<template>
<div v-if="startingLoadoutsActive && startingLoadoutsData" class="loadout-view">
    <!-- Slim toolbar: segmented difficulty + budget summary (no progress track) -->
    <div class="loadout-bar">
        <div class="loadout-diffs">
            <button
                v-for="(pts, i) in startingLoadoutsData.points"
                :key="i"
                class="loadout-diff-btn"
                :class="{ active: startingLoadoutsDifficulty === i }"
                @click="selectDifficulty(i)"
            >
                <span class="loadout-diff-name">{{ difficultyLabel(i) }}</span>
                <span class="loadout-diff-pts">{{ pts.toLocaleString() }}</span>
            </button>
        </div>
        <div class="loadout-bar-sum">
            <span class="loadout-bar-spent" :class="{ over: remainingPoints < 0 }">{{ selectedCost.toLocaleString() }} / {{ pointBudget.toLocaleString() }} {{ t('app_loadout_points') }}</span>
            <span class="loadout-bar-sep">&middot;</span>
            <span class="loadout-bar-money">{{ activeFaction.money.toLocaleString() }} &#8381;</span>
            <button class="loadout-bar-clear" @click.stop="clearAll()" :title="t('app_loadout_clear')"><LucideTrash2 :size="14" /></button>
        </div>
    </div>

    <!-- Faction chips -->
    <div class="exchange-faction-chips">
        <button
            v-for="faction in startingLoadoutsData.factions"
            :key="faction.id"
            class="exchange-chip"
            :class="{ active: activeFactionId === faction.id }"
            @click="$emit('update:startingLoadoutsFaction', faction.id)"
        >
            <img
                v-if="factionIcon(faction.id)"
                :src="'/img/' + factionIcon(faction.id)"
                :alt="faction.id"
                class="exchange-chip-icon"
            >
            <span>{{ t(faction.id) }}</span>
        </button>
    </div>

    <!-- Scrollable content -->
    <div class="loadout-scroll">

        <!-- Purchasable items -->
        <div v-if="allSelectableItems.length" class="loadout-section">
            <div class="loadout-section-header static">
                <span>{{ t('app_loadout_purchasable') }}</span>
                <span class="loadout-section-count">{{ allSelectableItems.length }}</span>
                <span class="loadout-section-actions">
                    <a href="#" @click.prevent.stop="selectAll()">{{ t('app_loadout_select_all') }}</a>
                    <a href="#" @click.prevent.stop="clearAll()">{{ t('app_loadout_clear') }}</a>
                </span>
            </div>
            <InventoryTray>
                <div class="loadout-field">
                    <InventoryTile
                        v-for="item in allSelectableItems"
                        :key="'p-' + item.id"
                        :icon-id="item.id"
                        :name="itemName(item.id)"
                        :cost="item.cost"
                        :qty="getQty(item.id)"
                        :capacity="item.quantity"
                        :spent="getQty(item.id) > 0"
                        :selected="getQty(item.id) > 0"
                        :dim="getQty(item.id) === 0 && remainingPoints < item.cost"
                        :clickable="!!indexById[item.id]"
                        selectable
                        @cycle="cycleItem(item)"
                        @navigate="$emit('navigateToItem', item.id)"
                        @hover-enter="$emit('showItemHover', item.id, $event)"
                        @hover-move="$emit('moveItemHover', $event)"
                        @hover-leave="$emit('hideItemHover')"
                    >
                        <template v-if="item.difficultyLock === 1 || item.difficultyLock === 2" #corner>
                            <span v-if="item.difficultyLock === 1" class="loadout-lock" :title="t('app_loadout_stalker_veteran_only')">TS</span>
                            <span v-else class="loadout-lock lock-hard" :title="t('app_loadout_stalker_only')">T</span>
                        </template>
                    </InventoryTile>
                </div>
            </InventoryTray>
        </div>

        <!-- Included ammo -->
        <div v-if="ammoEntries.length" class="loadout-section">
            <div class="loadout-section-header static">
                <span>{{ t('app_loadout_included_ammo') }}</span>
                <span class="loadout-section-count">{{ ammoEntries.length }}</span>
            </div>
            <div class="loadout-item-grid">
                <div
                    v-for="entry in ammoEntries"
                    :key="'a-' + entry.weaponId"
                    class="loadout-item loadout-ammo-row"
                >
                    <span
                        class="loadout-item-name"
                        :class="{ clickable: indexById[entry.weaponId] }"
                        @click.stop="indexById[entry.weaponId] && $emit('navigateToItem', entry.weaponId)"
                        @mouseenter="indexById[entry.weaponId] && $emit('showItemHover', entry.weaponId, $event)"
                        @mousemove="indexById[entry.weaponId] && $emit('moveItemHover', $event)"
                        @mouseleave="$emit('hideItemHover')"
                    >{{ itemName(entry.weaponId) }}</span>
                    <svg class="loadout-ammo-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    <span
                        class="loadout-ammo-name"
                        :class="{ clickable: indexById[entry.ammoId] }"
                        @click.stop="indexById[entry.ammoId] && $emit('navigateToItem', entry.ammoId)"
                        @mouseenter="indexById[entry.ammoId] && $emit('showItemHover', entry.ammoId, $event)"
                        @mousemove="indexById[entry.ammoId] && $emit('moveItemHover', $event)"
                        @mouseleave="$emit('hideItemHover')"
                    >{{ itemName(entry.ammoId) }}</span>
                    <span class="loadout-qty">&times;{{ entry.quantity }}</span>
                </div>
            </div>
        </div>

        <!-- Free items -->
        <div v-if="allFreeItems.length" class="loadout-section">
            <div class="loadout-section-header static">
                <span>{{ t('app_loadout_free_items') }}</span>
                <span class="loadout-section-count">{{ allFreeItems.length }}</span>
            </div>
            <InventoryTray>
                <div class="loadout-field">
                    <InventoryTile
                        v-for="item in allFreeItems"
                        :key="'f-' + item.id"
                        :icon-id="item.id"
                        :name="itemName(item.id)"
                        :qty="item.quantity"
                        :clickable="!!indexById[item.id]"
                        @navigate="$emit('navigateToItem', item.id)"
                        @hover-enter="$emit('showItemHover', item.id, $event)"
                        @hover-move="$emit('moveItemHover', $event)"
                        @hover-leave="$emit('hideItemHover')"
                    />
                </div>
            </InventoryTray>
        </div>
    </div>
