/**
 * Import exported CSV files from the GAMMA game directory into a pack's data folder.
 *
 * The exporter writes each run into a timestamped subfolder (e.g. 2026-07-16_20-27-45)
 * under a root bin directory. By default this script scans --root for the most recent
 * such folder and imports from it, so you only need to point at the root. Pass --src to
 * import from a specific run folder instead.
 *
 * All CSV and JSON files are copied from the resolved run folder to data/<pack>/.
 * Translation CSVs (en_us.csv, ru_ru.csv, fr_fr.csv) are replaced by default.
 * Pass --merge-translations to merge new keys into existing translation files instead.
 *
 * export_item_icons.csv is additionally staged to <GAMMA>\data\ (where the MO2
 * icon-extractor plugin reads it), so the plugin crops from the latest atlas coords.
 *
 * Usage:
 *   node scripts/import-game-exports.mjs --pack gamma-0.9.5
 *   node scripts/import-game-exports.mjs --pack gamma-0.9.5 --root "D:\gamma0.9.5\GAMMA\overwrite\bin"
 *   node scripts/import-game-exports.mjs --pack gamma-0.9.5 --src "D:\gamma0.9.5\GAMMA\overwrite\bin\2026-07-16_20-27-45"
 *   node scripts/import-game-exports.mjs --pack gamma-0.9.5 --merge-translations
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync, statSync, mkdirSync } from "fs";
import { join } from "path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        args[key] = argv[i + 1];
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const GAMMA_DIR = "D:\\gamma0.9.5\\GAMMA";
const DEFAULT_ROOT = join(GAMMA_DIR, "overwrite", "bin");

// The MO2 icon-extractor plugin reads its CSV from <GAMMA>\data\export_item_icons.csv
// (it resolves <plugin dir>\..\data\). After importing, mirror the icon CSV there so the
// plugin always crops from the latest atlas coords — no separate setup-icon-extractor.mjs
// run needed just to refresh the CSV.
const ICON_CSV = "export_item_icons.csv";
const ICON_PLUGIN_DATA_DIR = join(GAMMA_DIR, "data");

// Exporter run folders are named like 2026-07-16_20-27-45.
const RUN_FOLDER_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

const args = parseArgs(process.argv);
const pack = args.pack;
const rootDir = args.root || DEFAULT_ROOT;
const mergeTranslations = !!args["merge-translations"];

if (!pack) {
  console.error('Usage: node scripts/import-game-exports.mjs --pack <pack-id> [--root "<bin-path>"] [--src "<run-folder>"] [--merge-translations]');
  console.error(`  --root defaults to ${DEFAULT_ROOT} (latest timestamped run folder is picked automatically)`);
  console.error("  --src imports from a specific run folder, bypassing --root");
  process.exit(1);
}

const destDir = join(import.meta.dirname, "..", "data", pack);

// Resolve the run folder to import from: an explicit --src, or the most recent
// timestamped subfolder under --root.
let srcDir;
if (args.src) {
  srcDir = args.src;
  if (!existsSync(srcDir)) {
    console.error(`Source directory not found: ${srcDir}`);
    process.exit(1);
  }
} else {
  if (!existsSync(rootDir)) {
    console.error(`Root directory not found: ${rootDir}`);
    process.exit(1);
  }
  const runs = readdirSync(rootDir)
    .filter((f) => RUN_FOLDER_RE.test(f))
    .filter((f) => statSync(join(rootDir, f)).isDirectory())
    .sort() // lexical sort matches chronological order for this timestamp format
    .reverse();
  if (runs.length === 0) {
    console.error(`No timestamped run folders (e.g. 2026-07-16_20-27-45) found under: ${rootDir}`);
    console.error("Pass --src to import from a specific folder instead.");
    process.exit(1);
  }
  srcDir = join(rootDir, runs[0]);
  console.log(`Using latest run: ${runs[0]} (${runs.length} run folder${runs.length === 1 ? "" : "s"} found)`);
}
if (!existsSync(destDir)) {
  console.error(`Destination directory not found: ${destDir}`);
  process.exit(1);
}

const TRANSLATION_FILES = new Set(["en_us.csv", "ru_ru.csv", "fr_fr.csv", "translation_keys.csv"]);

// CSV tables plus structured JSON exports (e.g. export_starting_loadouts.json,
// whose nested shape doesn't fit a flat CSV). JSON files are plain copies — the
// translation-merge path only applies to the CSV translation files.
const srcFiles = readdirSync(srcDir).filter((f) => f.endsWith(".csv") || f.endsWith(".json"));
if (srcFiles.length === 0) {
  console.log("No CSV or JSON files found in source directory.");
  process.exit(0);
}

let copied = 0;
let merged = 0;

for (const file of srcFiles) {
  const srcPath = join(srcDir, file);
  const destPath = join(destDir, file);

  if (mergeTranslations && TRANSLATION_FILES.has(file)) {
    // Read as latin1 (binary-safe) to preserve Windows-1251 bytes.
    // The generation script handles the actual Win-1251 → UTF-8 decoding.
    // translation_keys.csv has one bare key per line (no comma); the others
    // have "key,value" rows. Extract the key with the first-comma rule, or
    // fall back to the whole line for bare-key files.
    const keyOf = (line) => {
      const sep = line.indexOf(",");
      return sep > 0 ? line.slice(0, sep) : line;
    };

    const existing = new Map();
    if (existsSync(destPath)) {
      const text = readFileSync(destPath, "latin1");
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        existing.set(keyOf(line), line);
      }
    }

    const existingCount = existing.size;
    const srcText = readFileSync(srcPath, "latin1");
    let added = 0;
    for (const line of srcText.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const key = keyOf(line);
      if (key === "Translation Key") continue;
      if (!existing.has(key)) {
        existing.set(key, line);
        added++;
      }
    }

    const lines = [];
    for (const [, line] of existing) {
      if (line.startsWith("Translation Key,")) continue;
      lines.push(line);
    }
    writeFileSync(destPath, lines.join("\n") + "\n", "latin1");
    console.log(`${file}: merged ${added} new keys (${existingCount} → ${existing.size} total)`);
    merged++;
  } else {
    copyFileSync(srcPath, destPath);
    console.log(`${file}: copied`);
    copied++;
  }
}

// Stage the icon CSV where the MO2 icon-extractor plugin reads it, so its next run
// crops from the atlas coords we just imported (keeps GAMMA\data\ in sync without a
// separate setup-icon-extractor.mjs run).
if (srcFiles.includes(ICON_CSV)) {
  mkdirSync(ICON_PLUGIN_DATA_DIR, { recursive: true });
  const iconPluginDest = join(ICON_PLUGIN_DATA_DIR, ICON_CSV);
  copyFileSync(join(destDir, ICON_CSV), iconPluginDest);
  console.log(`${ICON_CSV}: also staged for the MO2 icon-extractor plugin → ${iconPluginDest}`);
}

console.log(`\nDone. ${copied} files copied${merged ? `, ${merged} translation files merged` : ""}.`);
