#!/usr/bin/env node
/**
 * Transforms map_entities.json world-space coordinates into global map pixel
 * coordinates (1024×2634 image space) using global_rect from game_maps_single.ltx
 * and level_bounds from the dump.
 *
 * Usage: node scripts/generate-map-entities.mjs --pack gamma-0.9.5
 * Output: site/public/data/<pack>/map_entities.json
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { globalRects, levelBounds as level_bounds, excludedLevels, buildAnomalyFields } from './map-projection.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let pack = 'gamma-0.9.5';
const packIdx = args.indexOf('--pack');
if (packIdx !== -1 && args[packIdx + 1]) pack = args[packIdx + 1];

// Level projection tables (globalRects, level_bounds) and exclusions live in
// map-projection.mjs — shared with generate-map-anomaly-fields.mjs so they can't
// drift apart.

// ── Load map_entities.json ──────────────────────────────────────────────────
const dumpPath = resolve(root, 'data', pack, 'map_entities.json');
const dump = JSON.parse(readFileSync(dumpPath, 'utf-8'));
const { entities } = dump;

// ── Types to exclude from output (too many, dynamic in GAMMA, or unused) ─
// Anomalies are dynamic (re-randomize per level load) — only available via save import
const excludedTypes = new Set(['anomaly']);

// ── Transform ───────────────────────────────────────────────────────────
let mapped = 0;
let skipped = 0;
let noRect = new Set();

const output = [];

for (const ent of entities) {
  const { level, x, y, z } = ent;

  if (excludedLevels.has(level)) { skipped++; continue; }
  if (excludedTypes.has(ent.type)) { skipped++; continue; }

  const bounds = level_bounds[level];
  const rect = globalRects[level];

  if (!bounds || !rect) {
    noRect.add(level);
    skipped++;
    continue;
  }

  const rangeX = bounds.maxX - bounds.minX;
  const rangeZ = bounds.maxZ - bounds.minZ;

  // Normalize to 0..1 within level world bounds
  const normX = rangeX > 0 ? (x - bounds.minX) / rangeX : 0.5;
  const normZ = rangeZ > 0 ? (z - bounds.minZ) / rangeZ : 0.5;

  // Map to global image pixels (1024 × 2634)
  // X maps left→right, Z maps bottom→top (higher Z = north = lower Y on image)
  const mapX = rect.left + normX * (rect.right - rect.left);
  const mapY = rect.bottom - normZ * (rect.bottom - rect.top);

  output.push({
    id:    ent.id,
    name:  ent.name,
    ...(ent.label ? { label: ent.label } : {}),
    ...(ent.label_key ? { label_key: ent.label_key } : {}),
    ...(ent.char_name ? { char_name: ent.char_name } : {}),
    ...(ent.role ? { role: ent.role } : {}),
    ...(ent.faction ? { faction: ent.faction } : {}),
    section: ent.section,
    type:  ent.type,
    level: ent.level,
    mapX:  Math.round(mapX * 100) / 100,
    mapY:  Math.round(mapY * 100) / 100,
  });
  mapped++;
}

// ── Resolve NPC locations from nearest smart terrain ────────────────────
const trPath = resolve(root, 'data', pack, 'map_entities_translations_en.json');
let translations = {};
try { translations = JSON.parse(readFileSync(trPath, 'utf-8')); } catch {}

// ── Parse smart terrain configs for faction/mutant data ──────────────────
const smartConfigDir = 'C:\\Stalker_Anomaly\\tools\\_unpacked\\configs\\scripts';
const stFactionData = {};
const knownFactions = new Set(['stalker','duty','freedom','bandit','army','monolith','killer','ecolog','csky','renegade','greh','isg','zombied','merc']);
try {
  for (const level of readdirSync(smartConfigDir)) {
    const smartDir = join(smartConfigDir, level, 'smart');
    if (!existsSync(smartDir)) continue;
    for (const file of readdirSync(smartDir)) {
      if (!file.endsWith('.ltx')) continue;
      const name = file.replace('.ltx', '');
      const content = readFileSync(join(smartDir, file), 'utf-8');

      const factions = new Set();
      const mutants = new Set();
      const spawnMatches = content.matchAll(/spawn_squads\s*=\s*(.+)/g);
      for (const sm of spawnMatches) {
        for (let sq of sm[1].split(',')) {
          sq = sq.trim().split(';')[0].trim(); // strip comments
          if (!sq) continue;
          if (sq.startsWith('simulation_')) {
            const mut = sq.replace('simulation_', '').replace(/_\d.*$/, '');
            mutants.add(mut);
          } else {
            const fac = sq.split('_sim_')[0];
            if (knownFactions.has(fac)) factions.add(fac);
          }
        }
      }

      if (factions.size || mutants.size) {
        stFactionData[name] = {
          factions: [...factions],
          mutants: [...mutants],
          isMutant: mutants.size > 0 && factions.size === 0,
        };
      }
    }
  }
  console.log(`Parsed ${Object.keys(stFactionData).length} smart terrain configs for faction data`);
} catch (e) {
  console.warn('Warning: could not parse smart terrain configs:', e.message);
}

// Resolve smart terrain display names and attach faction data
const smartTerrains = entities.filter(e => e.type === 'smart_terrain');
for (const ent of output) {
  if (ent.type === 'smart_terrain') {
    const stKey = `st_${ent.name}_name`;
    const locName = translations[stKey] || '';
    if (locName) ent.location = locName;
    const stData = stFactionData[ent.name];
    if (stData) {
      if (stData.factions.length) ent.factions = stData.factions;
      if (stData.mutants.length) ent.mutants = stData.mutants;
      if (stData.isMutant) ent.isMutant = true;
    }
  }
  if (ent.type !== 'named_npc') continue;
  // Find nearest smart terrain on same level (using world coords from raw dump)
  const raw = entities.find(e => e.id === ent.id);
  if (!raw) continue;
  const sameLvl = smartTerrains.filter(s => s.level === raw.level);
  let best = null, bestDist = Infinity;
  for (const st of sameLvl) {
    const dx = st.x - raw.x, dz = st.z - raw.z;
    const dist = dx * dx + dz * dz;
    if (dist < bestDist) { bestDist = dist; best = st; }
  }
  if (best) {
    const stKey = `st_${best.name}_name`;
    const locName = translations[stKey] || '';
    if (locName) ent.location = locName;
  }
}

// ── Resolve land names (PDA map landmarks) from st_land_names.xml ────────
const landNamesPath = 'C:\\Stalker_Anomaly\\tools\\_unpacked\\configs\\text\\eng\\st_land_names.xml';
const landNames = {};
try {
  const xml = readFileSync(landNamesPath, 'utf-8');
  const re = /<string id="st_(.+?)_name_land">\s*<text>(.+?)<\/text>/gs;
  let m;
  while ((m = re.exec(xml)) !== null) {
    landNames[m[1]] = m[2];
  }
  console.log(`Loaded ${Object.keys(landNames).length} land names from st_land_names.xml`);
} catch {
  console.warn('Warning: could not load st_land_names.xml');
}

// Match land names to entities, skip if a location with the same short name exists on that level
const existingLocations = new Set();
for (const ent of output) {
  if (ent.type === 'smart_terrain' && ent.location) {
    const short = ent.location.replace(/^[^-]+ - /, '').toLowerCase();
    existingLocations.add(`${ent.level}:${short}`);
  }
}

for (const [landId, landName] of Object.entries(landNames)) {
  const match = output.find(e => e.name === landId)
    || output.find(e => e.type === 'smart_terrain' && e.name.startsWith(landId + '_'))
    || output.find(e => e.name.startsWith(landId + '_'));
  if (!match) continue;

  const shortName = landName.toLowerCase();
  const key = `${match.level}:${shortName}`;
  if (existingLocations.has(key)) continue;
  existingLocations.add(key);

  output.push({
    id: 0,
    name: landId,
    location: landName,
    type: 'smart_terrain',
    level: match.level,
    mapX: match.mapX,
    mapY: match.mapY,
  });
}

// ── Named artefact anomaly fields (High Hopes, Crispy Train, …) ──────────
// Independent CSV input (export_anomaly_fields.csv) — static restrictor
// positions, unaffected by the dynamic-anomaly randomizer excluded above.
const anomalyFields = buildAnomalyFields(root, pack);
output.push(...anomalyFields);
if (anomalyFields.length) console.log(`Added ${anomalyFields.length} named anomaly fields`);

// ── Group by type for easier consumption ────────────────────────────────
const byType = {};
for (const ent of output) {
  if (!byType[ent.type]) byType[ent.type] = [];
  byType[ent.type].push(ent);
}

const result = {
  _info: `Map entities with pixel coordinates in 1024×2634 image space. Generated ${new Date().toISOString().slice(0, 10)}.`,
  image: { width: 1024, height: 2634 },
  counts: {},
  entities: byType,
};
for (const [type, arr] of Object.entries(byType)) {
  result.counts[type] = arr.length;
}

// ── Write output ────────────────────────────────────────────────────────
const outDir = resolve(root, 'site', 'public', 'data', pack);
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'map-entities.json');
writeFileSync(outPath, JSON.stringify(result, null, 2));

console.log(`Mapped ${mapped} entities, skipped ${skipped} (underground/excluded)`);
for (const [type, arr] of Object.entries(byType)) {
  console.log(`  ${type}: ${arr.length}`);
}
if (noRect.size) {
  console.log(`Warning: no global_rect for levels: ${[...noRect].join(', ')}`);
}
console.log(`Output: ${outPath}`);
