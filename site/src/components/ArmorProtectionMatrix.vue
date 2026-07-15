<template>
<div class="pm">
  <div class="pm-head">
    <h2>{{ t('app_pm_title') }}</h2>
    <p class="pm-lede">{{ t('app_pm_intro') }}</p>
  </div>

  <div class="pm-toolbar">
    <div class="pm-control">
      <label for="pm-cond">{{ t('app_sim_armor_condition') }}</label>
      <input id="pm-cond" type="range" min="0" max="100" step="1" v-model.number="condition" :style="{ '--fill': condition + '%' }" />
      <output>{{ condition }}%</output>
    </div>
    <button class="pm-add-btn" @click="ammoPickerOpen = true"><span class="pm-plus">+</span> {{ t('app_pm_add_ammo') }}</button>
  </div>

  <div class="pm-scroll" v-if="rows.length">
    <div class="pm-grid" :style="{ gridTemplateColumns: gridTemplate }">
      <!-- header -->
      <div class="pm-cell pm-corner">{{ t('app_pm_corner') }}</div>
      <div v-for="col in columns" :key="col.key" class="pm-cell pm-colhead" :class="{ custom: col.custom }">
        <span class="pm-cname">{{ col.name }}</span>
        <span class="pm-ap">{{ col.ap }}</span>
        <button v-if="col.custom" class="pm-rm" :aria-label="t('app_pm_remove') + ' ' + col.name" @click="removeAmmo(col.key)">&times;</button>
      </div>
      <div class="pm-cell pm-rating-head">{{ t('app_pm_rating') }}</div>

      <!-- rows -->
      <template v-for="row in rows" :key="row.id">
        <div class="pm-cell pm-rail">
          <span class="pm-aname">{{ tName(row.item) }}</span>
          <span class="pm-br">BR&nbsp;<b>{{ scaled(row.br) }}</b> · {{ scaled(row.res) }}%</span>
          <span class="pm-tag">{{ t(row.slot === 'head' ? 'app_sim_hitzone_head' : 'app_sim_hitzone_torso') }}</span>
          <button class="pm-row-rm" :aria-label="t('app_pm_remove') + ' ' + tName(row.item)" @click="removeRow(row.id)">&times;</button>
        </div>
        <div v-for="(cell, ci) in cellsFor(row)" :key="row.id + col_key(ci)" class="pm-cell pm-dcell"
             :class="{ frontier: cell.frontier }"
             :style="{ '--db': cell.bg, '--dc': cell.fg }"
             :title="cellTitle(row, cell)">{{ cell.pct }}%</div>
        <div class="pm-cell pm-rating">
          <span class="pm-rnum">{{ ratingFor(row) }}</span>
          <span class="pm-rbar"><i :style="{ width: ratingFor(row) + '%' }"></i></span>
        </div>
      </template>
    </div>
  </div>

  <div class="pm-add-row" :class="{ empty: !rows.length }" @click="armourPickerOpen = true">
    <span class="pm-plus">+</span> {{ t('app_pm_add_armour') }}
  </div>

  <p class="pm-caption">{{ t('app_pm_caption') }}</p>

  <ItemPickerModal :open="armourPickerOpen" :title="t('app_pm_add_armour')" :placeholder="t('app_sim_search_armor')"
                   :empty-text="t('app_sim_no_results')" :items="armourChoices" :label-fn="(a) => tName(a)"
                   @close="armourPickerOpen = false" @select="selectArmour">
    <template #item="{ item }">
      <span class="build-picker-item-name">{{ tName(item) }}</span>
      <span class="build-picker-item-type">BR {{ brClass(item) }} / {{ brResPct(item) }}%</span>
    </template>
  </ItemPickerModal>

  <ItemPickerModal :open="ammoPickerOpen" :title="t('app_pm_add_ammo')" :placeholder="t('app_sim_search_armor')"
                   :empty-text="t('app_sim_no_results')" :items="ammoChoices" :label-fn="(a) => tName(a)"
                   @close="ammoPickerOpen = false" @select="selectAmmo">
    <template #item="{ item }">
      <span class="build-picker-item-name">{{ tName(item) }}</span>
      <span class="build-picker-item-type">AP {{ ammoAp(item) }}</span>
    </template>
  </ItemPickerModal>
</div>
</template>

<script>
import { calcActorDamage, ACTOR_FIRE_WOUND } from '../../js/damage-calc.js';
import { BALLISTIC_TIERS } from '../../js/utils.js';
import ItemPickerModal from './modals/ItemPickerModal.vue';

