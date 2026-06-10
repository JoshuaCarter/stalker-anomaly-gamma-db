<template>
<div class="wb-drawer">
    <!-- Toolkit ownership strip — click a kit to mark it owned (kits found in the
         save are locked on; the override only fills in ones you didn't import) -->
    <div class="wb-kits">
        <button
            v-for="kit in kits"
            :key="kit.tier"
            type="button"
            class="wb-kit"
            :class="[kit.have ? 'wb-kit-have' : 'wb-kit-lack', { 'wb-kit-manual': kit.owned && !kit.detected, 'wb-kit-locked': kit.detected }]"
            :disabled="kit.detected"
            v-tooltip="kit.detected
                ? t('app_craft_toolkit_' + kit.tier)
                : t('app_craft_toolkit_' + kit.tier) + ' — ' + t('app_save_inv_wb_own_toolkit')"
            @click="$emit('toggleKit', kit.id)"
        >
            <img :src="'img/icons/' + kit.id + '.png'" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
            <span class="wb-kit-mark">{{ kit.have ? '✓' : '✗' }}</span>
        </button>
    </div>

    <div class="wb-controls">
        <div class="wb-search">
            <LucideSearch :size="13" class="wb-search-icon" />
            <input type="text" v-model="search" :placeholder="t('app_save_inv_wb_filter')">
            <button v-if="search" class="wb-search-clear" @click="search = ''">&times;</button>
        </div>
        <div class="wb-scope">
            <button :class="{ active: scope === 'carried' }" @click="$emit('setScope', 'carried')">{{ t('app_save_inv_wb_carried') }}</button>
            <button :class="{ active: scope === 'all' }" @click="$emit('setScope', 'all')">{{ t('app_save_inv_wb_with_stashes') }}</button>
        </div>
    </div>

    <!-- Category filter chips -->
    <div class="wb-cats filter-chips">
        <button
            v-for="cat in presentCategories"
            :key="cat"
            class="filter-chip"
            :class="{ active: activeCategories.includes(cat) }"
            @click="toggleCategory(cat)"
        >{{ t('app_craft_chip_' + cat) }}</button>
    </div>

    <div class="wb-body">
        <template v-for="group in groups" :key="group.key">
            <template v-if="group.recipes.length">
                <div class="wb-section" :class="'wb-section-' + group.key">
                    <span>{{ group.label }}</span>
                    <span class="wb-section-n">{{ group.recipes.length }}</span>
                </div>
                <div v-for="r in group.recipes" :key="r.id" class="wb-recipe">
                    <div
                        class="wb-recipe-row"
                        @click="toggleExpand(r.id)"
                        @mouseenter="r.inIndex && $emit('showItemHover', r.id, $event)"
                        @mousemove="r.inIndex && $emit('moveItemHover', $event)"
                        @mouseleave="r.inIndex && $emit('hideItemHover')"
                    >
                        <img :src="'img/icons/' + r.id + '.png'" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
                        <span class="wb-recipe-name">{{ t(r.nameKey) }}</span>
                        <span
                            v-if="r.kitId"
                            class="wb-tier"
                            :class="r.kitHave ? 'wb-tier-have' : 'wb-tier-lack'"
                            v-tooltip="t('app_craft_toolkit_' + r.tier)"
                        >
                            <img :src="'img/icons/' + r.kitId + '.png'" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
                            <span>{{ r.kitHave ? '✓' : '✗' }}</span>
                        </span>
                        <span class="wb-pct" :class="pctClass(r)">{{ pct(r) }}%</span>
                        <button
                            class="wb-track"
                            :class="{ 'wb-track-on': tracked.has(r.id) }"
                            v-tooltip="t('app_save_inv_wb_track')"
                            @click.stop="toggleTrack(r.id)"
                        >
                            <LucidePin :size="12" />
                        </button>
                    </div>
                    <div class="wb-bar"><div class="wb-bar-fill" :class="fillClass(r)" :style="{ width: pct(r) + '%' }"></div></div>
                    <div v-if="expanded.has(r.id)" class="wb-checklist">
                        <div v-for="ing in r.ingredients" :key="ing.key" class="wb-check" :class="ing.have >= ing.need ? 'wb-check-have' : 'wb-check-lack'">
                            <span class="wb-check-mark">{{ ing.have >= ing.need ? '✓' : '✗' }}</span>
                            <img v-if="ing.id" :src="'img/icons/' + ing.id + '.png'" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
                            <a
                                v-if="ing.inDb"
                                href="#"
                                class="wb-check-name"
                                @click.prevent.stop="$emit('navigateToItem', ing.id)"
                            >{{ t(ing.key) }}</a>
                            <span v-else class="wb-check-name">{{ t(ing.key) }}</span>
                            <span class="wb-check-count">{{ Math.min(ing.have, ing.need) }}/{{ ing.need }}</span>
                            <span v-if="ing.have < ing.need" class="wb-check-need">{{ t('app_save_inv_wb_need') }} {{ ing.need - ing.have }}</span>
                        </div>
                        <div class="wb-foot">
                            <a href="#" @click.prevent="$emit('openRecipeTree', r)">{{ t('app_save_inv_wb_view_tree') }} →</a>
                        </div>
                    </div>
                </div>
            </template>
        </template>
        <div v-if="!filtered.length" class="wb-empty">{{ t('app_label_no_results') }}</div>
    </div>
</div>
</template>

<script>
export default {
    props: {
        open: { type: Boolean, default: false },
        recipes: { type: Array, default: () => [] },
        kits: { type: Array, default: () => [] },
        scope: { type: String, default: 'all' },
    },
    emits: ['close', 'setScope', 'toggleKit', 'navigateToItem', 'openRecipeTree', 'showItemHover', 'moveItemHover', 'hideItemHover'],
    inject: ['t'],
    data() {
        let activeCategories = [];
        let tracked = [];
        try {
            const stored = JSON.parse(localStorage.getItem('workbenchCategories'));
            if (Array.isArray(stored)) activeCategories = stored.filter(c => typeof c === 'string');
        } catch { /* private mode / corrupt value */ }
        try {
            const stored = JSON.parse(localStorage.getItem('workbenchTracked'));
            if (Array.isArray(stored)) tracked = stored.filter(id => typeof id === 'string');
        } catch { /* private mode / corrupt value */ }
        return {
            search: '',
            activeCategories,
            tracked: new Set(tracked),
            expanded: new Set(),
        };
    },
    computed: {
        presentCategories() {
            const cats = [];
            for (const r of this.recipes) {
                if (!cats.includes(r.craftCategory)) cats.push(r.craftCategory);
            }
            return cats;
        },
        filtered() {
            // Ignore stored categories the current pack doesn't have — their chips aren't
            // rendered, so they would otherwise filter invisibly.
            const active = this.activeCategories.filter(c => this.presentCategories.includes(c));
            const q = this.search.trim().toLowerCase();
            return this.recipes.filter(r =>
                (active.length === 0 || active.includes(r.craftCategory)) &&
                (!q || this.t(r.nameKey).toLowerCase().includes(q) || r.id.includes(q))
            );
        },
        groups() {
            const tracked = [], ready = [], close = [], far = [];
            for (const r of this.filtered) {
                if (this.tracked.has(r.id)) tracked.push(r);
                else if (r.ready) ready.push(r);
                else if (r.completion >= 0.5 && r.kitOk) close.push(r);
                else far.push(r);
            }
            const byName = (a, b) => this.t(a.nameKey).localeCompare(this.t(b.nameKey));
            const byCompletion = (a, b) => (b.completion - a.completion) || byName(a, b);
            tracked.sort(byCompletion);
            ready.sort(byName);
            close.sort(byCompletion);
            far.sort(byCompletion);
            return [
                { key: 'tracked', label: this.t('app_save_inv_wb_tracked'), recipes: tracked },
                { key: 'ready', label: this.t('app_save_inv_wb_ready'), recipes: ready },
                { key: 'close', label: this.t('app_save_inv_wb_close'), recipes: close },
                { key: 'far', label: this.t('app_save_inv_wb_far'), recipes: far },
            ];
        },
    },
    mounted() {
        window.addEventListener('keydown', this.onKeydown);
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.onKeydown);
    },
    methods: {
        pct(r) {
            return r.ready ? 100 : Math.floor(r.completion * 100);
        },
        pctClass(r) {
            if (r.ready) return 'wb-pct-ok';
            return r.completion >= 0.5 ? 'wb-pct-mid' : 'wb-pct-low';
        },
        fillClass(r) {
            if (r.ready) return 'wb-fill-ready';
            return r.completion >= 0.5 ? 'wb-fill-close' : 'wb-fill-far';
        },
        toggleTrack(id) {
            if (this.tracked.has(id)) this.tracked.delete(id);
            else this.tracked.add(id);
            try { localStorage.setItem('workbenchTracked', JSON.stringify([...this.tracked])); } catch { /* private mode */ }
        },
        toggleExpand(id) {
            if (this.expanded.has(id)) this.expanded.delete(id);
            else this.expanded.add(id);
        },
        toggleCategory(cat) {
            const idx = this.activeCategories.indexOf(cat);
            if (idx >= 0) this.activeCategories.splice(idx, 1);
            else this.activeCategories.push(cat);
            try { localStorage.setItem('workbenchCategories', JSON.stringify(this.activeCategories)); } catch { /* private mode */ }
        },
        onKeydown(e) {
            if (e.key === 'Escape' && this.open) this.$emit('close');
        },
    },
};
</script>