</div>
</template>

<script>
import { CAT } from "../../js/constants.js";
import InventoryTray from "./InventoryTray.vue";
import InventoryTile from "./InventoryTile.vue";

/** Explicit display order. Weapons (by class), then armor, then meds, then food;
 *  anything not listed falls into "other" at the end. Items tie-break by name. */
const CATEGORY_ORDER = [
    // Weapons — heaviest/longest-range first, sidearms then launchers and melee
    CAT.RIFLES, CAT.SNIPERS, CAT.SMGS, CAT.SHOTGUNS, CAT.PISTOLS,
    CAT.LAUNCHERS, CAT.GRENADE_LAUNCHERS, CAT.MELEE,
    // Armor
    CAT.OUTFITS, CAT.HELMETS,
    // Consumables
    CAT.MEDICINE, CAT.FOOD,
];

export default {
    name: "StartingLoadoutsView",
    components: { InventoryTray, InventoryTile },
    inject: ["t", "factionIcon"],
    props: {
        startingLoadoutsActive: Boolean,
        startingLoadoutsData: { type: Object, default: null },
        startingLoadoutsFaction: { type: String, default: null },
        startingLoadoutsDifficulty: { type: Number, default: 0 },
        packId: { type: String, default: "" },
        indexById: { type: Object, default: () => ({}) },
    },
    emits: ["update:startingLoadoutsFaction", "update:startingLoadoutsDifficulty", "navigateToItem", "showItemHover", "moveItemHover", "hideItemHover"],
    data() {
        return {
            // { [factionId]: { [itemId]: selectedQty } }
            selectedItems: {},
        };
    },
    computed: {
        activeFactionId() {
            if (this.startingLoadoutsFaction) return this.startingLoadoutsFaction;
            return this.startingLoadoutsData?.factions?.[0]?.id || null;
        },
        activeFaction() {
            if (!this.startingLoadoutsData) return null;
            return this.startingLoadoutsData.factions.find(f => f.id === this.activeFactionId)
                || this.startingLoadoutsData.factions[0];
        },
        currentSelections() {
            return this.selectedItems[this.activeFactionId] || {};
        },
        sharedIds() {
            if (!this.startingLoadoutsData) return new Set();
            return new Set(this.startingLoadoutsData.shared.map(i => i.id));
        },
        allVisibleItems() {
            if (!this.startingLoadoutsData || !this.activeFaction) return [];
            const shared = this.filterByDifficulty(this.startingLoadoutsData.shared);
            const factionOnly = this.filterByDifficulty(
                this.activeFaction.items.filter(i => !this.sharedIds.has(i.id))
            );
            return [
                ...shared.map(i => ({ ...i, isFactionOnly: false })),
                ...factionOnly.map(i => ({ ...i, isFactionOnly: true })),
            ];
        },
        allFreeItems() {
            return this.allVisibleItems.filter(i => !i.selectable).sort((a, b) => this.compareByCategory(a, b));
        },
        allSelectableItems() {
            return this.allVisibleItems.filter(i => i.selectable).sort((a, b) => this.compareByCategory(a, b));
        },
        selectedCost() {
            const sel = this.currentSelections;
            let cost = 0;
            for (const item of this.allSelectableItems) {
                const qty = sel[item.id] || 0;
                if (qty > 0) cost += item.cost * qty;
            }
            return cost;
        },
        pointBudget() {
            return this.startingLoadoutsData?.points?.[this.startingLoadoutsDifficulty] || 0;
        },
        remainingPoints() {
            return this.pointBudget - this.selectedCost;
        },
        ammoEntries() {
            if (!this.startingLoadoutsData || !this.activeFaction) return [];
            const { ammoPerWeapon, ammoCount } = this.startingLoadoutsData;
            if (!ammoPerWeapon || !ammoCount) return [];
            const sel = this.currentSelections;
            const entries = [];
            const seen = new Set();
            for (const item of this.allVisibleItems) {
                if (item.selectable && !(sel[item.id] > 0)) continue;
                const ammoId = ammoPerWeapon[item.id];
                if (ammoId && !seen.has(item.id)) {
                    seen.add(item.id);
                    entries.push({
                        weaponId: item.id,
                        ammoId,
                        quantity: ammoCount[ammoId] || 0,
                    });
                }
            }
            return entries;
        },
    },
    watch: {
        activeFactionId: {
            immediate: true,
            handler(id) {
                if (id && !(id in this.selectedItems)) {
                    this.loadSelections(id);
                }
            },
        },
        // Restore the saved difficulty once the data (and its points array) is available
        startingLoadoutsData: {
            immediate: true,
            handler(data) {
                if (!data || this._difficultyRestored) return;
                this._difficultyRestored = true;
                try {
                    const stored = parseInt(localStorage.getItem("loadoutDifficulty"), 10);
                    const max = (data.points?.length || 1) - 1;
                    if (!isNaN(stored) && stored >= 0 && stored <= max && stored !== this.startingLoadoutsDifficulty) {
                        this.$emit("update:startingLoadoutsDifficulty", stored);
                    }
                } catch { /* private mode */ }
            },
        },
    },
    created() {
        // Non-reactive guard so the difficulty is only restored from storage once
        this._difficultyRestored = false;
    },
    methods: {
        categoryRank(id) {
            const cat = this.indexById[id]?.category;
            const i = CATEGORY_ORDER.indexOf(cat);
            return i === -1 ? CATEGORY_ORDER.length : i;
        },
        compareByCategory(a, b) {
            return (this.categoryRank(a.id) - this.categoryRank(b.id))
                || this.itemName(a.id).localeCompare(this.itemName(b.id));
        },
        selectDifficulty(i) {
            try { localStorage.setItem("loadoutDifficulty", String(i)); } catch { /* private mode */ }
            this.$emit("update:startingLoadoutsDifficulty", i);
        },
        difficultyLabel(index) {
            const keys = ["app_loadout_difficulty_stalker", "app_loadout_difficulty_veteran", "app_loadout_difficulty_master"];
            return this.t(keys[index]) || ["Stalker", "Veteran", "Master"][index];
        },
        itemName(id) {
            const entry = this.indexById[id];
            if (entry?.name) return this.t(entry.name);
            if (entry?.displayName) return this.t(entry.displayName);
            const translated = this.t(id);
            if (translated && translated !== id) return translated;
            return id;
        },
        filterByDifficulty(items) {
            const d = this.startingLoadoutsDifficulty;
            return items.filter(item =>
                item.difficultyLock === null || d <= (2 - item.difficultyLock)
            );
        },
        getQty(id) {
            return this.currentSelections[id] || 0;
        },
        setQty(id, qty) {
            const fid = this.activeFactionId;
            const sel = { ...(this.selectedItems[fid] || {}) };
            if (qty <= 0) delete sel[id];
            else sel[id] = qty;
            this.selectedItems = { ...this.selectedItems, [fid]: sel };
            this.saveSelections(fid);
        },
        // Click-to-cycle: each click bumps the count, wrapping max → 0.
        // If the next unit is unaffordable, clicking clears the item (treated as the wrap).
        cycleItem(item) {
            const current = this.getQty(item.id);
            let next = current + 1;
            if (next > item.quantity || this.remainingPoints < item.cost) next = 0;
            this.setQty(item.id, next);
        },
        selectAll() {
            const fid = this.activeFactionId;
            const sel = { ...(this.selectedItems[fid] || {}) };
            for (const item of this.allSelectableItems) sel[item.id] = item.quantity;
            this.selectedItems = { ...this.selectedItems, [fid]: sel };
            this.saveSelections(fid);
        },
        clearAll() {
            const fid = this.activeFactionId;
            this.selectedItems = { ...this.selectedItems, [fid]: {} };
            this.saveSelections(fid);
        },
        storageKey(fid) {
            return `loadoutSelections:${this.packId || "default"}:${fid}`;
        },
        saveSelections(fid) {
            try {
                const sel = this.selectedItems[fid];
                if (!sel || !Object.keys(sel).length) {
                    localStorage.removeItem(this.storageKey(fid));
                } else {
                    localStorage.setItem(this.storageKey(fid), JSON.stringify(sel));
                }
            } catch { /* quota or private mode */ }
        },
        loadSelections(fid) {
            try {
                const raw = localStorage.getItem(this.storageKey(fid));
                if (raw) {
                    this.selectedItems = { ...this.selectedItems, [fid]: JSON.parse(raw) };
                } else {
                    this.selectedItems = { ...this.selectedItems, [fid]: {} };
                }
            } catch {
                this.selectedItems = { ...this.selectedItems, [fid]: {} };
            }
        },
    },
};
</script>

