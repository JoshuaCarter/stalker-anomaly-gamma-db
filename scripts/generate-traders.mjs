#!/usr/bin/env node
/**
 * Converts trader CSV files from data/<pack>/traders/ into JSON
 * and writes them to site/public/data/<pack>/traders/.
 *
 * Usage: node scripts/generate-traders.mjs [--pack gamma-0.9.5]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function coerce(val) {
  if (val === '') return '';
  if (!isNaN(val)) return Number(val);
  return val;
}

/**
 * Parse a trader CSV into a compact JSON-friendly structure.
 *
 * - The header row (with names like st_data_export_*, ~) is discarded.
 * - "data.csv" (key-value pairs) → plain object { key: value }
 * - All other files → array of arrays [[id, v1, v2, ...], ...]
 *   Rows where every value column is empty are omitted.
 */
function parseCSV(text, fileName) {
  const lines = text.replace(/\r\n/g, '\n').trimEnd().split('\n');
  if (lines.length < 2) return [];

  const headerCount = lines[0].split(',').length;
  const isKeyValue = headerCount === 2 && fileName === 'data';

  if (isKeyValue) {
    const obj = {};
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const idx = line.indexOf(',');
      const key = line.slice(0, idx).trim();
      const val = coerce(line.slice(idx + 1).trim());
      if (key && val !== '') obj[key] = val;
    }
    return obj;
  }

  // Array-style: supplies, conditions, discounts, buy_supplies, etc.
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split(',');
    const id = parts[0].trim();
    if (!id) continue;
    const values = parts.slice(1).map(v => coerce(v.trim()));
    // Skip rows where all value columns are empty
    if (values.every(v => v === '')) continue;
    if (values.length === 1) {
      rows.push([id, values[0]]);
    } else {
      rows.push([id, ...values]);
    }
  }
  return rows;
}

/** Numeric rank for a supply-tier key, used to find the lowest tier an item sells at.
 *  `supplies_generic` is always available, so it ranks below the numbered tiers. */
function tierRank(key) {
  if (key === 'supplies_generic') return 0;
  const n = parseInt(key.replace('supplies_', ''), 10);
  return Number.isFinite(n) ? n : Infinity;
}

/** Compact tier suffix for display ("1".."5" or "generic"). */
function tierSuffix(key) {
  return key === 'supplies_generic' ? 'generic' : key.replace('supplies_', '');
}

// Source CSVs whose items are weapons / outfits / helmets. In GAMMA these are
// stocked into traders (they appear in supplies_*), but the engine forbids
// *selling* them: the trader's sell_condition lists every weapon/outfit/helmet
// section as a bare name (no price value), which the engine reads as "disabled
// for trade" (see CTradeParameters::process / AllowItemToTrade). So an item in
// supplies is only actually sold if it ALSO appears in sell_condition.
// We restrict this intersection to weapon/outfit/helmet kinds because addons
// (scopes/silencers/mags) are not in the exporter's sell_condition catalog yet
// are genuinely sellable — they must stay supplies-based.
const GEAR_CSVS = [
  'export_weapons_pistol', 'export_weapons_smg', 'export_weapons_shotgun',
  'export_weapons_rifle', 'export_weapons_sniper', 'export_weapons_melee',
  'export_weapons_explosive', 'export_outfits_outfit_light',
  'export_outfits_outfit_medium', 'export_outfits_outfit_heavy',
  'export_outfits_outfit_helmet',
];

/** Set of every weapon/outfit/helmet item id for a pack, read from the source
 *  export CSVs (id is the first column). Empty set if the pack has none. */
function getGearItemIds(pack) {
  const dir = path.join(ROOT, 'data', pack);
  const ids = new Set();
  for (const name of GEAR_CSVS) {
    const file = path.join(dir, `${name}.csv`);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n').trimEnd().split('\n');
    for (let i = 1; i < lines.length; i++) { // skip header row
      const id = (lines[i] || '').split(',')[0].trim();
      if (id && id !== '~') ids.add(id);
    }
  }
  return ids;
}

/** Set of item ids a trader will actually sell (its sell_condition entries),
 *  or null when the trader has no sell_condition data (then no filtering). */
function sellableSet(traderData) {
  const rows = traderData.sell_condition;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const s = new Set();
  for (const row of rows) if (row[0]) s.add(row[0]);
  return s;
}

/** A gear item (weapon/outfit/helmet) stocked in supplies is only sold when its
 *  trader also lists it as sellable. Non-gear items are always kept. */
function isBlockedGear(id, gearIds, sellable) {
  return sellable !== null && gearIds.has(id) && !sellable.has(id);
}

function processTraderDir(traderPath) {
  const files = fs.readdirSync(traderPath).filter(f => f.endsWith('.csv'));
  const traderData = {};

  for (const file of files) {
    const key = path.basename(file, '.csv');
    const content = fs.readFileSync(path.join(traderPath, file), 'utf-8');
    traderData[key] = parseCSV(content, key);
  }

  return traderData;
}

/**
 * Source-derived set of every item id that at least one trader stocks for sale
 * (i.e. appears in any `supplies_*` tier). Reads the trader CSV *inputs*
 * directly so consumers — e.g. the index generator's obtainability pass — can
 * depend on source data rather than on the produced sold-by.json. Returns an
 * empty set if the pack has no trader data.
 */
