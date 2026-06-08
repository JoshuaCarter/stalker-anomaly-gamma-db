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
                <div class="pi-drop-divider">{{ t('app_save_inv_or') }}</div>
                <button class="pi-btn" @click="$emit('startBlank')">
                    <LucidePlus :size="13" />
                    <span>{{ t('app_save_inv_start_blank') }}</span>
                </button>
            </div>
        </div>

        <!-- Loaded -->
        <div v-else class="pi-loaded" :style="{ '--pi-insp-w': inspWidthCss }">
            <!-- Scrollable manifest column (header + container panels) -->
            <div class="pi-scroll">
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
                        <div v-if="parseResult.fileName" class="pi-summary-file" :title="parseResult.fileName">{{ parseResult.fileName }}</div>
                        <div class="pi-summary-actions" :class="{ 'pi-actions-grow': !parseResult.fileName }">
                            <button v-if="parseResult.manual" class="pi-btn pi-btn-accent" @click="addPickerOpen = true">
                                <LucidePlus :size="13" />
                                <span>{{ t('app_save_inv_add_items') }}</span>
                            </button>
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
                        <div class="sort-wrap" v-click-outside="closeSortMenu">
                            <button class="sort-btn" @click.stop="sortMenuOpen = !sortMenuOpen" v-tooltip="t('app_label_sort')">
                                <LucideArrowUpDown :size="14" />
                                <span class="sort-btn-label">{{ sortModeLabel }}</span>
                            </button>
                            <div class="sort-menu" v-show="sortMenuOpen" @click.stop>
                                <div class="sort-menu-header">{{ t('app_label_sort_by') }}</div>
                                <button
                                    v-for="m in sortModes"
                                    :key="m.key"
                                    class="sort-menu-item"
                                    :class="{ active: sortMode === m.key }"
                                    @click="setSortMode(m.key)"
                                >
                                    <span class="sort-menu-check">{{ sortMode === m.key ? '✓' : '' }}</span>
                                    <span>{{ m.label }}</span>
                                </button>
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
                                <a
                                    v-for="item in panel.items"
                                    :key="item.id"
                                    :href="itemHref(item.id)"
                                    class="pi-icon-cell"
                                    :class="{ 'pi-icon-equipped': item._equipped, 'pi-icon-selected': selectedIds.has(item.id) }"
                                    draggable="true"
                                    @click.prevent="onCellClick(item, $event)"
                                    @dragstart="onCellDragStart(item, $event)"
                                    @dragend="loadoutDragItem = null"
                                    @mouseenter="onCellEnter(item, $event)"
                                    @mousemove="onCellMove($event)"
                                    @mouseleave="$emit('hideItemHover')"
                                >
                                    <img :src="'img/icons/' + item.id + '.png'" :alt="tItemName(item)" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
                                    <span class="pi-icon-name">{{ tItemName(item) }}</span>
                                    <span v-if="item._qty > 1" class="pi-qty">&times;{{ item._qty }}</span>
                                    <span v-if="item._equipped" class="pi-equip" v-tooltip="t('app_save_inv_equipped')"></span>
                                    <LucideWrench v-if="item._wbTick && !item._equipped" :size="10" class="pi-wb-tick" v-tooltip="t('app_save_inv_wb_ready_ingredient')" />
                                    <span v-if="parseResult.manual" class="pi-cell-edit">
                                        <button class="pi-cell-btn" @click.stop.prevent="$emit('adjustItem', item.id, $event.shiftKey ? -10 : -1)">&minus;</button>
                                        <button class="pi-cell-btn" @click.stop.prevent="$emit('adjustItem', item.id, $event.shiftKey ? 10 : 1)">+</button>
                                    </span>
                                    <span v-if="showCondition(item)" class="pi-cond">
                                        <span class="pi-cond-fill" :class="conditionClass(item._cond)" :style="{ width: Math.round(item._cond * 100) + '%' }"></span>
                                    </span>
                                </a>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <!-- Multi-select action bar -->
            <div v-if="selectedIds.size" class="pi-select-bar">
                <span class="pi-select-count">{{ selectedIds.size }} {{ t('app_save_inv_selected') }}</span>
                <button
                    class="pi-btn"
                    :disabled="selectedWeaponIds.length === 0"
                    v-tooltip="selectedWeaponIds.length > 5 ? t('app_save_inv_ballistics_max') : null"
                    @click="openBallistics"
                >
                    <LucideCrosshair :size="13" />
                    <span>{{ t('app_nav_damage_sim') }}</span>
                    <span v-if="selectedWeaponIds.length" class="pi-wb-count">{{ selectedWeaponIds.length }}</span>
                </button>
                <button class="pi-btn" @click="clearSelection">
                    <LucideX :size="13" />
                    <span>{{ t('app_save_inv_clear_selection') }}</span>
                </button>
            </div>

            <!-- Docked inspector panel; opens to the left of the icon rail -->
            <aside v-if="railPanels.length" class="pi-inspector" :class="{ 'pi-insp-open': activeDrawer }">
                <div class="pi-insp-inner">
                    <div class="pi-insp-head">
                        <component v-if="activeRailPanel" :is="activeRailPanel.icon" :size="14" class="pi-insp-head-icon" />
                        <h3 class="pi-insp-title">{{ activeRailPanel ? activeRailPanel.label : '' }}</h3>
                        <button
                            class="pi-insp-size"
                            v-tooltip="inspWidth === '50' ? t('app_save_inv_panel_shrink') : t('app_save_inv_panel_expand')"
                            @click="toggleInspWidth"
                        >
                            <component :is="inspWidth === '50' ? 'LucideChevronsRight' : 'LucideChevronsLeft'" :size="14" />
                        </button>
                        <button class="pi-insp-close" @click="activeDrawer = null">&times;</button>
                    </div>
                    <div class="pi-insp-body">
                        <LoadoutDrawer
                            v-show="activeDrawer === 'loadout'"
                            :open="activeDrawer === 'loadout'"
                            :actor-items="parseResult.actorItems"
                            :index-by-id="indexById"
                            :resolve-full="resolveFull"
                            :drag-item="loadoutDragItem"
                            @close="activeDrawer = null"
                            @show-item-hover="(id, event) => $emit('showItemHover', id, event, null)"
                            @move-item-hover="$emit('moveItemHover', $event)"
                            @hide-item-hover="$emit('hideItemHover')"
                        />
                        <WorkbenchDrawer
                            v-show="activeDrawer === 'workbench'"
                            :open="activeDrawer === 'workbench'"
                            :recipes="workbenchRecipes"
                            :kits="workbenchKits"
                            :scope="workbenchScope"
                            @close="activeDrawer = null"
                            @set-scope="setWorkbenchScope"
                            @navigate-to-item="$emit('navigateToItem', $event)"
                            @open-recipe-tree="openRecipeTree"
                            @show-item-hover="(id, event) => $emit('showItemHover', id, event, null)"
                            @move-item-hover="$emit('moveItemHover', $event)"
                            @hide-item-hover="$emit('hideItemHover')"
                        />
                        <StatsDrawer
                            v-show="activeDrawer === 'stats'"
                            :open="activeDrawer === 'stats'"
                            :stats="parseResult.stats"
                            :level-names="levelNames"
                            @close="activeDrawer = null"
                        />
                    </div>
                </div>
            </aside>

            <!-- Icon activity rail: pinned to the right screen edge -->
            <div v-if="railPanels.length" class="pi-rail">
                <button
                    v-for="p in railPanels"
                    :key="p.key"
                    class="pi-rail-btn"
                    :class="{ active: activeDrawer === p.key }"
                    v-tooltip="p.label"
                    @click="toggleDrawer(p.key)"
                >
                    <component :is="p.icon" :size="16" />
                    <span v-if="p.badge" class="pi-rail-badge">{{ p.badge }}</span>
                </button>
            </div>

            <!-- Manual mode: add-items picker (check items, then Add) -->
            <ItemPickerModal
                :open="addPickerOpen"
                :title="t('app_save_inv_add_items')"
                :placeholder="t('app_label_filter_placeholder')"
                :empty-text="t('app_label_no_results')"
                :items="pickerItems"
                :label-fn="(item) => tItemName(item)"
                @close="closeAddPicker"
                @select="togglePickerChecked"
            >
                <template #item="{ item }">
                    <span class="pi-picker-check" :class="{ 'pi-picker-checked': addPickerChecked.has(item.id) }">✓</span>
                    <img class="pi-picker-icon" :src="'img/icons/' + item.id + '.png'" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
                    <span class="build-picker-item-name">{{ tItemName(item) }}</span>
                    <span v-if="actorQty(item.id)" class="pi-picker-qty">&times;{{ actorQty(item.id) }}</span>
                    <span class="build-picker-item-type">{{ tCat(item.category) }}</span>
                </template>
                <template #footer>
                    <span class="pi-picker-count">{{ addPickerChecked.size }} {{ t('app_save_inv_selected') }}</span>
                    <button class="pi-btn" @click="closeAddPicker">{{ t('app_label_cancel') }}</button>
                    <button class="pi-btn pi-btn-accent" :disabled="addPickerChecked.size === 0" @click="confirmAddItems">{{ t('app_label_add') }}</button>
                </template>
            </ItemPickerModal>

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
import LoadoutDrawer from './LoadoutDrawer.vue';
import WorkbenchDrawer from './WorkbenchDrawer.vue';
import StatsDrawer from './StatsDrawer.vue';
import ItemPickerModal from './modals/ItemPickerModal.vue';