<style scoped>
.loadout-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding-right: calc(1rem + 8px);
    gap: 0.5rem;
}

/* Slim toolbar: discrete difficulty buttons + budget summary, one borderless row */
.loadout-bar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-shrink: 0;
    flex-wrap: wrap;
}

/* Difficulty: separate buttons (not a stretched segmented control) */
.loadout-diffs {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
}

.loadout-diff-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.7rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text-secondary);
    font-family: var(--font-display);
    font-size: 0.72rem;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.loadout-diff-btn:hover {
    color: var(--text);
    border-color: var(--accent-dim);
}

.loadout-diff-btn.active {
    color: var(--accent);
    border-color: var(--accent-dim);
    background: var(--color-accent-tint-8);
}

.loadout-diff-name { font-weight: 600; letter-spacing: 0.03em; }

.loadout-diff-pts {
    font-family: var(--mono);
    font-size: 0.66rem;
    opacity: 0.6;
}

.loadout-diff-btn.active .loadout-diff-pts { opacity: 0.9; }

/* Budget summary — pushed to the right, no progress track */
.loadout-bar-sum {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    white-space: nowrap;
}

.loadout-bar-spent {
    font-family: var(--mono);
    font-size: 0.68rem;
    color: var(--text-secondary);
}

/* Reachable by switching to a lower-budget difficulty while items are picked */
.loadout-bar-spent.over {
    color: var(--color-red);
    font-weight: 600;
}

