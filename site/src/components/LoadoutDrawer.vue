<template>
<div class="ld-drawer">
    <!-- Provenance legend + reset-to-save -->
    <div class="ld-legend">
        <span class="ld-leg"><i class="ld-dot ld-dot-save"></i>{{ t('app_save_inv_loadout_from_save') }}</span>
        <span class="ld-leg"><i class="ld-dot ld-dot-mod"></i>{{ t('app_save_inv_loadout_modified') }}</span>
        <button class="ld-reset" :disabled="!dirty" @click="applySaved">&#8634; {{ t('app_save_inv_loadout_reset') }}</button>
    </div>

    <div class="ld-body">
        <!-- Paper doll: weapons left, body gear centre, utility right -->
        <div class="ld-doll">
            <div class="ld-sil" aria-hidden="true">
                <svg width="116" height="260" viewBox="0 0 120 280" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4">
                    <circle cx="60" cy="30" r="18"/>
                    <path d="M40 56 h40 l8 30 v60 l-10 8 v90 h-12 v-80 h-12 v80 H42 v-90 l-10-8 v-60 z"/>
                    <path d="M32 86 l-14 50 M88 86 l14 50"/>
                </svg>
            </div>
            <div v-for="(col, ci) in dollColumns" :key="ci" class="ld-col">
                <div
                    v-for="key in col"
                    :key="key"
                    class="ld-slot"
                    :class="slotClasses(key, null)"
                    @click="openPicker(key, null)"
                    @dragover="onSlotDragOver(key, null, $event)"
                    @dragleave="onSlotDragLeave(key, null)"
                    @drop="onSlotDrop(key, null, $event)"
                    @mouseenter="slots[key] && $emit('showItemHover', slots[key], $event)"
                    @mousemove="slots[key] && $emit('moveItemHover', $event)"
                    @mouseleave="slots[key] && $emit('hideItemHover')"
                >
                    <span class="ld-prov"></span>
                    <span class="ld-tag">{{ t(slotDefs[key].labelKey) }}</span>
                    <template v-if="slots[key]">
                        <img class="ld-icon" :src="'img/icons/' + slots[key] + '.png'" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
                        <span class="ld-name">{{ itemName(slots[key]) }}</span>
                        <button class="ld-x" @click.stop="clearSlot(key, null)">&times;</button>
                    </template>
                    <template v-else>
                        <span class="ld-plus">+</span>
                        <span class="ld-name ld-name-empty">{{ t('app_save_inv_loadout_empty') }}</span>
                    </template>
                </div>
            </div>
        </div>

        <!-- Belt (artefacts; slot count comes from the equipped outfit) -->
        <div class="ld-sect">
            <span>{{ t('app_build_belt_slots') }}</span>
            <small>{{ beltUsed }}/{{ beltMax }}</small>
        </div>
        <div class="ld-belt">
            <div
                v-for="(id, i) in slots.belt"
                :key="i"
                class="ld-slot ld-belt-slot"
                :class="slotClasses('belt', i)"
                @click="openPicker('belt', i)"
                @dragover="onSlotDragOver('belt', i, $event)"
                @dragleave="onSlotDragLeave('belt', i)"
                @drop="onSlotDrop('belt', i, $event)"
                @mouseenter="id && $emit('showItemHover', id, $event)"
                @mousemove="id && $emit('moveItemHover', $event)"
                @mouseleave="id && $emit('hideItemHover')"
            >
                <span class="ld-prov"></span>
                <template v-if="id">
                    <img class="ld-icon ld-icon-sm" :src="'img/icons/' + id + '.png'" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
                    <button class="ld-x" @click.stop="clearSlot('belt', i)">&times;</button>
                </template>
                <span v-else-if="i >= beltMax" class="ld-belt-locked">&times;</span>
                <span v-else class="ld-plus">+</span>
            </div>
        </div>

        <!-- Statistics: weights + full protection breakdown -->
        <div class="ld-sect"><span>{{ t('app_build_statistics') }}</span></div>
        <div class="ld-stats">
            <div class="ld-stats-row">
                <div class="ld-stat">
                    <b>{{ stats.weight.toFixed(1) }} <small>{{ t('unit_kg') }}</small></b>
                    <span>{{ headerLabel('st_prop_weight') }}</span>
                </div>
                <div class="ld-stat">
                    <b>{{ stats.armor.toFixed(1) }}</b>
                    <span>{{ headerLabel('ui_inv_ap_res') }}</span>
                </div>
                <div class="ld-stat">
                    <b>+{{ stats.carry.toFixed(0) }} <small>{{ t('unit_kg') }}</small></b>
                    <span>{{ headerLabel('ui_inv_outfit_additional_weight') }}</span>
                </div>
            </div>
            <div v-for="f in protFields" :key="f" class="ld-full-row">
                <span class="ld-full-label">{{ headerLabel(f) }}</span>
                <div class="ld-pbar"><i :style="{ width: protWidth(stats.prot[f]) }"></i></div>
                <b>{{ stats.prot[f].toFixed(1) }}%</b>
            </div>
        </div>
    </div>

    <!-- Click-to-equip fallback (touch / no-drag) -->
    <ItemPickerModal
        :open="pickerSlot !== null"
        :title="pickerTitle"
        :placeholder="t('app_label_filter_placeholder')"
        :empty-text="t('app_label_no_results')"
        :items="pickerItems"
        :label-fn="(item) => tItemName(item)"
        @close="pickerSlot = null"
        @select="pickFromPicker"
    >
        <template #item="{ item }">
            <img class="ld-picker-icon" :src="'img/icons/' + item.id + '.png'" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
            <span class="build-picker-item-name">{{ tItemName(item) }}</span>
            <span v-if="ownedCounts.get(item.id)" class="ld-picker-qty">&times;{{ ownedCounts.get(item.id) }}</span>
            <span class="build-picker-item-type">{{ tCat(item.category) }}</span>
        </template>
    </ItemPickerModal>
