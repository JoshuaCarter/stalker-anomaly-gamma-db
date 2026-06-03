<template>
<div v-if="active && drops" class="fa-view" :style="themeVars">
    <!-- Faction chips -->
    <div class="exchange-faction-chips">
        <button
            v-for="f in factions"
            :key="f.id"
            class="exchange-chip"
            :class="{ active: f.id === activeFactionId }"
            @click="$emit('update:faction', f.id)"
        >
            <img v-if="f.icon" :src="'/img/' + f.icon" :alt="f.id" class="exchange-chip-icon">
            <span>{{ t(f.id) }}</span>
        </button>
    </div>

    <div class="fa-scroll">
        <!-- Dossier header -->
        <section class="fa-dossier">
            <img v-if="activeFaction.icon" class="fa-emblem" :src="'/img/' + activeFaction.icon" :alt="activeFactionId">
            <div class="fa-dossier-text">
                <h2>{{ t(activeFactionId) }}</h2>
            </div>
            <div class="fa-stats">
                <div class="fa-stat hero"><b>{{ poolRows.length }}</b><span>{{ t('app_fa_weapon_pool') }}</span></div>
                <button
                    v-for="g in groups"
                    :key="g.category"
                    class="fa-stat fa-stat-btn"
                    :class="{ active: categoryFilter.includes(g.category) }"
                    @click="toggleCategory(g.category)"
                ><b>{{ g.rows.length }}</b><span>{{ tCat(g.category) }}</span></button>
                <button
                    v-if="exclusiveCount > 0"
                    class="fa-stat fa-stat-btn"
                    :class="{ active: exclusiveFilter }"
                    @click="exclusiveFilter = !exclusiveFilter"
                ><b>{{ exclusiveCount }}</b><span>{{ t('app_fa_exclusive') }}</span></button>
            </div>
        </section>

        <!-- Matrix ledger: search strip + table share the trading-ledger chroming -->
        <div class="fa-ledger">
        <div class="fa-strip">
            <div class="filter-input-group fa-filter-group" v-click-outside="closeFilterPanel">
                <LucideSearch class="filter-input-icon" :size="14" />
                <input type="text" v-model="query" :placeholder="t('app_fa_filter')">
                <button v-if="query" class="filter-input-clear" @click="query = ''">&times;</button>
                <button class="filter-btn" @click.stop="filterPanelOpen = !filterPanelOpen" v-tooltip="t('app_label_filters')">
                    <LucideSlidersHorizontal :size="14" />
                    <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
                </button>
                <div class="filter-panel fa-filter-panel" v-show="filterPanelOpen" @click.stop>
                    <div class="filter-group">
                        <div class="filter-group-label">{{ t('app_trading_filter_category') }}</div>
                        <div class="filter-chips">
                            <button
                                v-for="g in groups"
                                :key="g.category"
                                class="filter-chip"
                                :class="{ active: categoryFilter.includes(g.category) }"
                                @click="toggleCategory(g.category)"
                            >{{ tCat(g.category) }}</button>
                        </div>
                    </div>
                    <div class="filter-group">
                        <div class="filter-group-label">{{ t('app_fa_filter_rank') }}</div>
                        <div class="filter-chips">
                            <button
                                v-for="(rk, i) in RANK_KEYS"
                                :key="rk"
                                class="filter-chip"
                                :class="{ active: rankFilter.includes(i) }"
                                @click="toggleRank(i)"
                            >{{ t(rk) }}</button>
                        </div>
                    </div>
                    <div v-if="originOptions.length" class="filter-group">
                        <div class="filter-group-label">{{ t('app_filter_origin') }}</div>
                        <div class="filter-chips">
                            <button
                                v-for="o in originOptions"
                                :key="o"
                                class="filter-chip"
                                :class="{ active: originFilter.includes(o) }"
                                @click="toggleOrigin(o)"
                            >{{ originLabel(o) }}</button>
                        </div>
                    </div>
                </div>
            </div>
            <div v-if="activeFilterCount > 0" class="active-filters">
                <span v-for="c in categoryFilter" :key="'cat-' + c" class="active-filter-chip">
                    <span class="active-filter-label">{{ tCat(c) }}</span>
                    <button class="active-filter-remove" @click="toggleCategory(c)">&times;</button>
                </span>
                <span v-for="i in rankFilter" :key="'rank-' + i" class="active-filter-chip">
                    <span class="active-filter-label">{{ t(RANK_KEYS[i]) }}</span>
                    <button class="active-filter-remove" @click="toggleRank(i)">&times;</button>
                </span>
                <span v-for="o in originFilter" :key="'org-' + o" class="active-filter-chip">
                    <span class="active-filter-label">{{ originLabel(o) }}</span>
                    <button class="active-filter-remove" @click="toggleOrigin(o)">&times;</button>
                </span>
                <span v-if="exclusiveFilter" class="active-filter-chip">
                    <span class="active-filter-label">{{ t('app_fa_exclusive') }}</span>
                    <button class="active-filter-remove" @click="exclusiveFilter = false">&times;</button>
                </span>
            </div>
        </div>
        <div class="fa-matrix-wrap">
            <table class="fa-matrix">
                <thead>
                    <tr>
                        <th class="fa-w-name">{{ t('app_fa_weapon') }}</th>
                        <th
                            v-for="(rk, i) in RANK_KEYS"
                            :key="rk"
                            class="fa-rank-h"
                            :class="{ lensed: i === lensRank }"
                            :title="t('app_fa_lens_hint')"
                            @click="lensRank = lensRank === i ? -1 : i"
                        >
                            <span class="fa-rank-num">{{ ROMAN[i] }}</span>
                            <span class="fa-rank-nm">{{ t(rk) }}</span>
                        </th>
                        <th v-if="hasSpecials" class="fa-w-spc">{{ t('app_fa_special') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <template v-for="g in filteredGroups" :key="g.category">
                        <tr class="fa-grp">
                            <td :colspan="colCount"><span class="fa-grp-lbl">{{ tCat(g.category) }}<span class="fa-grp-cnt">&times;{{ g.rows.length }}</span></span></td>
                        </tr>
                        <tr
                            v-for="row in g.rows"
                            :key="row.id"
                            class="fa-wrow"
                            :class="{ dimmed: lensRank >= 0 && !row.stdSet.has(lensRank) }"
                            @click="$emit('navigateToItem', row.id)"
                        >
                            <td class="fa-w-name">
                                <span
                                    class="fa-w-name-text"
                                    @mouseenter="$emit('showItemHover', row.id, $event)"
                                    @mousemove="$emit('moveItemHover', $event)"
                                    @mouseleave="$emit('hideItemHover')"
                                >{{ row.name }}</span>
                                <span v-if="row.excl" class="fa-excl" :title="t('app_fa_excl_title')">{{ t('app_fa_excl') }}</span>
                            </td>
                            <td
                                v-for="(rk, i) in RANK_KEYS"
                                :key="rk"
                                class="fa-seg"
                                :class="segClass(row, i)"
                            ></td>
                            <td v-if="hasSpecials" class="fa-spc">
                                <i v-for="sk in row.spc" :key="sk" :title="t(sk)">{{ SPC_ABBR[sk] }}</i>
                            </td>
                        </tr>
                    </template>
                    <tr v-if="!filteredGroups.length">
                        <td :colspan="colCount"><div class="fa-empty">{{ t('app_fa_no_match') }}</div></td>
                    </tr>
                </tbody>
            </table>
        </div>
        </div>
    </div>
</div>
</template>

<script>
import { FACTION_LIST } from "../../js/constants.js";

const RANK_KEYS = [
    "st_rank_novice", "st_rank_trainee", "st_rank_experienced", "st_rank_professional",
    "st_rank_veteran", "st_rank_expert", "st_rank_master", "st_rank_legend",
];
const RANK_IDX = Object.fromEntries(RANK_KEYS.map((k, i) => [k, i]));
const SPC_ABBR = {
    st_rank_any: "ANY", st_rank_sniper: "SNP", st_rank_gauss: "GAU",
    st_rank_rg6: "RG6", st_rank_blackops: "BLK", st_rank_ssu: "SSU",
};
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
// Weapon categories in pool display order; anything else sorts after
const KIND_ORDER = ["Pistols", "SMGs", "Shotguns", "Rifles", "Snipers", "Launchers", "Grenade Launchers", "Explosives"];

export default {
    name: "FactionDropsView",
    inject: ["t", "tName", "tCat", "factionIcon", "factionColor"],
    props: {
        active: Boolean,
        drops: { type: Object, default: null },
        faction: { type: String, default: null },
        indexById: { type: Object, default: () => ({}) },
        categoryItems: { type: Object, default: () => ({}) },
    },
    emits: ["update:faction", "navigateToItem", "showItemHover", "moveItemHover", "hideItemHover"],
    data() {
        return {
            query: "",
            lensRank: -1,
            filterPanelOpen: false,
            categoryFilter: [],
            rankFilter: [],
            originFilter: [],
            exclusiveFilter: false,
            RANK_KEYS,
            SPC_ABBR,
            ROMAN,
        };
    },
    computed: {
        factions() {
            const present = new Set();
            for (const byFaction of Object.values(this.drops || {})) {
                for (const f of Object.keys(byFaction)) present.add(f);
            }
            const ordered = FACTION_LIST.filter((id) => present.has(id));
            for (const id of [...present].sort()) {
                if (!FACTION_LIST.includes(id)) ordered.push(id);
            }
            return ordered.map((id) => ({
                id,
                icon: this.factionIcon(id),
                color: this.factionColor(id) || "var(--accent)",
            }));
        },
        activeFactionId() {
            if (this.faction && this.factions.some((f) => f.id === this.faction)) return this.faction;
            return this.factions[0]?.id || null;
        },
        activeFaction() {
            return this.factions.find((f) => f.id === this.activeFactionId) || { id: null, icon: null, color: null };
        },
        themeVars() {
            const hex = this.activeFaction.color || "#c8a84e";
            return { "--f": hex, "--f-rgb": this.hexRgb(hex) };
        },
        poolRows() {
            const fid = this.activeFactionId;
            if (!fid || !this.drops) return [];
            const rows = [];
            for (const [id, byFaction] of Object.entries(this.drops)) {
                const ranks = byFaction[fid];
                if (!ranks) continue;
                const entry = this.indexById[id];
                if (!entry) continue; // e.g. "bolt" — not a real item page
                const std = ranks.filter((r) => r in RANK_IDX).map((r) => RANK_IDX[r]).sort((a, b) => a - b);
                const spc = ranks.filter((r) => r in SPC_ABBR);
                rows.push({
                    id,
                    name: this.tName(entry),
                    category: entry.category,
                    std,
                    stdSet: new Set(std),
                    spc,
                    excl: Object.keys(byFaction).length === 1,
                });
            }
            return rows;
        },
        exclusiveCount() {
            return this.poolRows.filter((r) => r.excl).length;
        },
        hasSpecials() {
            return this.poolRows.some((r) => r.spc.length > 0);
        },
        colCount() {
            return 1 + RANK_KEYS.length + (this.hasSpecials ? 1 : 0);
        },
        groups() {
            return this.groupRows(this.poolRows);
        },
        // weapon id → origin factions (e.g. ["wp"]) from loaded category data
        originMap() {
            const map = {};
            const slugs = new Set(this.poolRows.map((r) => this.catSlug(r.category)));
            for (const slug of slugs) {
                for (const item of this.categoryItems[slug] || []) {
                    if (Array.isArray(item.factions) && item.factions.length) map[item.id] = item.factions;
                }
            }
            return map;
        },
        originOptions() {
            const present = new Set();
            for (const row of this.poolRows) {
                for (const o of this.originMap[row.id] || []) present.add(o);
            }
            return ["wp", "nato", "other"].filter((o) => present.has(o));
        },
        activeFilterCount() {
            return this.categoryFilter.length + this.rankFilter.length + this.originFilter.length
                + (this.exclusiveFilter ? 1 : 0);
        },
        filteredGroups() {
            const q = this.query.trim().toLowerCase();
            const noFilters = !q && !this.activeFilterCount;
            if (noFilters) return this.groups;
            return this.groupRows(this.poolRows.filter((r) => {
                if (q && !r.name.toLowerCase().includes(q)) return false;
                if (this.exclusiveFilter && !r.excl) return false;
                if (this.categoryFilter.length && !this.categoryFilter.includes(r.category)) return false;
                if (this.rankFilter.length && !this.rankFilter.some((i) => r.stdSet.has(i))) return false;
                if (this.originFilter.length) {
                    const origins = this.originMap[r.id] || [];
                    if (!origins.some((o) => this.originFilter.includes(o))) return false;
                }
                return true;
            }));
        },
    },
    watch: {
        activeFactionId() {
            this.lensRank = -1;
            // The exclusive tile is hidden when a faction has no exclusives, so
            // drop the filter too rather than leaving an un-toggleable empty state
            if (!this.exclusiveCount) this.exclusiveFilter = false;
        },
    },
    methods: {
        closeFilterPanel() {
            this.filterPanelOpen = false;
        },
        toggleCategory(cat) {
            this.categoryFilter = this.categoryFilter.includes(cat)
                ? this.categoryFilter.filter((c) => c !== cat)
                : [...this.categoryFilter, cat];
        },
        toggleRank(i) {
            this.rankFilter = this.rankFilter.includes(i)
                ? this.rankFilter.filter((x) => x !== i)
                : [...this.rankFilter, i].sort((a, b) => a - b);
        },
        toggleOrigin(o) {
            this.originFilter = this.originFilter.includes(o)
                ? this.originFilter.filter((x) => x !== o)
                : [...this.originFilter, o];
        },
        originLabel(o) {
            if (o === "wp") return "WP";
            if (o === "nato") return "NATO";
            return this.t("app_origin_other");
        },
        catSlug(category) {
            return category.toLowerCase().replace(/ /g, "-");
        },
        hexRgb(hex) {
            if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "200, 168, 78";
            const n = parseInt(hex.slice(1), 16);
            return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
        },
        groupRows(rows) {
            const byCat = new Map();
            for (const row of rows) {
                if (!byCat.has(row.category)) byCat.set(row.category, []);
                byCat.get(row.category).push(row);
            }
            const order = (c) => {
                const i = KIND_ORDER.indexOf(c);
                return i < 0 ? KIND_ORDER.length : i;
            };
            return [...byCat.entries()]
                .sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]))
                .map(([category, catRows]) => ({
                    category,
                    rows: catRows.sort((a, b) =>
                        (a.std[0] ?? 99) - (b.std[0] ?? 99)
                        || b.std.length - a.std.length
                        || a.name.localeCompare(b.name)
                    ),
                }));
        },
        segClass(row, i) {
            if (!row.stdSet.has(i)) return { hl: i === this.lensRank };
            return {
                on: true,
                "cap-l": !row.stdSet.has(i - 1),
                "cap-r": !row.stdSet.has(i + 1),
                hl: i === this.lensRank,
            };
        },
    },
};
</script>