.loadout-bar-money {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--color-accent-light);
}

.loadout-bar-sep { color: var(--color-border-strong); }

.loadout-bar-clear {
    display: grid;
    place-items: center;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0 0.2rem;
    border-radius: 4px;
    transition: color 0.15s;
}

.loadout-bar-clear:hover { color: var(--color-red); }

/* Scrollable area */
.loadout-scroll {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-bottom: 1rem;
    /* Breathing room between the item trays and the scrollbar */
    padding-right: 0.6rem;
}

/* Sections */
.loadout-section {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
}

.loadout-section-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.5rem;
    color: var(--accent);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--accent-dim);
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
    cursor: default;
    text-align: left;
}

.loadout-section-count {
    font-size: 0.6rem;
    font-weight: 400;
    color: var(--text-secondary);
    background: var(--border);
    padding: 0 0.35rem;
    border-radius: 3px;
    font-family: var(--mono);
}

.loadout-section-actions {
    margin-left: auto;
    display: flex;
    gap: 0.5rem;
    font-size: 0.6rem;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
}

.loadout-section-actions a {
    color: var(--accent-dim);
    text-decoration: none;
}

.loadout-section-actions a:hover {
    color: var(--accent);
    text-decoration: underline;
}

/* Item grid (ammo rows still use this) */
.loadout-item-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.25rem;
    padding: 0.35rem 0;
}

