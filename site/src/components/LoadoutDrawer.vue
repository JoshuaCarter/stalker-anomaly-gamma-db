<template>
<div class="ld-drawer">
    <!-- Provenance legend + reset-to-save (imported saves only; in manual mode the loadout is the saved state) -->
    <div v-if="!manual" class="ld-legend">
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
                <div v-for="key in col" :key="key" class="ld-stack" :class="{ 'ld-stack-paired': hasAmmoSlot(key) }">
                <div
                    class="ld-slot"
                    :class="slotClasses(key, null)"
                    :draggable="!!slots[key]"
                    @click="openPicker(key, null)"
                    @dragstart="onSlotDragOut(key, null, $event)"
                    @dragend="onSlotDragOutEnd($event)"
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
                <!-- Loaded-ammo sub-slot: shown under a weapon that takes ammo -->
                <div
                    v-if="hasAmmoSlot(key)"
                    class="ld-slot ld-ammo-slot"
                    :class="slotClasses(ammoSlotFor(key), null)"
                    :draggable="!!slots[ammoSlotFor(key)]"
                    @click="openPicker(ammoSlotFor(key), null)"
                    @dragstart="onSlotDragOut(ammoSlotFor(key), null, $event)"
                    @dragend="onSlotDragOutEnd($event)"
                    @dragover="onSlotDragOver(ammoSlotFor(key), null, $event)"
                    @dragleave="onSlotDragLeave(ammoSlotFor(key), null)"
                    @drop="onSlotDrop(ammoSlotFor(key), null, $event)"
                    @mouseenter="slots[ammoSlotFor(key)] && $emit('showItemHover', slots[ammoSlotFor(key)], $event)"
                    @mousemove="slots[ammoSlotFor(key)] && $emit('moveItemHover', $event)"
                    @mouseleave="slots[ammoSlotFor(key)] && $emit('hideItemHover')"
                >
                    <span class="ld-prov"></span>
                    <template v-if="slots[ammoSlotFor(key)]">
                        <img class="ld-icon ld-icon-ammo" :src="'img/icons/' + slots[ammoSlotFor(key)] + '.png'" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
                        <span class="ld-name ld-name-ammo">{{ itemName(slots[ammoSlotFor(key)]) }}</span>
                        <button class="ld-x" @click.stop="clearSlot(ammoSlotFor(key), null)">&times;</button>
                    </template>
                    <template v-else>
                        <span class="ld-name ld-name-empty ld-name-ammo">+ {{ t('app_build_ammo') }}</span>
                    </template>
                </div>
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
                :draggable="!!id"
                @click="openPicker('belt', i)"
                @dragstart="onSlotDragOut('belt', i, $event)"
                @dragend="onSlotDragOutEnd($event)"
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

        <!-- Statistics: full gear + protection + restoration set (mirrors the Build Planner) -->
        <div class="ld-sect"><span>{{ t('app_build_statistics') }}</span></div>
        <div class="ld-stats-grid">
            <div
                v-for="tile in statTiles"
                :key="tile.key"
                class="ld-stat-tile"
                :class="{ 'ld-stat-zero': tile.zero }"
            >
                <span class="ld-stat-name">{{ tile.label }}</span>
                <span class="ld-stat-val" :class="{ 'ld-stat-neg': tile.negative }">
                    <span v-if="tile.capped" class="ld-cap" v-tooltip="t('app_build_capped')">CAP</span>
                    {{ tile.value }}
                </span>
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
        @close="closePicker"
        @select="pickFromPicker"
        @item-hover="(item, event) => $emit('showItemHover', item.id, event)"
        @item-move="(event) => $emit('moveItemHover', event)"
        @item-leave="$emit('hideItemHover')"
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
import { PRIMARY_WEAPON_SLUGS, SIDEARM_SLUGS, CAT, isBackpack, BASE_RESIST_CAP, CAP_FIELD_MAP } from '../../js/constants.js';
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

/** Weapon slot → its loaded-ammo sub-slot, and the reverse. */
const AMMO_SLOTS = { primary: 'ammoPrimary', secondary: 'ammoSecondary', sidearm: 'ammoSidearm' };
const AMMO_SLOT_WEAPON = { ammoPrimary: 'primary', ammoSecondary: 'secondary', ammoSidearm: 'sidearm' };

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

