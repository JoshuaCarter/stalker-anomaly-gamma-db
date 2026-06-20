<template>
    <a
        href="#"
        class="addon-img-tile"
        :class="modifier ? 'addon-img-tile-' + modifier : null"
        v-tooltip="tooltip || null"
        @mouseenter="hover && showItemHover(item, $event)"
        @mousemove="hover && moveItemHover($event)"
        @mouseleave="hover && hideItemHover()"
        @click.prevent="$emit('navigate', item.id)"
    >
        <span class="addon-img-tile-fig">
            <img class="addon-img-tile-icon" :src="'img/icons/' + item.id + '.png'" :alt="name" loading="lazy" @error="$event.target.style.display='none'" />
            <span v-if="badge" class="addon-img-tile-badge">{{ badge }}</span>
            <span v-if="integral" class="addon-img-tile-integral" v-tooltip="t('app_label_integrated_tip')">{{ t('app_label_integrated') }}</span>
        </span>
        <span class="addon-img-tile-name">{{ name }}</span>
    </a>
</template>

<script>
export default {
  name: 'AddonTile',
  inject: ['t', 'showItemHover', 'moveItemHover', 'hideItemHover'],
  props: {
    item: { type: Object, required: true },
    name: { type: String, default: '' },
    // Category accent class suffix, e.g. 'scope' -> .addon-img-tile-scope
    modifier: { type: String, default: '' },
    // Optional stat overlay text (scope magnification, magazine capacity)
    badge: { type: String, default: '' },
    // Shows the "Integrated" overlay when the addon is built into the item
    integral: { type: Boolean, default: false },
    // Static description tooltip on the tile (used where there's no item hover card)
    tooltip: { type: String, default: '' },
    // Whether to show the floating item hover card on mouseover
    hover: { type: Boolean, default: true },
  },
  emits: ['navigate'],
};
</script>
