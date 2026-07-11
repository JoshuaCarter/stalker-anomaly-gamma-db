<template>
<!-- One borderless inventory item. No card chrome: the icon sits on the tray,
     selection is a warm glow behind the art, and small data badges ride the
     corners like the in-game inventory. Reusable across inventory screens.

     Corners: cost = top-right, picked ×N = top-left, effect glyphs = bottom-left,
     view-specific marks (locks, faction) = bottom-right `corner` slot, and the
     buy/quantity control drops into the foot via the `control` slot.

     Interaction: the name always opens item details (`navigate`). Clicking the
     art cycles the picked count (`cycle`) when `selectable`, otherwise it also
     navigates — so a plain viewer stays click-to-open. -->
<div
    class="inv-tile"
    :class="{ selected, dim, clickable, selectable }"
    :draggable="draggable || null"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
>
    <span v-if="qtyBadge" class="inv-tile-qty" :class="{ idle: !qtyBadge.active }">{{ qtyBadge.text }}</span>
    <span v-if="cost != null" class="inv-tile-cost" :class="{ spent }" :title="costTitle">{{ formattedCost }}</span>

    <div
        class="inv-tile-art"
        @click="onArtClick"
        @mouseenter="onEnter"
        @mousemove="onMove"
        @mouseleave="onLeave"
    >
        <img :src="iconSrc" :alt="name" loading="lazy" @error="onImgError">
        <span v-if="$slots.glyphs" class="inv-tile-glyphs"><slot name="glyphs" /></span>
    </div>

    <span
        class="inv-tile-name"
        @click="onNameClick"
        @mouseenter="onEnter"
        @mousemove="onMove"
        @mouseleave="onLeave"
    >{{ name }}</span>

    <span v-if="$slots.corner" class="inv-tile-corner"><slot name="corner" /></span>

    <div v-if="$slots.control" class="inv-tile-ctl"><slot name="control" /></div>
</div>
</template>

<script>
export default {
    name: "InventoryTile",
    props: {
        iconId: { type: String, required: true },
        name: { type: String, default: "" },
        // Cost badge (top-right). Omit / null to hide (e.g. free or non-purchasable items).
        cost: { type: Number, default: null },
        // Turn the cost badge "spent" (accent-orange) — typically when selected.
        spent: { type: Boolean, default: false },
        // Picked-quantity badge (top-left). Alone → "×N" (shown when > 1).
        qty: { type: Number, default: null },
        // Buy cap for a selectable stackable. With it, the badge reads "qty/capacity"
        // (e.g. "0/4" available, "2/4" picked) so the cap is always visible.
        capacity: { type: Number, default: null },
        selected: { type: Boolean, default: false },
        // Muted (e.g. unaffordable / unavailable).
        dim: { type: Boolean, default: false },
        // Whether the icon/name navigate on click and fire hover events.
        clickable: { type: Boolean, default: false },
        // When true, clicking the art cycles the picked count (`cycle`) instead of navigating.
        selectable: { type: Boolean, default: false },
        // Make the tile a drag source; drag events are re-emitted for the parent.
        draggable: { type: Boolean, default: false },
    },
    emits: ["navigate", "cycle", "dragstart", "dragend", "hover-enter", "hover-move", "hover-leave"],
    computed: {
        iconSrc() {
            return "/img/icons/" + this.iconId + ".png";
        },
        // Top-left badge: "picked/cap" for a stackable buy cap, else "×N" for a fixed count.
        qtyBadge() {
            if (this.capacity != null && this.capacity > 1) {
                const picked = this.qty || 0;
                return { text: picked + "/" + this.capacity, active: picked > 0 };
            }
            if (this.qty != null && this.qty > 1) {
                return { text: "×" + this.qty, active: true };
            }
            return null;
        },
        formattedCost() {
            return this.cost != null ? this.cost.toLocaleString() : "";
        },
        costTitle() {
            return this.cost != null ? this.formattedCost : "";
        },
    },
    methods: {
        onArtClick(e) {
            if (this.selectable) this.$emit("cycle");
            else if (this.clickable) this.$emit("navigate", e);
        },
        onNameClick(e) { if (this.clickable) this.$emit("navigate", e); },
        onEnter(e) { if (this.clickable) this.$emit("hover-enter", e); },
        onMove(e) { if (this.clickable) this.$emit("hover-move", e); },
        onLeave() { if (this.clickable) this.$emit("hover-leave"); },
        onImgError(e) { e.target.style.visibility = "hidden"; },
    },
};
</script>

