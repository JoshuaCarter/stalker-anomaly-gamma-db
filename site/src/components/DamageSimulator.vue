<template>
<div class="damage-sim">
  <div class="damage-sim-layout">

    <!-- Left rail: toolbar, then target conditions (one-click, live), then credit -->
    <div class="damage-sim-panel damage-sim-rail">

      <Teleport :to="actionsTarget" :disabled="!actionsTarget">
      <div class="damage-sim-actions damage-sim-rail-actions">
        <button class="copy-link-btn damage-sim-help-toggle" :class="{ active: showHelp }" @click="showHelp = !showHelp; saveToStorage()">
          <LucideCircleHelp :size="14" />
          <span>{{ t('app_sim_show_help') }}</span>
        </button>
        <button class="copy-link-btn" :class="{ copied: _shareFeedback }" @click="copyShareLink()" v-tooltip="_shareFeedback ? t('app_sim_link_copied') : t('app_sim_copy_link')">
          <LucideLink v-show="!_shareFeedback" :size="16" />
          <svg v-show="_shareFeedback" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="copy-link-btn" @click="resetAll()" v-tooltip="t('app_sim_reset')">
          <LucideTrash2 :size="16" />
        </button>
      </div>
      </Teleport>

      <!-- Target -->
      <div class="damage-sim-section-label">{{ t('app_sim_target') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_target') }}</div></div>
      <div class="damage-sim-toggle-group">
        <button :class="{ active: targetType === 'mutant' }" @click="targetType = 'mutant'; saveToStorage()">{{ t('app_sim_target_mutant') }}</button>
        <button :class="{ active: targetType === 'stalker' }" @click="targetType = 'stalker'; saveToStorage()">{{ t('app_sim_target_stalker') }}</button>
      </div>

      <template v-if="targetType === 'mutant'">
        <div class="damage-sim-slot damage-sim-target-slot" :class="selectedMutant ? 'filled' : 'empty'" @click="mutantPickerOpen = true">
          <template v-if="selectedMutant">
            <span class="damage-sim-slot-name">{{ mutantDisplayName(selectedMutant.id) }}</span>
            <span class="damage-sim-slot-meta">
              <span class="damage-sim-stat"><span class="k">Skin</span> <span class="v">{{ selectedMutant.skin_armor }}</span></span>
              <span class="damage-sim-stat"><span class="k">Hit Frac</span> <span class="v">{{ selectedMutant.hit_fraction }}</span></span>
              <span class="damage-sim-stat"><span class="k">Head</span> <span class="v">×{{ selectedMutant.hitzone_head }}</span></span>
            </span>
            <button class="damage-sim-slot-remove" @click.stop="selectedMutantId = ''">&times;</button>
          </template>
          <template v-else>
            <span class="damage-sim-slot-hint">{{ t('app_sim_select_target') }}</span>
          </template>
        </div>
        <div class="damage-sim-section-label">{{ t('app_sim_hitzone') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_hitzone_mutant') }}</div></div>
        <div class="damage-sim-toggle-group">
          <button v-for="z in mutantHitzones" :key="z" :class="{ active: hitzone === z }" @click="hitzone = z; saveToStorage()">{{ t('app_sim_hitzone_' + z) }}<span v-if="selectedMutant" class="damage-sim-btn-sub">{{ selectedMutant['hitzone_' + z] }}x</span></button>
        </div>
      </template>

      <template v-if="targetType === 'stalker'">
        <div class="damage-sim-slot damage-sim-target-slot" :class="selectedNpcProfile ? 'filled' : 'empty'" @click="npcPickerOpen = true">
          <template v-if="selectedNpcProfile">
            <span class="damage-sim-slot-name">{{ npcProfileLabel(selectedNpcProfile) }}</span>
            <span class="damage-sim-slot-meta">
              <span class="damage-sim-stat"><span class="k">Body</span> <span class="v">{{ selectedNpcProfile.body_bonearmor }}</span></span>
              <span class="damage-sim-stat"><span class="k">Head</span> <span class="v">{{ selectedNpcProfile.head_bonearmor }}</span></span>
              <span class="damage-sim-stat"><span class="k">AP Scale</span> <span class="v">{{ selectedNpcProfile.ap_scale }}</span></span>
              <span class="damage-sim-stat"><span class="k">Hit Frac</span> <span class="v">{{ selectedNpcProfile.hit_fraction }}</span></span>
            </span>
            <button class="damage-sim-slot-remove" @click.stop="selectedNpcProfileId = ''">&times;</button>
          </template>
          <template v-else>
            <span class="damage-sim-slot-hint">{{ t('app_sim_select_target') }}</span>
          </template>
        </div>
        <div class="damage-sim-section-label">{{ t('app_sim_hitzone') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_hitzone') }}</div></div>
        <div class="damage-sim-toggle-group">
          <button v-for="z in stalkerHitzones" :key="z" :class="{ active: hitzone === z }" @click="hitzone = z; saveToStorage()">{{ t('app_sim_hitzone_' + z) }}<span v-if="gboConstants.stalker_hitzones" class="damage-sim-btn-sub">{{ stalkerBoneDamageMult(z, gboConstants) }}x<template v-if="hitzoneApBoost(z)">, +{{ hitzoneApBoost(z) }} AP</template></span></button>
        </div>
        <div class="damage-sim-section-label">{{ t('app_sim_faction') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_faction') }}</div></div>
        <div class="damage-sim-toggle-group damage-sim-fac-group">
          <button :class="{ active: faction === 'default' }" @click="faction = 'default'; saveToStorage()">{{ t('app_sim_faction_default') }}<span v-if="gboConstants.faction_resistance" class="damage-sim-btn-sub">{{ resolveFactionRes('default', gboConstants).dmg_res }}x<template v-if="resolveFactionRes('default', gboConstants).ap_res !== resolveFactionRes('default', gboConstants).dmg_res">, {{ resolveFactionRes('default', gboConstants).ap_res }}x AP</template></span></button>
          <button v-for="f in factions" :key="f" :class="{ active: faction === f }" @click="faction = f; saveToStorage()">{{ t('app_sim_faction_' + f) }}<span v-if="gboConstants.faction_resistance" class="damage-sim-btn-sub">{{ resolveFactionRes(f, gboConstants).dmg_res }}x<template v-if="resolveFactionRes(f, gboConstants).ap_res !== resolveFactionRes(f, gboConstants).dmg_res">, {{ resolveFactionRes(f, gboConstants).ap_res }}x AP</template></span></button>
        </div>
      </template>

      <div class="damage-sim-divider"></div>

      <div class="damage-sim-section-label">{{ t('app_sim_distance') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_distance') }}</div></div>
      <div class="damage-sim-range-row">
        <input type="range" v-model.number="distance" min="0" max="300" step="5" @change="saveToStorage()" />
        <span class="damage-sim-range-value">{{ distance }}m</span>
      </div>

      <div class="damage-sim-section-label">{{ t('app_sim_barrel_condition') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_barrel_condition') }}</div></div>
      <div class="damage-sim-range-row">
        <input type="range" v-model.number="barrelCondition" min="0" max="100" step="1" @change="saveToStorage()" />
        <span class="damage-sim-range-value">{{ barrelCondition }}% ({{ barrelConditionCorrected(barrelCondition).toFixed(2) }}x)</span>
      </div>

      <div class="damage-sim-section-label">{{ t('app_sim_difficulty') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_difficulty') }}</div></div>
      <div class="damage-sim-toggle-group">
        <button v-for="d in difficulties" :key="d.key" :class="{ active: difficulty === d.key }" @click="difficulty = d.key; saveToStorage()">{{ t(d.label) }}<span v-if="gboConstants.difficulty" class="damage-sim-btn-sub">{{ gboConstants.difficulty[String(d.key)] }}x</span></button>
      </div>

      <div class="damage-sim-credit damage-sim-rail-credit">
        <LucideHeart :size="12" />
        <span>Inspired by veerserif's damage <a href="https://github.com/veerserif/gamma-dashboard" target="_blank" rel="noopener">calculator</a>.</span>
      </div>

    </div>

    <!-- Right: leaderboard + compare -->
    <div class="damage-sim-panel damage-sim-board-col">
      <div class="damage-sim-board-head">
        <h3 class="damage-sim-board-title">{{ t('app_sim_results') }}</h3>
        <button class="damage-sim-add-primary" @click="openCombinedPicker()">
          {{ t('app_sim_add_pair') }}
        </button>
      </div>

      <!-- Leaderboard -->
      <div v-if="activeResults.length" class="damage-sim-lb-wrap damage-sim-stats-box">
        <table class="damage-sim-lb">
          <thead>
            <tr>
              <th class="damage-sim-lb-pin-col">
                <span class="damage-sim-pin damage-sim-pin-all" :class="{ on: pinAllState !== 'none' }" @click="toggleSelectAll()" v-tooltip="t('app_sim_pin_all')">
                  <svg v-if="pinAllState === 'all'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <svg v-else-if="pinAllState === 'some'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </span>
              </th>
              <th class="left">{{ t('app_sim_weapon_ammo') }}</th>
              <template v-if="targetType === 'stalker'">
                <th class="damage-sim-lb-sortable" :class="{ sorted: sortKey === 'damage' }" @click="sortBy('damage')" v-tooltip="t('app_sim_help_damage')">{{ t('app_sim_col_dmg') }}<span v-if="sortKey === 'damage'" class="damage-sim-lb-arrow">{{ sortDir < 0 ? '▾' : '▴' }}</span></th>
                <th class="damage-sim-lb-sortable" :class="{ sorted: sortKey === 'stk' }" @click="sortBy('stk')" v-tooltip="t('app_sim_help_stk')">{{ t('app_sim_col_stk') }}<span v-if="sortKey === 'stk'" class="damage-sim-lb-arrow">{{ sortDir < 0 ? '▾' : '▴' }}</span></th>
                <th class="damage-sim-lb-sortable" :class="{ sorted: sortKey === 'ap' }" @click="sortBy('ap')" v-tooltip="t('app_sim_help_ap')">{{ t('app_sim_col_ap') }}<span v-if="sortKey === 'ap'" class="damage-sim-lb-arrow">{{ sortDir < 0 ? '▾' : '▴' }}</span></th>
                <th class="damage-sim-lb-sortable" :class="{ sorted: sortKey === 'dps' }" @click="sortBy('dps')" v-tooltip="t('app_sim_help_dps')">{{ t('app_sim_col_dps') }}<span v-if="sortKey === 'dps'" class="damage-sim-lb-arrow">{{ sortDir < 0 ? '▾' : '▴' }}</span></th>
              </template>
              <template v-else>
                <th class="damage-sim-lb-sortable" :class="{ sorted: sortKey === 'damage' }" @click="sortBy('damage')" v-tooltip="t('app_sim_help_damage')">{{ t('app_sim_col_dmg') }}<span v-if="sortKey === 'damage'" class="damage-sim-lb-arrow">{{ sortDir < 0 ? '▾' : '▴' }}</span></th>
                <th class="damage-sim-lb-sortable" :class="{ sorted: sortKey === 'ammoMult' }" @click="sortBy('ammoMult')" v-tooltip="t('app_sim_help_ammo_mult')">{{ t('app_sim_col_ammo') }}<span v-if="sortKey === 'ammoMult'" class="damage-sim-lb-arrow">{{ sortDir < 0 ? '▾' : '▴' }}</span></th>
                <th class="damage-sim-lb-sortable" :class="{ sorted: sortKey === 'stk' }" @click="sortBy('stk')" v-tooltip="t('app_sim_help_stk')">{{ t('app_sim_col_stk') }}<span v-if="sortKey === 'stk'" class="damage-sim-lb-arrow">{{ sortDir < 0 ? '▾' : '▴' }}</span></th>
                <th class="damage-sim-lb-sortable" :class="{ sorted: sortKey === 'dps' }" @click="sortBy('dps')" v-tooltip="t('app_sim_help_dps')">{{ t('app_sim_col_dps') }}<span v-if="sortKey === 'dps'" class="damage-sim-lb-arrow">{{ sortDir < 0 ? '▾' : '▴' }}</span></th>
              </template>
              <th class="damage-sim-lb-sil-col" v-tooltip="t('app_sim_help_silencer_mult')">{{ t('app_sim_col_sil') }}</th>
              <th class="damage-sim-lb-remove-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ar in sortedResults" :key="ar.idx" :class="{ pinned: isPinned(ar.idx) }">
              <td class="damage-sim-lb-pin-cell">
                <span class="damage-sim-pin" :class="{ on: isPinned(ar.idx) }" :style="isPinned(ar.idx) ? { background: pinColorForIndex(ar.idx), borderColor: pinColorForIndex(ar.idx) } : {}" @click="togglePin(ar.idx)" v-tooltip="t('app_sim_pin')">
                  <svg v-if="isPinned(ar.idx)" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
              </td>
              <td class="left">
                <div class="damage-sim-lb-wcell">
                  <div class="damage-sim-lb-icon" :style="isPinned(ar.idx) ? { borderColor: pinColorForIndex(ar.idx) } : {}" @mouseenter="$emit('showBuildHover', loadouts[ar.idx].weapon, $event)" @mousemove="$emit('moveBuildHover', $event)" @mouseleave="$emit('hideBuildHover')">
                    <img :src="iconUrl(loadouts[ar.idx].weapon!.id)" :alt="tName(loadouts[ar.idx].weapon!)" @error="onIconError" loading="lazy" />
                  </div>
                  <div class="damage-sim-lb-wtext">
                    <div class="damage-sim-lb-wname">{{ tName(loadouts[ar.idx].weapon!) }}<span v-if="loadouts[ar.idx].silenced || hasBuiltInSilencer(loadouts[ar.idx].weapon)" class="damage-sim-lb-silenced" v-tooltip="t('app_sim_silencer')"><LucideVolumeX :size="11" /></span></div>
                    <span v-if="selectedAmmoFor(ar.idx)" class="damage-sim-lb-ammo" :class="'ammo-cls-' + ammoClassFor(ar.idx)">{{ shortAmmoName(tName(selectedAmmoFor(ar.idx)!)) }}</span>
                  </div>
                </div>
              </td>
              <template v-if="targetType === 'stalker'">
                <td class="damage-sim-lb-num damage-sim-lb-dmg">
                  <span class="damage-sim-lb-dmgval" :class="{ best: ar.result.stalker?.armor?.damage === maxActiveDamage }">{{ fmt(ar.result.stalker?.armor?.damage) }}</span>
                  <div v-if="activeResults.length > 1" class="damage-sim-lb-bar"><span :style="{ width: dmgBarWidth(ar.result.stalker?.armor?.damage), background: ar.result.stalker?.armor?.damage === maxActiveDamage ? 'var(--accent)' : 'var(--text-secondary)' }"></span></div>
                </td>
                <td class="damage-sim-lb-num"><span class="damage-sim-lb-stk">{{ ar.result.stalker?.stk?.stk }}</span><span v-if="ar.result.stalker?.stk?.minStk !== ar.result.stalker?.stk?.maxStk" class="damage-sim-lb-sub">{{ ar.result.stalker?.stk?.minStk }}&ndash;{{ ar.result.stalker?.stk?.maxStk }}</span></td>
                <td class="damage-sim-lb-num">
                  <span class="damage-sim-lb-ap-line">
                    <span class="damage-sim-pen-ico" :class="ar.result.stalker?.armor?.penetrated ? 'pen' : 'nopen'" v-tooltip="ar.result.stalker?.armor?.penetrated ? t('app_sim_result_pen') : t('app_sim_result_stop')">
                      <svg v-if="ar.result.stalker?.armor?.penetrated" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                    <span class="damage-sim-lb-val">{{ fmt(ar.result.stalker?.ap) }}</span>
                  </span>
                  <span class="damage-sim-lb-sub">vs {{ fmt(ar.result.stalker?.boneArmor) }}</span>
                </td>
                <td class="damage-sim-lb-num"><span class="damage-sim-lb-val">{{ fmt(dpsFor(ar.idx)) }}</span></td>
              </template>
              <template v-else>
                <td class="damage-sim-lb-num damage-sim-lb-dmg">
                  <span class="damage-sim-lb-dmgval" :class="{ best: ar.result.mutant?.damage === maxActiveDamage }">{{ fmt(ar.result.mutant?.damage) }}</span>
                  <div v-if="activeResults.length > 1" class="damage-sim-lb-bar"><span :style="{ width: dmgBarWidth(ar.result.mutant?.damage), background: ar.result.mutant?.damage === maxActiveDamage ? 'var(--accent)' : 'var(--text-secondary)' }"></span></div>
                  <div v-if="ar.result.mutant?.critMult > 1" class="damage-sim-lb-crit">{{ t('app_sim_result_crit') }} ×{{ ar.result.mutant.critMult }}</div>
                </td>
                <td class="damage-sim-lb-num"><span class="damage-sim-lb-val" :class="ammoMultClass(ar.result.mutant?.ammoMult)">×{{ ar.result.mutant?.ammoMult }}</span></td>
                <td class="damage-sim-lb-num"><span class="damage-sim-lb-stk">{{ Number.isFinite(ar.result.mutant?.stk) ? ar.result.mutant.stk : '∞' }}</span></td>
                <td class="damage-sim-lb-num"><span class="damage-sim-lb-val">{{ fmt(dpsFor(ar.idx)) }}</span></td>
              </template>
              <td class="damage-sim-lb-sil-cell">
                <div v-if="weaponSilencerCapable(loadouts[ar.idx].weapon)" class="damage-sim-silencer-toggle" :class="{ locked: hasBuiltInSilencer(loadouts[ar.idx].weapon) }" @click="toggleSilencer(loadouts[ar.idx])" v-tooltip="(hasBuiltInSilencer(loadouts[ar.idx].weapon) ? t('app_sim_silencer_builtin') : t('app_sim_silencer')) + (gboConstants.silencer_boost ? ' (' + gboConstants.silencer_boost + 'x)' : '')">
                  <span class="damage-sim-sil-caption" :class="{ on: loadouts[ar.idx].silenced || hasBuiltInSilencer(loadouts[ar.idx].weapon) }">{{ t('app_sim_silencer') }}</span>
                  <span class="toggle-switch toggle-switch-sm" :class="{ on: loadouts[ar.idx].silenced || hasBuiltInSilencer(loadouts[ar.idx].weapon) }"><span class="toggle-knob"></span></span>
                </div>
              </td>
              <td class="damage-sim-lb-remove-cell">
                <button class="damage-sim-icon-btn damage-sim-icon-btn-danger" @click="removeRow(ar.idx)" v-tooltip="t('app_sim_remove')"><LucideX :size="12" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="damage-sim-empty-state">
        <LucideCrosshair :size="32" />
        <p>{{ t('app_sim_no_weapons') }}</p>
      </div>

      <!-- Compare (pinned rows) — hidden until at least one row is pinned -->
      <div v-if="pinnedResults.length" class="damage-sim-compare">
        <div class="damage-sim-compare-head">
          <h4 class="damage-sim-compare-title">{{ t('app_sim_compare') }}</h4>
          <div class="damage-sim-toggle-group damage-sim-toggle-sm">
            <button :class="{ active: detailView === 'chart' }" @click="detailView = 'chart'">{{ t('app_sim_radar_chart') }}</button>
            <button :class="{ active: detailView === 'breakdown' }" @click="detailView = 'breakdown'">{{ t('app_sim_breakdown') }}</button>
          </div>
        </div>

        <!-- Breakdown table -->
          <div v-if="detailView === 'breakdown'" class="damage-sim-results-table-wrap damage-sim-stats-box">
            <!-- Mutant breakdown -->
            <table v-if="targetType === 'mutant'" class="damage-sim-results-table">
              <thead><tr>
                <th></th>
                <th v-for="ar in pinnedResults" :key="'bh'+ar.idx" :style="{ color: pinColorForIndex(ar.idx) }">{{ loadoutLabel(ar.idx) }}</th>
              </tr></thead>
              <tbody>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_raw_damage') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_raw_damage') }}</div></td><td v-for="ar in pinnedResults" :key="'rd'+ar.idx"><span class="damage-sim-table-val">{{ fmt(ar.result.mutant?.rawDmg) }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_air_res') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_air_res') }}</div></td><td v-for="ar in pinnedResults" :key="'ar'+ar.idx"><span class="damage-sim-table-val">&divide; {{ fmt(ar.result.mutant?.airDiv) }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_ammo_mult') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_ammo_mult') }}</div></td><td v-for="ar in pinnedResults" :key="'am'+ar.idx"><span class="damage-sim-table-val">&times; {{ ar.result.mutant?.ammoMult }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_spec_mult') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_spec_mult') }}</div></td><td v-for="ar in pinnedResults" :key="'sm'+ar.idx"><span class="damage-sim-table-val">&times; {{ ar.result.mutant?.specMult }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_bone_mult') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_bone_mult') }}</div></td><td v-for="ar in pinnedResults" :key="'bm'+ar.idx"><span class="damage-sim-table-val">&times; {{ ar.result.mutant?.boneMult }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_barrel') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_barrel') }}</div></td><td v-for="ar in pinnedResults" :key="'ba'+ar.idx"><span class="damage-sim-table-val">&times; {{ fmt(ar.result.mutant?.barrel) }}</span></td></tr>
                <tr class="damage-sim-table-total"><td class="damage-sim-table-label">{{ t('app_sim_result_damage') }}</td><td v-for="ar in pinnedResults" :key="'td'+ar.idx"><span class="damage-sim-table-val damage-sim-table-val-primary">{{ fmt(ar.result.mutant?.damage) }}</span></td></tr>
              </tbody>
            </table>

            <!-- Stalker breakdown -->
            <table v-if="targetType === 'stalker'" class="damage-sim-results-table">
              <thead><tr>
                <th></th>
                <th v-for="ar in pinnedResults" :key="'bh'+ar.idx" :style="{ color: pinColorForIndex(ar.idx) }">{{ loadoutLabel(ar.idx) }}</th>
              </tr></thead>
              <tbody>
                <tr class="damage-sim-table-section"><td :colspan="pinnedResults.length + 1">{{ t('app_sim_result_damage') }}</td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_hit_power') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_hit_power') }}</div></td><td v-for="ar in pinnedResults" :key="'hp'+ar.idx"><span class="damage-sim-table-val">{{ fmt(ar.result.stalker?.breakdown?.hitPower) }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_air_res') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_air_res') }}</div></td><td v-for="ar in pinnedResults" :key="'ar'+ar.idx"><span class="damage-sim-table-val">&divide; {{ fmt(ar.result.stalker?.breakdown?.airDiv) }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_k_hit') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_k_hit') }}</div></td><td v-for="ar in pinnedResults" :key="'kh'+ar.idx"><span class="damage-sim-table-val">&times; {{ ar.result.stalker?.breakdown?.kHit }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_bone_mult') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_bone_mult') }}</div></td><td v-for="ar in pinnedResults" :key="'bm'+ar.idx"><span class="damage-sim-table-val">&times; {{ ar.result.stalker?.breakdown?.boneDmgMult }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_ap_scale') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_ap_scale') }}</div></td><td v-for="ar in pinnedResults" :key="'as'+ar.idx"><span class="damage-sim-table-val">&times; {{ ar.result.stalker?.breakdown?.apScale }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_barrel') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_barrel') }}</div></td><td v-for="ar in pinnedResults" :key="'ba'+ar.idx"><span class="damage-sim-table-val">&times; {{ fmt(ar.result.stalker?.breakdown?.barrel) }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_difficulty') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_difficulty') }}</div></td><td v-for="ar in pinnedResults" :key="'df'+ar.idx"><span class="damage-sim-table-val">&times; {{ ar.result.stalker?.breakdown?.diffMult }}</span></td></tr>
                <tr v-if="pinnedResults.some(ar => ar.result.stalker?.breakdown?.ammoMult !== 1)"><td class="damage-sim-table-label">{{ t('app_sim_ammo_mult') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_ammo_mult') }}</div></td><td v-for="ar in pinnedResults" :key="'am'+ar.idx"><span class="damage-sim-table-val">&times; {{ ar.result.stalker?.breakdown?.ammoMult }}</span></td></tr>
                <tr v-if="pinnedResults.some(ar => ar.result.stalker?.breakdown?.silencerMult !== 1)"><td class="damage-sim-table-label">{{ t('app_sim_silencer_mult') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_silencer_mult') }}</div></td><td v-for="ar in pinnedResults" :key="'sl'+ar.idx"><span class="damage-sim-table-val">&times; {{ ar.result.stalker?.breakdown?.silencerMult }}</span></td></tr>
                <tr class="damage-sim-table-total"><td class="damage-sim-table-label">{{ t('app_sim_raw_damage') }}</td><td v-for="ar in pinnedResults" :key="'rd'+ar.idx"><span class="damage-sim-table-val damage-sim-table-val-primary">{{ fmt(ar.result.stalker?.rawDmg) }}</span></td></tr>

                <tr class="damage-sim-table-section"><td :colspan="pinnedResults.length + 1">{{ t('app_sim_result_ap') }}</td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_base_ap') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_base_ap') }}</div></td><td v-for="ar in pinnedResults" :key="'kap'+ar.idx"><span class="damage-sim-table-val">{{ fmt(ar.result.stalker?.breakdown?.kAp) }}</span></td></tr>
                <tr v-if="pinnedResults.some(ar => ar.result.stalker?.breakdown?.apBoost)"><td class="damage-sim-table-label">{{ t('app_sim_ap_boost') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_ap_boost') }}</div></td><td v-for="ar in pinnedResults" :key="'ab'+ar.idx"><span class="damage-sim-table-val">+ {{ ar.result.stalker?.breakdown?.apBoost || 0 }}</span></td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_difficulty') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_difficulty') }}</div></td><td v-for="ar in pinnedResults" :key="'df2'+ar.idx"><span class="damage-sim-table-val">&times; {{ ar.result.stalker?.breakdown?.diffMult }}</span></td></tr>
                <tr class="damage-sim-table-total"><td class="damage-sim-table-label">{{ t('app_sim_result_ap') }}</td><td v-for="ar in pinnedResults" :key="'tap'+ar.idx"><span class="damage-sim-table-val damage-sim-table-val-primary">{{ fmt(ar.result.stalker?.ap) }}</span></td></tr>

                <tr class="damage-sim-table-section"><td :colspan="pinnedResults.length + 1">{{ t('app_sim_armor_result') }}</td></tr>
                <tr><td class="damage-sim-table-label">{{ t('app_sim_result_damage') }}<div v-if="showHelp" class="damage-sim-help-text">{{ t('app_sim_help_armor_result') }}</div></td>
                  <td v-for="ar in pinnedResults" :key="'ares'+ar.idx">
                    <span class="damage-sim-pen-icon" :class="ar.result.stalker?.armor?.penetrated ? 'pen' : 'nopen'">
                      <svg v-if="ar.result.stalker?.armor?.penetrated" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                    <span class="damage-sim-table-val">{{ fmt(ar.result.stalker?.armor?.damage) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Radar chart -->
          <div v-if="detailView === 'chart'" class="damage-sim-radar-wrap">
            <canvas ref="radarCanvas"></canvas>
            <div class="damage-sim-radar-mode">
              <button :class="{ active: radarMode === 'relative' }" @click="radarMode = 'relative'">{{ t('app_sim_radar_each_other') }}</button>
              <button :class="{ active: radarMode === 'category' }" @click="radarMode = 'category'">{{ t('app_sim_radar_same_class') }}</button>
              <button :class="{ active: radarMode === 'global' }" @click="radarMode = 'global'">{{ t('app_sim_radar_all_weapons') }}</button>
            </div>
          </div>
      </div>
    </div>

  </div>

  <!-- Picker Modals -->
  <!-- Combined weapon + ammo picker: each row is a flat weapon×ammo pair -->
  <ItemPickerModal :open="combinedPickerOpen" :title="t('app_sim_add_pair')" :placeholder="t('app_sim_search_weapon_ammo')" :empty-text="t('app_sim_no_results')" :items="weaponAmmoPairs" :label-fn="(p: any) => p.label" :filter-fn="pairFilter" :key-fn="(p: any) => p.key" @close="closeCombinedPicker()" @select="selectPair" @item-hover="(p: any, e: MouseEvent) => $emit('showBuildHover', p.weapon, e)" @item-move="(e: MouseEvent) => $emit('moveBuildHover', e)" @item-leave="$emit('hideBuildHover')">
    <template #toolbar>
      <button class="damage-sim-picker-filter" :class="{ active: ammoPrimaryFilter }" @click.stop="toggleAmmoPrimaryFilter()">
        <LucideSlidersHorizontal :size="12" />
        {{ t('app_sim_primary_ammo') }}
      </button>
      <button v-if="!restrictedToInitial" class="damage-sim-picker-filter" :class="{ active: weaponStartingFilter }" @click.stop="toggleStartingFilter()">
        <LucideSlidersHorizontal :size="12" />
        {{ t('app_sim_starting_loadouts') }}
      </button>
    </template>
    <template #item="{ item }">
      <span class="damage-sim-pick-check" :class="{ on: isPairAdded(item) }">
        <svg v-if="isPairAdded(item)" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
      <span class="build-picker-item-name">{{ item.weaponName }}</span>
      <span class="damage-sim-pick-id">{{ item.weapon.id }}</span>
      <span class="badge-ammo damage-sim-pick-ammo" :class="'ammo-cls-' + item.ammoClass">{{ item.ammoName }}</span>
      <span v-if="item.alt" class="badge-ammo badge-ammo-alt ammo-alt-tag">ALT</span>
    </template>
  </ItemPickerModal>

  <ItemPickerModal :open="mutantPickerOpen" :title="t('app_sim_target_mutant')" :placeholder="t('app_sim_search_mutant')" :empty-text="t('app_sim_no_results')" :items="uniqueMutants" :label-fn="(m: any) => mutantDisplayName(m.id)" @close="mutantPickerOpen = false" @select="selectMutant">
    <template #item="{ item }">
      <span class="build-picker-item-name">{{ mutantDisplayName(item.id) }}</span>
      <span class="build-picker-item-type">{{ mutantSubLabel(item) }}</span>
    </template>
  </ItemPickerModal>

  <ItemPickerModal :open="npcPickerOpen" :title="t('app_sim_armor_profile')" :placeholder="t('app_sim_search_armor')" :empty-text="t('app_sim_no_results')" :items="uniqueNpcProfiles" :label-fn="(p: any) => npcProfileLabel(p)" @close="npcPickerOpen = false" @select="selectNpcProfile">
    <template #item="{ item }">
      <span class="build-picker-item-name">{{ npcProfileLabel(item) }}</span>
      <span class="build-picker-item-type">Body {{ item.body_bonearmor }} / Head {{ item.head_bonearmor }}</span>
    </template>
  </ItemPickerModal>

</div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { calcMutantDamage, mutantShotsToKill, extractMutantSpecies,
         calcStalkerDetailed, stalkerArmorCalc,
         stalkerShotsToKill, stalkerArmorGroup, shotsToPen, resolveHpNoPenPenalty,
         stalkerBoneDamageMult, resolveFactionRes, barrelConditionCorrected,
         hasIntegratedSilencer, hasPermanentSilencer } from '../../js/damage-calc.js';
import ItemPickerModal from './modals/ItemPickerModal.vue';

interface GameItem {
  id: string;
  pda_encyclopedia_name?: string;
  displayName?: string;
  localeName?: string;
  ui_ammo_types?: string;
  st_data_export_ammo_types_alt?: string;
  st_data_export_hit_power?: string;
  st_data_export_k_hit?: string;
  st_data_export_k_ap?: string;
  st_data_export_k_air_resistance?: string;
  st_data_export_projectiles?: string;
  [key: string]: unknown;
}

interface MutantProfile {
  id: string;
  skin_armor: number;
  hit_fraction: number;
  fire_wound_immunity: number;
  hitzone_head: number;
  hitzone_torso: number;
  hitzone_limbs: number;
  hitzone_rear: number;
  [key: string]: unknown;
}

interface NpcArmorProfile {
  id: string;
  visual_item_id?: string;
  hit_fraction: number;
  ap_scale: number;
  body_bonearmor: number;
  head_bonearmor: number;
}

interface GboConstants {
  difficulty: Record<string, number>;
  [key: string]: unknown;
}

interface Loadout {
  weapon: GameItem | null;
  ammoId: string;
  silenced: boolean;
  uid: number;
}

interface DifficultyOption {
  key: number;
  label: string;
}

const MAX_LOADOUTS = 40;
// Colors assigned to pinned rows (in pin order) for the compare panel.
const PIN_COLORS = ['#5b8abd', '#c89050', '#b8a048', '#9b6fb0', '#6fb08a', '#bd6f6f', '#6fa8b0', '#b06f9b', '#8ab05b', '#c8a0c0'];
const MAX_PINS = PIN_COLORS.length;

// Stable per-row id so pins survive sorting and row removal.
let _loadoutUid = 0;
function blankLoadout(): Loadout {
  return { weapon: null, ammoId: '', silenced: false, uid: ++_loadoutUid };
}

export default defineComponent({
  name: 'DamageSimulator',
  components: { ItemPickerModal },
  props: {
    weaponCategories: { type: Object as PropType<Record<string, GameItem[]>>, default: () => ({}) },
    ammoItems: { type: Array as PropType<GameItem[]>, default: () => [] },
    mutantProfiles: { type: Array as PropType<MutantProfile[]>, default: () => [] },
    npcArmorProfiles: { type: Array as PropType<NpcArmorProfile[]>, default: () => [] },
    gboConstants: { type: Object as PropType<GboConstants>, default: () => ({}) },
    // weapon ID → { silencer, scope, launcher } X-Ray addon status (1=integral, 2=attachable).
    weaponAddonStatus: { type: Object as PropType<Record<string, { silencer?: number, scope?: number, launcher?: number }>>, default: () => ({}) },
    calibersData: { type: Object, default: () => ({}) },
    ballisticRanges: { type: Object as PropType<{ maxDamage?: number, maxAp?: number, maxDps?: number }>, default: () => ({}) },
    hideNoDrop: { type: Boolean, default: true },
    hideTacticalKit: { type: Boolean, default: false },
    hideUnusedAmmo: { type: Boolean, default: true },
    ammoWeaponsCache: { type: Object as PropType<Record<string, any[]>>, default: () => ({}) },
    /** When set, overrides restored loadouts with these weapons (e.g. inventory ballistics modal). */
    initialWeaponIds: { type: Array as PropType<string[]>, default: null },
    /** CSS selector of a container to teleport the toolbar actions into (e.g. the ballistics tab bar). Null keeps them in place. */
    actionsTarget: { type: String as PropType<string | null>, default: null },
  },
  emits: ['showBuildHover', 'moveBuildHover', 'hideBuildHover'],
  inject: ['t', 'tName', 'shortAmmoName'],
  data() {
    return {
      loadouts: [
        blankLoadout(),
      ] as Loadout[],
      targetType: 'stalker' as 'mutant' | 'stalker',
      selectedMutantId: '',
      selectedNpcProfileId: '',
      hitzone: 'torso',
      faction: 'default',
      distance: 25,
      barrelCondition: 70,
      difficulty: 3,
      combinedPickerOpen: false,
      mutantPickerOpen: false,
      npcPickerOpen: false,
      _shareFeedback: false as boolean,
      startingLoadoutIds: null as Set<string> | null,
      weaponStartingFilter: false,
      ammoPrimaryFilter: true,
      showHelp: false,
      detailView: 'chart' as 'breakdown' | 'chart',
      radarMode: 'relative' as 'relative' | 'category' | 'global',
      sortKey: 'damage' as string,
      sortDir: -1 as 1 | -1,
      pinnedUids: [] as number[],
    };
  },
  computed: {
    difficulties(): DifficultyOption[] {
      return [
        { key: 1, label: 'app_sim_difficulty_easy' },
        { key: 2, label: 'app_sim_difficulty_medium' },
        { key: 3, label: 'app_sim_difficulty_hard' },
      ];
    },

    allWeapons(): GameItem[] {
      const slugs = ['pistols', 'smgs', 'shotguns', 'rifles', 'snipers'];
      const seen = new Set<string>();
      const weapons: GameItem[] = [];
      for (const slug of slugs) {
        const items = this.weaponCategories[slug];
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          if (!item.ui_ammo_types || seen.has(item.id)) continue;
          if (this.hideNoDrop && item.unobtainable === true) continue;
          if (this.hideTacticalKit && item.tacticalKit === true) continue;
          seen.add(item.id);
          weapons.push(item);
        }
      }
      return weapons.sort((a, b) => ((this as any).tName(a) || a.id).localeCompare((this as any).tName(b) || b.id));
    },

    // Flat weapon×ammo pairs for the combined picker. Built lazily (only while open)
    // because the cross-product is large.
    weaponAmmoPairs(): Record<string, any>[] {
      if (!this.combinedPickerOpen) return [];
      const pairs: Record<string, any>[] = [];
      for (const w of this.pickerWeapons) {
        const wName = (this as any).tName(w) || w.id;
        for (const a of this.compatibleAmmoForWeapon(w)) {
          const alt = this.isAltAmmoFor(w, a);
          if (this.ammoPrimaryFilter && alt) continue;
          const ammoName = (this as any).shortAmmoName((this as any).tName(a) || a.id);
          pairs.push({
            key: w.id + '|' + a.id,
            weapon: w,
            ammoId: a.id,
            weaponName: wName,
            ammoName,
            ammoClass: this.ammoClassOf(a),
            alt,
            label: `${wName} ${ammoName} ${w.id} ${a.id}`,
          });
        }
      }
      return pairs;
    },

    targetTitle(): string {
      if (this.targetType === 'mutant') {
        return this.selectedMutant ? this.mutantDisplayName(this.selectedMutant.id) : (this as any).t('app_sim_target_mutant');
      }
      return this.selectedNpcProfile ? this.npcProfileLabel(this.selectedNpcProfile) : (this as any).t('app_sim_target_stalker');
    },

    // Active results ordered by the selected column. Kept separate from activeResults
    // so the underlying loadout indices (and pins) stay stable.
    sortedResults(): { idx: number, result: Record<string, any> }[] {
      const rows = this.activeResults.slice();
      const dir = this.sortDir;
      rows.sort((a, b) => {
        const av = this.sortValFor(a, this.sortKey);
        const bv = this.sortValFor(b, this.sortKey);
        if (av === bv) return 0;
        return av < bv ? -dir : dir;
      });
      return rows;
    },

    maxActiveDamage(): number {
      let max = 0;
      for (const ar of this.activeResults) {
        const d = this.targetType === 'mutant' ? ar.result.mutant?.damage : ar.result.stalker?.armor?.damage;
        if (typeof d === 'number' && d > max) max = d;
      }
      return max;
    },

    // Loadout indices of pinned rows, in pin order, that currently produce a result.
    pinnedIndices(): number[] {
      const out: number[] = [];
      for (const uid of this.pinnedUids) {
        const idx = this.loadouts.findIndex(lo => lo.uid === uid);
        if (idx >= 0 && this.results[idx]) out.push(idx);
      }
      return out;
    },

    pinnedResults(): { idx: number, result: Record<string, any> }[] {
      return this.pinnedIndices.map(idx => ({ idx, result: this.results[idx]! }));
    },

    // Header select-all checkbox state: none / some / all rows pinned.
    pinAllState(): 'none' | 'some' | 'all' {
      const rows = this.activeResults;
      if (!rows.length) return 'none';
      const pinnedCount = rows.filter(ar => this.isPinned(ar.idx)).length;
      if (pinnedCount === 0) return 'none';
      return pinnedCount === rows.length ? 'all' : 'some';
    },

    uniqueMutants(): MutantProfile[] {
      // Dedupe by stat signature: two sections with identical
      // (skin_armor, hit_fraction, hitzone_*) are functionally the same target.
      // Skip base m_<X>_e sections (they have skin=0 & hit_fraction=0 because they
      // don't define protections_sect — picking one as a representative gives bogus stats).
      const seen = new Map<string, MutantProfile>();
      for (const m of this.mutantProfiles) {
        if (m.skin_armor === 0 && m.hit_fraction === 0) continue;
        const key = `${m.skin_armor}_${m.hit_fraction}_${m.hitzone_head}_${m.hitzone_torso}_${m.hitzone_limbs}_${m.hitzone_rear}`;
        if (!seen.has(key)) seen.set(key, m);
      }
      return [...seen.values()].sort((a, b) => this.mutantDisplayName(a.id).localeCompare(this.mutantDisplayName(b.id)));
    },

    uniqueNpcProfiles(): NpcArmorProfile[] {
      const seen = new Map<string, NpcArmorProfile>();
      for (const p of this.npcArmorProfiles) {
        const key = `${p.hit_fraction}_${p.ap_scale}_${p.body_bonearmor}_${p.head_bonearmor}`;
        if (!seen.has(key)) seen.set(key, p);
      }
      return [...seen.values()].sort((a, b) => this.npcProfileLabel(a).localeCompare(this.npcProfileLabel(b)));
    },

    selectedMutant(): MutantProfile | null {
      return this.mutantProfiles.find(m => m.id === this.selectedMutantId) || null;
    },

    selectedNpcProfile(): NpcArmorProfile | null {
      return this.npcArmorProfiles.find(p => p.id === this.selectedNpcProfileId) || null;
    },

    mutantHitzones(): string[] { return ['head', 'torso', 'limbs', 'rear']; },
    stalkerHitzones(): string[] { return ['head', 'torso', 'arms', 'legs']; },
    factions(): string[] { return ['greh', 'zombied', 'isg', 'monolith', 'bandit']; },

    results(): (Record<string, any> | null)[] {
      return this.loadouts.map((_, i) => this.calcForSlot(i));
    },

    /** Launched with an explicit weapon list (inventory modal) — pickers stay within it */
    restrictedToInitial(): boolean {
      return !!this.initialWeaponIds && this.initialWeaponIds.length > 0;
    },

    pickerWeapons(): GameItem[] {
      if (this.restrictedToInitial) {
        const ids = new Set(this.initialWeaponIds);
        return this.allWeapons.filter(w => ids.has(w.id));
      }
      if (this.weaponStartingFilter && this.startingLoadoutIds) {
        const ids = this.startingLoadoutIds;
        return this.allWeapons.filter(w => ids.has(w.id));
      }
      return this.allWeapons;
    },

    activeResults(): { idx: number, result: Record<string, any> }[] {
      return this.results
        .map((r, i) => r ? { idx: i, result: r } : null)
        .filter(Boolean) as { idx: number, result: Record<string, any> }[];
    },

    // Weapon categories that each loadout weapon belongs to
    loadoutWeaponSlugs(): (string | null)[] {
      const slugs = ['pistols', 'smgs', 'shotguns', 'rifles', 'snipers'];
      return this.loadouts.map(lo => {
        if (!lo.weapon) return null;
        for (const slug of slugs) {
          const items = this.weaponCategories[slug];
          if (Array.isArray(items) && items.some(w => w.id === lo.weapon!.id)) return slug;
        }
        return null;
      });
    },

    // Weapons in same categories as selected loadouts
    categoryWeapons(): GameItem[] {
      const activeSlugs = new Set(this.loadoutWeaponSlugs.filter(Boolean) as string[]);
      if (activeSlugs.size === 0) return this.allWeapons;
      const weapons: GameItem[] = [];
      for (const slug of activeSlugs) {
        const items = this.weaponCategories[slug];
        if (!Array.isArray(items)) continue;
        for (const w of items) {
          if (this.hideNoDrop && w.unobtainable === true) continue;
          if (this.hideTacticalKit && w.tacticalKit === true) continue;
          if (w.ui_ammo_types) weapons.push(w);
        }
      }
      return weapons;
    },

    // Weapon stat ranges for radar normalization
    weaponStatRanges(): { accuracy: [number, number], magSize: [number, number] } {
      const pool = this.radarMode === 'category' ? this.categoryWeapons : this.allWeapons;
      let minAcc = 100, maxAcc = 0;
      let minMag = 999, maxMag = 0;

      for (const w of pool) {
        const acc = parseFloat((w.ui_inv_accuracy as string || '0').replace('%', '')) || 0;
        const mag = parseFloat(w.ui_ammo_count as string || '0') || 0;
        if (acc > 0) { minAcc = Math.min(minAcc, acc); maxAcc = Math.max(maxAcc, acc); }
        if (mag > 0) { minMag = Math.min(minMag, mag); maxMag = Math.max(maxMag, mag); }
      }
      if (minAcc > maxAcc) { minAcc = 0; maxAcc = 100; }
      if (minMag > maxMag) { minMag = 0; maxMag = 100; }

      return {
        accuracy: [minAcc, maxAcc],
        magSize: [minMag, maxMag],
      };
    },

    radarData(): { labels: string[], datasets: any[], rawValues: number[][] } | null {
      // The radar compares only the pinned rows (in pin order).
      const idxs = this.pinnedIndices;
      if (idxs.length === 0) return null;

      // Ordered axis definitions. The Recoil axis is intentionally omitted: it was fed by
      // the recoil-control stat, which the Weapon Mechanics guide flags as meaningless.
      const ranges = this.weaponStatRanges;
      const br = this.ballisticRanges;
      const axisDefs: { key: string, label: string, range: number[] }[] = [
        { key: 'damage', label: (this as any).t('app_sim_result_damage'), range: [0, br.maxDamage || 1] },
        { key: 'ap', label: (this as any).t('app_sim_result_ap'), range: [0, br.maxAp || 0.3] },
        { key: 'dps', label: 'DPS', range: [0, br.maxDps || 5] },
        { key: 'accuracy', label: (this as any).t('app_sim_radar_accuracy'), range: ranges.accuracy },
        { key: 'range', label: (this as any).t('app_sim_radar_range'), range: [0, 100] },
        { key: 'magSize', label: (this as any).t('app_sim_radar_mag_size'), range: ranges.magSize },
      ];
      const labels = axisDefs.map(a => a.label);

      const rawValues: number[][] = [];
      for (const i of idxs) {
        const res = this.results[i];
        const lo = this.loadouts[i];
        if (!res || !lo.weapon) { rawValues.push(axisDefs.map(() => 0)); continue; }

        const damage = this.targetType === 'mutant' ? (res.mutant?.damage || 0) : (res.stalker?.armor?.damage || 0);
        const ammo = this.selectedAmmoFor(i);
        const kAp = ammo ? parseFloat(ammo.st_data_export_k_ap || '0') : 0;
        const ap = res.stalker?.ap || kAp * 10;
        const fireRate = parseFloat(lo.weapon.ui_inv_rate_of_fire as string || '0') || 0;
        const dps = damage * fireRate / 60;
        const accuracy = parseFloat((lo.weapon.ui_inv_accuracy as string || '0').replace('%', '')) || 0;
        const kAirRes = ammo ? parseFloat(ammo.st_data_export_k_air_resistance || '0') : 0;
        const rangeEff = 1 / this.airResDivisorAt(this.distance, kAirRes) * 100;
        const magSize = parseFloat(lo.weapon.ui_ammo_count as string || '0') || 0;

        const byKey: Record<string, number> = { damage, ap, dps, accuracy, range: rangeEff, magSize };
        rawValues.push(axisDefs.map(a => byKey[a.key]));
      }

      const normalize = (val: number, min: number, max: number): number => {
        if (max <= min) return 50;
        return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
      };

      // Build effective ranges based on mode, aligned positionally with axisDefs.
      const effectiveRanges = axisDefs.map(a => a.range);
      if (this.radarMode === 'relative' && rawValues.length > 1) {
        for (let j = 0; j < axisDefs.length; j++) {
          let min = Infinity, max = -Infinity;
          for (const vals of rawValues) {
            min = Math.min(min, vals[j]);
            max = Math.max(max, vals[j]);
          }
          if (min === max) continue;
          effectiveRanges[j] = [0, max];
        }
      }

      const datasets: any[] = idxs.map((i, pos) => {
        const vals = rawValues[pos];
        const normalized = vals.map((v, j) => normalize(v, effectiveRanges[j][0], effectiveRanges[j][1]));
        const col = PIN_COLORS[pos % PIN_COLORS.length];
        return {
          label: this.loadoutLabel(i),
          data: normalized,
          borderColor: col,
          backgroundColor: col + '26',
          pointBackgroundColor: col,
          pointRadius: 3,
          borderWidth: 2,
          fill: true,
        };
      });

      return { labels, datasets, rawValues };
    },
  },
  methods: {
    stalkerBoneDamageMult(hitzone: string, gbo: any): number {
      return stalkerBoneDamageMult(hitzone, gbo);
    },
    resolveFactionRes(faction: string, gbo: any): { dmg_res: number, ap_res: number } {
      return resolveFactionRes(faction, gbo);
    },
    barrelConditionCorrected(conditionPct: number): number {
      return barrelConditionCorrected(conditionPct);
    },
    hitzoneApBoost(hitzone: string): number {
      const gbo = this.gboConstants;
      if (!gbo?.stalker_hitzones || !gbo?.ap_boost) return 0;
      const zone = gbo.stalker_hitzones[hitzone];
      const group = zone ? zone.group : 'upper_body';
      if (group === 'head') return gbo.ap_boost.head || 0;
      if (group === 'lower_body') return gbo.ap_boost.legs || 0;
      return 0;
    },
    // A weapon whose silencer is built in (grok_bo integrated list or a permanent silencer_status==1
    // addon): always silenced in-game, so the toggle is forced on and locked.
    hasBuiltInSilencer(weapon: GameItem | null): boolean {
      if (!weapon) return false;
      return hasIntegratedSilencer(weapon.id, this.gboConstants)
        || hasPermanentSilencer(this.weaponAddonStatus?.[weapon.id]?.silencer);
    },
    toggleSilencer(lo: Loadout): void {
      if (this.hasBuiltInSilencer(lo.weapon)) return; // locked: silencer is integral
      lo.silenced = !lo.silenced;
      this.saveToStorage();
    },
    // Show the silencer control only when the weapon can actually be suppressed:
    // a built-in/integral suppressor, or an attachable one (addon status 2).
    weaponSilencerCapable(weapon: GameItem | null): boolean {
      if (!weapon) return false;
      if (this.hasBuiltInSilencer(weapon)) return true;
      return this.weaponAddonStatus?.[weapon.id]?.silencer === 2;
    },
    selectedAmmoFor(slot: number): GameItem | null {
      const id = this.loadouts[slot].ammoId;
      return id ? (this.ammoItems.find(a => a.id === id) || null) : null;
    },

    compatibleAmmoForWeapon(weapon: GameItem | null): GameItem[] {
      if (!weapon) return [];
      const types = (weapon.ui_ammo_types || '').split(';').map(s => s.trim()).filter(Boolean);
      const altTypes = (weapon.st_data_export_ammo_types_alt || '').split(';').map(s => s.trim()).filter(Boolean);
      const allTypes = [...types, ...altTypes];
      return this.ammoItems.filter(a => {
        const name = a.pda_encyclopedia_name || a.displayName || '';
        if (!allTypes.some(t => name === t || name.startsWith(t))) return false;
        if (this.hideUnusedAmmo && this.ammoWeaponsCache) {
          const weapons = this.ammoWeaponsCache[a.id];
          if (!weapons || weapons.length === 0) return false;
          if (!weapons.some((w: any) => !(this.hideNoDrop && w.noDrop) && !(this.hideTacticalKit && w.tacticalKit))) return false;
        }
        return true;
      }).sort((a, b) => ((this as any).tName(a) || a.id).localeCompare((this as any).tName(b) || b.id));
    },

    isAltAmmoFor(weapon: GameItem, ammoItem: GameItem): boolean {
      const altTypes = (weapon.st_data_export_ammo_types_alt || '').split(';').map(s => s.trim()).filter(Boolean);
      if (!altTypes.length) return false;
      const name = ammoItem.pda_encyclopedia_name || ammoItem.displayName || '';
      return altTypes.some(t => name === t || name.startsWith(t));
    },

    // Coarse ammo class purely for badge coloring (HP=green, AP=blue, slug/buck=warm).
    ammoClassOf(ammo: GameItem | null): string {
      if (!ammo) return 'FMJ';
      const id = ammo.id.toLowerCase();
      if (/buck/.test(id)) return 'BUCK';
      if (/(slug|zhekan|dart|bull|barrikada|shrapnel)/.test(id)) return 'SLUG';
      if (/(ap|pbp|sp6|ss190|7n1|7n14|pab9|_7n|magnum)/.test(id)) return 'AP';
      if (/(hp|jhp|hydro|pmm|expan|_ep|-ep)/.test(id)) return 'HP';
      return 'FMJ';
    },

    ammoClassFor(slot: number): string {
      return this.ammoClassOf(this.selectedAmmoFor(slot));
    },

    defaultAmmoForWeapon(weapon: GameItem | null): string {
      const list = this.compatibleAmmoForWeapon(weapon);
      return list.length ? list[0].id : '';
    },

    calcForSlot(slot: number): Record<string, any> | null {
      const gbo = this.gboConstants;
      if (!gbo || !gbo.difficulty) return null;
      const weapon = this.loadouts[slot].weapon;
      const ammo = this.selectedAmmoFor(slot);
      if (!weapon || !ammo) return null;

      if (this.targetType === 'mutant') {
        if (!this.selectedMutant) return null;
        const hitPower = parseFloat(weapon.st_data_export_hit_power || '');
        const kHit = parseFloat(ammo.st_data_export_k_hit || '');
        const kAp = parseFloat(ammo.st_data_export_k_ap || '');
        const kAirRes = parseFloat(ammo.st_data_export_k_air_resistance || '');
        const pellets = parseInt(ammo.st_data_export_projectiles || '1') || 1;
        if (isNaN(hitPower) || isNaN(kHit)) return null;
        const mutantResult = calcMutantDamage({ hitPower, kHit, kAp: isNaN(kAp) ? 0 : kAp, pellets, kAirRes, distance: this.distance, barrelCond: this.barrelCondition, difficulty: this.difficulty, ammoId: ammo.id, mutantId: this.selectedMutant.id, hitzone: this.hitzone, mutantProfile: this.selectedMutant, gbo });
        return { mutant: { ...mutantResult, stk: mutantShotsToKill(mutantResult.damage) } };
      }

      if (this.targetType === 'stalker') {
        if (!this.selectedNpcProfile) return null;
        const hitPower = parseFloat(weapon.st_data_export_hit_power || '');
        const kHit = parseFloat(ammo.st_data_export_k_hit || '');
        const kAp = parseFloat(ammo.st_data_export_k_ap || '');
        const kAirRes = parseFloat(ammo.st_data_export_k_air_resistance || '');
        const pellets = parseInt(ammo.st_data_export_projectiles || '1') || 1;
        if (isNaN(hitPower) || isNaN(kHit) || isNaN(kAp)) return null;
        const npc = this.selectedNpcProfile;
        const commonParams = { hitPower, kHit, kAp, pellets, kAirRes, distance: this.distance, barrelCond: this.barrelCondition, difficulty: this.difficulty, ammoId: ammo.id, weaponId: weapon.id, hitzone: this.hitzone, faction: this.faction, silenced: this.loadouts[slot].silenced, silencerStatus: this.weaponAddonStatus?.[weapon.id]?.silencer, apScale: npc.ap_scale };
        const detailed = calcStalkerDetailed({ ...commonParams, gbo });
        const armorGroup = stalkerArmorGroup(this.hitzone);
        const boneArmor = armorGroup === 'head' ? npc.head_bonearmor : npc.body_bonearmor;
        const hpPenalty = resolveHpNoPenPenalty(ammo.id, gbo);
        const armor = stalkerArmorCalc(detailed.ap, detailed.rawDmg, boneArmor, npc.hit_fraction, hpPenalty);
        const stp = shotsToPen(detailed.ap, boneArmor);
        const stk = stalkerShotsToKill(commonParams, npc, gbo);
        return { stalker: { ap: detailed.ap, rawDmg: detailed.rawDmg, boneArmor, armor, stp, stk, breakdown: detailed.breakdown } };
      }
      return null;
    },

    airResDivisorAt(distance: number, kAirRes: number): number {
      return 1 + distance / 200 * (kAirRes * 0.5 / (1 - kAirRes + 0.1));
    },

    updateRadarChart(): void {
      const canvas = this.$refs.radarCanvas as HTMLCanvasElement | undefined;
      if (!canvas) return;
      const data = this.radarData;

      if ((this as any)._radarChart) {
        (this as any)._radarChart.destroy();
        (this as any)._radarChart = null;
      }

      if (!data || data.datasets.length === 0) return;

      const rawValues = data.rawValues;
      const labels = data.labels;

      (this as any)._radarChart = new (globalThis as any).Chart(canvas, {
        type: 'radar',
        data: { labels: data.labels, datasets: data.datasets },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            r: {
              min: 0, max: 100,
              ticks: { display: false, stepSize: 20 },
              grid: { color: '#2a2a2a' },
              angleLines: { color: '#2a2a2a' },
              pointLabels: { color: '#d4d4d4', font: { size: 11 } },
            }
          },
          plugins: {
            legend: { display: data.datasets.length > 1, position: 'top' as const, labels: { color: '#d4d4d4', font: { size: 10 }, usePointStyle: true, pointStyle: 'circle', padding: 12 } },
            tooltip: {
              backgroundColor: '#1a1a1a',
              titleColor: '#d4d4d4',
              bodyColor: '#d4d4d4',
              borderColor: '#2a2a2a',
              borderWidth: 1,
              callbacks: {
                label(ctx: any) {
                  const val = rawValues[ctx.datasetIndex]?.[ctx.dataIndex];
                  const axis = labels[ctx.dataIndex];
                  const fmtVal = val != null ? (val < 1 ? val.toFixed(4) : val.toFixed(1)) : '--';
                  const suffix = axis === labels[5] ? '%' : '';
                  return `${ctx.dataset.label}: ${fmtVal}${suffix}`;
                }
              }
            }
          }
        }
      });
    },

    async loadStartingLoadouts(): Promise<void> {
      if (this.startingLoadoutIds) return;
      try {
        const packId = new URL(window.location.href).pathname.match(/\/db\/([^/]+)/)?.[1] || 'gamma-0.9.5';
        const res = await fetch(`/data/${packId}/starting-loadouts.json`);
        if (!res.ok) return;
        const data = await res.json();
        const ids = new Set<string>();
        for (const faction of (data.factions || [])) {
          for (const item of (faction.items || [])) {
            if (item.id) ids.add(item.id);
          }
        }
        this.startingLoadoutIds = ids;
      } catch { /* ignore */ }
    },

    toggleAmmoPrimaryFilter(): void {
      this.ammoPrimaryFilter = !this.ammoPrimaryFilter;
    },
    toggleStartingFilter(): void {
      this.weaponStartingFilter = !this.weaponStartingFilter;
      if (this.weaponStartingFilter) this.loadStartingLoadouts();
    },

    resetAll(): void {
      this.loadouts.splice(0, this.loadouts.length, blankLoadout());
      this.pinnedUids = [];
      this.sortKey = 'damage';
      this.sortDir = -1;
      this.targetType = 'stalker';
      this.hitzone = 'torso';
      this.faction = 'default';
      this.distance = 25;
      this.barrelCondition = 70;
      this.difficulty = 3;
      // Restore defaults
      const sunrise = this.npcArmorProfiles.find(p =>
        p.visual_item_id === 'stalker_outfit' ||
        (p.visual_item_id?.startsWith('stalker_outfit') && !p.visual_item_id?.includes(',helm'))
      );
      this.selectedNpcProfileId = sunrise ? sunrise.id : '';
      const boar = this.mutantProfiles.find(p => p.id === 'boar_normal');
      this.selectedMutantId = boar ? boar.id : '';
      this.saveToStorage();
    },

    pushUrlParams(): void {
      const url = new URL(window.location.href);
      const p = url.searchParams;
      // Clear old sim params
      for (let i = 0; i < MAX_LOADOUTS; i++) {
        for (const prefix of ['bw','ba','bs']) p.delete(prefix + i);
      }
      for (const k of ['btt','bmid','bnid','bhz','bfc','bdi','bbc','bdf']) p.delete(k);
      // Set current state
      for (let i = 0; i < this.loadouts.length; i++) {
        const lo = this.loadouts[i];
        if (lo.weapon) p.set('bw' + i, lo.weapon.id);
        if (lo.ammoId) p.set('ba' + i, lo.ammoId);
        if (lo.silenced) p.set('bs' + i, '1');
      }
      p.set('btt', this.targetType === 'mutant' ? 'm' : 's');
      if (this.selectedMutantId) p.set('bmid', this.selectedMutantId);
      if (this.selectedNpcProfileId) p.set('bnid', this.selectedNpcProfileId);
      if (this.hitzone !== 'torso') p.set('bhz', this.hitzone);
      if (this.faction !== 'default') p.set('bfc', this.faction);
      if (this.distance !== 25) p.set('bdi', String(this.distance));
      if (this.barrelCondition !== 70) p.set('bbc', String(this.barrelCondition));
      if (this.difficulty !== 3) p.set('bdf', String(this.difficulty));
      window.history.replaceState(null, '', url.toString());
    },

    restoreFromUrl(): boolean {
      const p = new URLSearchParams(window.location.search);
      if (!p.has('bw0')) return false;
      // Restore non-weapon state
      const tt = p.get('btt');
      if (tt === 'm') this.targetType = 'mutant';
      else if (tt === 's') this.targetType = 'stalker';
      if (p.has('bmid')) this.selectedMutantId = p.get('bmid')!;
      if (p.has('bnid')) this.selectedNpcProfileId = p.get('bnid')!;
      if (p.has('bhz')) this.hitzone = p.get('bhz')!;
      if (p.has('bfc')) this.faction = p.get('bfc')!;
      if (p.has('bdi')) this.distance = parseInt(p.get('bdi')!) || 25;
      if (p.has('bbc')) this.barrelCondition = parseInt(p.get('bbc')!) || 70;
      if (p.has('bdf')) this.difficulty = parseInt(p.get('bdf')!) || 3;
      // Stash weapon/ammo IDs for deferred restore
      const savedLoadouts = [];
      for (let i = 0; i < MAX_LOADOUTS; i++) {
        if (p.has('bw' + i) || p.has('ba' + i)) {
          savedLoadouts.push({ weaponId: p.get('bw' + i) || '', ammoId: p.get('ba' + i) || '', silenced: p.get('bs' + i) === '1' });
        }
      }
      if (savedLoadouts.length === 0) savedLoadouts.push({ weaponId: '', ammoId: '', silenced: false });
      this._savedLoadouts = savedLoadouts;
      // Ensure loadouts array matches
      while (this.loadouts.length < savedLoadouts.length) this.loadouts.push(blankLoadout());
      while (this.loadouts.length > savedLoadouts.length) this.loadouts.pop();
      this.restoreWeaponsFromStorage();
      // Save to localStorage so it persists
      this.saveToStorage();
      return true;
    },

    async copyShareLink(): Promise<void> {
      this.pushUrlParams();
      try {
        await navigator.clipboard.writeText(window.location.href);
        this._shareFeedback = true;
        setTimeout(() => { this._shareFeedback = false; }, 2000);
      } catch { /* fallback: URL is already in address bar */ }
    },

    saveToStorage(): void {
      try {
        const state = {
          loadouts: this.loadouts.map(lo => ({ weaponId: lo.weapon?.id || '', ammoId: lo.ammoId, silenced: lo.silenced })),
          targetType: this.targetType,
          mutantId: this.selectedMutantId,
          npcProfileId: this.selectedNpcProfileId,
          hitzone: this.hitzone,
          faction: this.faction,
          distance: this.distance,
          barrelCondition: this.barrelCondition,
          difficulty: this.difficulty,
          showHelp: this.showHelp,
        };
        localStorage.setItem('damageSimState', JSON.stringify(state));
      } catch (e) { /* quota */ }
      this.pushUrlParams();
    },

    restoreFromStorage(): void {
      // Always restore UI prefs from localStorage (not part of URL sharing)
      try {
        const raw = localStorage.getItem('damageSimState');
        if (raw) {
          const prefs = JSON.parse(raw);
          if (prefs.showHelp != null) this.showHelp = prefs.showHelp;
        }
      } catch (e) { /* ignore */ }

      // URL params take priority (shared link)
      if (this.restoreFromUrl()) return;

      try {
        const raw = localStorage.getItem('damageSimState');
        if (raw) {
          const data = JSON.parse(raw);
          this._savedLoadouts = data.loadouts || null;
          if (this._savedLoadouts) {
            while (this.loadouts.length < this._savedLoadouts.length) this.loadouts.push(blankLoadout());
            while (this.loadouts.length > this._savedLoadouts.length && this.loadouts.length > 1) this.loadouts.pop();
          }
          if (data.targetType) this.targetType = data.targetType;
          if (data.hitzone) this.hitzone = data.hitzone;
          if (data.faction) this.faction = data.faction;
          if (data.distance != null) this.distance = data.distance;
          if (data.barrelCondition != null) this.barrelCondition = data.barrelCondition;
          if (data.difficulty != null) this.difficulty = data.difficulty;
          if (data.mutantId) this.selectedMutantId = data.mutantId;
          if (data.npcProfileId) this.selectedNpcProfileId = data.npcProfileId;
          if (data.showHelp != null) this.showHelp = data.showHelp;
          // Try weapon restore now (may succeed if data already loaded)
          this.restoreWeaponsFromStorage();
          return;
        }
      } catch (e) { /* ignore */ }

      // Defaults when no saved state
      this._restored = true;
      const sunrise = this.npcArmorProfiles.find(p =>
        p.visual_item_id === 'stalker_outfit' ||
        (p.visual_item_id?.startsWith('stalker_outfit') && !p.visual_item_id?.includes(',helm'))
      );
      if (sunrise) this.selectedNpcProfileId = sunrise.id;

      const boar = this.mutantProfiles.find(p => p.id === 'boar_normal');
      if (boar) this.selectedMutantId = boar.id;
    },

    findWeaponById(id: string): GameItem | null {
      const slugs = ['pistols', 'smgs', 'shotguns', 'rifles', 'snipers'];
      for (const slug of slugs) {
        const items = this.weaponCategories[slug];
        if (!Array.isArray(items)) continue;
        const found = items.find(w => w.id === id);
        if (found) return found;
      }
      return null;
    },

    applyInitialWeapons(): void {
      if (!this.initialWeaponIds || this.initialWeaponIds.length === 0) return;
      const ids = this.initialWeaponIds.slice(0, MAX_LOADOUTS);
      this.loadouts = ids.map(() => (blankLoadout()));
      (this as any)._savedLoadouts = ids.map(id => ({ weaponId: id, ammoId: '', silenced: false }));
      // Let the allWeapons watcher retry if weapon data hasn't arrived yet
      this._restored = false;
      this.restoreWeaponsFromStorage();
      if (this._restored) this.saveToStorage();
    },

    restoreWeaponsFromStorage(): void {
      const saved = (this as any)._savedLoadouts;
      if (!saved) return;
      const hasData = ['pistols', 'smgs', 'shotguns', 'rifles', 'snipers'].some(
        s => Array.isArray(this.weaponCategories[s]) && this.weaponCategories[s].length > 0
      );
      if (!hasData) return;
      // Ensure loadouts array is the right size
      while (this.loadouts.length < saved.length) this.loadouts.push(blankLoadout());
      for (let i = 0; i < saved.length; i++) {
        const lo = saved[i];
        if (!lo) continue;
        if (lo.weaponId) {
          const weapon = this.findWeaponById(lo.weaponId);
          if (weapon) this.loadouts[i].weapon = weapon;
        }
        if (lo.ammoId) this.loadouts[i].ammoId = lo.ammoId;
        // Combined model: a row needs ammo to score. When restored (or seeded by the
        // inventory modal) without one, default to the weapon's first compatible round.
        if (!this.loadouts[i].ammoId && this.loadouts[i].weapon) {
          this.loadouts[i].ammoId = this.defaultAmmoForWeapon(this.loadouts[i].weapon);
        }
        if (lo.silenced != null) this.loadouts[i].silenced = lo.silenced;
      }
      this._restored = true;
      (this as any)._savedLoadouts = null;
    },

    loadoutLabel(slot: number): string {
      const lo = this.loadouts[slot];
      if (!lo.weapon) return '';
      const wpn = (this as any).tName(lo.weapon) || lo.weapon.id;
      const ammo = this.selectedAmmoFor(slot);
      if (!ammo) return wpn;
      return wpn + ' + ' + (this as any).shortAmmoName((this as any).tName(ammo));
    },

    // ── Weapon icons ────────────────────────────────────────────
    iconUrl(id: string): string { return `img/icons/${id}.png`; },
    onIconError(e: Event): void {
      const img = e.target as HTMLImageElement;
      img.style.visibility = 'hidden';
      img.parentElement?.classList.add('no-icon');
    },

    // ── Combined weapon×ammo picker ─────────────────────────────
    openCombinedPicker(): void { this.combinedPickerOpen = true; },
    closeCombinedPicker(): void { this.combinedPickerOpen = false; this.weaponStartingFilter = false; this.ammoPrimaryFilter = true; },
    pairFilter(p: Record<string, any>, q: string): boolean {
      return `${p.weaponName} ${p.ammoName} ${p.weapon.id} ${p.ammoId}`.toLowerCase().includes(q);
    },
    isPairAdded(p: Record<string, any>): boolean {
      return this.loadouts.some(lo => lo.weapon?.id === p.weapon.id && lo.ammoId === p.ammoId);
    },
    selectPair(p: Record<string, any>): void {
      // Checkbox toggle: clicking an added pair removes it, otherwise add it.
      // Picker stays open so several pairs can be toggled in one pass.
      const idx = this.loadouts.findIndex(lo => lo.weapon?.id === p.weapon.id && lo.ammoId === p.ammoId);
      if (idx >= 0) { this.removeRow(idx); return; }
      this.addPair(p.weapon as GameItem, p.ammoId as string);
    },
    addPair(weapon: GameItem, ammoId: string): void {
      if (this.loadouts.length >= MAX_LOADOUTS) return;
      // Reuse a trailing empty row (e.g. the initial blank) before growing the list.
      let lo = this.loadouts.find(l => !l.weapon);
      if (!lo) { lo = blankLoadout(); this.loadouts.push(lo); }
      lo.weapon = weapon;
      lo.ammoId = ammoId;
      lo.silenced = false;
      this.saveToStorage();
    },
    removeRow(idx: number): void {
      const uid = this.loadouts[idx]?.uid;
      if (uid != null) {
        const p = this.pinnedUids.indexOf(uid);
        if (p >= 0) this.pinnedUids.splice(p, 1);
      }
      this.loadouts.splice(idx, 1);
      if (this.loadouts.length === 0) this.loadouts.push(blankLoadout());
      this.saveToStorage();
    },

    // ── Pins (drive the compare panel) ──────────────────────────
    isPinned(idx: number): boolean {
      const uid = this.loadouts[idx]?.uid;
      return uid != null && this.pinnedUids.includes(uid);
    },
    togglePin(idx: number): void {
      const uid = this.loadouts[idx]?.uid;
      if (uid == null) return;
      const pos = this.pinnedUids.indexOf(uid);
      if (pos >= 0) { this.pinnedUids.splice(pos, 1); return; }
      if (this.pinnedUids.length >= MAX_PINS) this.pinnedUids.shift();
      this.pinnedUids.push(uid);
    },
    // Select-all header checkbox: clear if anything is pinned, else pin up to MAX_PINS rows.
    toggleSelectAll(): void {
      if (this.pinAllState !== 'none') { this.pinnedUids = []; return; }
      const uids: number[] = [];
      for (const ar of this.activeResults) {
        if (uids.length >= MAX_PINS) break;
        const uid = this.loadouts[ar.idx]?.uid;
        if (uid != null) uids.push(uid);
      }
      this.pinnedUids = uids;
    },
    pinColorForIndex(idx: number): string {
      const uid = this.loadouts[idx]?.uid;
      if (uid == null) return '';
      const pos = this.pinnedUids.indexOf(uid);
      return pos >= 0 ? PIN_COLORS[pos % PIN_COLORS.length] : '';
    },

    // ── Sorting + derived row stats ─────────────────────────────
    sortBy(key: string): void {
      if (this.sortKey === key) { this.sortDir = this.sortDir === 1 ? -1 : 1; }
      else { this.sortKey = key; this.sortDir = key === 'stk' ? 1 : -1; }
    },
    sortValFor(ar: { idx: number, result: Record<string, any> }, key: string): number {
      const r = ar.result;
      if (this.targetType === 'mutant') {
        switch (key) {
          case 'pen': return r.mutant?.penetrated ? 1 : 0;
          case 'ammoMult': return r.mutant?.ammoMult ?? 0;
          case 'damage': return r.mutant?.damage ?? 0;
          case 'stk': return Number.isFinite(r.mutant?.stk) ? r.mutant.stk : 99999;
          case 'dps': return this.dpsFor(ar.idx);
        }
      } else {
        switch (key) {
          case 'pen': return r.stalker?.armor?.penetrated ? 1 : 0;
          case 'damage': return r.stalker?.armor?.damage ?? 0;
          case 'stk': return r.stalker?.stk?.stk ?? 99999;
          case 'ap': return r.stalker?.ap ?? 0;
          case 'dps': return this.dpsFor(ar.idx);
        }
      }
      return 0;
    },
    dpsFor(idx: number): number {
      const res = this.results[idx];
      const lo = this.loadouts[idx];
      if (!res || !lo?.weapon) return 0;
      const dmg = this.targetType === 'mutant' ? (res.mutant?.damage || 0) : (res.stalker?.armor?.damage || 0);
      const rof = parseFloat(lo.weapon.ui_inv_rate_of_fire as string || '0') || 0;
      return dmg * rof / 60;
    },
    dmgBarWidth(v: number | undefined): string {
      const max = this.maxActiveDamage;
      if (!max || !v) return '0%';
      return `${Math.max(3, Math.min(100, (v / max) * 100))}%`;
    },

    selectMutant(m: MutantProfile): void {
      this.selectedMutantId = m.id;
      this.mutantPickerOpen = false;
      this.saveToStorage();
    },
    selectNpcProfile(p: NpcArmorProfile): void {
      this.selectedNpcProfileId = p.id;
      this.npcPickerOpen = false;
      this.saveToStorage();
    },
    fmt(n: number | null | undefined): string {
      if (n == null || isNaN(n)) return '\u2014';
      if (Math.abs(n) < 0.0001) return '0';
      return n < 1 ? n.toFixed(4) : n.toFixed(2);
    },
    mutantDisplayName(id: string): string {
      const species = extractMutantSpecies(id);
      const base = species || id.replace(/_/g, ' ');
      return base.charAt(0).toUpperCase() + base.slice(1).replace(/_/g, ' ');
    },
    ammoMultClass(mult: number | undefined): string {
      // Highlight ammo multipliers that meaningfully shift the calc.
      // Default mutant_ammo_mult is 0.85; overrides above 1.0 are damage bonuses
      // (HP-style rounds), below 0.85 are penalties (rare). 1.5× and up is huge.
      if (mult == null) return '';
      if (mult >= 1.5) return 'damage-sim-better';
      if (mult < 0.85) return 'damage-sim-worse';
      return '';
    },
    mutantSubLabel(m: MutantProfile): string {
      // Used for disambiguation when stat-signature dedup keeps multiple
      // entries with the same display name (e.g., 3 poltergeist sub-types).
      // Surface the most useful stats for STK comparison.
      return `Skin ${m.skin_armor} · Hit Frac ${m.hit_fraction} · Head ×${m.hitzone_head}`;
    },
    npcProfileLabel(p: NpcArmorProfile): string {
      const items = p.visual_item_id || '';
      const t = (this as any).t;
      const parts = items.split(',').map(s => {
        const id = s.trim();
        // Try: id_name, st_id_name, id (raw key)
        for (const key of [id + '_name', 'st_' + id + '_name', id]) {
          const translated = t(key);
          if (translated !== key) return translated;
        }
        return id.replace(/_/g, ' ');
      });
      return parts.join(' + ') || p.id.split('\\').pop() || p.id;
    },
  },
  mounted() {
    this.restoreFromStorage();
    this.applyInitialWeapons();
  },
  beforeUnmount() {
    if ((this as any)._radarChart) {
      (this as any)._radarChart.destroy();
      (this as any)._radarChart = null;
    }
  },
  watch: {
    allWeapons(weapons: GameItem[]): void {
      if (weapons.length > 0 && !this._restored) {
        this.restoreWeaponsFromStorage();
      }
    },
    radarData: {
      deep: true,
      handler(): void {
        clearTimeout((this as any)._radarDebounce);
        (this as any)._radarDebounce = setTimeout(() => {
          this.$nextTick(() => this.updateRadarChart());
        }, 80);
      },
    },
    detailView(val: string): void {
      if (val === 'chart') {
        this.$nextTick(() => this.updateRadarChart());
      }
    },
  },
});
</script>

<style scoped>
.damage-sim {
  padding: 0 0.75rem 0.5rem 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.damage-sim-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.damage-sim-credit {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6rem;
  color: var(--text-secondary);
}
.damage-sim-actions {
  display: flex;
  gap: 0.4rem;
}
.damage-sim-actions .copy-link-btn {
  border-radius: 4px;
}
.damage-sim-credit a {
  color: var(--accent-dim);
  text-decoration: none;
}
.damage-sim-credit a:hover {
  color: var(--accent);
  text-decoration: underline;
}
.damage-sim-credit svg {
  color: var(--color-red-warm-soft);
}
.damage-sim-layout {
  display: grid;
  grid-template-columns: minmax(340px, 33%) 1fr;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 900px) {
  .damage-sim-layout { grid-template-columns: 1fr; }
}
.damage-sim-rail {
  position: sticky;
  top: 0;
  gap: 0.4rem;
}
/* Toolbar pinned to the top of the target column */
.damage-sim-rail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
/* Credit line sits at the bottom of the target column */
.damage-sim-rail-credit {
  margin-top: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border);
}
@media (max-width: 900px) {
  .damage-sim-rail { position: static; }
}

/* Rail toggle groups wrap instead of clipping in the (narrow) rail, and
   every button in a row stretches to a common height so wrapping sub-labels
   don't create ragged rows. */
.damage-sim-rail .damage-sim-toggle-group {
  flex-wrap: wrap;
  overflow: visible;
  border: none;
  gap: 0.3rem;
  align-items: stretch;
}
.damage-sim-rail .damage-sim-toggle-group button {
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 3px;
}
.damage-sim-rail .damage-sim-toggle-group button + button {
  border-left: 1px solid var(--border);
}
.damage-sim-rail .damage-sim-toggle-group button.active {
  border-color: var(--accent-dim);
}
/* Faction has 6 options — lay them out as an even 3×2 grid so none clip. */
.damage-sim-rail .damage-sim-fac-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

/* ── Board header + primary add button ─────────────────────── */
.damage-sim-board-col { gap: 0.6rem; }
.damage-sim-board-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.damage-sim-board-title {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text);
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.damage-sim-board-count {
  font-family: var(--mono);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
}
.damage-sim-board-vs {
  font-size: 0.68rem;
  font-weight: 400;
  color: var(--text-secondary);
}
.damage-sim-add-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--color-accent-tint-10);
  color: var(--accent);
  border: 1px solid var(--accent-dim);
  border-radius: 5px;
  padding: 0.4rem 0.75rem;
  font-family: var(--font-display);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.damage-sim-add-primary:hover {
  background: var(--color-accent-tint-20);
  border-color: var(--accent);
}

