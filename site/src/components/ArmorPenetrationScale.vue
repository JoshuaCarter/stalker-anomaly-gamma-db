<template>
<div class="pen-scale">
    <div class="pen-scale-head">
        <div class="pen-stat">
            <span class="pen-stat-label">{{ t('ui_inv_ap_res') }}</span>
            <span class="pen-stat-val">{{ brClass }}</span>
        </div>
        <div class="pen-stat">
            <span class="pen-stat-label">{{ t('ui_inv_outfit_fire_wound_protection') }}</span>
            <span class="pen-stat-val">{{ brResPct }}%</span>
        </div>
        <div v-if="maxStopLabel" class="pen-stat pen-stat-grow">
            <span class="pen-stat-label">{{ t('app_pen_stops_up_to') }}</span>
            <span class="pen-stat-val pen-stat-val-sm">{{ maxStopLabel }}</span>
        </div>
    </div>

    <!-- Zone headers, sized to sit over their half of the track below -->
    <div class="pen-zones">
        <div v-if="stoppedCount" class="pen-zone pen-zone-stopped" :style="{ flexGrow: stoppedCount }">
            <span>{{ t('app_pen_stopped') }}</span>
            <b>{{ stoppedDmgPct }}% {{ t('app_pen_damage_taken') }}</b>
        </div>
        <div v-if="penCount" class="pen-zone pen-zone-pen" :style="{ flexGrow: penCount }">
            <span>{{ t('app_pen_penetrates') }}</span>
            <b>{{ penDmgPct }}% {{ t('app_pen_damage_taken') }}</b>
        </div>
    </div>

    <!-- Ammo track ordered by armour-piercing power, with the BR Class threshold blade -->
    <div class="pen-track">
        <div v-for="(tier, i) in tiers" :key="tier.labelKey"
             class="pen-seg"
             :class="[tier.stopped ? 'pen-seg-stopped' : 'pen-seg-pen', { 'pen-seg-max': i === maxStopIndex }]">
            <span class="pen-seg-ap">{{ tier.ap }}</span>
            <span class="pen-seg-name">{{ tier.label }}</span>
        </div>
        <div class="pen-blade" :class="{ 'pen-blade-edge': bladeEdge }" :style="{ left: bladeLeftPct + '%' }"></div>
    </div>

    <div class="pen-axis">
        <span class="pen-axis-rail"></span>
        <span class="pen-axis-label">{{ t('app_pen_axis') }}</span>
    </div>

    <div class="pen-scale-caption">{{ t('app_pen_caption') }}</div>
</div>
</template>

<script>
import { BALLISTIC_TIERS } from '../../js/utils.js';

// Static, single-armour penetration breakdown: the armour's BR Class drawn as a
// threshold on the ammo penetration axis, and the damage taken either side of it.
// Bare item, body shot, full condition — belt plates, artefacts, boosters and wear
// are loadout-specific and belong in the actor mode of the damage calculator.
// Mirrors ballisticRating() (utils.js) shown per-tier instead of averaged.
export default {
    name: 'ArmorPenetrationScale',
    inject: ['t'],
    props: {
        boneArmor: { type: Number, required: true },
        hitFractionActor: { type: Number, required: true },
    },
    computed: {
        brRes() { return this.boneArmor * 0.8; },                 // flat fire-wound protection
        threshold() { return 1 - this.hitFractionActor; },        // penetration gate (= BR Class / 100)
        brClass() { return Math.round(this.threshold * 100); },
        brResPct() { return Math.round(this.brRes * 100); },
        stoppedDmgPct() { return Math.round(0.6 * (1 - this.brRes) * 100); },  // +40% premitigation bucket
        penDmgPct() { return Math.round((1 - this.brRes) * 100); },
        tiers() {
            return BALLISTIC_TIERS.map((tier) => ({
                labelKey: tier.labelKey,
                label: this.t(tier.labelKey),
                ap: Math.round(tier.kAp * 100),           // same 0-100 scale as BR Class
                stopped: this.threshold >= tier.kAp,
            }));
        },
        stoppedCount() { return this.tiers.filter((tier) => tier.stopped).length; },
        penCount() { return this.tiers.length - this.stoppedCount; },
        maxStopIndex() { return this.stoppedCount - 1; },         // last stopped tier (-1 if none)
        maxStopLabel() {
            return this.stoppedCount > 0 ? this.tiers[this.stoppedCount - 1].label : null;
        },
        bladeLeftPct() { return (this.stoppedCount / this.tiers.length) * 100; },
        bladeEdge() { return this.stoppedCount === 0 || this.stoppedCount === this.tiers.length; },
    },
};
</script>