<style scoped>
.fa-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 0.5rem;
    padding-right: calc(1rem + 8px);
    /* Size container so the stat tiles can hide based on actual content width
       (accounts for sidebar state), not the viewport */
    container-type: inline-size;
}

/* ── Scroll container ───────────────────────────────────── */
.fa-scroll {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-height: 0;
}

/* ── Dossier header ─────────────────────────────────────── */
.fa-dossier {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0.9rem;
    padding: 0.55rem 0.9rem;
    background: linear-gradient(135deg, rgba(var(--f-rgb), 0.09), transparent 55%), var(--card);
    border: 1px solid var(--border);
    border-left: 3px solid var(--f);
    border-radius: 8px;
    flex-shrink: 0;
    transition: border-color 0.35s;
}

.fa-emblem {
    width: 52px;
    height: 52px;
    object-fit: contain;
    filter: drop-shadow(0 0 14px rgba(var(--f-rgb), 0.45));
}

.fa-dossier-text {
    min-width: 0;
}

/* Mirrors .trading-trader-card-name metrics; color stays faction-themed */
.fa-dossier-text h2 {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.15rem;
    line-height: 1.1;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--f);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.35s;
}

.fa-stats {
    display: flex;
    flex-wrap: nowrap;
    justify-content: flex-end;
    gap: 0.35rem;
    margin-left: auto;
    flex-shrink: 0;
}