export function getSoldItemIds(pack) {
  const srcDir = path.join(ROOT, 'data', pack, 'traders');
  const sold = new Set();
  if (!fs.existsSync(srcDir)) return sold;

  const gearIds = getGearItemIds(pack);
  const traderDirs = fs.readdirSync(srcDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const traderName of traderDirs) {
    const traderData = processTraderDir(path.join(srcDir, traderName));
    const sellable = sellableSet(traderData);
    for (const key of Object.keys(traderData)) {
      if (!key.startsWith('supplies_')) continue;
      for (const row of (traderData[key] || [])) {
        const id = row[0];
        if (!id || isBlockedGear(id, gearIds, sellable)) continue;
        sold.add(id);
      }
    }
  }
  return sold;
}

export function generateTraders(pack) {
  const srcDir = path.join(ROOT, 'data', pack, 'traders');
  const outDir = path.join(ROOT, 'site', 'public', 'data', pack, 'traders');

  if (!fs.existsSync(srcDir)) {
    console.error(`Source directory not found: ${srcDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const traderDirs = fs.readdirSync(srcDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let totalFiles = 0;
  const gearIds = getGearItemIds(pack);
  // Reverse index: itemId -> [{ trader, tier, cond }] — which traders stock this item
  // for sale and the lowest supply tier (plus that tier's unlock condition) it appears in.
  const soldBy = {};
  for (const traderName of traderDirs) {
    const traderPath = path.join(srcDir, traderName);
    const traderData = processTraderDir(traderPath);
    const outFile = path.join(outDir, `${traderName}.json`);
    fs.writeFileSync(outFile, JSON.stringify(traderData, null, 2));
    const csvCount = Object.keys(traderData).length;
    totalFiles += csvCount;
    console.log(`  ${traderName}: ${csvCount} CSV files → ${traderName}.json`);

    // buy_supplies = [[tierKey, conditionString], ...] — the requirement to unlock each tier.
    const condByTier = {};
    for (const [tierKey, cond] of (traderData.buy_supplies || [])) {
      if (cond) condByTier[tierKey] = String(cond);
    }
    // For each item, keep the lowest tier it sells at for this trader. Gear stocked
    // but disabled in sell_condition (weapons/outfits/helmets) is skipped — see GEAR_CSVS.
    const sellable = sellableSet(traderData);
    const lowest = {}; // itemId -> tierKey
    for (const key of Object.keys(traderData)) {
      if (!key.startsWith('supplies_')) continue;
      for (const row of (traderData[key] || [])) {
        const id = row[0];
        if (!id || isBlockedGear(id, gearIds, sellable)) continue;
        if (!(id in lowest) || tierRank(key) < tierRank(lowest[id])) lowest[id] = key;
      }
    }
    for (const [id, tierKey] of Object.entries(lowest)) {
      (soldBy[id] ||= []).push({
        trader: traderName,
        tier: tierSuffix(tierKey),
        cond: condByTier[tierKey] || null,
      });
    }
  }

  // Sort each item's traders by tier (lowest first) then trader id for stable output.
  for (const id of Object.keys(soldBy)) {
    soldBy[id].sort((a, b) =>
      tierRank(`supplies_${a.tier}`) - tierRank(`supplies_${b.tier}`) || a.trader.localeCompare(b.trader)
    );
  }
  const soldByOut = path.join(outDir, '..', 'sold-by.json');
  fs.writeFileSync(soldByOut, JSON.stringify(soldBy));
  console.log(`Wrote sold-by.json (${Object.keys(soldBy).length} items) → ${soldByOut}`);

  console.log(`\nDone! Processed ${totalFiles} CSV files from ${traderDirs.length} traders → ${outDir}`);

  // Generate traders-meta.json alongside other pack-level JSON files
  const metaOutFile = path.join(outDir, '..', 'traders-meta.json');

  // Preserve any colors the user has already set manually
  let colorMap = {};
  try {
    const existing = JSON.parse(fs.readFileSync(metaOutFile, 'utf-8'));
    for (const entry of existing) {
      if (entry.id && entry.color) colorMap[entry.id] = entry.color;
    }
  } catch { /* file doesn't exist yet or is malformed — start fresh */ }

  const tradersMeta = traderDirs.map(id => {
    const dataFile = path.join(srcDir, id, 'data.csv');
    let label = '';
    try {
      const data = parseCSV(fs.readFileSync(dataFile, 'utf-8'), 'data');
      label = data.name ?? '';
    } catch { /* no data.csv — leave label empty */ }
    return { id, labelKey: `app_${id}`, label, color: colorMap[id] ?? '' };
  });

  fs.writeFileSync(metaOutFile, JSON.stringify(tradersMeta, null, 2));
  console.log(`Wrote traders-meta.json (${tradersMeta.length} entries) → ${metaOutFile}`);
}

// Run as a script when invoked directly: `node scripts/generate-traders.mjs --pack <id>`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let pack = 'gamma-0.9.5';
  const packIdx = args.indexOf('--pack');
  if (packIdx !== -1 && args[packIdx + 1]) {
    pack = args[packIdx + 1];
  }
  generateTraders(pack);
}
