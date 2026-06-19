// Shared parser for trader supply-tier unlock conditions.
//
// Trader CSVs encode each tier's requirement as a raw string such as
//   "=actor_goodwill_ge(stalker:2000) OR =heavy_pockets_functor()"
// parseCondition turns that into an array of human-readable, OR-joined labels.
// `t` is the app translation function (key -> string), passed in so this module
// stays free of any Vue/component coupling.

const FACTION_KEY = {
  stalker: 'app_faction_stalker', bandit: 'app_faction_bandit',
  csky: 'app_faction_clear_sky', dolg: 'app_faction_duty',
  freedom: 'app_faction_freedom', ecolog: 'app_faction_ecolog',
  army: 'app_faction_military', monolith: 'app_faction_monolith',
  killer: 'app_faction_mercenary', greh: 'app_faction_greh',
  isg: 'app_faction_isg',
};

const FACTION_FALLBACK = {
  stalker: 'Stalker', bandit: 'Bandit', csky: 'Clear Sky',
  dolg: 'Duty', freedom: 'Freedom', ecolog: 'Ecologist',
  army: 'Military', monolith: 'Monolith', killer: 'Mercenary',
  greh: 'Sin', isg: 'ISG',
};

export function parseCondition(raw, t) {
  const CONDITION_HANDLERS = {
    actor_goodwill_ge: (args) => {
      const [factionRaw, threshold] = args.split(':');
      const fKey = FACTION_KEY[factionRaw];
      const fName = fKey ? (t(fKey) || FACTION_FALLBACK[factionRaw] || factionRaw) : factionRaw;
      return `${fName} ≥ ${threshold}`;
    },
    heavy_pockets_functor: () => t('app_trading_cond_heavy_pockets') || 'Heavy Pockets',
    toolkit_task_done: (args) => (t('app_trading_cond_toolkit_task') || 'Toolkit task {n} done').replace('{n}', args),
    drugkit_task_done: () => t('app_trading_cond_drugkit_task') || 'Drug kit task done',
    raid_goodwill_check: (args) => CONDITION_HANDLERS.actor_goodwill_ge(args),
  };

  const parts = String(raw).split(/ OR /);
  const labels = [];

  for (const part of parts) {
    const p = part.trim();

    if (p.startsWith('+')) {
      labels.push(p.slice(1).replace(/_/g, ' '));
      continue;
    }

    if (p.startsWith('=')) {
      const match = p.slice(1).match(/^(\w+)\((.*)\)$/);
      if (match) {
        const [, fnName, args] = match;
        const handler = CONDITION_HANDLERS[fnName];
        if (handler) {
          labels.push(handler(args));
          continue;
        }
        // Unknown function: humanize name
        labels.push(fnName.replace(/_/g, ' ').trim());
        continue;
      }
    }

    labels.push(p.replace(/^=/, '').replace(/_/g, ' ').replace(/\(.*\)/, '').trim());
  }

  return labels;
}