const REST_FIELDS = [
    'st_prop_restore_health',
    'st_prop_restore_bleeding',
    'st_data_export_restore_radiation',
    'ui_inv_outfit_power_restore',
];

export default {
    components: { ItemPickerModal },
    props: {
        open: { type: Boolean, default: false },
        actorItems: { type: Array, default: () => [] },
        // Weapon section → loaded ammo_type index (from the save); resolves to a loaded-ammo slot.
        weaponAmmoIdx: { type: Object, default: () => ({}) },
        // Manually chosen ammo persisted on the model: { primary, secondary, sidearm } → ammo section.
        savedAmmo: { type: Object, default: () => ({}) },
        indexById: { type: Object, default: () => new Map() },
        resolveFull: { type: Function, required: true },
        // { id, category } of the inventory cell currently being dragged, or null
        dragItem: { type: Object, default: null },
        // Blank-stash mode: slot edits write back to the saved inventory instead
        // of staying as a local what-if experiment.
        manual: { type: Boolean, default: false },
    },
    emits: ['close', 'showItemHover', 'moveItemHover', 'hideItemHover', 'equipLoadout', 'setAmmo'],
    inject: ['t', 'tItemName', 'tCat', 'headerLabel', 'buildStatFormatted'],
    data() {
        return {
            slots: {
                helmet: null, outfit: null, backpack: null,
                primary: null, secondary: null, sidearm: null, grenade: null,
                ammoPrimary: null, ammoSecondary: null, ammoSidearm: null,
                belt: Array(BELT_MAX).fill(null),
            },
            dirty: false,
            pickerSlot: null,   // { key, idx } or null
            overSlot: null,     // "key" / "belt:i" while a drag hovers it
            slotDefs: SLOT_DEFS,
            dollColumns: DOLL_COLUMNS,
            ammoSlots: AMMO_SLOTS,
        };
    },
    computed: {
        /** Loadout as recorded in the save (equipped flags), mapped to slots. */
        savedLoadout() {
            const saved = {
                helmet: null, outfit: null, backpack: null,
                primary: null, secondary: null, sidearm: null, grenade: null,
                ammoPrimary: null, ammoSecondary: null, ammoSidearm: null,
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
            // Pre-fill loaded ammo: imported save's ammo_type index, else a manual choice
            for (const [weaponKey, ammoKey] of Object.entries(AMMO_SLOTS)) {
                saved[ammoKey] = this.loadedAmmoFor(saved[weaponKey], weaponKey);
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
        /** Combined stats of everything slotted — same field set and cap rules as
            the Build Planner's buildCombinedStats (weapons count toward weight only). */
        stats() {
            const parseNum = (v) => {
                if (v == null || v === '') return 0;
                return parseFloat(String(v).replace(/%$/, '')) || 0;
            };
            // Slotted items tagged with their slot, mirroring the planner's buildAllItems
            const all = [];
            const add = (id, slot) => { const f = id ? this.resolveFull(id) : null; if (f) all.push({ item: f, slot }); };
            add(this.slots.helmet, 'helmet');
            add(this.slots.outfit, 'outfit');
            add(this.slots.backpack, 'backpack');
            for (const id of this.slots.belt) add(id, 'artifact');
            for (const key of ['primary', 'secondary', 'sidearm', 'grenade']) add(this.slots[key], 'weapon');

            const sumField = (field, slotFilter) => {
                let total = 0;
                for (const { item, slot } of all) {
                    if (slotFilter && !slotFilter(slot)) continue;
                    total += parseNum(item[field]);
                }
                return total;
            };

            const protections = {};
            for (const f of PROT_FIELDS) {
                let total = sumField(f);
                let capped = false;
                const capField = CAP_FIELD_MAP[f];
                if (capField && total > 0) {
                    let capSum = 0;
                    for (const { item } of all) capSum += parseNum(item[capField]);
                    const maxResist = BASE_RESIST_CAP + capSum;
                    if (total > maxResist) { total = maxResist; capped = true; }
                }
                protections[f] = { total, capped };
            }

            const restorations = {};
            for (const f of REST_FIELDS) restorations[f] = sumField(f);

            return {
                weight: sumField('st_prop_weight'),
                carry: sumField('ui_inv_outfit_additional_weight'),
                armor: sumField('ui_inv_ap_res', s => s === 'outfit' || s === 'helmet' || s === 'belt'),
                speed: this.slots.outfit ? parseNum(this.resolveFull(this.slots.outfit)?.['ui_inv_outfit_speed']) : null,
                protections,
                restorations,
            };
        },
        /** Flat, ordered tile list for the responsive multi-column stats grid. */
        statTiles() {
            const s = this.stats;
            const fmt = (f, v) => this.buildStatFormatted(f, v);
            const tiles = [
                { key: 'weight', label: this.t('st_prop_weight'), value: fmt('st_prop_weight', s.weight), zero: s.weight === 0 },
                { key: 'carry', label: this.t('ui_inv_outfit_additional_weight'), value: fmt('ui_inv_outfit_additional_weight', s.carry), zero: s.carry === 0 },
                { key: 'armor', label: this.t('ui_inv_ap_res'), value: fmt('ui_inv_ap_res', s.armor), zero: s.armor === 0 },
            ];
            if (s.speed !== null) {
                tiles.push({ key: 'speed', label: this.t('ui_inv_outfit_speed'), value: fmt('ui_inv_outfit_speed', s.speed), zero: s.speed === 0, negative: s.speed < 0 });
            }
            for (const f of PROT_FIELDS) {
                const p = s.protections[f];
                tiles.push({ key: f, label: this.headerLabel(f), value: fmt(f, p.total), zero: p.total === 0, negative: p.total < 0, capped: p.capped });
            }
            for (const f of REST_FIELDS) {
                const v = s.restorations[f];
                tiles.push({ key: f, label: this.headerLabel(f), value: fmt(f, v), zero: v === 0, negative: v < 0 });
            }
            return tiles;
        },
        ownedCounts() {
            const counts = new Map();
            for (const it of this.actorItems) counts.set(it.s, (counts.get(it.s) || 0) + it.q);
            return counts;
        },
        /** Every matching item in the database; owned items first. */
        pickerItems() {
            if (!this.pickerSlot) return [];
            const key = this.pickerSlot.key;
            // Ammo slots match a short, fixed type list — resolve it once rather than
            // re-deriving the weapon's ammo types for every index entry.
            const ammoTypes = AMMO_SLOT_WEAPON[key]
                ? new Set(this.weaponAmmoTypes(this.slots[AMMO_SLOT_WEAPON[key]]))
                : null;
            const items = [];
            for (const entry of this.indexById.values()) {
                const ok = ammoTypes ? ammoTypes.has(entry.id) : this.accepts(key, entry.id);
                if (!ok) continue;
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
            const key = this.pickerSlot.key;
            if (AMMO_SLOT_WEAPON[key]) return this.t('app_build_ammo');
            const def = SLOT_DEFS[key];
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
                ammoPrimary: s.ammoPrimary, ammoSecondary: s.ammoSecondary, ammoSidearm: s.ammoSidearm,
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
        /** Normalized ammo section ids a weapon accepts (primary + alt types). */
        weaponAmmoTypes(weaponId) {
            const wpn = weaponId ? this.resolveFull(weaponId) : null;
            if (!wpn) return [];
            const types = (wpn.ui_ammo_types || '').split(';').filter(Boolean);
            const alt = (wpn.st_data_export_ammo_types_alt || '').split(';').filter(Boolean);
            return [...types, ...alt].map(t => t.replace(/-/g, '_'));
        },
        /** Loaded ammo section for a weapon slot: the save's ammo_type index if present,
            otherwise a manually chosen round persisted on the model (kept only while it
            still fits the equipped weapon). */
        loadedAmmoFor(weaponId, slotKey) {
            if (!weaponId) return null;
            const types = this.weaponAmmoTypes(weaponId);
            const idx = this.weaponAmmoIdx[weaponId];
            if (idx !== undefined && idx >= 0 && idx < types.length) return types[idx];
            const manual = this.savedAmmo ? this.savedAmmo[slotKey] : null;
            return manual && types.includes(manual) ? manual : null;
        },
        ammoSlotFor(weaponKey) {
            return AMMO_SLOTS[weaponKey] || null;
        },
        /** True when a weapon slot has a weapon that takes ammo (drives its sub-slot). */
        hasAmmoSlot(weaponKey) {
            return !!AMMO_SLOTS[weaponKey] && !!this.slots[weaponKey] && this.weaponAmmoTypes(this.slots[weaponKey]).length > 0;
        },
        /** Does an item belong in this slot? */
        accepts(key, id) {
            // Ammo sub-slots accept any round compatible with the weapon above them.
            if (AMMO_SLOT_WEAPON[key]) {
                return this.weaponAmmoTypes(this.slots[AMMO_SLOT_WEAPON[key]]).includes(id);
            }
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
                // Provenance only means something against an imported save
                'ld-saved': !this.manual && !!value && value === savedValue,
                'ld-mod': !this.manual && !!value && value !== savedValue,
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
        /** Drag a slotted item out toward the inventory grid (unequip on drop). */
        onSlotDragOut(key, idx, event) {
            const id = idx === null ? this.slots[key] : this.slots.belt[idx];
            if (!id) return;
            this._dragOutSlot = { key, idx };
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', id);
            // Marker the inventory dropzone recognizes (getData is unreadable during dragover; types is not)
            event.dataTransfer.setData('application/x-gamma-loadout-item', id);
            this.$emit('hideItemHover');
        },
        onSlotDragOutEnd(event) {
            // The inventory dropzone accepts with dropEffect 'move'; clear the source slot only then
            if (this._dragOutSlot && event.dataTransfer.dropEffect === 'move') {
                this.clearSlot(this._dragOutSlot.key, this._dragOutSlot.idx);
            }
            this._dragOutSlot = null;
        },
        setSlot(key, idx, id) {
            if (idx === null) this.slots[key] = id;
            else this.slots.belt[idx] = id;
            // Swapping/removing a weapon drops any loaded ammo that no longer fits it
            const ammoKey = AMMO_SLOTS[key];
            if (ammoKey && this.slots[ammoKey] && !this.weaponAmmoTypes(id).includes(this.slots[ammoKey])) {
                this.slots[ammoKey] = null;
            }
            // In manual mode the loadout IS the saved state: persist the change
            // (parent reconciles equipped flags) rather than marking a local edit.
            // Ammo isn't equipped gear, so it persists on its own channel; a weapon
            // swap that invalidated its ammo persists that clear too.
            if (this.manual) {
                if (AMMO_SLOT_WEAPON[key]) this.emitAmmo();
                else { this.emitLoadout(); if (ammoKey) this.emitAmmo(); }
            } else {
                this.dirty = true;
            }
        },
        emitLoadout() {
            this.$emit('equipLoadout', {
                helmet: this.slots.helmet,
                outfit: this.slots.outfit,
                backpack: this.slots.backpack,
                primary: this.slots.primary,
                secondary: this.slots.secondary,
                sidearm: this.slots.sidearm,
                grenade: this.slots.grenade,
                belt: this.slots.belt.filter(Boolean),
            });
        },
        emitAmmo() {
            this.$emit('setAmmo', {
                primary: this.slots.ammoPrimary,
                secondary: this.slots.ammoSecondary,
                sidearm: this.slots.ammoSidearm,
            });
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
            this.closePicker();
        },
        closePicker() {
            this.pickerSlot = null;
            // Picker rows may unmount before mouseleave fires — clear any lingering popover
            this.$emit('hideItemHover');
        },
        onKeydown(e) {
            if (e.key !== 'Escape' || !this.open) return;
            if (this.pickerSlot) this.closePicker();
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
.ld-dot-mod { background: var(--color-blue-bright); box-shadow: 0 0 4px var(--color-blue-bright); }

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
    min-height: 92px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    /* Extra top padding reserves room for the absolutely-placed tag */
    padding: 1rem 0.3rem 0.45rem;
    background: var(--color-surface-2);
    border: 1px solid var(--border);
    border-radius: 5px;
    cursor: pointer;
    text-align: center;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, opacity 0.15s;
}

.ld-slot:hover {
    border-color: var(--accent-dim);
    /* Lift above an overlapping paired neighbour so the highlight rings all sides */
    z-index: 1;
}

/* Tag floats at the top so it no longer steals a flex row from the icon */
.ld-tag {
    position: absolute;
    top: 0.4rem;
    left: 0;
    right: 0;
    text-align: center;
    font-family: var(--mono);
    font-size: 0.52rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-secondary);
    pointer-events: none;
}

.ld-icon {
    width: 82%;
    max-width: 96px;
    height: auto;
    max-height: 52px;
    object-fit: contain;
    image-rendering: pixelated;
}

.ld-icon-sm { width: 74%; max-width: 64px; max-height: 46px; }

/* ── Weapon + ammo stack ──────────────────────────────────── */
/* The stack is the column's flex child, so the inter-slot gutter falls between
   stacks. A weapon and its ammo sub-slot sit flush inside one stack, merged into
   a single bordered box divided by one line (the ammo slot's top border). */
.ld-stack {
    display: flex;
    flex-direction: column;
}

/* Square the meeting corners only; both slots keep all four borders so hover/drag
   highlights ring every side. The ammo slot's -1px top margin overlaps the shared
   pair of borders into a single divider line. */
.ld-stack-paired > .ld-slot:first-child {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
}

/* ── Loaded-ammo sub-slot (sits directly under its weapon) ── */
.ld-ammo-slot {
    min-height: 44px;
    flex-direction: row;
    gap: 0.35rem;
    padding: 0.25rem 0.4rem;
    margin-top: -1px;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
}

.ld-icon-ammo {
    width: auto;
    max-width: 38px;
    max-height: 26px;
}

.ld-name-ammo {
    -webkit-line-clamp: 1;
    font-size: 0.56rem;
    text-align: left;
}

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
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border: 1px dashed var(--border);
    border-radius: 3px;
    color: var(--text-secondary);
    font-size: 0.85rem;
    line-height: 1;
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
    /* Aligned with the inventory grid's equipped marker (.pi-equip) */
    top: 5px;
    left: 5px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: none;
}

/* From Save = green, Modified = blue (distinct from the gold "equipped" marker) */
.ld-saved .ld-prov { display: block; background: var(--color-green-positive); box-shadow: 0 0 4px var(--color-green-positive); }
.ld-mod .ld-prov { display: block; background: var(--color-blue-bright); box-shadow: 0 0 4px var(--color-blue-bright); }

/* drag states */
.ld-eligible {
    border-color: var(--accent-dim);
    border-style: dashed;
    animation: ld-pulse 1.1s ease-in-out infinite;
    z-index: 1;
}

.ld-dim { opacity: 0.35; }

.ld-over {
    border-color: var(--accent) !important;
    border-style: solid !important;
    background: var(--color-accent-tint-12) !important;
    box-shadow: 0 0 0 1px var(--accent), inset 0 0 18px var(--color-accent-tint-12) !important;
    z-index: 2;
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
    flex: 1 1 0;
    max-width: 84px;
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
/* Multi-column tile flow: as many ~200px columns as fit, capped at 3, so the
   grid collapses to fewer columns at narrow flyout widths / small screens. */
.ld-stats-grid {
    margin: 0 0.8rem 0.9rem;
    columns: 200px 3;
    column-gap: 1.4rem;
}

.ld-stat-tile {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.22rem 0;
    border-bottom: 1px dashed var(--border);
    break-inside: avoid;
}

.ld-stat-name {
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ld-stat-val {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--mono);
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
    flex-shrink: 0;
}

/* Zeroed stats are dimmed (matches the planner's build-prot-low) */
.ld-stat-zero .ld-stat-val {
    color: var(--text-secondary);
    opacity: 0.65;
}

.ld-stat-neg {
    color: var(--color-red-soft);
}

.ld-cap {
    font-family: var(--mono);
    font-size: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-bg);
    background: var(--accent);
    border-radius: 2px;
    padding: 0 3px;
    line-height: 1.1;
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