/* ── Leaderboard table ─────────────────────────────────────── */
.damage-sim-lb-wrap { overflow-x: auto; }
.damage-sim-lb {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;
}
.damage-sim-lb thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--card);
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  padding: 0.4rem 0.5rem;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
}
.damage-sim-lb thead th.left { text-align: left; }
.damage-sim-lb-sortable { cursor: pointer; user-select: none; transition: color 0.12s; }
.damage-sim-lb-sortable:hover { color: var(--text); }
.damage-sim-lb thead th.sorted { color: var(--accent); }
.damage-sim-lb-arrow { margin-left: 0.15rem; font-size: 0.6rem; }
.damage-sim-lb-pin-col { width: 1.6rem; }
.damage-sim-lb-sil-col { width: 5.5rem; }
.damage-sim-lb-remove-col { width: 2rem; }

.damage-sim-lb tbody tr { border-bottom: 1px solid var(--color-overlay-border-50); transition: background 0.1s; }
.damage-sim-lb tbody tr:hover { background: var(--color-accent-tint-5); }
.damage-sim-lb tbody tr.pinned { background: var(--color-accent-tint-8); }
.damage-sim-lb td { padding: 0.4rem 0.5rem; text-align: right; vertical-align: middle; white-space: nowrap; }
.damage-sim-lb td.left { text-align: left; }
.damage-sim-lb-num { font-family: var(--mono); }