</div>
</template>

<script>
import { PRIMARY_WEAPON_SLUGS, SIDEARM_SLUGS, CAT, isBackpack } from '../../js/constants.js';
import { categorySlug } from '../../js/utils.js';
import ItemPickerModal from './modals/ItemPickerModal.vue';

const BELT_MAX = 5;

/** Doll slots and their translation keys (belt is rendered separately). */
const SLOT_DEFS = {
    primary:   { labelKey: 'app_build_weapon_primary' },
    secondary: { labelKey: 'app_build_weapon_secondary' },
    helmet:    { labelKey: 'app_type_helmet' },
    outfit:    { labelKey: 'app_type_outfit' },
    backpack:  { labelKey: 'app_type_backpack' },
    sidearm:   { labelKey: 'app_build_sidearm' },
    grenade:   { labelKey: 'app_build_grenade' },
};

/** Column layout: weapons left, body gear centre, utility right. */
const DOLL_COLUMNS = [
    ['primary', 'secondary'],
    ['helmet', 'outfit', 'backpack'],
    ['sidearm', 'grenade'],
];

const PROT_FIELDS = [
    'ui_inv_outfit_fire_wound_protection',
    'ui_inv_outfit_wound_protection',
    'ui_inv_outfit_burn_protection',
    'ui_inv_outfit_shock_protection',
    'ui_inv_outfit_chemical_burn_protection',
    'ui_inv_outfit_radiation_protection',
    'ui_inv_outfit_telepatic_protection',
    'ui_inv_outfit_strike_protection',
    'ui_inv_outfit_explosion_protection',
];

