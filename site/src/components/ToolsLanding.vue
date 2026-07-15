<template>
<div class="tools-landing">
    <div class="tools-landing-body">
        <div v-for="group in groups" :key="group.key" class="tools-group">
            <div class="tools-group-label">{{ t(group.labelKey) }}</div>
            <div class="tools-grid">
                <button
                    v-for="tool in group.tools"
                    :key="tool.key"
                    type="button"
                    class="tool-card"
                    @click="$emit(tool.event)"
                >
                    <span class="tool-card-ico"><component :is="tool.icon" :size="19" /></span>
                    <span class="tool-card-body">
                        <b>{{ t(tool.nameKey) }}</b>
                        <span>{{ t(tool.descKey) }}</span>
                    </span>
                    <LucideChevronRight class="tool-card-go" :size="16" />
                </button>
            </div>
        </div>
    </div>
</div>
</template>

<script>
export default {
    name: 'ToolsLanding',
    inject: ['t'],
    props: {
        hasStartingLoadouts: { type: Boolean, default: false },
        hasFactionPools: { type: Boolean, default: false },
    },
    emits: ['openDamageSim', 'openArmorProtection', 'openVersionCompare', 'openStartingLoadouts', 'openFactionPools'],
    computed: {
        groups() {
            const all = [
                {
                    key: 'combat',
                    labelKey: 'app_tools_group_combat',
                    tools: [
                        { key: 'weapon-damage', icon: 'LucideCrosshair', nameKey: 'app_tool_weapon_damage', descKey: 'app_tools_desc_weapon_damage', event: 'openDamageSim', show: true },
                        // Armor Protection hidden (feature kept; still reachable at /db/<pack>/armor)
                        { key: 'armor-protection', icon: 'LucideShield', nameKey: 'app_tool_armor_protection', descKey: 'app_tools_desc_armor_protection', event: 'openArmorProtection', show: false },
                    ],
                },
                {
                    key: 'data',
                    labelKey: 'app_tools_group_data',
                    tools: [
                        { key: 'starting-loadouts', icon: 'LucideLayers', nameKey: 'app_cat_starting_loadouts', descKey: 'app_tools_desc_starting_loadouts', event: 'openStartingLoadouts', show: this.hasStartingLoadouts },
                        { key: 'faction-drops', icon: 'LucidePackage', nameKey: 'app_cat_faction_drops', descKey: 'app_tools_desc_faction_drops', event: 'openFactionPools', show: this.hasFactionPools },
                    ],
                },
            ];
            return all
                .map(g => ({ ...g, tools: g.tools.filter(t => t.show) }))
                .filter(g => g.tools.length);
        },
    },
};
</script>

<style scoped>
.tools-landing {
    max-width: 62rem;
    margin: 0 auto;
    padding: 1.6rem 1.4rem 2.5rem;
}
.tools-landing-head {
    margin-bottom: 1.2rem;
}
.tools-landing-title {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.03em;
    font-size: 1.7rem;
    margin: 0;
    color: var(--color-text);
}
.tools-landing-intro {
    color: var(--color-text-secondary);
    margin: 0.3rem 0 0;
    font-size: 0.9rem;
}
.tools-group + .tools-group {
    margin-top: 1.6rem;
}
.tools-group-label {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    font-size: 0.66rem;
    color: var(--color-text-secondary);
    margin-bottom: 0.7rem;
}
.tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: 0.8rem;
}
.tool-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    text-align: left;
    width: 100%;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 11px;
    padding: 0.9rem;
    cursor: pointer;
    color: var(--color-text);
    transition: border-color 0.12s, background 0.12s;
}
.tool-card:hover {
    border-color: var(--color-accent-dim);
    background: var(--color-card);
}
.tool-card:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
}
.tool-card-ico {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 9px;
    background: var(--color-accent-tint-10);
    color: var(--color-accent);
    border: 1px solid var(--color-accent-dim);
}
.tool-card-body {
    min-width: 0;
    flex: 1 1 auto;
}
.tool-card-body b {
    display: block;
    font-size: 0.92rem;
    font-weight: 600;
}
.tool-card-body span {
    display: block;
    font-size: 0.74rem;
    color: var(--color-text-secondary);
    margin-top: 0.15rem;
    line-height: 1.35;
}
.tool-card-go {
    flex: 0 0 auto;
    color: var(--color-text-secondary);
    margin-top: 0.15rem;
}
.tool-card:hover .tool-card-go {
    color: var(--color-accent);
}
</style>