/* pin checkbox */
.damage-sim-lb-pin-cell { text-align: center; }
.damage-sim-pin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border: 1.5px solid var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  background: var(--card-raised);
  color: var(--bg);
  transition: border-color 0.12s, background 0.12s;
}
.damage-sim-pin:hover { border-color: var(--accent); }
/* Header select-all checkbox (no per-row pin color) */
.damage-sim-pin-all.on { background: var(--accent); border-color: var(--accent); }

/* weapon cell */
.damage-sim-lb-wcell { display: flex; align-items: center; gap: 0.55rem; min-width: 0; }
.damage-sim-lb-icon {
  width: 84px;
  height: 46px;
  flex: 0 0 auto;
  border-radius: 5px;
  background: var(--card-raised);
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.damage-sim-lb-icon img { width: 100%; height: 100%; object-fit: contain; }
.damage-sim-lb-icon.no-icon { position: relative; }
.damage-sim-lb-icon.no-icon::after {
  content: '';
  position: absolute;
  inset: 25%;
  background: currentColor;
  color: var(--text-secondary);
  opacity: 0.4;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='22' y1='12' x2='18' y2='12'/%3E%3Cline x1='6' y1='12' x2='2' y2='12'/%3E%3Cline x1='12' y1='6' x2='12' y2='2'/%3E%3Cline x1='12' y1='22' x2='12' y2='18'/%3E%3C/svg%3E") center / contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='22' y1='12' x2='18' y2='12'/%3E%3Cline x1='6' y1='12' x2='2' y2='12'/%3E%3Cline x1='12' y1='6' x2='12' y2='2'/%3E%3Cline x1='12' y1='22' x2='12' y2='18'/%3E%3C/svg%3E") center / contain no-repeat;
}
.damage-sim-lb-wtext { min-width: 0; }
.damage-sim-lb-wname {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  line-height: 1.15;
}
.damage-sim-lb-silenced { display: inline-flex; color: var(--text-secondary); }
.damage-sim-lb-ammo {
  display: inline-block;
  margin-top: 0.15rem;
  font-family: var(--mono);
  font-size: 0.6rem;
  padding: 0.02rem 0.35rem;
  border-radius: 3px;
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
}
.ammo-cls-HP { color: var(--color-green-positive); border-color: var(--color-green-muted); }
.ammo-cls-AP { color: var(--color-blue-mid); border-color: var(--color-blue-muted); }
.ammo-cls-BUCK, .ammo-cls-SLUG { color: var(--accent-warm); border-color: var(--color-accent-muted); }