export default {
    components: { ItemPickerModal },
    props: {
        open: { type: Boolean, default: false },
        actorItems: { type: Array, default: () => [] },
        indexById: { type: Object, default: () => new Map() },
        resolveFull: { type: Function, required: true },
        // { id, category } of the inventory cell currently being dragged, or null
        dragItem: { type: Object, default: null },
    },
    emits: ['close', 'showItemHover', 'moveItemHover', 'hideItemHover'],
    inject: ['t', 'tItemName', 'tCat', 'headerLabel'],
    data() {
        return {
            slots: {
                helmet: null, outfit: null, backpack: null,
                primary: null, secondary: null, sidearm: null, grenade: null,
                belt: Array(BELT_MAX).fill(null),
            },
            dirty: false,
            pickerSlot: null,   // { key, idx } or null
            overSlot: null,     // "key" / "belt:i" while a drag hovers it
            slotDefs: SLOT_DEFS,
            dollColumns: DOLL_COLUMNS,
            protFields: PROT_FIELDS,
        };
    },
    computed: {
        /** Loadout as recorded in the save (equipped flags), mapped to slots. */
        savedLoadout() {
            const saved = {
                helmet: null, outfit: null, backpack: null,
                primary: null, secondary: null, sidearm: null, grenade: null,
                belt: [],
            };
            for (const it of this.actorItems) {
                if (!it.e) continue;
                const id = it.s;
                const cat = this.indexById.get(id)?.category;
                if (!cat) continue;
                const slug = categorySlug(cat);
                if (cat === CAT.HELMETS) { if (!saved.helmet) saved.helmet = id; }
                else if (cat === CAT.OUTFITS) { if (!saved.outfit) saved.outfit = id; }
                else if (cat === CAT.BELT_ATTACHMENTS) { if (!saved.backpack && isBackpack(this.resolveFull(id))) saved.backpack = id; }
                else if (cat === CAT.ARTEFACTS) { if (saved.belt.length < BELT_MAX) saved.belt.push(id); }
                else if (PRIMARY_WEAPON_SLUGS.includes(slug)) {
                    if (!saved.primary) saved.primary = id;
                    else if (!saved.secondary) saved.secondary = id;
                }
                else if (SIDEARM_SLUGS.includes(slug)) { if (!saved.sidearm) saved.sidearm = id; }
                else if (cat === CAT.EXPLOSIVES) { if (!saved.grenade) saved.grenade = id; }
            }
            return saved;
        },
        /** Usable belt slots: the outfit's max (upgraded) artefact capacity,
            same rule as the Build Planner's buildBeltSlotMax. */
        beltMax() {
            const outfit = this.slots.outfit ? this.resolveFull(this.slots.outfit) : null;
            if (!outfit) return 0;
            const n = parseInt(outfit['st_data_export_outfit_artefact_count_max'], 10);
            return Math.min(BELT_MAX, isNaN(n) ? 0 : n);
        },
        beltUsed() {
            return this.slots.belt.filter(Boolean).length;
        },
        /** Combined stats of everything slotted (weapons count toward weight only). */
        stats() {
            const num = (item, field) => {
                const v = parseFloat(item?.[field]);
                return isNaN(v) ? 0 : v;
            };
            const full = (key) => this.slots[key] ? this.resolveFull(this.slots[key]) : null;
            const beltItems = this.slots.belt.filter(Boolean).map(id => this.resolveFull(id)).filter(Boolean);

            let weight = 0;
            for (const key of Object.keys(SLOT_DEFS)) weight += num(full(key), 'st_prop_weight');
            for (const item of beltItems) weight += num(item, 'st_prop_weight');

            const armor = num(full('helmet'), 'ui_inv_ap_res') + num(full('outfit'), 'ui_inv_ap_res');
            const carry = num(full('outfit'), 'ui_inv_outfit_additional_weight') + num(full('backpack'), 'ui_inv_outfit_additional_weight');

            const prot = {};
            const protSources = [full('helmet'), full('outfit'), ...beltItems].filter(Boolean);
            for (const f of PROT_FIELDS) {
                prot[f] = protSources.reduce((sum, item) => sum + num(item, f), 0);
            }
            return { weight, armor, carry, prot };
        },
        ownedCounts() {
            const counts = new Map();
            for (const it of this.actorItems) counts.set(it.s, (counts.get(it.s) || 0) + it.q);
            return counts;
        },
        /** Every matching item in the database; owned items first. */
        pickerItems() {
            if (!this.pickerSlot) return [];
            const items = [];
            for (const entry of this.indexById.values()) {
                if (!this.accepts(this.pickerSlot.key, entry.id)) continue;
                items.push(this.displayItem(entry.id));
            }
            const owned = this.ownedCounts;
            return items.sort((a, b) =>
                ((owned.has(b.id) ? 1 : 0) - (owned.has(a.id) ? 1 : 0)) ||
                this.tItemName(a).localeCompare(this.tItemName(b))
            );
        },
        pickerTitle() {
            if (!this.pickerSlot) return '';
            const def = SLOT_DEFS[this.pickerSlot.key];
            return def ? this.t(def.labelKey) : this.t('app_build_belt_slots');
        },
    },
    watch: {
        // Re-sync from the save whenever it changes — unless the user has local edits
        savedLoadout: {
            immediate: true,
            handler() {
                if (!this.dirty) this.applySaved();
            },
        },
    },
    mounted() {
        window.addEventListener('keydown', this.onKeydown);
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.onKeydown);
    },
    methods: {
        applySaved() {
            const s = this.savedLoadout;
            this.slots = {
                helmet: s.helmet, outfit: s.outfit, backpack: s.backpack,
                primary: s.primary, secondary: s.secondary, sidearm: s.sidearm, grenade: s.grenade,
                belt: [...s.belt, ...Array(Math.max(0, BELT_MAX - s.belt.length)).fill(null)],
            };
            this.dirty = false;
        },
        displayItem(id) {
            const entry = this.indexById.get(id);
            return this.resolveFull(id)
                || { id, name: entry?.name || id, displayName: entry?.displayName, category: entry?.category };
        },
        itemName(id) {
            return this.tItemName(this.displayItem(id));
        },
        /** Does an item belong in this slot? */
        accepts(key, id) {
            const cat = this.indexById.get(id)?.category;
            if (!cat) return false;
            const slug = categorySlug(cat);
            switch (key) {
                case 'helmet': return cat === CAT.HELMETS;
                case 'outfit': return cat === CAT.OUTFITS;
                case 'backpack': return cat === CAT.BELT_ATTACHMENTS && isBackpack(this.resolveFull(id));
                case 'primary':
                case 'secondary': return PRIMARY_WEAPON_SLUGS.includes(slug);
                case 'sidearm': return SIDEARM_SLUGS.includes(slug);
                case 'grenade': return cat === CAT.EXPLOSIVES;
                case 'belt': return cat === CAT.ARTEFACTS;
                default: return false;
            }
        },
        slotToken(key, idx) {
            return idx === null ? key : `${key}:${idx}`;
        },
        slotValue(key, idx) {
            return idx === null ? this.slots[key] : this.slots.belt[idx];
        },
        beltLocked(idx) {
            return idx !== null && idx >= this.beltMax && !this.slots.belt[idx];
        },
        slotClasses(key, idx) {
            const value = this.slotValue(key, idx);
            const savedValue = idx === null ? this.savedLoadout[key] : (this.savedLoadout.belt[idx] || null);
            const eligible = !!this.dragItem && !this.beltLocked(idx) && this.accepts(key, this.dragItem.id);
            return {
                'ld-filled': !!value,
                'ld-saved': !!value && value === savedValue,
                'ld-mod': !!value && value !== savedValue,
                'ld-locked': this.beltLocked(idx),
                'ld-eligible': eligible,
                'ld-dim': !!this.dragItem && !eligible,
                'ld-over': this.overSlot === this.slotToken(key, idx),
            };
        },
        onSlotDragOver(key, idx, event) {
            if (!this.dragItem || this.beltLocked(idx) || !this.accepts(key, this.dragItem.id)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            this.overSlot = this.slotToken(key, idx);
        },
        onSlotDragLeave(key, idx) {
            if (this.overSlot === this.slotToken(key, idx)) this.overSlot = null;
        },
        onSlotDrop(key, idx, event) {
            if (!this.dragItem || this.beltLocked(idx) || !this.accepts(key, this.dragItem.id)) return;
            event.preventDefault();
            this.setSlot(key, idx, this.dragItem.id);
            this.overSlot = null;
        },
        setSlot(key, idx, id) {
            if (idx === null) this.slots[key] = id;
            else this.slots.belt[idx] = id;
            this.dirty = true;
        },
        clearSlot(key, idx) {
            this.setSlot(key, idx, null);
            this.$emit('hideItemHover');
        },
        openPicker(key, idx) {
            if (this.beltLocked(idx)) return;
            this.pickerSlot = { key, idx };
        },
        pickFromPicker(item) {
            if (this.pickerSlot) this.setSlot(this.pickerSlot.key, this.pickerSlot.idx, item.id);
            this.pickerSlot = null;
        },
        protWidth(value) {
            return Math.max(0, Math.min(100, value)) + '%';
        },
        onKeydown(e) {
            if (e.key !== 'Escape' || !this.open) return;
            if (this.pickerSlot) this.pickerSlot = null;
            else this.$emit('close');
        },
    },
};
</script>