.fa-stat {
    min-width: 78px;
    padding: 0.3rem 0.55rem 0.26rem;
    background: var(--color-surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
}

/* Value/label pair mirrors .trading-rate-value / .trading-rate-label */
.fa-stat b {
    display: block;
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    font-size: 1.05rem;
    color: var(--text);
    line-height: 1.2;
}

.fa-stat span {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.55rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-secondary);
}

.fa-stat.hero {
    border-color: rgba(var(--f-rgb), 0.45);
    background: rgba(var(--f-rgb), 0.07);
}

.fa-stat.hero b {
    color: var(--f);
}

/* Kind tiles double as category filter toggles */
.fa-stat-btn {
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
}

.fa-stat-btn:hover {
    border-color: rgba(var(--f-rgb), 0.45);
}

.fa-stat-btn.active {
    border-color: rgba(var(--f-rgb), 0.6);
    background: rgba(var(--f-rgb), 0.12);
}

.fa-stat-btn.active b {
    color: var(--f);
}

/* ── Matrix ledger (chroming mirrors the trading ledger) ── */
.fa-ledger {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}

/* Search strip — same treatment as .trading-strip-controls */
.fa-strip {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.35rem;
    padding: 0.4rem 0.65rem;
    background:
        linear-gradient(180deg,
            var(--color-surface-3) 0%,
            color-mix(in srgb, var(--color-surface-3) 100%, black 8%) 100%);
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    flex-shrink: 0;
}

