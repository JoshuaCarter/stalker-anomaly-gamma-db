<template>
<!-- Borderless "rucksack" surface: a gritty dark tray that items sit on
     directly, with no per-item cards. Shared across inventory-style screens. -->
<div class="inv-tray" :class="{ 'inv-tray-kit': kit, 'inv-tray-flush': flush }">
    <slot />
</div>
</template>

<script>
export default {
    name: "InventoryTray",
    props: {
        // Warmer treatment for a "your loadout / your kit" tray (vs. a catalogue)
        kit: { type: Boolean, default: false },
        // Drop the frame (border, corner ticks, shadow, radius) so the tray fills
        // an existing panel body edge-to-edge — avoids a box-in-a-box.
        flush: { type: Boolean, default: false },
    },
};
</script>

<style scoped>
.inv-tray {
    position: relative;
    border-radius: 6px;
    padding: 0.85rem 0.8rem 1rem;
    background:
        radial-gradient(120% 90% at 50% -10%, var(--color-accent-tint-5), transparent 55%),
        radial-gradient(140% 120% at 50% 120%, var(--color-ember-tint-10), transparent 60%),
        repeating-linear-gradient(-45deg, var(--color-overlay-white-1) 0 2px, transparent 2px 5px),
        linear-gradient(180deg, var(--color-inv-tray-top), var(--color-inv-tray-bottom));
    border: 1px solid var(--color-inv-tray-border);
    box-shadow: inset 0 0 60px var(--color-overlay-black-50), inset 0 1px 0 var(--color-overlay-white-2);
    overflow: hidden;
}

.inv-tray-kit {
    background:
        radial-gradient(120% 90% at 50% -10%, var(--color-accent-tint-8), transparent 55%),
        radial-gradient(140% 120% at 50% 120%, var(--color-ember-tint-10), transparent 60%),
        repeating-linear-gradient(-45deg, var(--color-overlay-white-1) 0 2px, transparent 2px 5px),
        linear-gradient(180deg, var(--color-inv-tray-kit-top), var(--color-inv-tray-bottom));
    border-color: var(--color-accent-tint-20);
}

/* Faint utilitarian corner ticks, echoing the in-game panel frame */
.inv-tray::before,
.inv-tray::after {
    content: "";
    position: absolute;
    width: 14px;
    height: 14px;
    pointer-events: none;
    border-color: var(--color-accent-tint-20);
    border-style: solid;
}

.inv-tray::before { top: 7px; left: 7px; border-width: 1px 0 0 1px; }
.inv-tray::after { bottom: 7px; right: 7px; border-width: 0 1px 1px 0; }

/* Flush: no frame — the tray fills a host panel's body edge-to-edge.
   Keeps the gritty texture, drops the border/ticks/shadow/radius. */
.inv-tray-flush {
    border: none;
    border-radius: 0;
    box-shadow: none;
}

.inv-tray-flush::before,
.inv-tray-flush::after { display: none; }
</style>