<style scoped>
/* Panel content only — the inspector shell in PlayerInventoryView
   owns positioning, header and the close button. */
.ld-drawer {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-surface-1);
}

/* ── Legend + reset ───────────────────────────────────────── */
.ld-legend {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.4rem 0.8rem;
    border-bottom: 1px solid var(--border);
    background: var(--color-surface-2);
}

.ld-leg {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--mono);
    font-size: 0.56rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-secondary);
}

.ld-dot { width: 6px; height: 6px; border-radius: 50%; }
.ld-dot-save { background: var(--color-green-positive); box-shadow: 0 0 4px var(--color-green-positive); }
.ld-dot-mod { background: var(--accent); box-shadow: 0 0 4px var(--accent); }

.ld-reset {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--mono);
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    transition: color 0.15s, opacity 0.2s;
}

.ld-reset:hover { color: var(--text); }

.ld-reset:disabled {
    opacity: 0.35;
    color: var(--text-secondary);
    cursor: default;
}

.ld-body {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
}

/* ── Paper doll ───────────────────────────────────────────── */
.ld-doll {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.45rem;
    padding: 0.75rem 0.8rem 0.5rem;
}

.ld-sil {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    color: var(--accent);
    opacity: 0.14;
}

.ld-col {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
}

/* ── Slots ────────────────────────────────────────────────── */
.ld-slot {
    position: relative;
    min-height: 76px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.35rem 0.25rem;
    background: var(--color-surface-2);
    border: 1px solid var(--border);
    border-radius: 5px;
    cursor: pointer;
    text-align: center;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, opacity 0.15s;
}

