<template>
<div class="gd-drawer">
    <div class="gd-body" v-if="rows.length">
        <!-- Standing summary: allies / neutral / hostile tally -->
        <div class="gd-summary">
            <div class="gd-sum-cell gd-friendly">
                <span class="gd-sum-value">{{ tally.friendly }}</span>
                <span class="gd-sum-label">{{ t('app_save_goodwill_friendly') }}</span>
            </div>
            <div class="gd-sum-cell gd-neutral">
                <span class="gd-sum-value">{{ tally.neutral }}</span>
                <span class="gd-sum-label">{{ t('app_save_goodwill_neutral') }}</span>
            </div>
            <div class="gd-sum-cell gd-hostile">
                <span class="gd-sum-value">{{ tally.hostile }}</span>
                <span class="gd-sum-label">{{ t('app_save_goodwill_hostile') }}</span>
            </div>
        </div>

        <!-- Faction roster -->
        <div class="gd-list">
            <article
                v-for="row in rows"
                :key="row.id"
                class="gd-card"
                :class="{ 'gd-card-self': row.self }"
                :style="{ '--fc': row.color, '--fc-rgb': row.colorRgb }"
            >
                <div class="gd-card-top">
                    <img v-if="row.icon" class="gd-emblem" :src="'/img/' + row.icon" :alt="row.name">
                    <div class="gd-id">
                        <span class="gd-name">{{ row.name }}</span>
                        <span v-if="row.self" class="gd-self-tag">{{ t('app_save_goodwill_your_faction') }}</span>
                    </div>
                    <!-- Faction stance (war state) — independent of personal goodwill -->
                    <span class="gd-state" :class="row.attitudeClass">{{ row.attitudeLabel }}</span>
                </div>

                <!-- Personally-earned goodwill: a separate signed value with its own
                     diverging meter (centre = 0, left = negative, right = positive) -->
                <div class="gd-goodwill">
                    <span class="gd-gw-label">{{ t('app_save_inv_goodwill') }}</span>
                    <div class="gd-meter" :class="row.goodwillClass">
                        <span class="gd-meter-axis"></span>
                        <span class="gd-meter-fill" :style="row.fillStyle"></span>
                    </div>
                    <span class="gd-value" :class="row.goodwillClass">{{ row.goodwill > 0 ? '+' : '' }}{{ row.goodwill }}</span>
                </div>

                <div v-if="row.blacklisted" class="gd-card-foot">
                    <span class="gd-blacklisted">{{ t('app_save_stats_blacklisted') }}</span>
                </div>
            </article>
        </div>
    </div>

    <div v-else class="gd-empty">
        <LucideHandshake :size="32" class="gd-empty-icon" />
        <p>{{ factions.length ? t('app_save_goodwill_no_relations') : t('app_save_goodwill_empty') }}</p>
    </div>
</div>
</template>

<script>
import { FACTION_LIST, FACTION_BASE_RELATIONS } from '../../js/constants.js';

// Personal community goodwill is clamped to ±3000 in-engine, but this stored value
// is only ONE component of a faction's full stance, so it rarely climbs past a few
// hundred. The meter therefore saturates at ±1000 (the attitude-flip threshold) for
// legibility, and standing is classed by sign: any positive lean reads as friendly,
// any negative lean as hostile, zero as neutral.
const GOODWILL_SCALE = 1000;