/** Weapon categories the damage simulator can compare. */
const SIM_WEAPON_CATEGORIES = new Set(['Pistols', 'SMGs', 'Shotguns', 'Rifles', 'Snipers']);

/** Toolkit item section required for each craft-recipe toolTier. */
const TIER_KITS = {
    1: 'itm_basickit',
    2: 'itm_advancedkit',
    3: 'itm_expertkit',
    4: 'itm_drugkit',
    5: 'itm_ammokit',
    6: 'itm_artefactskit',
};

export default {
    components: { LoadoutDrawer, WorkbenchDrawer, StatsDrawer, ItemPickerModal },
    props: {
        active: { type: Boolean, default: false },
        parseResult: { type: Object, default: null },
        parsing: { type: Boolean, default: false },
        error: { type: String, default: '' },
        index: { type: Array, default: () => [] },
        categoryItems: { type: Object, default: () => ({}) },
        craftRecipes: { type: Object, default: null },
        packId: { type: String, default: '' },
    },
    emits: [
        'parseSave', 'clearSave', 'dismissError',
        'startBlank', 'adjustItem',
        'navigateToItem',
        'showItemHover', 'moveItemHover', 'hideItemHover',
        'ensureCraftRecipes', 'openCraftingRecipe', 'openBallistics',
    ],
    inject: ['t', 'tCat', 'tItemName', 'itemHref', 'headerLabel'],
    data() {
        let sortMode = 'default';
        try {
            const stored = localStorage.getItem('playerInventorySort');
            if (['name', 'weight', 'qty'].includes(stored)) sortMode = stored;
        } catch { /* private mode */ }
        let workbenchScope = 'all';
        try {
            if (localStorage.getItem('workbenchScope') === 'carried') workbenchScope = 'carried';
        } catch { /* private mode */ }
        let inspWidth = '33';
        try {
            if (localStorage.getItem('inventoryInspectorWidth') === '50') inspWidth = '50';
        } catch { /* private mode */ }
        return {
            search: '',
            activeCategories: [],
            filterPanelOpen: false,
            sortMode,
            sortMenuOpen: false,
            collapsed: {},
            dragOver: false,
            _dragDepth: 0,
            levelNames: {},
            activeDrawer: null,
            workbenchScope,
            inspWidth,
            selectedIds: new Set(),
            ctrlHeld: false,
            // Inventory cell being dragged toward the loadout panel
            loadoutDragItem: null,
            addPickerOpen: false,
            addPickerChecked: new Set(),
            // Universal section → { name, price } map (covers items outside the DB index)
            itemsCommon: {},
            _itemsCommonPack: null,
        };
    },
    watch: {
        craftDataWanted: {
            immediate: true,
            handler(wanted) {
                if (wanted) this.$emit('ensureCraftRecipes');
            },
        },
        workbenchDataWanted: {
            immediate: true,
            handler(wanted) {
                if (wanted) this.loadItemsCommon();
            },
        },
        packId() {
            this._itemsCommonPack = null;
            this.itemsCommon = {};
            if (this.workbenchDataWanted) this.loadItemsCommon();
        },
    },
    computed: {
        indexById() {
            const map = new Map();
            for (const e of this.index) map.set(e.id, e);
            return map;
        },
        indexByName() {
            // Translation key → index entry (recipe ingredients reference keys, not section ids).
            // items-common.json fills in sections the DB index doesn't cover (devices, outfit parts…).
            const map = new Map();
            for (const e of this.index) {
                if (e.name && !map.has(e.name)) map.set(e.name, e);
                if (e.displayName && !map.has(e.displayName)) map.set(e.displayName, e);
            }
            for (const [id, info] of Object.entries(this.itemsCommon)) {
                if (info && info.name && !map.has(info.name)) map.set(info.name, { id, name: info.name });
            }
            return map;
        },
        craftDataWanted() {
            return this.active && !!this.parseResult && !this.craftRecipes;
        },
        workbenchDataWanted() {
            return this.active && !!this.parseResult;
        },
        hasStats() {
            return !!this.parseResult?.stats;
        },
        workbenchCounts() {
            // Owned quantity per item section, within the selected scope
            const counts = new Map();
            if (!this.parseResult) return counts;
            const add = (items) => {
                for (const it of items) counts.set(it.s, (counts.get(it.s) || 0) + it.q);
            };
            add(this.parseResult.actorItems);
            if (this.workbenchScope === 'all') {
                for (const cont of this.parseResult.containers) add(cont.items);
            }
            return counts;
        },
        workbenchKits() {
            return Object.entries(TIER_KITS).map(([tier, id]) => ({
                tier: Number(tier),
                id,
                have: this.workbenchCounts.has(id),
            }));
        },
        workbenchRecipes() {
            if (!this.craftRecipes || !this.parseResult) return [];
            const counts = this.workbenchCounts;
            const recipes = [];
            for (const [cat, catData] of Object.entries(this.craftRecipes)) {
                for (const r of catData.items || []) {
                    if (!r.ingredients || r.ingredients.length === 0) continue;
                    let totalNeed = 0;
                    let totalHave = 0;
                    const ingredients = r.ingredients.map(ing => {
                        const entry = this.indexByName.get(ing.name);
                        const need = parseInt(String(ing.amount).replace(/^x/i, ''), 10) || 1;
                        const have = entry ? (counts.get(entry.id) || 0) : 0;
                        totalNeed += need;
                        totalHave += Math.min(have, need);
                        return {
                            key: ing.name,
                            id: entry ? entry.id : null,
                            inDb: !!entry && this.indexById.has(entry.id),
                            need,
                            have,
                        };
                    });
                    recipes.push({
                        id: r.id,
                        nameKey: r.pda_encyclopedia_name,
                        craftCategory: cat,
                        tier: r.toolTier,
                        kitId: TIER_KITS[r.toolTier] || null,
                        kitHave: counts.has(TIER_KITS[r.toolTier]),
                        ingredients,
                        completion: totalNeed > 0 ? totalHave / totalNeed : 0,
                        ready: ingredients.every(i => i.have >= i.need),
                        inIndex: this.indexById.has(r.id),
                    });
                }
            }
            return recipes;
        },
        workbenchReadyCount() {
            return this.workbenchRecipes.reduce((n, r) => n + (r.ready ? 1 : 0), 0);
        },
        railPanels() {
            // Activity-rail registry — future panels are one more entry here
            const panels = [];
            panels.push({
                key: 'loadout',
                icon: 'LucideBackpack',
                label: this.t('app_build_loadout'),
                badge: 0,
            });
            if (this.workbenchRecipes.length) {
                panels.push({
                    key: 'workbench',
                    icon: 'LucideWrench',
                    label: this.t('app_save_inv_workbench'),
                    badge: this.workbenchReadyCount,
                });
            }
            if (this.hasStats) {
                panels.push({
                    key: 'stats',
                    icon: 'LucideChartColumn',
                    label: this.t('app_save_inv_stats'),
                    badge: 0,
                });
            }
            return panels;
        },
        activeRailPanel() {
            return this.railPanels.find(p => p.key === this.activeDrawer) || null;
        },
        inspWidthCss() {
            // Never narrower than 380px regardless of percentage choice
            return this.inspWidth === '50' ? 'max(380px, 50%)' : 'max(380px, 33%)';
        },
        workbenchReadyIngredientIds() {
            const ids = new Set();
            for (const r of this.workbenchRecipes) {
                if (!r.ready) continue;
                for (const ing of r.ingredients) {
                    if (ing.id) ids.add(ing.id);
                }
            }
            return ids;
        },
        pickerItems() {
            return [...this.index].sort((a, b) => this.tItemName(a).localeCompare(this.tItemName(b)));
        },
        actorItemCounts() {
            const counts = new Map();
            for (const it of this.parseResult?.actorItems || []) {
                counts.set(it.s, (counts.get(it.s) || 0) + it.q);
            }
            return counts;
        },
        selectedWeaponIds() {
            const ids = [];
            for (const id of this.selectedIds) {
                const entry = this.indexById.get(id);
                if (entry && SIM_WEAPON_CATEGORIES.has(entry.category)) ids.push(id);
            }
            return ids;
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
        sortModes() {
            return [
                { key: 'default', label: this.t('app_save_inv_sort_default') },
                { key: 'name', label: this.headerLabel('pda_encyclopedia_name') },
                { key: 'weight', label: this.headerLabel('st_prop_weight') },
                { key: 'qty', label: this.t('app_save_inv_quantity') },
            ];
        },
        sortModeLabel() {
            return this.sortModes.find(m => m.key === this.sortMode)?.label || '';
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
        window.addEventListener('keydown', this.onWindowKeydown);
        window.addEventListener('keyup', this.onWindowKeyup);
        window.addEventListener('blur', this.onWindowBlur);
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.onWindowKeydown);
        window.removeEventListener('keyup', this.onWindowKeyup);
        window.removeEventListener('blur', this.onWindowBlur);
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
                display._wbTick = this.workbenchReadyIngredientIds.has(st.s);
                const unitWeight = parseFloat(display.st_prop_weight);
                display._stackWeight = isNaN(unitWeight) ? -1 : unitWeight * st.q;
                items.push(display);
            }
            const byName = (a, b) => this.tItemName(a).localeCompare(this.tItemName(b));
            if (this.sortMode === 'name') {
                items.sort(byName);
            } else if (this.sortMode === 'weight') {
                items.sort((a, b) => (b._stackWeight - a._stackWeight) || byName(a, b));
            } else if (this.sortMode === 'qty') {
                items.sort((a, b) => (b._qty - a._qty) || byName(a, b));
            } else {
                // Default: equipped gear first, then group by category, then by name
                items.sort((a, b) =>
                    (b._equipped - a._equipped) ||
                    (a.category || '').localeCompare(b.category || '') ||
                    byName(a, b)
                );
            }
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
        setSortMode(mode) {
            this.sortMode = mode;
            this.sortMenuOpen = false;
            try { localStorage.setItem('playerInventorySort', mode); } catch { /* private mode */ }
        },
        closeSortMenu() {
            this.sortMenuOpen = false;
        },
        onWindowKeydown(e) {
            if (e.key === 'Control' || e.key === 'Meta') {
                this.ctrlHeld = true;
                // Hover popover is suppressed while ctrl is held (multi-select mode)
                this.$emit('hideItemHover');
            } else if (e.key === 'Escape' && this.selectedIds.size) {
                this.clearSelection();
            }
        },
        onWindowKeyup(e) {
            if (e.key === 'Control' || e.key === 'Meta') this.ctrlHeld = false;
        },
        onWindowBlur() {
            this.ctrlHeld = false;
        },
        onCellClick(item, event) {
            if (event.ctrlKey || event.metaKey) {
                this.toggleSelected(item.id);
                return;
            }
            this.$emit('navigateToItem', item.id);
        },
        onCellEnter(item, event) {
            if (this.ctrlHeld || event.ctrlKey || event.metaKey) return;
            this.$emit('showItemHover', item.id, event, this.hoverExtrasFor(item));
        },
        onCellDragStart(item, event) {
            this.loadoutDragItem = { id: item.id, category: item.category };
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('text/plain', item.id);
            this.$emit('hideItemHover');
        },
        onCellMove(event) {
            if (this.ctrlHeld) return;
            this.$emit('moveItemHover', event);
        },
        toggleSelected(id) {
            if (this.selectedIds.has(id)) this.selectedIds.delete(id);
            else this.selectedIds.add(id);
        },
        clearSelection() {
            this.selectedIds.clear();
        },
        openBallistics() {
            if (this.selectedWeaponIds.length === 0) return;
            // The sim caps loadouts at 5, but gets the full selection so its picker can swap among them
            this.$emit('openBallistics', this.selectedWeaponIds);
        },
        async loadItemsCommon() {
            if (!this.packId || this._itemsCommonPack === this.packId) return;
            this._itemsCommonPack = this.packId;
            try {
                const res = await fetch(`/data/${this.packId}/items-common.json`);
                if (!res.ok) return;
                const data = await res.json();
                if (data && typeof data === 'object') this.itemsCommon = data;
            } catch { /* optional file — ingredient matching falls back to the index */ }
        },
        actorQty(id) {
            return this.actorItemCounts.get(id) || 0;
        },
        togglePickerChecked(item) {
            if (this.addPickerChecked.has(item.id)) this.addPickerChecked.delete(item.id);
            else this.addPickerChecked.add(item.id);
        },
        closeAddPicker() {
            this.addPickerOpen = false;
            this.addPickerChecked.clear();
        },
        confirmAddItems() {
            for (const id of this.addPickerChecked) {
                this.$emit('adjustItem', id, 1);
            }
            this.closeAddPicker();
        },
        toggleDrawer(name) {
            this.activeDrawer = this.activeDrawer === name ? null : name;
        },
        toggleInspWidth() {
            this.inspWidth = this.inspWidth === '50' ? '33' : '50';
            try { localStorage.setItem('inventoryInspectorWidth', this.inspWidth); } catch { /* private mode */ }
        },
        setWorkbenchScope(scope) {
            this.workbenchScope = scope;
            try { localStorage.setItem('workbenchScope', scope); } catch { /* private mode */ }
        },
        openRecipeTree(recipe) {
            this.activeDrawer = null;
            this.$emit('openCraftingRecipe', {
                id: recipe.id,
                craftCategory: recipe.craftCategory,
                displayName: this.t(recipe.nameKey),
            });
        },
        hoverExtrasFor(item) {
            const rows = [];
            if (item._qty > 1) {
                rows.push({ label: this.t('app_save_inv_quantity'), value: `×${item._qty}` });
            }
            const unitWeight = parseFloat(item.st_prop_weight);
            if (!isNaN(unitWeight)) {
                const kg = this.t('unit_kg');
                const value = item._qty > 1
                    ? `${item._qty} × ${unitWeight} = ${(unitWeight * item._qty).toFixed(1)} ${kg}`
                    : `${unitWeight} ${kg}`;
                rows.push({ label: this.headerLabel('st_prop_weight'), value });
            }
            if (item._cond >= 0 && item._cond < 0.995) {
                rows.push({ label: this.t('app_save_inv_condition'), value: `${Math.round(item._cond * 100)}%` });
            }
            if (item._equipped) {
                rows.push({ label: this.t('app_save_inv_equipped'), value: '✓' });
            }
            return rows.length ? { rows } : null;
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
}

/* ── Loaded layout: manifest + docked inspector + icon rail ── */
.pi-loaded {
    --pi-rail-w: 2.6rem; /* activity-rail gutter width */
    --pi-insp-w: max(380px, 33%); /* docked inspector width; overridden inline by the 33%/50% toggle */
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.pi-scroll {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
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
    margin: 0 0.75rem 0.75rem 0;
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

.pi-drop-divider {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: min(260px, 100%);
    margin-top: 0.5rem;
    font-size: 0.66rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-secondary);
    opacity: 0.7;
}

.pi-drop-divider::before,
.pi-drop-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--border);
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

/* Count badge (used in the selection action bar) */
.pi-wb-count {
    font-family: var(--mono);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--accent);
    background: var(--color-accent-tint-12);
    border: 1px solid var(--color-accent-tint-20);
    border-radius: 3px;
    padding: 0 4px;
    line-height: 1.1rem;
}

/* ── Icon activity rail ───────────────────────────────────── */
.pi-rail {
    flex-shrink: 0;
    width: var(--pi-rail-w);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
    padding-top: 0.4rem;
    border-left: 1px solid var(--border);
    background: var(--color-surface-3);
}

.pi-rail-btn {
    position: relative;
    height: 2.4rem;
    display: grid;
    place-items: center;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
}

.pi-rail-btn:hover {
    color: var(--text);
    background: var(--color-overlay-white-6);
}

.pi-rail-btn.active {
    color: var(--accent);
    background: var(--color-accent-tint-12);
}

/* Edge indicator on the panel-facing side (activity-bar convention) */
.pi-rail-btn.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 2px;
    border-radius: 1px;
    background: var(--accent);
}