/* Same flex reset as .trading-filter-group: full-width input in a column context */
.fa-filter-group {
    position: relative;
    width: 100%;
    max-width: none;
    flex: 0 0 auto;
}

/* Drop the filter panel below the input group, like .trading-filter-panel */
.fa-filter-panel {
    top: calc(100% + 0.35rem);
    left: 0;
    right: auto;
}

.fa-strip .active-filters {
    margin-top: 0;
    padding-right: 0;
}

.fa-matrix-wrap {
    border: 1px solid var(--border);
    border-radius: 0 0 6px 6px;
    background: var(--color-surface-2);
    overflow: auto;
    flex: 1;
    min-height: 0;
}

.fa-matrix {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    min-width: 860px;
}

.fa-matrix th,
.fa-matrix td {
    padding: 0;
}

.fa-matrix thead th {
    position: sticky;
    top: 0;
    z-index: 6;
    background:
        linear-gradient(180deg,
            var(--color-surface-3) 0%,
            color-mix(in srgb, var(--color-surface-3) 100%, black 8%) 100%);
    border-bottom: 1px solid var(--color-border-strong);
}

/* Column headers mirror .trading-ledger-header type treatment */
.fa-matrix thead th.fa-w-name {
    left: 0;
    z-index: 7;
    text-align: left;
    padding: 0.5rem 0.7rem 0.36rem;
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-secondary);
    text-transform: uppercase;
}