/* Item field inside an InventoryTray (purchasable + free items).
   Denser than the old card grid — items pack together on the tray. */
.loadout-field {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 0.35rem 0.2rem;
}

/* Item row */
.loadout-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.7rem;
    transition: background 0.1s;
}

.loadout-item:hover {
    background: var(--color-accent-tint-5);
}

.loadout-item.selected {
    background: var(--color-accent-tint-8);
}

.loadout-item.selected:hover {
    background: var(--color-accent-tint-10);
}


.loadout-item-name {
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
}

.loadout-item-name.clickable {
    color: var(--accent);
    cursor: pointer;
}

.loadout-item-name.clickable:hover {
    text-decoration: underline;
}

.loadout-qty {
    font-family: var(--mono);
    font-size: 0.6rem;
    color: var(--text-secondary);
    flex-shrink: 0;
}

.loadout-cost {
    font-family: var(--mono);
    font-size: 0.6rem;
    color: var(--text-secondary);
    flex-shrink: 0;
    transition: color 0.15s;
}

.loadout-item.selected .loadout-cost {
    color: var(--color-accent-orange);
}

.loadout-lock {
    font-family: var(--mono);
    font-size: 0.55rem;
    font-weight: 600;
    color: var(--color-blue-soft);
    background: var(--color-blue-tint-15);
    padding: 0 0.25rem;
    border-radius: 2px;
    flex-shrink: 0;
    letter-spacing: 0.02em;
}

.loadout-lock.lock-hard {
    color: var(--color-red-warm-soft);
    background: var(--color-red-tint-15);
}

/* Ammo rows */
.loadout-ammo-row {
    grid-column: 1 / -1;
}

.loadout-ammo-arrow {
    flex-shrink: 0;
    color: var(--text-secondary);
    opacity: 0.5;
}

.loadout-ammo-name {
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}

.loadout-ammo-name.clickable {
    color: var(--accent);
    cursor: pointer;
}

.loadout-ammo-name.clickable:hover {
    text-decoration: underline;
}

.loadout-ammo-row .loadout-item-name {
    flex: 0 1 auto;
    max-width: 40%;
}

.loadout-ammo-row .loadout-ammo-name {
    flex: 1;
}

/* Responsive */
@media (max-width: 640px) {
    .loadout-view {
        padding-right: 0.5rem;
    }

    /* Toolbar stacks: segmented difficulty on top, summary strip beneath */
    .loadout-bar {
        flex-direction: column;
    }

    .loadout-bar-sum {
        justify-content: space-between;
        padding: 0.15rem 0.3rem;
    }

    .loadout-item-grid {
        grid-template-columns: 1fr;
    }
}
</style>