<style scoped>
/* Panel content only — the inspector shell in PlayerInventoryView
   owns positioning, tabs and the close button. */
.wb-drawer {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-surface-1);
}

.wb-drawer img {
    image-rendering: pixelated;
    object-fit: contain;
    flex-shrink: 0;
}

/* ── Toolkit strip ────────────────────────────────────────── */
.wb-kits {
    display: flex;
    gap: 0.4rem;
    padding: 0.55rem 0.9rem;
    border-bottom: 1px solid var(--border);
}

.wb-kit {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    background: var(--color-surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.3rem 0.2rem 0.25rem;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: border-color 0.15s, opacity 0.15s;
}

.wb-kit:hover:not(:disabled) {
    border-color: var(--accent-dim);
}

/* Kits imported from the save are owned for real — not user-toggleable */
.wb-kit-locked {
    cursor: default;
}

.wb-kit img {
    height: 20px;
    width: 30px;
}

.wb-kit-mark {
    font-family: var(--mono);
    font-size: 0.6rem;
    font-weight: 600;
}

.wb-kit-have {
    border-color: var(--color-green-tint-30);
}

.wb-kit-have .wb-kit-mark {
    color: var(--color-green-positive);
}

.wb-kit-lack {
    opacity: 0.45;
}

.wb-kit-lack:hover {
    opacity: 0.8;
}

.wb-kit-lack .wb-kit-mark {
    color: var(--color-red-soft);
}

/* Manually marked as owned (vs. detected from the save) — accent, not green */
.wb-kit-manual {
    border-color: var(--color-accent-tint-35);
}

.wb-kit-manual .wb-kit-mark {
    color: var(--accent);
}

/* ── Controls ─────────────────────────────────────────────── */
.wb-controls {
    display: flex;
    gap: 0.45rem;
    padding: 0.55rem 0.9rem;
    border-bottom: 1px solid var(--border);
}

.wb-search {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
    height: 1.7rem;
    background: var(--color-surface-2);
    border: 1px solid var(--color-bg);
    border-radius: 4px;
    box-shadow: inset 0 2px 4px var(--color-overlay-black-60);
    transition: border-color 0.15s;
}

.wb-search:focus-within {
    border-color: var(--accent);
}

.wb-search-icon {
    flex-shrink: 0;
    margin-left: 0.45rem;
    color: var(--text-secondary);
    opacity: 0.5;
}

.wb-search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 0.45rem;
    background: transparent;
    border: none;
    color: var(--text);
    font-size: 0.72rem;
    outline: none;
}

