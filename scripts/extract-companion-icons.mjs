// Extract companion portrait icons for starting-loadout mods that ship them
// (currently "Drunk's Alternative Loadouts").
//
// Such a mod's loadout offers <faction>_sim_squad_comp_N_comp_item pick tokens whose
// icons live on a single sprite sheet (ui\companions_xcv.dds). The site renders item
// icons as per-ID PNGs at site/public/img/icons/<id>.png, so this crops each
// companion's cell off the sheet and writes one PNG per comp_item ID.
//
// Inputs per mod (committed under data/<pack>/source/, copied from the mod, declared
// in scripts/loadout-mods.mjs → companions):
//   - <companions.ltx>  — grid coords per comp_item (inv_grid_x/y/width/height)
//   - <companions.dds>  — uncompressed 32-bit BGRA sprite sheet (no mipmaps)
//
// generate-index.mjs calls extractCompanionIcons() as part of the data pipeline, so
// this normally runs automatically. Still runnable standalone for a quick re-crop:
//   node scripts/extract-companion-icons.mjs [--pack gamma-0.9.5]

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { LOADOUT_MODS } from "./loadout-mods.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Anomaly lays inventory icons on a fixed 50px grid regardless of sheet size.
const CELL = 50;

// ── Parse the LTX into sections with single-key inheritance resolution ──────────
function parseLtxSections(text) {
  const sections = new Map();
  let cur = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/;.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^\[([^\]]+)\](?::(.+))?/);
    if (m) {
      cur = { parent: m[2] || null, entries: new Map() };
      sections.set(m[1], cur);
      continue;
    }
    if (cur) {
      const eq = line.indexOf("=");
      if (eq >= 0) cur.entries.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
    }
  }
  return sections;
}
function resolve(sections, name, key, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const sec = sections.get(name);
  if (!sec) return null;
  if (sec.entries.has(key)) return sec.entries.get(key);
  if (sec.parent) {
    for (const p of sec.parent.split(",")) {
      const v = resolve(sections, p.trim(), key, seen);
      if (v != null) return v;
    }
  }
  return null;
}
const num = (v, d) => (v != null && !isNaN(parseInt(v)) ? parseInt(v) : d);

// ── Decode the uncompressed BGRA DDS into an RGBA buffer sharp can read ─────────
function decodeDds(path) {
  const b = readFileSync(path);
  if (b.toString("ascii", 0, 4) !== "DDS ") throw new Error("not a DDS file");
  const height = b.readUInt32LE(12);
  const width = b.readUInt32LE(16);
  const rgbBitCount = b.readUInt32LE(88);
  if (rgbBitCount !== 32) throw new Error(`expected 32-bit DDS, got ${rgbBitCount}`);
  const HEADER = 128;
  const px = width * height;
  if (b.length < HEADER + px * 4) throw new Error("DDS pixel data truncated");
  // Masks are B=0xff, G=0xff00, R=0xff0000, A=0xff000000 → stored bytes are BGRA.
  const rgba = Buffer.allocUnsafe(px * 4);
  for (let i = 0; i < px; i++) {
    const s = HEADER + i * 4;
    rgba[i * 4] = b[s + 2];     // R
    rgba[i * 4 + 1] = b[s + 1]; // G
    rgba[i * 4 + 2] = b[s];     // B
    rgba[i * 4 + 3] = b[s + 3]; // A
  }
  return { width, height, data: rgba };
}

// Crop every _comp_item cell out of one mod's sprite sheet into per-ID PNGs.
async function extractModIcons(src, out, comp) {
  const ltxPath = join(src, comp.ltx);
  const ddsPath = join(src, comp.dds);
  if (!existsSync(ltxPath) || !existsSync(ddsPath)) return 0;

  const sections = parseLtxSections(readFileSync(ltxPath, "utf-8"));
  const { width, height, data } = decodeDds(ddsPath);
  const base = sharp(data, { raw: { width, height, channels: 4 } });

  let written = 0;
  const jobs = [];
  for (const [name] of sections) {
    if (!name.endsWith("_comp_item")) continue;
    const gx = num(resolve(sections, name, "inv_grid_x"), 0);
    const gy = num(resolve(sections, name, "inv_grid_y"), 0);
    const gw = num(resolve(sections, name, "inv_grid_width"), 1);
    const gh = num(resolve(sections, name, "inv_grid_height"), 1);
    const left = gx * CELL, top = gy * CELL, w = gw * CELL, h = gh * CELL;
    if (left + w > width || top + h > height) {
      console.warn(`  skip ${name}: cell ${left},${top} ${w}x${h} outside ${width}x${height}`);
      continue;
    }
    const outPath = join(out, `${name.toLowerCase()}.png`);
    jobs.push(
      base.clone().extract({ left, top, width: w, height: h }).png().toFile(outPath)
        .then(() => { written++; })
    );
  }
  await Promise.all(jobs);
  return written;
}

// Extract companion icons for every registered loadout mod that ships them.
// Exported so generate-index.mjs can run it inline; also callable via the CLI below.
export async function extractCompanionIcons(pack, mods = LOADOUT_MODS) {
  const src = join(ROOT, "data", pack, "source");
  const out = join(ROOT, "site", "public", "img", "icons");
  let total = 0;
  for (const mod of mods) {
    if (!mod.companions) continue;
    total += await extractModIcons(src, out, mod.companions);
  }
  console.log(`Wrote ${total} companion icons to ${out}`);
  return total;
}

// CLI entry: node scripts/extract-companion-icons.mjs [--pack <id>]
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const packArgIdx = process.argv.indexOf("--pack");
  const pack = packArgIdx >= 0 ? process.argv[packArgIdx + 1] : "gamma-0.9.5";
  await extractCompanionIcons(pack);
}