export default {
    props: {
        open: { type: Boolean, default: false },
        // { factionId: goodwillValue } from the .scop relations registry, or null
        goodwill: { type: Object, default: null },
        // MilPDA reputation: [{ id, progress, blacklisted }]
        factions: { type: Array, default: () => [] },
        // The actor's own faction id (stats.faction), highlighted in the roster
        actorFaction: { type: String, default: '' },
    },
    emits: ['close'],
    inject: ['t', 'factionIcon', 'factionColor'],
    computed: {
        // Faction id → MilPDA entry, used only to flag blacklisted factions
        blacklistedIds() {
            const set = new Set();
            for (const f of this.factions) if (f.blacklisted) set.add(f.id);
            return set;
        },
        rows() {
            // Full attitude ≈ personal goodwill (save) + base faction war state (ltx).
            // The base table captures who the player's faction is at war with; the
            // registry only carries the small personally-earned deltas on top.
            const base = FACTION_BASE_RELATIONS[this.actorFaction] || {};
            const personal = this.goodwill || {};
            const ids = new Set([...Object.keys(personal), ...Object.keys(base)]);
            if (!ids.size) return [];

            const orderOf = (id) => {
                const i = FACTION_LIST.indexOf(id);
                return i === -1 ? FACTION_LIST.length : i;
            };

            const rows = [...ids].map((id) => {
                const goodwill = personal[id] || 0;             // points the player earned
                const attitude = goodwill + (base[id] || 0);    // overall stance incl. war state
                const color = this.factionColor(id) || 'var(--accent)';
                return {
                    id,
                    name: this.t(id),
                    icon: this.factionIcon(id),
                    color,
                    colorRgb: this.hexRgb(color),
                    goodwill,
                    attitude,
                    goodwillClass: this.signClass(goodwill),
                    attitudeClass: this.signClass(attitude),
                    attitudeLabel: this.signLabel(attitude),
                    blacklisted: this.blacklistedIds.has(id),
                    self: id === this.actorFaction,
                    fillStyle: this.fillStyle(goodwill),
                };
            });

            return rows.sort((a, b) => {
                if (a.self !== b.self) return a.self ? -1 : 1;
                // Group by stance (friendly → hostile), then by earned goodwill
                if (a.attitude !== b.attitude) return b.attitude - a.attitude;
                if (a.goodwill !== b.goodwill) return b.goodwill - a.goodwill;
                return orderOf(a.id) - orderOf(b.id) || a.name.localeCompare(b.name);
            });
        },
        tally() {
            // Counts reflect faction stance, not personal goodwill
            const t = { friendly: 0, neutral: 0, hostile: 0 };
            for (const r of this.rows) {
                if (r.attitude > 0) t.friendly++;
                else if (r.attitude < 0) t.hostile++;
                else t.neutral++;
            }
            return t;
        },
    },
    mounted() {
        window.addEventListener('keydown', this.onKeydown);
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.onKeydown);
    },
    methods: {
        signClass(v) {
            if (v > 0) return 'gd-is-friendly';
            if (v < 0) return 'gd-is-hostile';
            return 'gd-is-neutral';
        },
        signLabel(v) {
            if (v > 0) return this.t('app_save_goodwill_friendly');
            if (v < 0) return this.t('app_save_goodwill_hostile');
            return this.t('app_save_goodwill_neutral');
        },
        fillStyle(goodwill) {
            if (!goodwill) return { display: 'none' };
            const pct = Math.min(Math.abs(goodwill) / GOODWILL_SCALE, 1) * 50;
            return goodwill > 0
                ? { left: '50%', width: pct + '%' }
                : { right: '50%', width: pct + '%' };
        },
        hexRgb(hex) {
            if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '212, 168, 67';
            const n = parseInt(hex.slice(1), 16);
            return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
        },
        onKeydown(e) {
            if (e.key === 'Escape' && this.open) this.$emit('close');
        },
    },
};
</script>

<style scoped>
/* Panel content only — the inspector shell in PlayerInventoryView owns
   positioning, tabs and the close button (mirrors StatsDrawer). */
.gd-drawer {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-surface-1);
}

.gd-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.7rem 0.9rem 1rem;
}

/* ── Empty state ───────────────────────────────────────────── */
.gd-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary);
}

.gd-empty-icon {
    color: var(--text-secondary);
    opacity: 0.5;
}

.gd-empty p {
    margin: 0;
    font-size: 0.8rem;
}

/* ── Standing summary ──────────────────────────────────────── */
.gd-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.4rem;
    margin-bottom: 0.7rem;
}

.gd-sum-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    padding: 0.45rem 0.3rem;
    background: var(--color-surface-2);
    border: 1px solid var(--border);
    border-radius: 5px;
    border-top-width: 2px;
}

.gd-sum-cell.gd-friendly { border-top-color: var(--color-green-positive); }
.gd-sum-cell.gd-neutral { border-top-color: var(--text-secondary); }
.gd-sum-cell.gd-hostile { border-top-color: var(--color-red-soft); }