.wb-search input::placeholder {
    color: var(--text-secondary);
}

.wb-search-clear {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.85rem;
    line-height: 1;
    padding: 0 0.3rem;
    flex-shrink: 0;
}

.wb-scope {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
}

.wb-scope button {
    background: var(--color-surface-2);
    border: none;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.66rem;
    padding: 0 0.55rem;
    cursor: pointer;
}

.wb-scope button.active {
    background: var(--color-accent-tint-12);
    color: var(--accent);
}

/* ── Category chips ───────────────────────────────────────── */
.wb-cats {
    padding: 0.5rem 0.9rem;
    border-bottom: 1px solid var(--border);
}

.wb-cats .filter-chip {
    padding: 0.14rem 0.45rem;
    font-size: 0.66rem;
}

/* ── Body / sections ──────────────────────────────────────── */
.wb-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.6rem 0.9rem 1rem;
}

.wb-section {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin: 0.65rem 0 0.45rem;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.wb-section::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--border);
}

.wb-section-n {
    font-family: var(--mono);
    color: var(--text-secondary);
    font-weight: 400;
}

.wb-section-tracked { color: var(--color-blue-soft); }
.wb-section-ready { color: var(--color-green-positive); }
.wb-section-close { color: var(--accent); }
.wb-section-far { color: var(--text-secondary); }