/* pen chip — a quiet verdict so the gold damage value stays the loudest cell */
.damage-sim-pen-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-family: var(--font-display);
  font-size: 0.56rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: none;
}
.damage-sim-pen-chip.pen { color: var(--color-green-positive); }
.damage-sim-pen-chip.nopen { color: var(--color-red-warm-soft); }

/* pen verdict folded into the AP column: icon sits to the left of the AP value */
.damage-sim-lb-ap-line { display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.3rem; }
.damage-sim-pen-ico { display: inline-flex; align-items: center; }
.damage-sim-pen-ico.pen { color: var(--color-green-positive); }
.damage-sim-pen-ico.nopen { color: var(--color-red-warm-soft); }

/* damage cell + bar */
.damage-sim-lb-dmg { min-width: 5.5rem; }
.damage-sim-lb-dmgval { font-family: var(--mono); font-size: 0.74rem; font-weight: 700; color: var(--text); }
.damage-sim-lb-dmgval.best { color: var(--accent); }
.damage-sim-lb-bar { height: 3px; border-radius: 2px; margin-top: 0.2rem; background: var(--color-overlay-white-6); overflow: hidden; }
.damage-sim-lb-bar span { display: block; height: 100%; border-radius: 2px; transition: width 0.25s ease; }
.damage-sim-lb-crit {
  display: inline-block;
  margin-top: 0.2rem;
  font-size: 0.55rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--accent);
}
.damage-sim-lb-val { font-family: var(--mono); font-size: 0.7rem; color: var(--text); }
.damage-sim-lb-stk { font-family: var(--mono); font-size: 0.76rem; font-weight: 700; color: var(--text); }
.damage-sim-lb-sub { display: block; font-family: var(--mono); font-size: 0.55rem; color: var(--text-secondary); }

