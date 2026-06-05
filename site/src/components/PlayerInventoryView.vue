<template>
<div class="player-inventory-view" @dragenter.prevent="onDragEnter" @dragover.prevent @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">

    <!-- Parsing -->
    <div v-if="parsing" class="pi-loading">
        <span class="loading-spinner"></span>
        <p>{{ t('app_save_import_parsing') }}</p>
    </div>

    <template v-else>
        <!-- Error -->
        <div v-if="error" class="pi-error">
            <p class="pi-error-msg">{{ error }}</p>
            <button class="pi-btn" @click="$emit('dismissError')">{{ t('app_save_import_retry') }}</button>
        </div>

        <!-- Empty state: hero dropzone -->
        <div v-if="!parseResult" class="pi-empty">
            <div class="pi-dropzone" :class="{ 'pi-dragover': dragOver }">
                <span class="pi-corner pi-corner-tl"></span>
                <span class="pi-corner pi-corner-tr"></span>
                <span class="pi-corner pi-corner-bl"></span>
                <span class="pi-corner pi-corner-br"></span>
                <div class="pi-scanlines"></div>
                <LucideFileUp :size="42" class="pi-drop-icon" />
                <h2 class="pi-drop-title">{{ t('app_save_inv_title') }}</h2>
                <p class="pi-drop-sub">{{ t('app_save_inv_drop') }}</p>
                <label class="pi-browse-btn">
                    {{ t('app_save_import_browse') }}
                    <input type="file" accept=".scop,.scoc" multiple @change="onFileInput" style="display:none">
                </label>
                <p class="pi-drop-hint">{{ t('app_save_inv_hint') }}</p>
            </div>
        </div>

        <!-- Loaded -->
        <div v-else class="pi-loaded">
            <!-- Manifest header: summary strip + controls -->
            <div class="pi-header">
                <div class="pi-summary">
                    <div class="pi-summary-stat" v-if="parseResult.actor && parseResult.actor.name">
                        <span class="pi-summary-label">{{ t('app_save_inv_actor') }}</span>
                        <span class="pi-summary-value">{{ parseResult.actor.name }}</span>
                    </div>
                    <div class="pi-summary-stat" v-if="actorLevelName">
                        <span class="pi-summary-label">{{ t('app_save_inv_location') }}</span>
                        <span class="pi-summary-value">{{ actorLevelName }}</span>
                    </div>
                    <div class="pi-summary-stat">
                        <span class="pi-summary-label">{{ t('app_save_inv_total_items') }}</span>
                        <span class="pi-summary-value">{{ parseResult.totalItems }}</span>
                    </div>
                    <div class="pi-summary-stat">
                        <span class="pi-summary-label">{{ t('app_save_inv_stash_count') }}</span>
                        <span class="pi-summary-value">{{ parseResult.stashCount }}</span>
                    </div>
                    <div class="pi-summary-stat" v-if="carryWeight > 0">
                        <span class="pi-summary-label">{{ t('app_save_inv_weight') }}</span>
                        <span class="pi-summary-value">{{ carryWeight.toFixed(1) }} {{ t('unit_kg') }}</span>
                    </div>
                    <div class="pi-summary-file" :title="parseResult.fileName">{{ parseResult.fileName }}</div>
                    <div class="pi-summary-actions">
                        <label class="pi-btn">
                            <LucideUpload :size="13" />
                            <span>{{ t('app_save_inv_reimport') }}</span>
                            <input type="file" accept=".scop,.scoc" multiple @change="onFileInput" style="display:none">
                        </label>
                        <button class="pi-btn pi-btn-danger" @click="$emit('clearSave')">
                            <LucideTrash2 :size="13" />
                            <span>{{ t('app_save_inv_clear') }}</span>
                        </button>
                    </div>
                </div>

                <div class="pi-controls">
                    <div class="pi-search" v-click-outside="closeFilterPanel">
                        <LucideSearch :size="14" class="pi-search-icon" />
                        <input type="text" v-model="search" :placeholder="t('app_label_filter_placeholder')">
                        <button v-if="search" class="pi-search-clear" @click="search = ''">&times;</button>
                        <button class="filter-btn" @click.stop="filterPanelOpen = !filterPanelOpen" v-tooltip="t('app_label_filters')">
                            <LucideSlidersHorizontal :size="14" />
                            <span v-if="activeCategories.length > 0" class="filter-badge">{{ activeCategories.length }}</span>
                        </button>
                        <div class="filter-panel" v-show="filterPanelOpen" @click.stop>
                            <div class="filter-panel-header">
                                <span>{{ t('app_label_filters') }}</span>
                                <a v-if="activeCategories.length > 0" href="#" class="filter-clear" @click.prevent="activeCategories = []">{{ t('app_label_clear_all') }}</a>
                                <button class="filter-panel-close" @click="filterPanelOpen = false">&times;</button>
                            </div>
                            <div class="filter-group">
                                <div class="filter-group-label">{{ t('app_trading_filter_category') }}</div>
                                <div class="filter-chips">
                                    <button
                                        v-for="cat in presentCategories"
                                        :key="cat"
                                        class="filter-chip"
                                        :class="{ active: activeCategories.includes(cat) }"
                                        @click="toggleCategory(cat)"
                                    >{{ tCat(cat) }}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="pi-active-chips" v-if="activeCategories.length">
                        <button
                            v-for="cat in activeCategories"
                            :key="cat"
                            class="filter-chip"
                            @click="toggleCategory(cat)"
                        >{{ tCat(cat) }} &times;</button>
                    </div>
                </div>
            </div>

            <!-- Container panels -->
            <div class="pi-panels">
                <section v-for="panel in panels" :key="panel.key" class="pi-panel">
                    <header class="pi-panel-header" @click="togglePanel(panel.key)">
                        <component :is="collapsed[panel.key] ? 'LucideChevronRight' : 'LucideChevronDown'" :size="15" class="pi-panel-chevron" />
                        <LucidePackage v-if="panel.key !== 'actor'" :size="14" class="pi-panel-icon" />
                        <h3 class="pi-panel-title">{{ panel.title }}</h3>
                        <span v-if="panel.levelName" class="pi-panel-level"><LucideMapPin :size="11" /> {{ panel.levelName }}</span>
                        <span class="pi-panel-count">{{ panel.totalCount }}</span>
                    </header>
                    <div v-show="!collapsed[panel.key]" class="pi-panel-body">
                        <div v-if="panel.items.length === 0" class="pi-panel-empty">{{ t('app_label_no_results') }}</div>
                        <div v-else class="pi-icon-grid">
                            <button
                                v-for="item in panel.items"
                                :key="item.id"
                                class="pi-icon-cell"
                                :class="{ 'pi-icon-equipped': item._equipped }"
                                @click="$emit('navigateToItem', item.id)"
                                @mouseenter="$emit('showItemHover', item.id, $event)"
                                @mousemove="$emit('moveItemHover', $event)"
                                @mouseleave="$emit('hideItemHover')"
                            >
                                <img :src="'img/icons/' + item.id + '.png'" :alt="tItemName(item)" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
                                <span class="pi-icon-name">{{ tItemName(item) }}</span>
                                <span v-if="item._qty > 1" class="pi-qty">&times;{{ item._qty }}</span>
                                <span v-if="item._equipped" class="pi-equip" v-tooltip="t('app_save_inv_equipped')"></span>
                                <span v-if="showCondition(item)" class="pi-cond">
                                    <span class="pi-cond-fill" :class="conditionClass(item._cond)" :style="{ width: Math.round(item._cond * 100) + '%' }"></span>
                                </span>
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <!-- Drag overlay while a re-import drag is in progress -->
            <div v-if="dragOver" class="pi-drag-overlay">
                <LucideFileUp :size="36" />
                <p>{{ t('app_save_inv_drop') }}</p>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import { categorySlug } from '../../js/utils.js';