.gd-sum-value {
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.1;
}

.gd-friendly .gd-sum-value { color: var(--color-green-positive); }
.gd-neutral .gd-sum-value { color: var(--text); }
.gd-hostile .gd-sum-value { color: var(--color-red-soft); }

.gd-sum-label {
    font-size: 0.56rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-secondary);
}

/* ── Roster ────────────────────────────────────────────────── */
.gd-list {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
}

.gd-card {
    --fc: var(--accent);
    --fc-rgb: 212, 168, 67;
    padding: 0.5rem 0.6rem 0.55rem;
    background:
        linear-gradient(135deg, rgba(var(--fc-rgb), 0.08), transparent 60%),
        var(--color-surface-2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--fc);
    border-radius: 6px;
}

/* The actor's own faction is pulled to the top and given a stronger frame */
.gd-card-self {
    border-color: rgba(var(--fc-rgb), 0.55);
    border-left-color: var(--fc);
    box-shadow: 0 0 0 1px rgba(var(--fc-rgb), 0.25), 0 6px 18px -12px rgba(var(--fc-rgb), 0.8);
}

.gd-card-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.gd-emblem {
    width: 26px;
    height: 26px;
    object-fit: contain;
    flex-shrink: 0;
    filter: drop-shadow(0 0 7px rgba(var(--fc-rgb), 0.5));
}

.gd-id {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
}

.gd-name {
    font-family: var(--font-display);
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--fc);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.gd-self-tag {
    flex-shrink: 0;
    font-size: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-bg);
    background: var(--fc);
    border-radius: 3px;
    padding: 0.05rem 0.28rem;
}

/* ── Faction stance badge (war state) ──────────────────────── */
.gd-state {
    flex-shrink: 0;
    font-size: 0.56rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border: 1px solid currentColor;
    border-radius: 3px;
    padding: 0.1rem 0.36rem;
    line-height: 1;
}

/* ── Personal goodwill row (separate from stance) ──────────── */
.gd-goodwill {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.gd-gw-label {
    flex-shrink: 0;
    font-size: 0.54rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-secondary);
}

.gd-value {
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
    font-size: 0.82rem;
    font-weight: 600;
    flex-shrink: 0;
    min-width: 2.6rem;
    text-align: right;
}

/* ── Diverging meter ───────────────────────────────────────── */
.gd-meter {
    position: relative;
    flex: 1;
    height: 6px;
    background: var(--color-overlay-white-6);
    border-radius: 3px;
    overflow: hidden;
}

.gd-meter-axis {
    position: absolute;
    left: 50%;
    top: -1px;
    bottom: -1px;
    width: 1px;
    background: var(--border);
    transform: translateX(-0.5px);
    z-index: 1;
}

.gd-meter-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 3px;
    transition: width 0.45s ease;
}

.gd-is-friendly .gd-meter-fill {
    background: linear-gradient(90deg, rgba(var(--fc-rgb), 0.5), var(--color-green-positive));
    box-shadow: 0 0 8px rgba(110, 200, 110, 0.4);
}

.gd-is-hostile .gd-meter-fill {
    background: linear-gradient(270deg, rgba(var(--fc-rgb), 0.45), var(--color-red-soft));
    box-shadow: 0 0 8px rgba(210, 90, 90, 0.4);
}

.gd-is-neutral .gd-meter-fill {
    background: linear-gradient(90deg, rgba(var(--fc-rgb), 0.35), rgba(var(--fc-rgb), 0.7));
}

/* Stance-badge and goodwill-value colours (same green/red/neutral semantics) */
.gd-value.gd-is-friendly,
.gd-state.gd-is-friendly { color: var(--color-green-positive); }
.gd-value.gd-is-hostile,
.gd-state.gd-is-hostile { color: var(--color-red-soft); }
.gd-value.gd-is-neutral { color: var(--text-secondary); }
.gd-state.gd-is-neutral { color: var(--text-secondary); }

/* ── Card footer ───────────────────────────────────────────── */
.gd-card-foot {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.45rem;
}

.gd-blacklisted {
    font-size: 0.56rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-red-soft);
    border: 1px solid var(--color-red-muted);
    border-radius: 3px;
    padding: 0 4px;
}
</style>