/* row actions */
.damage-sim-lb-sil-cell { text-align: right; }
.damage-sim-lb-sil-cell .damage-sim-silencer-toggle { display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.4rem; }
.damage-sim-sil-caption { color: var(--text-secondary); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; transition: color 0.12s; }
.damage-sim-sil-caption.on { color: var(--accent); }
.damage-sim-lb-remove-cell { text-align: center; }
.toggle-switch-sm { transform: scale(0.8); transform-origin: right center; }

/* ── Compare panel (pinned) ────────────────────────────────── */
.damage-sim-compare {
  padding-top: 0.6rem;
  margin-top: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.damage-sim-compare-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.damage-sim-compare-title {
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text);
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}
.damage-sim-compare-sub { font-size: 0.58rem; font-weight: 400; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); }

/* ── Combined picker rows ──────────────────────────────────── */
.damage-sim-pick-check {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--text-secondary);
  border-radius: 4px;
  background: var(--card-raised);
  color: var(--bg);
  transition: border-color 0.12s, background 0.12s;
}
.damage-sim-pick-check.on { background: var(--accent); border-color: var(--accent); }
.build-picker-item:hover .damage-sim-pick-check { border-color: var(--accent); }
.damage-sim-pick-id { font-family: var(--mono); font-size: 0.6rem; color: var(--text-muted); white-space: nowrap; }
.damage-sim-pick-ammo { margin-left: auto; }