export default {
    props: {
        active: { type: Boolean, default: false },
        parseResult: { type: Object, default: null },
        parsing: { type: Boolean, default: false },
        error: { type: String, default: '' },
        index: { type: Array, default: () => [] },
        categoryItems: { type: Object, default: () => ({}) },
    },
    emits: [
        'parseSave', 'clearSave', 'dismissError',
        'navigateToItem',
        'showItemHover', 'moveItemHover', 'hideItemHover',
    ],
    inject: ['t', 'tCat', 'tItemName'],
    data() {
        return {
            search: '',
            activeCategories: [],
            filterPanelOpen: false,
            collapsed: {},
            dragOver: false,
            _dragDepth: 0,
            levelNames: {},
        };
    },
    computed: {
        indexById() {
            const map = new Map();
            for (const e of this.index) map.set(e.id, e);
            return map;
        },
        presentCategories() {
            if (!this.parseResult) return [];
            const cats = new Set();
            const collect = (items) => {
                for (const it of items) {
                    const entry = this.indexById.get(it.s);
                    if (entry) cats.add(entry.category);
                }
            };
            collect(this.parseResult.actorItems);
            for (const cont of this.parseResult.containers) collect(cont.items);
            return [...cats].sort();
        },
        actorLevelName() {
            return this.levelName(this.parseResult?.actor?.levelId);
        },
        carryWeight() {
            if (!this.parseResult) return 0;
            let total = 0;
            for (const it of this.parseResult.actorItems) {
                const full = this.resolveFull(it.s);
                const w = full ? parseFloat(full.st_prop_weight) : NaN;
                if (!isNaN(w)) total += w * it.q;
            }
            return total;
        },
        panels() {
            if (!this.parseResult) return [];
            const panels = [
                this.makePanel('actor', this.t('app_save_inv_actor_inventory'), this.parseResult.actor?.levelId, this.parseResult.actorItems),
            ];
            this.parseResult.containers.forEach((cont, i) => {
                const title = this.parseResult.containers.length > 1
                    ? `${this.t('app_save_inv_stash')} ${i + 1}`
                    : this.t('app_save_inv_stash');
                panels.push(this.makePanel(`stash-${cont.id}`, title, cont.levelId, cont.items));
            });
            return panels;
        },
    },
    mounted() {
        this.loadLevelNames();
    },
    methods: {
        async loadLevelNames() {
            try {
                const res = await fetch('/data/map-levels.json');
                if (!res.ok) return;
                const data = await res.json();
                const names = {};
                for (const level of data.levels || []) names[level.id] = level.name;
                this.levelNames = names;
            } catch { /* level names are cosmetic */ }
        },
        levelName(levelId) {
            if (!levelId) return '';
            return this.levelNames[levelId] || levelId;
        },
        resolveFull(sectionName) {
            const entry = this.indexById.get(sectionName);
            if (!entry) return null;
            const slug = categorySlug(entry.category);
            return (this.categoryItems[slug] || []).find(i => i.id === sectionName) || null;
        },
        makePanel(key, title, levelId, storedItems) {
            const items = [];
            const q = this.search.trim().toLowerCase();
            for (const st of storedItems) {
                const entry = this.indexById.get(st.s);
                const category = entry ? entry.category : null;
                if (this.activeCategories.length && !this.activeCategories.includes(category)) continue;
                const full = this.resolveFull(st.s);
                const display = full
                    ? { ...full, category }
                    : { id: st.s, name: entry?.name || st.s, displayName: entry?.displayName, category };
                if (q && !this.tItemName(display).toLowerCase().includes(q) && !st.s.includes(q)) continue;
                display._qty = st.q;
                display._cond = st.c;
                display._equipped = !!st.e;
                items.push(display);
            }
            // Equipped gear first, then group by category, then by name
            items.sort((a, b) =>
                (b._equipped - a._equipped) ||
                (a.category || '').localeCompare(b.category || '') ||
                this.tItemName(a).localeCompare(this.tItemName(b))
            );
            return {
                key, title,
                levelName: this.levelName(levelId),
                items,
                totalCount: storedItems.reduce((n, it) => n + it.q, 0),
            };
        },
        showCondition(item) {
            // Only meaningful for degradable gear; hide pristine/unknown values
            return item._cond >= 0 && item._cond < 0.995;
        },
        conditionClass(cond) {
            if (cond >= 0.7) return 'pi-cond-good';
            if (cond >= 0.4) return 'pi-cond-worn';
            return 'pi-cond-bad';
        },
        toggleCategory(cat) {
            const idx = this.activeCategories.indexOf(cat);
            if (idx >= 0) this.activeCategories.splice(idx, 1);
            else this.activeCategories.push(cat);
        },
        closeFilterPanel() {
            this.filterPanelOpen = false;
        },
        togglePanel(key) {
            this.collapsed[key] = !this.collapsed[key];
        },
        onFileInput(event) {
            const files = event.target?.files;
            if (files?.length) this.$emit('parseSave', files);
            event.target.value = '';
        },
        hasFiles(event) {
            return [...(event.dataTransfer?.types || [])].includes('Files');
        },
        onDragEnter(event) {
            if (!this.hasFiles(event)) return;
            this._dragDepth++;
            this.dragOver = true;
        },
        onDragLeave() {
            if (this._dragDepth > 0) this._dragDepth--;
            if (this._dragDepth === 0) this.dragOver = false;
        },
        onDrop(event) {
            this._dragDepth = 0;
            this.dragOver = false;
            const files = event.dataTransfer?.files;
            if (files?.length) this.$emit('parseSave', files);
        },
    },
};
</script>