.fa-rank-h {
    cursor: pointer;
    user-select: none;
    text-align: center;
    padding: 0.45rem 0.15rem 0.38rem !important;
    transition: background 0.15s;
}

.fa-rank-num {
    display: block;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.72rem;
    color: var(--text-tertiary);
    line-height: 1.1;
    transition: color 0.15s, text-shadow 0.15s;
}

.fa-rank-nm {
    display: block;
    font-family: var(--font-display);
    font-size: 0.5rem;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin-top: 0.1rem;
}

/* Tints layer over the opaque header gradient — the th must stay opaque,
   otherwise the band cells show through the sticky header when scrolled */
.fa-rank-h:hover {
    background:
        linear-gradient(rgba(var(--f-rgb), 0.07), rgba(var(--f-rgb), 0.07)),
        linear-gradient(180deg,
            var(--color-surface-3) 0%,
            color-mix(in srgb, var(--color-surface-3) 100%, black 8%) 100%);
}

.fa-rank-h:hover .fa-rank-num {
    color: var(--text);
}

.fa-rank-h.lensed {
    background:
        linear-gradient(rgba(var(--f-rgb), 0.13), rgba(var(--f-rgb), 0.13)),
        linear-gradient(180deg,
            var(--color-surface-3) 0%,
            color-mix(in srgb, var(--color-surface-3) 100%, black 8%) 100%);
    box-shadow: inset 0 -2px 0 var(--f);
}

.fa-rank-h.lensed .fa-rank-num {
    color: var(--f);
    text-shadow: 0 0 12px rgba(var(--f-rgb), 0.7);
}

.fa-matrix thead th.fa-w-spc {
    text-align: center;
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-secondary);
    text-transform: uppercase;
    padding: 0.5rem 0.5rem 0.36rem;
}

/* kind group header row */
.fa-grp td {
    position: sticky;
    top: 46px;
    z-index: 4;
    background: linear-gradient(90deg, rgba(var(--f-rgb), 0.10), rgba(var(--f-rgb), 0.02) 55%, transparent), var(--card);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 0.3rem 0.7rem;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text);
    white-space: nowrap;
}

.fa-grp-lbl {
    position: sticky;
    left: 0.7rem;
    display: inline-block;
}