<style scoped>
.inv-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 0.25rem 0.4rem;
    border-radius: 5px;
    transition: background 0.15s, opacity 0.15s, box-shadow 0.15s;
}

.inv-tile:hover {
    background: var(--color-overlay-white-2);
}

/* Selected reads as a "lit slot": tinted fill + crisp gold ring + soft glow.
   Only picked tiles get chrome, so this doesn't reintroduce a grid of boxes. */
.inv-tile.selected {
    background: var(--color-accent-tint-12);
    box-shadow: inset 0 0 0 1px var(--accent), 0 0 10px -3px var(--color-accent-tint-35);
}

.inv-tile.dim { opacity: 0.36; }
.inv-tile.dim:hover { opacity: 0.5; background: none; }

/* ── Art + selection glow ─────────────────────────────────── */
.inv-tile-art {
    position: relative;
    height: 44px;
    display: grid;
    place-items: center;
}

.inv-tile.clickable .inv-tile-art,
.inv-tile.selectable .inv-tile-art { cursor: pointer; }

/* Tactile press feedback when clicking to add */
.inv-tile.selectable .inv-tile-art:active img { transform: scale(0.92); }

.inv-tile-art img {
    max-height: 44px;
    max-width: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    filter: drop-shadow(0 2px 3px var(--color-overlay-black-55));
    transition: filter 0.15s, transform 0.12s;
}

/* Selection is a warm glow behind the icon — no rectangle, no border */
.inv-tile.selected .inv-tile-art::after {
    content: "";
    position: absolute;
    inset: -8px -6px;
    z-index: -1;
    border-radius: 50%;
    background: radial-gradient(circle, var(--color-accent-tint-35), transparent 70%);
    filter: blur(2px);
}

.inv-tile.selected .inv-tile-art img {
    filter: drop-shadow(0 0 6px var(--color-accent-tint-35)) drop-shadow(0 2px 3px var(--color-overlay-black-55));
}

/* ── Name (two-line clamp so the foot control aligns across tiles) ── */
.inv-tile-name {
    margin-top: 0.3rem;
    font-size: 0.62rem;
    line-height: 1.18;
    text-align: center;
    color: var(--text-secondary);
    min-height: calc(0.62rem * 1.18 * 2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
    transition: color 0.15s;
}

.inv-tile:hover .inv-tile-name,
.inv-tile.selected .inv-tile-name { color: var(--text); }

.inv-tile.clickable .inv-tile-name { color: var(--accent); cursor: pointer; }
.inv-tile.clickable .inv-tile-name:hover { text-decoration: underline; }

/* ── Cost badge (top-right) ───────────────────────────────── */
.inv-tile-cost {
    position: absolute;
    top: 1px;
    right: 2px;
    z-index: 3;
    font-family: var(--mono);
    font-size: 0.58rem;
    font-weight: 600;
    color: var(--color-blue-grey-soft);
    background: var(--color-overlay-black-55);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0 3px;
    line-height: 15px;
    transition: color 0.15s, border-color 0.15s;
}

.inv-tile-cost.spent {
    color: var(--color-accent-orange);
    border-color: var(--color-accent-tint-35);
}

/* ── Quantity badge (top-left): bordered box like the cost badge.
   Cyan when picked, muted when just showing the cap ("0/4"). ── */
.inv-tile-qty {
    position: absolute;
    top: 1px;
    left: 2px;
    z-index: 3;
    font-family: var(--mono);
    font-size: 0.58rem;
    font-weight: 600;
    line-height: 15px;
    padding: 0 3px;
    border-radius: 3px;
    color: var(--color-inv-qty);
    background: var(--color-overlay-black-55);
    border: 1px solid var(--border);
}

/* Cap shown on an unpicked stackable (e.g. "0/4") — present but understated */
.inv-tile-qty.idle {
    color: var(--text-secondary);
}

/* ── Effect glyphs (bottom-left of the art) ───────────────── */
.inv-tile-glyphs {
    position: absolute;
    bottom: -2px;
    left: 3px;
    display: flex;
    gap: 2px;
    z-index: 3;
}

/* ── View-specific corner marks (bottom-right) ────────────── */
.inv-tile-corner {
    position: absolute;
    bottom: 1px;
    right: 2px;
    z-index: 3;
    display: flex;
    align-items: flex-end;
    gap: 2px;
}

/* ── Foot control slot (stepper / checkbox provided by the view) ── */
.inv-tile-ctl {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 18px;
    margin-top: 0.3rem;
}
</style>