<style scoped>
.player-inventory-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    position: relative;
    padding: 0 0.75rem 0.5rem 0;
}

/* ── Loading / error ───────────────────────────────────────── */
.pi-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex: 1;
    color: var(--text-secondary);
}

.pi-error {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid var(--color-red-muted);
    background: var(--color-red-tint-12);
    border-radius: 6px;
    padding: 0.6rem 0.9rem;
    margin-bottom: 0.75rem;
}

.pi-error-msg {
    margin: 0;
    flex: 1;
    color: var(--text);
    font-size: 0.85rem;
}

/* ── Empty state: manifest dropzone ────────────────────────── */
.pi-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
}

.pi-dropzone {
    position: relative;
    width: min(620px, 100%);
    padding: 3.5rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
    text-align: center;
    background: var(--card);
    border: 1px dashed var(--border);
    border-radius: 4px;
    transition: border-color 0.2s, background 0.2s;
    overflow: hidden;
}

.pi-dropzone.pi-dragover {
    border-color: var(--accent);
    background: var(--color-accent-tint-5);
}

.pi-corner {
    position: absolute;
    width: 22px;
    height: 22px;
    border: 2px solid var(--accent);
    opacity: 0.7;
    pointer-events: none;
}
.pi-corner-tl { top: 8px; left: 8px; border-right: none; border-bottom: none; }
.pi-corner-tr { top: 8px; right: 8px; border-left: none; border-bottom: none; }
.pi-corner-bl { bottom: 8px; left: 8px; border-right: none; border-top: none; }
.pi-corner-br { bottom: 8px; right: 8px; border-left: none; border-top: none; }