/* ── Recipe rows ──────────────────────────────────────────── */
.wb-recipe {
    background: var(--color-surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    margin-bottom: 0.4rem;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.15s;
}

.wb-recipe:hover {
    border-color: var(--accent-dim);
}

.wb-recipe-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.45rem 0.6rem;
}

.wb-recipe-row > img {
    height: 26px;
    width: 38px;
}

.wb-recipe-name {
    font-size: 0.74rem;
    font-weight: 600;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text);
}

.wb-tier {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-family: var(--mono);
    font-size: 0.62rem;
    font-weight: 600;
    background: var(--color-accent-tint-8);
    border: 1px solid var(--color-accent-tint-20);
    border-radius: 3px;
    padding: 1px 5px;
    flex-shrink: 0;
}

.wb-tier img {
    height: 13px;
    width: 18px;
}

.wb-tier-have { color: var(--color-green-positive); }
.wb-tier-lack { color: var(--color-red-soft); }

.wb-pct {
    font-family: var(--mono);
    font-size: 0.68rem;
    flex-shrink: 0;
}

.wb-pct-ok { color: var(--color-green-positive); }
.wb-pct-mid { color: var(--accent); }
.wb-pct-low { color: var(--text-secondary); }

.wb-track {
    display: inline-flex;
    align-items: center;
    background: none;
    border: none;
    padding: 0.1rem;
    margin: -0.1rem 0;
    color: var(--text-secondary);
    opacity: 0.35;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.15s, color 0.15s;
}

.wb-recipe-row:hover .wb-track {
    opacity: 0.8;
}

.wb-track:hover {
    color: var(--text);
    opacity: 1;
}

.wb-track-on,
.wb-recipe-row:hover .wb-track-on,
.wb-track-on:hover {
    color: var(--color-blue-soft);
    opacity: 1;
}

.wb-track-on :deep(svg) {
    fill: currentColor;
}

.wb-bar {
    height: 3px;
    background: var(--color-overlay-white-6);
}

.wb-bar-fill {
    height: 100%;
    transition: width 0.4s ease;
}

.wb-fill-ready { background: var(--color-green-positive); }
.wb-fill-close { background: var(--accent); }
.wb-fill-far { background: var(--text-secondary); opacity: 0.5; }

/* ── Ingredient checklist ─────────────────────────────────── */
.wb-checklist {
    border-top: 1px solid var(--border);
    padding: 0.45rem 0.6rem 0.55rem;
    background: var(--color-surface-1);
    cursor: default;
}

.wb-check {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.7rem;
    padding: 0.22rem 0;
    font-family: var(--mono);
}

.wb-check img {
    height: 18px;
    width: 26px;
}

.wb-check-mark {
    width: 1em;
    text-align: center;
}

.wb-check-have .wb-check-mark { color: var(--color-green-positive); }
.wb-check-lack .wb-check-mark { color: var(--color-red-soft); }

.wb-check-name {
    flex: 1;
    min-width: 0;
    font-family: var(--font-display);
    color: var(--text);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

a.wb-check-name:hover {
    color: var(--accent);
}

.wb-check-lack a.wb-check-name {
    color: var(--color-red-soft);
    text-decoration: underline dotted;
    text-underline-offset: 3px;
}

.wb-check-lack a.wb-check-name:hover {
    color: var(--color-red-light);
}

.wb-check-count {
    color: var(--text-secondary);
    flex-shrink: 0;
}

.wb-check-have .wb-check-count {
    color: var(--color-green-positive);
}

.wb-check-need {
    color: var(--color-red-soft);
    font-size: 0.64rem;
    flex-shrink: 0;
}

.wb-foot {
    margin-top: 0.35rem;
    padding-top: 0.4rem;
    border-top: 1px dashed var(--border);
    display: flex;
    justify-content: flex-end;
    font-size: 0.64rem;
}

.wb-foot a {
    color: var(--accent);
    text-decoration: none;
}

.wb-foot a:hover {
    text-decoration: underline;
}

.wb-empty {
    color: var(--text-secondary);
    font-size: 0.78rem;
    text-align: center;
    padding: 1rem 0;
}
</style>