/* Panels */
.damage-sim-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Loadout row: single line */
.damage-sim-loadout-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.damage-sim-icon-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.15rem;
  border-radius: 3px;
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s;
}
.damage-sim-icon-btn:hover {
  color: var(--accent);
  background: var(--color-accent-tint-8);
}
.damage-sim-icon-btn-hidden {
  visibility: hidden;
}
.damage-sim-icon-btn-danger:hover {
  color: var(--color-red-vibrant);
  background: var(--color-red-vibrant-tint-10);
}

/* Add loadout button */
.damage-sim-add-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: 2px dashed var(--color-overlay-white-15);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  align-self: flex-start;
}
.damage-sim-add-btn:hover {
  color: var(--accent);
  border-color: var(--accent-dim);
}

/* Loadout row */
.damage-sim-loadout-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.damage-sim-loadout-row .damage-sim-slot {
  flex: 1;
  min-width: 0;
}


/* Comparison highlights */
.damage-sim-better { color: var(--color-green-positive) !important; }
.damage-sim-worse { color: var(--color-red-warm-soft) !important; }

/* Compare tag (inline percentage delta) */
.damage-sim-compare-tag {
  font-family: var(--mono);
  font-size: 0.55rem;
  font-weight: 600;
  margin-left: 0.5rem;
  padding: 0.05rem 0.3rem;
  border-radius: 2px;
}
.damage-sim-compare-tag.damage-sim-better {
  background: var(--color-green-positive-tint-10);
}
.damage-sim-compare-tag.damage-sim-worse {
  background: var(--color-red-warm-soft-tint-10);
}