// Actor protection matrix: candidate armours (rows) × incoming rounds (columns),
// each cell the damage taken. Columns are the canonical AP tiers plus any specific
// ammo added, ordered by armour-piercing power. Bare armour, body/head shot,
// condition-scaled. Uses the GAMMA actor formula (calcActorDamage).
export default {
  name: 'ArmorProtectionMatrix',
  components: { ItemPickerModal },
  inject: ['t', 'tName'],
  props: {
    outfits: { type: Array, default: () => [] },
    helmets: { type: Array, default: () => [] },
    ammoItems: { type: Array, default: () => [] },
  },
  data() {
    return {
      rows: [],          // [{ id, item, slot, br, res, boneArmor, hfa }]
      addedAmmo: [],     // [{ key, name, ap }]
      condition: 100,
      armourPickerOpen: false,
      ammoPickerOpen: false,
      _seq: 0,
    };
  },
  computed: {
    // Outfits + helmets carrying the actor calc fields.
    armourChoices() {
      const tag = (arr, slot) => (arr || [])
        .filter(a => typeof a.boneArmor === 'number' && typeof a.hitFractionActor === 'number')
        .map(a => ({ ...a, _slot: slot }));
      return [...tag(this.outfits, 'body'), ...tag(this.helmets, 'head')]
        .sort((a, b) => (this.tName(a) || a.id).localeCompare(this.tName(b) || b.id));
    },
    ammoChoices() {
      return (this.ammoItems || [])
        .filter(a => !isNaN(parseFloat(a.st_data_export_k_ap)))
        .sort((a, b) => (this.tName(a) || a.id).localeCompare(this.tName(b) || b.id));
    },
    columns() {
      const tiers = BALLISTIC_TIERS.map(tr => ({ key: 't' + Math.round(tr.kAp * 100), name: this.t(tr.labelKey), ap: Math.round(tr.kAp * 100), custom: false }));
      const cols = tiers.concat(this.addedAmmo.map(a => ({ key: a.key, name: a.name, ap: a.ap, custom: true })));
      return cols.sort((x, y) => x.ap - y.ap);
    },
    gridTemplate() {
      return `minmax(150px,1.3fr) repeat(${this.columns.length}, minmax(46px,1fr)) minmax(92px,1.1fr)`;
    },
    cond() { return this.condition / 100; },
  },
  methods: {
    brClass(item) { return Math.round((1 - item.hitFractionActor) * 100); },
    brResPct(item) { return Math.round(item.boneArmor * 0.8 * 100); },
    ammoAp(item) { return Math.round(parseFloat(item.st_data_export_k_ap) * 1000); },
    scaled(v) { return Math.round(v * this.cond); },
    col_key(ci) { return this.columns[ci] ? this.columns[ci].key : ci; },

    selectArmour(a) {
      this.rows.push({ id: 'r' + (this._seq++), item: a, slot: a._slot, br: this.brClass(a), res: this.brResPct(a), boneArmor: a.boneArmor, hfa: a.hitFractionActor });
      this.armourPickerOpen = false;
    },
    removeRow(id) { this.rows = this.rows.filter(r => r.id !== id); },
    selectAmmo(a) {
      const key = 'a' + a.id;
      if (!this.addedAmmo.some(x => x.key === key)) {
        this.addedAmmo.push({ key, name: this.shortName(this.tName(a) || a.id), ap: this.ammoAp(a) });
      }
      this.ammoPickerOpen = false;
    },
    removeAmmo(key) { this.addedAmmo = this.addedAmmo.filter(a => a.key !== key); },
    shortName(name) { return name.replace(/\s*ammo\s*/i, '').trim(); },

    cellColors(pct) {
      const t = Math.max(0, Math.min(1, (pct - 25) / 60));
      const hue = 132 - 132 * t;
      return { bg: `hsl(${hue} 42% 20%)`, fg: `hsl(${hue} 62% 70%)` };
    },
    cellsFor(row) {
      let frontierDone = false;
      return this.columns.map(col => {
        const r = calcActorDamage({ kAp: col.ap / 100, boneArmor: row.boneArmor, hitFractionActor: row.hfa, cond: this.cond, fw: ACTOR_FIRE_WOUND });
        const pct = Math.round(r.damageFraction * 100);
        const c = this.cellColors(pct);
        const frontier = !r.stopped && !frontierDone;
        if (frontier) frontierDone = true;
        return { pct, stopped: r.stopped, frontier, bg: c.bg, fg: c.fg, name: col.name, ap: col.ap };
      });
    },
    ratingFor(row) {
      const mean = BALLISTIC_TIERS.reduce((s, tr) => {
        const r = calcActorDamage({ kAp: tr.kAp, boneArmor: row.boneArmor, hitFractionActor: row.hfa, cond: this.cond, fw: ACTOR_FIRE_WOUND });
        return s + (1 - r.damageFraction);
      }, 0) / BALLISTIC_TIERS.length;
      return Math.round(mean * 100);
    },
    cellTitle(row, cell) {
      return `${cell.name} (AP ${cell.ap}) — ${cell.stopped ? this.t('app_pen_stopped') : this.t('app_pen_penetrates')}, ${cell.pct}%`;
    },
  },
};
</script>

<style scoped>
.pm { display: flex; flex-direction: column; gap: 1rem; color: var(--text); }
.pm-head h2 { font-family: var(--font-display); font-size: 1.25rem; font-weight: 600; margin: 0 0 0.35rem; }
.pm-lede { color: var(--text-secondary); font-size: 0.82rem; margin: 0; max-width: 64ch; line-height: 1.55; }