.ld-slot:hover {
    border-color: var(--accent-dim);
}

.ld-tag {
    font-family: var(--mono);
    font-size: 0.52rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-secondary);
}

.ld-icon {
    height: 26px;
    max-width: 56px;
    object-fit: contain;
    image-rendering: pixelated;
}

.ld-icon-sm { height: 22px; max-width: 40px; }

.ld-name {
    font-size: 0.58rem;
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-word;
}

.ld-name-empty { color: var(--text-secondary); }

.ld-plus {
    width: 24px;
    height: 18px;
    display: grid;
    place-items: center;
    border: 1px dashed var(--border);
    border-radius: 3px;
    color: var(--text-secondary);
    font-size: 0.7rem;
}

.ld-x {
    position: absolute;
    top: 2px;
    right: 3px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 0.85rem;
    line-height: 1;
    cursor: pointer;
    padding: 0 0.1rem;
    opacity: 0;
    transition: opacity 0.15s;
}

.ld-slot:hover .ld-x { opacity: 1; }
.ld-x:hover { color: var(--text); }

/* provenance dot */
.ld-prov {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: none;
}

.ld-saved .ld-prov { display: block; background: var(--color-green-positive); box-shadow: 0 0 4px var(--color-green-positive); }
.ld-mod .ld-prov { display: block; background: var(--accent); box-shadow: 0 0 4px var(--accent); }

/* drag states */
.ld-eligible {
    border-color: var(--accent-dim);
    border-style: dashed;
    animation: ld-pulse 1.1s ease-in-out infinite;
}

.ld-dim { opacity: 0.35; }

.ld-over {
    border-color: var(--accent) !important;
    border-style: solid !important;
    background: var(--color-accent-tint-12) !important;
    box-shadow: 0 0 0 1px var(--accent), inset 0 0 18px var(--color-accent-tint-12) !important;
}

@keyframes ld-pulse {
    50% { box-shadow: inset 0 0 14px var(--color-accent-tint-20); }
}

/* ── Belt strip ───────────────────────────────────────────── */
.ld-sect {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.55rem 0.8rem 0.4rem;
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent);
}

.ld-sect small {
    font-family: var(--mono);
    color: var(--text-secondary);
    font-weight: 400;
    letter-spacing: 0;
}

.ld-sect::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--border);
}

.ld-belt {
    display: flex;
    gap: 0.35rem;
    margin: 0 0.8rem 0.8rem;
}

.ld-belt-slot {
    flex: 1;
    aspect-ratio: 1;
    min-height: 0;
    padding: 0.15rem;
}

.ld-locked,
.ld-locked:hover {
    opacity: 0.3;
    border-style: dashed;
    border-color: var(--border);
    cursor: default;
}

.ld-belt-locked {
    color: var(--text-secondary);
    font-size: 0.75rem;
}

/* ── Statistics (scrolls with the panel body) ─────────────── */
.ld-stats {
    margin: 0 0.8rem 0.9rem;
}

.ld-stats-row {
    display: flex;
    align-items: baseline;
    gap: 1.1rem;
    margin-bottom: 0.55rem;
}

.ld-stat {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
}

.ld-stat:first-child { flex: 1; }

.ld-stat b {
    font-family: var(--mono);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
}

.ld-stat b small { font-size: 0.62rem; font-weight: 400; }

.ld-stat span {
    font-size: 0.52rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ld-pbar {
    height: 3px;
    border-radius: 1px;
    background: var(--color-overlay-white-6);
    overflow: hidden;
}

.ld-pbar i {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.3s ease;
}

.ld-full-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.16rem 0;
}

.ld-full-label {
    flex: 0 0 46%;
    font-size: 0.62rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ld-full-row .ld-pbar { flex: 1; }

.ld-full-row b {
    font-family: var(--mono);
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--accent);
    flex-shrink: 0;
    min-width: 3.2em;
    text-align: right;
}

/* ── Picker rows ──────────────────────────────────────────── */
.ld-picker-icon {
    height: 24px;
    width: 36px;
    object-fit: contain;
    image-rendering: pixelated;
    flex-shrink: 0;
}

/* Quantity owned (items from the save sort first) */
.ld-picker-qty {
    font-family: var(--mono);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-green-positive);
    background: var(--color-surface-1);
    border: 1px solid var(--color-green-tint-30);
    border-radius: 3px;
    padding: 0 4px;
    line-height: 1rem;
    flex-shrink: 0;
}
</style>