.pi-rail-badge {
    position: absolute;
    top: 3px;
    right: 4px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 0.56rem;
    font-weight: 600;
    color: var(--color-bg);
    background: var(--color-green-positive);
    border-radius: 7px;
    line-height: 1;
}

/* ── Docked inspector (single side panel) ─────────────────── */
.pi-inspector {
    flex-shrink: 0;
    width: 0;
    overflow: hidden;
    border-left: 0 solid var(--border);
    background: var(--color-surface-1);
    transition: width 0.25s ease, border-left-width 0.25s ease;
}

.pi-insp-open {
    width: var(--pi-insp-w);
    border-left-width: 1px;
}

/* min-width keeps content from squishing mid-animation */
.pi-insp-inner {
    width: 100%;
    min-width: 360px;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.pi-insp-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.9rem 0.55rem;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, var(--color-accent-tint-8), transparent);
}

.pi-insp-head-icon {
    color: var(--accent);
    flex-shrink: 0;
}

.pi-insp-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text);
}

/* Width toggle: cycles the docked panel between 33% and 50% */
.pi-insp-size {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0 0.3rem;
    transition: color 0.15s;
}

.pi-insp-size:hover {
    color: var(--text);
}

.pi-insp-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    padding: 0 0.2rem;
}

.pi-insp-close:hover {
    color: var(--text);
}