/* Section labels */
.damage-sim-section-label {
  font-size: 0.55rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 600;
  margin-top: 0.25rem;
}

.damage-sim-silencer-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
}
/* Built-in silencer: always on, not user-changeable. */
.damage-sim-silencer-toggle.locked {
  cursor: default;
}
.damage-sim-silencer-toggle.locked .toggle-switch {
  opacity: 0.6;
}

/* Slots */
.damage-sim-slot {
  position: relative;
  border-radius: 4px;
  padding: 0.35rem 0.6rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  min-height: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
}
.damage-sim-slot.filled {
  background: var(--card-raised);
  border: 2px solid var(--border);
}
.damage-sim-slot.filled:hover {
  border-color: var(--accent-dim);
  background: var(--color-accent-tint-5);
}
.damage-sim-slot.empty {
  border: 2px dashed var(--color-overlay-white-15);
  display: flex;
  align-items: center;
  justify-content: center;
}
.damage-sim-slot.empty:hover {
  border-color: var(--accent-dim);
  background: var(--color-accent-tint-5);
}
.damage-sim-slot.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.damage-sim-slot.filled { border-left: 3px solid var(--border); }
.damage-sim-slot-name {
  font-size: 0.7rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 1rem;
}
.damage-sim-target-slot {
  height: 2.8rem;
}
.damage-sim-slot-meta {
  font-size: 0.6rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.1rem 0.7rem;
}
.damage-sim-stat .k { color: var(--text-secondary); }
.damage-sim-stat .v { color: var(--text-muted); font-family: var(--mono); }
.damage-sim-slot-hint {
  font-size: 0.65rem;
  color: var(--text-secondary);
}
.damage-sim-slot-remove {
  position: absolute;
  top: 0.15rem;
  right: 0.3rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.15rem 0.25rem;
  border-radius: 3px;
  transition: color 0.15s, background 0.15s;
}
.damage-sim-slot-remove:hover {
  color: var(--color-red-vibrant);
  background: var(--color-red-vibrant-tint-10);
}