.pi-scanlines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
        0deg,
        transparent 0px,
        transparent 3px,
        var(--color-accent-tint-5) 3px,
        var(--color-accent-tint-5) 4px
    );
    opacity: 0.5;
}

.pi-drop-icon {
    color: var(--accent);
    opacity: 0.85;
}

.pi-drop-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text);
}

.pi-drop-sub {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.85rem;
}

.pi-drop-hint {
    margin: 0.4rem 0 0;
    color: var(--text-secondary);
    opacity: 0.75;
    font-size: 0.72rem;
}

.pi-browse-btn {
    margin-top: 0.5rem;
}

/* ── Buttons ──────────────────────────────────────────────── */
.pi-btn,
.pi-browse-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 4px;
    height: 1.75rem;
    padding: 0 0.7rem;
    font-size: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
}

.pi-btn:hover,
.pi-browse-btn:hover {
    color: var(--accent);
    border-color: var(--accent-dim);
}

.pi-btn-danger:hover {
    color: var(--color-red-soft);
    border-color: var(--color-red-muted);
}

/* ── Manifest header (summary + controls) ─────────────────── */
.pi-header {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: linear-gradient(180deg,
        var(--color-surface-3) 0%,
        color-mix(in srgb, var(--color-surface-3) 100%, black 8%) 100%);
    box-shadow: 0 4px 12px -8px color-mix(in srgb, black 80%, transparent);
    margin-bottom: 0.85rem;
}

.pi-header::before {
    content: "";
    display: block;
    height: 2px;
    border-radius: 6px 6px 0 0;
    background: linear-gradient(90deg,
        var(--color-accent-tint-35) 0%,
        var(--color-accent-tint-8) 45%,
        transparent 100%);
}

.pi-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0;
    padding: 0.6rem 0.9rem;
}

.pi-summary-stat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    padding-right: 1.4rem;
}

.pi-summary-stat + .pi-summary-stat {
    border-left: 1px solid var(--border);
    padding-left: 1.4rem;
}

.pi-summary-label {
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-secondary);
}

.pi-summary-value {
    font-family: var(--mono);
    font-size: 0.88rem;
    color: var(--accent);
    white-space: nowrap;
}

.pi-summary-file {
    margin-left: auto;
    font-size: 0.7rem;
    font-family: var(--mono);
    color: var(--text-secondary);
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 0.75rem;
}

.pi-summary-actions {
    display: flex;
    gap: 0.4rem;
}