.pm-toolbar { display: flex; gap: 0.8rem; flex-wrap: wrap; }
.pm-control { display: flex; align-items: center; gap: 0.9rem; flex: 1; min-width: 260px; padding: 0.7rem 1rem; background: var(--color-card-alt); border: 1px solid var(--border); border-radius: 6px; }
.pm-control label { font-size: 0.55rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent-dim); font-weight: 600; white-space: nowrap; }
.pm-control output { font-family: var(--mono); color: var(--accent); font-size: 0.85rem; min-width: 3.2ch; }
input[type=range] { -webkit-appearance: none; appearance: none; flex: 1; min-width: 120px; height: 3px; border-radius: 2px; cursor: pointer;
  background: linear-gradient(to right, var(--accent) var(--fill,100%), var(--border) var(--fill,100%)); }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 15px; height: 15px; border-radius: 50%; background: var(--accent); border: 2px solid var(--bg); }
input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); border: 2px solid var(--bg); }
input[type=range]:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.pm-add-btn, .pm-add-row { font-family: var(--font-display); font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-secondary);
  background: var(--color-card-alt); border: 1px dashed var(--border); border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; }
.pm-add-btn { padding: 0 1.1rem; white-space: nowrap; }
.pm-add-row { padding: 0.65rem 0.9rem; }
.pm-add-btn:hover, .pm-add-row:hover { border-color: var(--accent); color: var(--accent); }
.pm-add-row.empty { justify-content: center; padding: 1.4rem; }
.pm-plus { font-size: 1rem; line-height: 1; }

.pm-scroll { overflow-x: auto; }
.pm-grid { display: grid; gap: 3px; min-width: 860px; font-variant-numeric: tabular-nums; }
.pm-cell { padding: 0.5rem 0.35rem; border-radius: 4px; }
.pm-corner { display: flex; align-items: flex-end; font-size: 0.55rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-secondary); }
.pm-colhead { background: var(--color-card-alt); text-align: center; display: flex; flex-direction: column; gap: 0.15rem; justify-content: flex-end; position: relative; }
.pm-cname { font-size: 0.55rem; line-height: 1.15; }
.pm-ap { font-family: var(--mono); font-size: 0.82rem; font-weight: 700; color: var(--text-secondary); }
.pm-colhead.custom { box-shadow: inset 0 -2px 0 var(--accent); }
.pm-colhead.custom .pm-cname { color: var(--accent); }
.pm-rm, .pm-row-rm { position: absolute; border: 0; background: none; color: var(--text-secondary); cursor: pointer; font-family: var(--mono); opacity: 0; padding: 0; }
.pm-rm { top: 2px; right: 3px; width: 14px; height: 14px; line-height: 12px; font-size: 0.72rem; border-radius: 3px; }
.pm-row-rm { top: 4px; right: 4px; font-size: 0.85rem; }
.pm-colhead:hover .pm-rm, .pm-rail:hover .pm-row-rm { opacity: 1; }
.pm-rm:hover, .pm-row-rm:hover { color: var(--accent); }
.pm-rm:focus-visible, .pm-row-rm:focus-visible { opacity: 1; outline: 1px solid var(--accent); }
.pm-rating-head { background: var(--color-card-alt); display: flex; align-items: flex-end; justify-content: flex-end; font-size: 0.55rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }

.pm-rail { background: var(--color-card-alt); display: flex; flex-direction: column; gap: 0.2rem; justify-content: center; padding: 0.5rem 0.7rem; position: relative; }
.pm-aname { font-size: 0.82rem; font-weight: 600; }
.pm-br { font-family: var(--mono); font-size: 0.6rem; color: var(--text-secondary); }
.pm-br b { color: var(--accent); }
.pm-tag { font-size: 0.5rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); border: 1px solid var(--border); border-radius: 3px; padding: 0 0.3rem; align-self: flex-start; }

.pm-dcell { text-align: center; font-family: var(--mono); font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; justify-content: center;
  color: var(--dc, var(--text)); background: var(--db, var(--color-card-alt)); transition: background .18s ease, color .18s ease; }
.pm-dcell.frontier { box-shadow: inset 3px 0 0 var(--accent); }

.pm-rating { background: var(--color-card-alt); display: flex; flex-direction: column; gap: 0.3rem; justify-content: center; padding: 0.4rem 0.6rem; }
.pm-rnum { font-family: var(--mono); font-size: 0.95rem; font-weight: 700; color: var(--accent); }
.pm-rbar { height: 4px; border-radius: 2px; background: var(--border); overflow: hidden; }
.pm-rbar i { display: block; height: 100%; background: var(--accent); }

.pm-caption { color: var(--text-secondary); font-size: 0.68rem; margin: 0; max-width: 70ch; line-height: 1.6; }

@media (prefers-reduced-motion: reduce) { .pm-dcell { transition: none; } }
</style>