/* Toggle groups */
.damage-sim-toggle-group {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.damage-sim-toggle-group button {
  flex: 1;
  padding: 0.3rem 0.4rem;
  border: none;
  background: var(--card);
  color: var(--text-secondary);
  font-size: 0.65rem;
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 600;
}
.damage-sim-toggle-group button + button {
  border-left: 1px solid var(--border);
}
.damage-sim-toggle-group button:hover {
  color: var(--text);
}
.damage-sim-toggle-group button.active {
  color: var(--accent);
  border-color: var(--accent-dim);
  background: var(--color-accent-tint-8);
}

/* Sub-line values in toggle buttons — the modifier reads second to the choice */
.damage-sim-btn-sub {
  display: block;
  font-size: 0.5rem;
  font-weight: 400;
  opacity: 0.5;
  margin-top: 0.12rem;
  letter-spacing: 0;
}
.damage-sim-toggle-group button.active .damage-sim-btn-sub { opacity: 0.65; }

/* Range rows */
.damage-sim-range-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.damage-sim-range-row input[type="range"] {
  flex: 1;
  accent-color: var(--accent);
  height: 4px;
}
.damage-sim-range-value {
  font-family: var(--mono);
  font-size: 0.7rem;
  color: var(--text);
  min-width: 3rem;
  text-align: right;
}


/* Picker filter button — matches toggle-switch style */
.damage-sim-picker-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 0.65rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  flex-shrink: 0;
  height: 1.75rem;
}
.damage-sim-picker-filter:hover {
  color: var(--text);
  border-color: var(--accent-dim);
}
.damage-sim-picker-filter.active {
  color: var(--accent);
  border-color: var(--accent-dim);
  background: var(--color-accent-tint-8);
}

/* Divider */
.damage-sim-divider {
  height: 1px;
  background: var(--border);
  margin: 0.25rem 0;
}

/* Stats boxes */
.damage-sim-stats-box {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.damage-sim-stats-header {
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.55rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
}
.damage-sim-stats-body {
  padding: 0.5rem 0.6rem;
}
.damage-sim-big-value {
  font-family: var(--mono);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
}
.damage-sim-stat-range {
  font-family: var(--mono);
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}
.damage-sim-ap-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}
.damage-sim-ap-vs {
  font-size: 0.6rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}

/* Pen icon */
.damage-sim-pen-icon {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-right: 0.25rem;
}
.damage-sim-pen-icon.pen { color: var(--color-green-positive); }
.damage-sim-pen-icon.nopen { color: var(--color-red-warm-soft); }

/* Pen badge */
.damage-sim-pen-badge {
  display: inline-block;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  margin-top: 0.35rem;
}
.damage-sim-pen-badge.pen {
  background: var(--color-green-positive-tint-12);
  color: var(--color-green-positive);
}
.damage-sim-pen-badge.nopen {
  background: var(--color-red-warm-soft-tint-12);
  color: var(--color-red-warm-soft);
}

/* Crit badge */
.damage-sim-crit-badge {
  display: inline-block;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  margin-top: 0.35rem;
  background: var(--color-accent-tint-12);
  color: var(--accent);
}

/* Stat breakdown rows */
.damage-sim-stat-rows {
  padding: 0.25rem 0.6rem 0.4rem;
}
.damage-sim-stat-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.15rem 0;
  border-bottom: 1px solid var(--color-overlay-border-50);
  font-size: 0.65rem;
}
.damage-sim-stat-row span:first-child {
  color: var(--text-secondary);
}
.damage-sim-stat-row span:last-child {
  font-family: var(--mono);
  text-align: right;
  color: var(--text);
}
.damage-sim-stat-row-total {
  border-top: 1px solid var(--border);
  margin-top: 0.15rem;
  padding-top: 0.25rem;
  font-weight: 600;
}
.damage-sim-stat-row-total span:first-child {
  color: var(--text);
}
.damage-sim-breakdown-section {
  font-size: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--accent-dim);
  margin-top: 0.4rem;
  margin-bottom: 0.15rem;
}
.damage-sim-breakdown-section:first-child {
  margin-top: 0;
}

/* Results table */
.damage-sim-results-table-wrap {
  overflow-x: auto;
}
.damage-sim-results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.7rem;
  table-layout: fixed;
}
.damage-sim-results-table th {
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0.3rem 0.4rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 8rem;
}
.damage-sim-results-table td {
  padding: 0.3rem 0.4rem;
  border-bottom: 1px solid var(--color-overlay-border-50);
  vertical-align: top;
}
.damage-sim-table-label {
  font-size: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 6rem;
}
.damage-sim-table-val {
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--text);
}
.damage-sim-table-val-primary {
  font-weight: 700;
  font-size: 0.85rem;
}
.damage-sim-table-vs {
  font-size: 0.5rem;
  color: var(--text-secondary);
  margin: 0 0.2rem;
}
.damage-sim-table-sub {
  font-size: 0.55rem;
  color: var(--text-secondary);
  font-family: var(--mono);
}

.damage-sim-table-section td {
  font-size: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--accent-dim);
  padding-top: 0.5rem;
  padding-bottom: 0.15rem;
  border-bottom: 1px solid var(--accent-dim);
}
.damage-sim-table-total td {
  border-top: 1px solid var(--border);
  font-weight: 600;
}
.damage-sim-table-total .damage-sim-table-label {
  color: var(--text);
}

/* Help toggle — extends .copy-link-btn */
.damage-sim-help-toggle {
  width: auto;
  gap: 0.3rem;
  padding: 0 0.5rem;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.damage-sim-help-toggle:hover {
  color: #8db8d8;
  border-color: #6a9bbe;
}
.damage-sim-help-toggle.active {
  color: #8db8d8;
  border-color: #6a9bbe;
  background: rgba(80, 130, 170, 0.12);
}

/* Help text — inline callout */
.damage-sim-help-text {
  font-size: 0.65rem;
  color: #a0b8d0;
  font-weight: 400;
  text-transform: none;
  letter-spacing: normal;
  white-space: normal;
  line-height: 1.4;
  margin-top: 0.35rem;
  padding: 0.35rem 0.5rem 0.35rem 1.5rem;
  background: rgba(80, 130, 170, 0.08);
  border: 1px solid rgba(100, 145, 180, 0.2);
  border-radius: 4px;
  position: relative;
}
.damage-sim-help-text::before {
  content: '';
  position: absolute;
  left: 0.4rem;
  top: 0.4rem;
  width: 0.7rem;
  height: 0.7rem;
  background: currentColor;
  opacity: 0.5;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 16v-4'/%3E%3Cpath d='M12 8h.01'/%3E%3C/svg%3E") center / contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 16v-4'/%3E%3Cpath d='M12 8h.01'/%3E%3C/svg%3E") center / contain no-repeat;
}
.damage-sim-table-label:has(.damage-sim-help-text) {
  white-space: normal;
  overflow: visible;
  max-width: none;
}
.damage-sim-table-label .damage-sim-help-text {
  border: none;
  background: none;
  padding: 0;
  margin-top: 0.1rem;
  border-radius: 0;
  font-size: 0.6rem;
  opacity: 0.85;
  position: static;
}
.damage-sim-table-label .damage-sim-help-text::before {
  display: none;
}

/* Per-row info icon — hover for tooltip with help text */
.damage-sim-info-icon {
  display: inline-block;
  margin-left: 0.35rem;
  vertical-align: -2px;
  color: rgba(160, 184, 208, 0.55);
  cursor: help;
  transition: color 0.15s;
}
.damage-sim-info-icon:hover {
  color: #8db8d8;
}

/* Detail toggle */
.damage-sim-detail-toggle {
  grid-column: 1 / -1;
  margin-top: 0.25rem;
}
.damage-sim-toggle-sm button {
  padding: 0.2rem 0.5rem;
  font-size: 0.55rem;
}

/* Radar chart */
.damage-sim-radar-wrap {
  width: 100%;
  max-width: 500px;
  margin: 0.5rem auto 0;
}
.damage-sim-radar-mode {
  display: flex;
  justify-content: center;
  gap: 0;
  margin-top: 0.25rem;
}
.damage-sim-radar-mode button {
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.2rem 0.6rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.damage-sim-radar-mode button:first-child {
  border-radius: 3px 0 0 3px;
}
.damage-sim-radar-mode button:not(:first-child) {
  border-left: none;
}
.damage-sim-radar-mode button:last-child {
  border-radius: 0 3px 3px 0;
}
.damage-sim-radar-mode button.active {
  color: var(--accent);
  border-color: var(--accent-dim);
  background: var(--color-accent-tint-8);
  z-index: 1;
  position: relative;
  border-left: 1px solid var(--accent-dim);
}
.damage-sim-radar-mode button:hover {
  color: var(--text);
}


/* Empty state */
.damage-sim-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  opacity: 0.5;
  grid-column: 1 / -1;
}
.damage-sim-empty-state p {
  font-size: 0.75rem;
  margin: 0;
}

/* ── Mobile / small-screen fixes ────────────────────────────────────────── */
@media (max-width: 768px) {
  .damage-sim {
    padding-right: 0.5rem;
    /* do NOT add overflow-x: hidden – that clips content instead of fitting it */
  }

  /* KEY FIX: grid items must have min-width: 0 so they respect their track
     width and don't push the column (and the page) wider than the viewport. */
  .damage-sim-panel {
    min-width: 0;
  }

  /* Topbar: allow credit + actions to wrap on tiny screens */
  .damage-sim-topbar {
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .damage-sim-actions {
    flex-wrap: wrap;
  }

  /* ── Toggle groups ────────────────────────────────────────────────────── *
   * Buttons default to min-width:auto which means they refuse to shrink     *
   * below their text content.  6 faction buttons × ~68 px = ~408 px on a   *
   * 375 px screen → overflow.  Fix: drop the shared-border approach, give  *
   * every button its own border and let the group wrap freely.              */
  .damage-sim-toggle-group {
    flex-wrap: wrap;
    overflow: visible;
    border: none;           /* outer border replaced by per-button borders   */
    gap: 0.3rem;
  }
  .damage-sim-toggle-group button {
    flex: 1 1 auto;
    min-width: 0;           /* allow shrinking below content width           */
    border: 1px solid var(--border) !important;
    border-radius: 3px !important;
  }
  .damage-sim-toggle-group button + button {
    border-left: 1px solid var(--border) !important;
  }
  .damage-sim-toggle-group button.active {
    border-color: var(--accent-dim) !important;
  }

  /* ── Loadout row ──────────────────────────────────────────────────────── *
   * Allow wrapping so weapon + ammo slots stack on very narrow screens.     *
   * The slots already have flex:1 + min-width:0 + text-overflow:ellipsis   *
   * so on most 375 px+ screens they stay on one row and just truncate.      */
  .damage-sim-loadout-row {
    flex-wrap: wrap;
    row-gap: 0.25rem;
  }
  .damage-sim-loadout-row > .damage-sim-slot {
    /* each slot can claim a full row on its own when space is too tight */
    flex: 1 1 8rem;
    min-width: 0;
  }

  /* ── Slot meta text ───────────────────────────────────────────────────── *
   * "Body X · Head X · AP Scale X · Hit Frac X" – very long, no wrapping.  */
  .damage-sim-slot-meta {
    white-space: normal;
    overflow-wrap: break-word;
    word-break: break-word;
    font-size: 0.55rem;
    line-height: 1.4;
  }
}
</style>