.fa-grp-cnt {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 0.55rem;
    color: var(--f);
    margin-left: 0.5rem;
    letter-spacing: 0.05em;
}

/* weapon rows — treatment mirrors .trading-ledger-row */
.fa-wrow {
    cursor: pointer;
}

.fa-wrow td {
    height: 1.85rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    transition: background 0.1s, opacity 0.15s;
}

.fa-wrow:hover td {
    background: var(--color-overlay-white-6);
}

.fa-wrow td.fa-w-name {
    position: sticky;
    left: 0;
    z-index: 3;
    background: var(--color-surface-2);
    padding: 0 0.7rem;
    font-family: var(--font-display);
    font-size: 0.78rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: var(--text);
    white-space: nowrap;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Sticky cell needs an opaque hover equivalent of the row's overlay */
.fa-wrow:hover td.fa-w-name {
    background: color-mix(in srgb, var(--color-surface-2) 94%, white);
}

.fa-excl {
    display: inline-block;
    margin-left: 0.4rem;
    font-family: var(--mono);
    font-size: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--f);
    border: 1px solid rgba(var(--f-rgb), 0.5);
    border-radius: 3px;
    padding: 0 0.22rem;
    vertical-align: 1px;
}

/* service band cells */
td.fa-seg {
    position: relative;
    height: 28px;
    min-width: 56px;
}

td.fa-seg::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: var(--border);
    opacity: 0.55;
}

td.fa-seg.on::after {
    content: "";
    position: absolute;
    left: -1px;
    right: -1px;
    top: 50%;
    height: 8px;
    transform: translateY(-50%);
    background: linear-gradient(180deg, rgba(var(--f-rgb), 0.95), rgba(var(--f-rgb), 0.65));
    box-shadow: 0 0 8px rgba(var(--f-rgb), 0.35);
}

td.fa-seg.on.cap-l::after {
    left: 18%;
    border-radius: 99px 0 0 99px;
}

td.fa-seg.on.cap-r::after {
    right: 18%;
    border-radius: 0 99px 99px 0;
}

td.fa-seg.on.cap-l.cap-r::after {
    border-radius: 99px;
}

td.fa-seg.hl {
    background: rgba(var(--f-rgb), 0.05);
}

/* special chips */
td.fa-spc {
    padding: 0 0.5rem;
    white-space: nowrap;
    text-align: center;
}

td.fa-spc i {
    display: inline-block;
    font-style: normal;
    font-family: var(--mono);
    font-size: 0.55rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    background: var(--card-raised);
    border: 1px solid var(--color-border-strong);
    border-radius: 3px;
    padding: 0.03rem 0.28rem;
    margin: 0 0.08rem;
    cursor: default;
}

/* Column highlight: rows without the highlighted rank fade back (visual only, not a filter) */
.fa-wrow.dimmed {
    opacity: 0.22;
}

.fa-wrow.dimmed:hover {
    opacity: 0.6;
}

.fa-wrow.dimmed td.fa-seg.on::after {
    box-shadow: none;
}

.fa-empty {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.7rem;
}

/* Responsive */
/* The header row never wraps: once the content area is too narrow to fit the
   stat tiles beside the faction name, hide them entirely — category filtering
   stays available via the filter panel */
@container (max-width: 1280px) {
    .fa-stats {
        display: none;
    }
}

/* Mobile: faction chips become a single horizontal scroll strip, matching the
   trader rail on the trading page (no wrap, hidden scrollbar, right-edge fade) */
@media (max-width: 768px) {
    .exchange-faction-chips {
        flex-wrap: nowrap;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding-right: 0;
        /* Fade the right edge to hint that more chips lie beyond. */
        -webkit-mask-image: linear-gradient(to right, black calc(100% - 28px), transparent);
        mask-image: linear-gradient(to right, black calc(100% - 28px), transparent);
    }

    .exchange-faction-chips::-webkit-scrollbar {
        display: none;
    }

    .exchange-faction-chips .exchange-chip {
        flex: 0 0 auto;
        white-space: nowrap;
    }
}

@media (max-width: 640px) {
    .fa-view {
        padding-right: 0.5rem;
    }

    .fa-dossier {
        gap: 0.4rem 0.6rem;
    }

    .fa-emblem {
        width: 42px;
        height: 42px;
    }
}
</style>
