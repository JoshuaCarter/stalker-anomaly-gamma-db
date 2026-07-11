#!/usr/bin/env node
/**
 * Extracts the authoritative PDA map-spot name registry for anomaly fields.
 *
 * The field display names shown on the in-game PDA map come from pda.script's
 * `primary_objects_tbl` ({target=<field spot id>, hint=<translation key>}), NOT a
 * simple `st_<field_name>_name` convention — e.g. the Cordon electro tunnel's spot
 * `esc_smart_terrain_tunnel_electr_spot` maps to `st_tunnel_electr_name`
 * ("Burnt Fuzz Tunnel"). This resolves target → hint → text and writes
 * data/<pack>/anomaly_spot_names.json = { <spot id>: <display text> }, which
 * buildAnomalyFields uses as the primary name source (falling back to name_key).
 *
 * Reads the load-order-winning mods (verify with the gamma-anomaly-debug
 * resolve.py if the modlist changes). Override the GAMMA mods root with --mods.
 *
 * Usage: node scripts/generate-anomaly-spot-names.mjs --pack gamma-0.9.5 [--mods <path>]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const args = process.argv.slice(2);
const argVal = (flag, def) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : def; };
const pack = argVal('--pack', 'gamma-0.9.5');
const modsRoot = argVal('--mods', 'D:/gamma0.9.5/GAMMA/mods');

// Load-order winners (per resolve.py at time of writing).
const PDA = join(modsRoot, 'G.A.M.M.A. ZCP 1.4 Balanced Spawns/gamedata/scripts/pda.script');
const TEXT_ENG = join(modsRoot, '287- G.A.M.M.A. Massive Text Overhaul Project - SageDaHerb and Dr.Pr1nkos/gamedata/configs/text/eng');

if (!existsSync(PDA) || !existsSync(TEXT_ENG)) {
  console.error(`Source files not found under ${modsRoot}. Pass --mods <GAMMA mods path>.`);
  process.exit(1);
}

// target (spot id) → hint (translation key)
const targetHint = {};
for (const m of readFileSync(PDA, 'utf-8').matchAll(/target="([^"]+)"\s*,\s*hint="([^"]+)"/g)) {
  targetHint[m[1]] = m[2];
}

// translation key → text, from every eng string XML in the text overhaul
const text = {};
for (const f of readdirSync(TEXT_ENG)) {
  if (!f.endsWith('.xml')) continue;
  const xml = readFileSync(join(TEXT_ENG, f), 'utf-8');
  for (const m of xml.matchAll(/<string id="([^"]+)">\s*<text>([\s\S]*?)<\/text>/g)) {
    text[m[1]] = m[2].trim();
  }
}

const out = {};
for (const [target, hint] of Object.entries(targetHint)) {
  if (text[hint]) out[target] = text[hint];
}

const outPath = resolve(root, 'data', pack, 'anomaly_spot_names.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${Object.keys(out).length} spot names (of ${Object.keys(targetHint).length} registry entries) to ${outPath}`);