/* ── Controls row ─────────────────────────────────────────── */
.pi-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding: 0.55rem 0.9rem;
    border-top: 1px solid var(--border);
}

/* Search input — mirrors the app's .filter-input-group pattern */
.pi-search {
    display: flex;
    align-items: center;
    flex: 0 1 14rem;
    max-width: 14rem;
    height: 1.75rem;
    background: var(--color-surface-1);
    border: 1px solid var(--color-bg);
    border-radius: 4px;
    box-shadow: inset 0 2px 4px var(--color-overlay-black-60);
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    position: relative;
}

.pi-search:hover {
    border-color: var(--accent-dim);
}

.pi-search:focus-within {
    border-color: var(--accent);
    background: var(--color-surface-2);
    box-shadow:
        inset 0 2px 4px var(--color-overlay-black-60),
        0 0 0 3px var(--color-accent-tint-20);
}

.pi-search-icon {
    flex-shrink: 0;
    margin-left: 0.5rem;
    color: var(--text-secondary);
    opacity: 0.5;
}

.pi-search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 0.5rem;
    background: transparent;
    border: none;
    color: var(--text);
    font-size: 0.75rem;
    outline: none;
}

.pi-search input::placeholder {
    color: var(--text-secondary);
}

.pi-search-clear {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
    padding: 0 0.35rem;
    flex-shrink: 0;
}

.pi-search-clear:hover {
    color: var(--text);
}

.pi-active-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    min-width: 0;
}

/* ── Container panels ─────────────────────────────────────── */
.pi-panels {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.pi-panel {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card);
    overflow: hidden;
}

.pi-panel-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid var(--border);
}

.pi-panel-header:hover .pi-panel-title {
    color: var(--accent);
}

.pi-panel-chevron,
.pi-panel-icon {
    color: var(--text-secondary);
    flex-shrink: 0;
}

.pi-panel-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text);
    transition: color 0.15s;
}

.pi-panel-level {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.7rem;
    color: var(--text-secondary);
}

.pi-panel-count {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--accent);
    background: var(--color-accent-tint-8);
    border: 1px solid var(--color-accent-tint-20);
    border-radius: 3px;
    padding: 0 0.4rem;
    line-height: 1.3rem;
}

.pi-panel-body {
    padding: 0.65rem;
}

.pi-panel-empty {
    color: var(--text-secondary);
    font-size: 0.8rem;
    text-align: center;
    padding: 0.75rem;
}

/* ── Icon grid ────────────────────────────────────────────── */
.pi-icon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 0.45rem;
}

.pi-icon-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    background: var(--color-surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.5rem 0.3rem 0.4rem;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s, background 0.15s;
}

.pi-icon-cell:hover {
    border-color: var(--accent-dim);
    background: var(--color-accent-tint-5);
}

.pi-icon-equipped {
    border-color: var(--color-accent-tint-35);
}

.pi-icon-cell img {
    height: 42px;
    max-width: 100%;
    object-fit: contain;
    image-rendering: pixelated;
}

.pi-icon-name {
    font-size: 0.64rem;
    line-height: 1.2;
    color: var(--text-secondary);
    text-align: center;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-word;
}

.pi-icon-cell:hover .pi-icon-name {
    color: var(--text);
}

.pi-qty {
    position: absolute;
    top: 3px;
    right: 3px;
    font-family: var(--mono);
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--accent);
    background: var(--color-accent-tint-12);
    border: 1px solid var(--color-accent-tint-20);
    border-radius: 3px;
    padding: 0 3px;
    line-height: 14px;
}

.pi-equip {
    position: absolute;
    top: 5px;
    left: 5px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 4px var(--accent);
}

.pi-cond {
    position: absolute;
    bottom: 2px;
    left: 6px;
    right: 6px;
    height: 2px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 1px;
    overflow: hidden;
}

.pi-cond-fill {
    display: block;
    height: 100%;
    border-radius: 1px;
}

.pi-cond-good { background: var(--color-green-positive); }
.pi-cond-worn { background: var(--accent); }
.pi-cond-bad { background: var(--color-red-soft); }

/* ── Drag overlay ─────────────────────────────────────────── */
.pi-drag-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background: rgba(0, 0, 0, 0.65);
    color: var(--accent);
    pointer-events: none;
    font-family: var(--font-display);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-size: 0.9rem;
}

@media (max-width: 720px) {
    .pi-summary-file { display: none; }
    .pi-search { flex-basis: 100%; max-width: none; }
}
</style>
