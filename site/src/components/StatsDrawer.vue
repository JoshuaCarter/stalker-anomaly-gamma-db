<template>
<div class="sd-drawer">
    <div class="sd-body" v-if="stats">
        <!-- Faction strip -->
        <div v-if="stats.faction" class="sd-faction-strip">
            <span class="sd-faction-label">{{ t('app_save_stats_faction') }}</span>
            <span class="sd-faction-name">{{ t(stats.faction) }}</span>
        </div>

        <!-- Combat -->
        <template v-if="combatTiles.length">
            <div class="sd-section"><span>{{ t('app_save_stats_combat') }}</span></div>
            <div class="sd-tiles">
                <div v-for="tile in combatTiles" :key="tile.key" class="sd-tile">
                    <span class="sd-tile-value">{{ tile.value }}</span>
                    <span class="sd-tile-label">{{ tile.label }}</span>
                </div>
            </div>
            <template v-if="stats.kills && stats.kills.length">
                <div class="sd-subhead">{{ t('app_save_stats_recent_kills') }}</div>
                <div class="sd-kills">
                    <div v-for="(kill, i) in stats.kills" :key="i" class="sd-kill">
                        <span class="sd-kill-name">{{ kill.name || '—' }}</span>
                        <span v-if="kill.comm" class="sd-kill-comm">{{ t(kill.comm) }}</span>
                        <span v-if="kill.level" class="sd-kill-level"><LucideMapPin :size="10" /> {{ levelLabel(kill.level) }}</span>
                    </div>
                </div>
            </template>
        </template>

        <!-- Progression -->
        <template v-if="progressionTiles.length">
            <div class="sd-section"><span>{{ t('app_save_stats_progression') }}</span></div>
            <div class="sd-tiles">
                <div v-for="tile in progressionTiles" :key="tile.key" class="sd-tile">
                    <span class="sd-tile-value">{{ tile.value }}</span>
                    <span class="sd-tile-label">{{ tile.label }}</span>
                </div>
            </div>
        </template>

        <!-- Exploration -->
        <template v-if="explorationTiles.length || visitedLevelNames.length">
            <div class="sd-section"><span>{{ t('app_save_stats_exploration') }}</span></div>
            <div class="sd-tiles">
                <div v-for="tile in explorationTiles" :key="tile.key" class="sd-tile">
                    <span class="sd-tile-value">{{ tile.value }}</span>
                    <span class="sd-tile-label">{{ tile.label }}</span>
                </div>
            </div>
            <template v-if="visitedLevelNames.length">
                <div class="sd-subhead">{{ t('app_save_stats_levels_visited') }}</div>
                <div class="sd-chips">
                    <span v-for="name in visitedLevelNames" :key="name" class="sd-chip">{{ name }}</span>
                </div>
            </template>
        </template>

        <!-- Skills -->
        <template v-if="skills.length">
            <div class="sd-section"><span>{{ t('app_save_stats_skills') }}</span></div>
            <div v-for="skill in skills" :key="skill.id" class="sd-skill">
                <div class="sd-skill-row">
                    <span class="sd-skill-name">{{ skill.label }}</span>
                    <span class="sd-skill-level">{{ skill.level }}<template v-if="skill.maxLevel"> / {{ skill.maxLevel }}</template></span>
                </div>
                <div class="sd-bar"><div class="sd-bar-fill" :style="{ width: skill.pct + '%' }"></div></div>
            </div>
        </template>

        <!-- Factions -->
        <template v-if="factions.length">
            <div class="sd-section"><span>{{ t('app_save_stats_factions') }}</span></div>
            <div v-for="faction in factions" :key="faction.id" class="sd-faction">
                <span class="sd-faction-row-name">{{ t(faction.id) }}</span>
                <span v-if="faction.blacklisted" class="sd-blacklisted">{{ t('app_save_stats_blacklisted') }}</span>
                <span class="sd-faction-progress">{{ faction.progress }}</span>
            </div>
        </template>
    </div>
</div>
</template>

<script>
/** Skills with curated translations; anything else falls back to a prettified id. */
const KNOWN_SKILLS = new Set(['strength', 'endurance', 'scavenging', 'survival']);

