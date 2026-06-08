<template>
<Teleport to="body">
<Transition name="fade">
<div class="modal-backdrop" v-if="open" @click.self="$emit('close')" style="z-index: 210;">
    <Transition name="modal" appear>
    <div class="modal build-picker-modal" v-if="open">
        <button class="modal-close" @click="$emit('close')">&times;</button>
        <div class="modal-body">
            <h2 v-if="title" class="build-picker-title">{{ title }}</h2>
            <div class="build-picker-controls">
                <div class="build-picker-search">
                    <svg class="filter-input-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input type="text" :value="internalQuery" @input="onQueryInput(($event.target as HTMLInputElement).value)" :placeholder="placeholder" class="build-picker-input" ref="searchInput">
                </div>
                <div v-if="$slots.toolbar" class="build-picker-toolbar">
                    <slot name="toolbar"></slot>
                </div>
            </div>
            <div class="build-picker-list">
                <div v-for="item in displayItems" :key="itemKey(item)" class="build-picker-item" @click="$emit('select', item)">
                    <slot name="item" :item="item">
                        <span class="build-picker-item-name">{{ itemLabel(item) }}</span>
                    </slot>
                </div>
                <div v-if="displayItems.length === 0" class="build-picker-empty">{{ emptyText }}</div>
            </div>
            <div v-if="$slots.footer" class="build-picker-footer">
                <slot name="footer"></slot>
            </div>
        </div>
    </div>
    </Transition>
</div>
</Transition>
</Teleport>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';

interface PickerItem {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export default defineComponent({
  name: 'ItemPickerModal',
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
    placeholder: { type: String, default: 'Search...' },
    emptyText: { type: String, default: 'No results' },
    items: { type: Array as PropType<PickerItem[]>, default: () => [] },
    query: { type: String, default: undefined },
    filterFn: { type: Function as PropType<(item: PickerItem, query: string) => boolean>, default: null },
    labelFn: { type: Function as PropType<(item: PickerItem) => string>, default: null },
    keyFn: { type: Function as PropType<(item: PickerItem) => string>, default: null },
  },
  emits: ['close', 'select', 'update:query'],
  data() {
    return { localQuery: '' };
  },
  computed: {
    externalQuery(): boolean {
      return this.query !== undefined;
    },
    internalQuery(): string {
      return this.externalQuery ? (this.query ?? '') : this.localQuery;
    },
    displayItems(): PickerItem[] {
      if (this.externalQuery) return this.items;
      const q = this.localQuery.toLowerCase().trim();
      if (!q) return this.items;
      if (this.filterFn) return this.items.filter(item => this.filterFn!(item, q));
      return this.items.filter(item => this.itemLabel(item).toLowerCase().includes(q));
    },
  },
  methods: {
    itemLabel(item: PickerItem): string {
      if (this.labelFn) return this.labelFn(item);
      return item.name || item.id || '';
    },
    itemKey(item: PickerItem): string {
      if (this.keyFn) return this.keyFn(item);
      return item.id;
    },
    onQueryInput(val: string): void {
      if (this.externalQuery) {
        this.$emit('update:query', val);
      } else {
        this.localQuery = val;
      }
    },
  },
  watch: {
    open(val: boolean) {
      if (val) {
        this.localQuery = '';
        if (this.externalQuery) this.$emit('update:query', '');
        this.$nextTick(() => {
          const input = this.$refs.searchInput as HTMLInputElement | undefined;
          if (input) input.focus();
        });
      }
    },
  },
});
</script>

<style scoped>
.build-picker-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
    margin-top: 0.5rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--border);
}
</style>