.pi-insp-body {
    flex: 1;
    min-height: 0;
}

/* Below split-view width the inspector falls back to an overlay
   (still clearing the rail so its buttons stay reachable) */
@media (max-width: 900px) {
    .pi-inspector {
        position: absolute;
        top: 0;
        right: var(--pi-rail-w);
        bottom: 0;
        width: min(440px, calc(100% - var(--pi-rail-w))); /* width toggle is desktop-only */
        border-left-width: 1px;
        box-shadow: -18px 0 40px -20px var(--color-black);
        transform: translateX(102%);
        visibility: hidden;
        transition: transform 0.25s ease, visibility 0s linear 0.25s;
        z-index: 150;
    }

    .pi-insp-open {
        transform: none;
        visibility: visible;
        transition: transform 0.25s ease;
    }

    .pi-insp-inner {
        width: 100%;
        min-width: 0;
    }

    /* Width toggle has no effect in overlay mode */
    .pi-insp-size {
        display: none;
    }

    .pi-insp-close {
        margin-left: auto;
    }
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

/* When no filename is shown, push actions to the right edge */
.pi-actions-grow {
    margin-left: auto;
}

.pi-btn-accent {
    color: var(--accent);
    border-color: var(--color-accent-tint-35);
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
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, background 0.15s;
}

.pi-icon-cell:hover {
    border-color: var(--accent-dim);
    background: var(--color-accent-tint-5);
}

.pi-icon-equipped {
    border-color: var(--color-accent-tint-35);
}

.pi-icon-selected,
.pi-icon-selected:hover {
    border-color: var(--accent);
    background: var(--color-accent-tint-12);
    box-shadow: 0 0 0 1px var(--accent);
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

/* ── Manual mode: cell quantity steppers ──────────────────── */
.pi-cell-edit {
    position: absolute;
    inset: auto 0 0 0;
    display: flex;
    opacity: 0;
    transition: opacity 0.12s;
}

.pi-icon-cell:hover .pi-cell-edit {
    opacity: 1;
}

.pi-cell-btn {
    flex: 1;
    background: var(--color-overlay-black-60, rgba(0, 0, 0, 0.6));
    border: none;
    border-top: 1px solid var(--border);
    color: var(--text);
    font-family: var(--mono);
    font-size: 0.78rem;
    line-height: 1.1rem;
    cursor: pointer;
    padding: 0;
}

.pi-cell-btn:first-child {
    border-right: 1px solid var(--border);
}

.pi-cell-btn:hover {
    color: var(--accent);
    background: var(--color-accent-tint-12);
}

/* ── Add-items picker rows ────────────────────────────────── */
.pi-picker-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: 3px;
    background: var(--color-surface-1);
    color: transparent;
    font-size: 11px;
    line-height: 1;
    transition: border-color 0.12s, background 0.12s, color 0.12s;
}

.pi-picker-checked {
    border-color: var(--accent);
    background: var(--color-accent-tint-20);
    color: var(--accent);
}

.pi-picker-count {
    margin-right: auto;
    font-family: var(--mono);
    font-size: 0.74rem;
    color: var(--accent);
}

.pi-picker-icon {
    height: 24px;
    width: 36px;
    object-fit: contain;
    image-rendering: pixelated;
    flex-shrink: 0;
}

.pi-picker-qty {
    font-family: var(--mono);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--accent);
    background: var(--color-accent-tint-12);
    border: 1px solid var(--color-accent-tint-20);
    border-radius: 3px;
    padding: 0 4px;
    line-height: 1rem;
}

/* Marks items that are components of a fully craftable recipe */
.pi-wb-tick {
    position: absolute;
    top: 4px;
    left: 4px;
    color: var(--color-green-positive);
    opacity: 0.9;
    filter: drop-shadow(0 0 3px var(--color-green-tint-30));
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

/* ── Multi-select action bar ──────────────────────────────── */
.pi-select-bar {
    position: fixed;
    bottom: 1.1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: var(--color-surface-3);
    border: 1px solid var(--color-accent-tint-35);
    border-radius: 6px;
    padding: 0.4rem 0.7rem;
    box-shadow: 0 8px 24px -8px var(--color-black);
    animation: pi-bar-rise 0.2s ease;
}

@keyframes pi-bar-rise {
    from { opacity: 0; transform: translate(-50%, 8px); }
}

.pi-select-count {
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--accent);
    white-space: nowrap;
}

.pi-btn:disabled {
    opacity: 0.45;
    cursor: default;
}

.pi-btn:disabled:hover {
    color: var(--text);
    border-color: var(--border);
}

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