export default {
    props: {
        open: { type: Boolean, default: false },
        stats: { type: Object, default: null },
        levelNames: { type: Object, default: () => ({}) },
    },
    emits: ['close'],
    inject: ['t'],
    computed: {
        combatTiles() {
            const actor = this.stats?.actor || {};
            return this.buildTiles([
                ['killed_stalkers', actor.killed_stalkers, 'app_save_stats_stalkers_killed'],
                ['killed_monsters', actor.killed_monsters, 'app_save_stats_mutants_killed'],
                ['stealth', this.stats?.stealthKills, 'app_save_stats_stealth_kills'],
                ['deaths', actor.deaths, 'app_save_stats_deaths'],
            ]);
        },
        progressionTiles() {
            const s = this.stats || {};
            const actor = s.actor || {};
            const achievements = s.achievementsTotal
                ? `${s.achievementsUnlocked} / ${s.achievementsTotal}`
                : null;
            return this.buildTiles([
                ['tasks', actor.tasks_completed ?? s.tasksDone, 'app_save_stats_tasks_done'],
                ['artefacts', actor.artefacts_found, 'app_save_stats_artefacts_found'],
                ['achievements', achievements, 'app_save_stats_achievements'],
                ['recipes', s.recipes, 'app_save_stats_recipes_known'],
                ['disassembled', actor.items_disassembled, 'app_save_stats_items_disassembled'],
                ['articles', s.articles, 'app_save_stats_articles'],
                ['notes', s.notes, 'app_save_stats_notes'],
            ]);
        },
        explorationTiles() {
            const s = this.stats || {};
            const actor = s.actor || {};
            const ratio = (found, total) => (total ? `${found} / ${total}` : null);
            return this.buildTiles([
                ['levels', ratio(s.visitedLevels?.length, s.totalLevels), 'app_save_stats_levels_visited'],
                ['stashes', ratio(s.stashesFound, s.stashesTotal), 'app_save_stats_stashes_found'],
                ['smarts', ratio(s.smartsVisited, s.smartsTotal), 'app_save_stats_smarts_visited'],
                ['fast_travel', ratio(s.fastTravelFound, s.fastTravelTotal), 'app_save_stats_fast_travel'],
                ['campfires', s.campfires, 'app_save_stats_campfires'],
                ['emissions', actor.emissions, 'app_save_stats_emissions'],
            ]);
        },
        visitedLevelNames() {
            return (this.stats?.visitedLevels || [])
                .map(id => this.levelLabel(id))
                .sort((a, b) => a.localeCompare(b));
        },
        skills() {
            return (this.stats?.skills || []).map(s => {
                // XP progress within the current level band
                const band = s.req - s.prevReq;
                const pct = band > 0
                    ? Math.max(0, Math.min(100, Math.round(((s.xp - s.prevReq) / band) * 100)))
                    : 0;
                const label = KNOWN_SKILLS.has(s.id)
                    ? this.t('app_save_stats_skill_' + s.id)
                    : s.id.charAt(0).toUpperCase() + s.id.slice(1).replace(/_/g, ' ');
                return { ...s, label, pct };
            });
        },
        factions() {
            return [...(this.stats?.factions || [])]
                .filter(f => f.progress > 0 || f.blacklisted)
                .sort((a, b) => (b.progress - a.progress) || a.id.localeCompare(b.id));
        },
    },
    mounted() {
        window.addEventListener('keydown', this.onKeydown);
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.onKeydown);
    },
    methods: {
        buildTiles(defs) {
            const tiles = [];
            for (const [key, value, labelKey] of defs) {
                if (value === null || value === undefined) continue;
                tiles.push({ key, value, label: this.t(labelKey) });
            }
            return tiles;
        },
        levelLabel(levelId) {
            return this.levelNames[levelId] || levelId;
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
.sd-drawer {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-surface-1);
}

/* ── Body ─────────────────────────────────────────────────── */
.sd-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.6rem 0.9rem 1rem;
}

.sd-faction-strip {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    background: var(--color-surface-2);
    border: 1px solid var(--color-accent-tint-20);
    border-radius: 4px;
    padding: 0.45rem 0.6rem;
}

.sd-faction-label {
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-secondary);
}

.sd-faction-name {
    font-family: var(--font-display);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--accent);
}

.sd-section {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin: 0.85rem 0 0.45rem;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent);
}

.sd-section::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--border);
}

.sd-subhead {
    margin: 0.5rem 0 0.3rem;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-secondary);
}

/* ── Stat tiles ───────────────────────────────────────────── */
.sd-tiles {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.4rem;
}

.sd-tile {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    background: var(--color-surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.4rem 0.55rem;
}

.sd-tile-value {
    font-family: var(--mono);
    font-size: 0.92rem;
    color: var(--accent);
    white-space: nowrap;
}

.sd-tile-label {
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-secondary);
}

/* ── Kill feed ────────────────────────────────────────────── */
.sd-kills {
    display: flex;
    flex-direction: column;
}

.sd-kill {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.7rem;
    padding: 0.22rem 0;
    border-bottom: 1px dashed var(--border);
}

.sd-kill:last-child {
    border-bottom: none;
}

.sd-kill-name {
    flex: 1;
    min-width: 0;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sd-kill-comm {
    font-family: var(--mono);
    font-size: 0.62rem;
    color: var(--text-secondary);
    background: var(--color-overlay-white-6);
    border-radius: 3px;
    padding: 0 4px;
    line-height: 1rem;
    flex-shrink: 0;
}

.sd-kill-level {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.62rem;
    color: var(--text-secondary);
    flex-shrink: 0;
}

/* ── Visited-level chips ──────────────────────────────────── */
.sd-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
}

.sd-chip {
    font-size: 0.62rem;
    color: var(--text-secondary);
    background: var(--color-surface-2);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0.1rem 0.4rem;
}

/* ── Skills ───────────────────────────────────────────────── */
.sd-skill {
    margin-bottom: 0.5rem;
}

.sd-skill-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 0.2rem;
}

.sd-skill-name {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text);
}

.sd-skill-level {
    font-family: var(--mono);
    font-size: 0.68rem;
    color: var(--accent);
}

.sd-bar {
    height: 3px;
    background: var(--color-overlay-white-6);
    border-radius: 1px;
    overflow: hidden;
}

.sd-bar-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.4s ease;
}

/* ── Factions ─────────────────────────────────────────────── */
.sd-faction {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.72rem;
    padding: 0.24rem 0;
    border-bottom: 1px dashed var(--border);
}

.sd-faction:last-child {
    border-bottom: none;
}

.sd-faction-row-name {
    flex: 1;
    min-width: 0;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sd-blacklisted {
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-red-soft);
    border: 1px solid var(--color-red-muted);
    border-radius: 3px;
    padding: 0 4px;
    flex-shrink: 0;
}

.sd-faction-progress {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--accent);
    flex-shrink: 0;
}
</style>
