/**
 * Import extracted item-icon PNGs into the site's icon folder.
 *
 * The MO2 icon-extractor plugin (extract-weapon-and-outfit-icons.py) writes one
 * <section>.png per item to <GAMMA>\scripts\img-data\icons\. This copies them into
 * site/public/img/icons/, overwriting existing icons, and reports the total imported
 * and how many are new (weren't already in the destination).
 *
 * Usage:
 *   node scripts/import-icons.mjs
 *   node scripts/import-icons.mjs --src "D:\gamma0.9.5\GAMMA\scripts\img-data\icons"
 *   node scripts/import-icons.mjs --dest "<path>"
 */

import { readdirSync, existsSync, copyFileSync, mkdirSync } from "fs";
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
// Where the MO2 icon-extractor plugin writes its PNGs (repo_root\scripts\img-data\icons,
// repo_root being the plugin's parent = <GAMMA>).
const DEFAULT_SRC = join(GAMMA_DIR, "scripts", "img-data", "icons");

const args = parseArgs(process.argv);
const srcDir = args.src || DEFAULT_SRC;
const destDir = args.dest || join(import.meta.dirname, "..", "site", "public", "img", "icons");

if (!existsSync(srcDir)) {
  console.error(`Source icon folder not found: ${srcDir}`);
  console.error("Run the MO2 icon-extractor plugin first — it writes to <GAMMA>\\scripts\\img-data\\icons.");
  console.error("Pass --src to import from a different folder.");
  process.exit(1);
}

const pngs = readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith(".png"));
if (pngs.length === 0) {
  console.log(`No PNG icons found in ${srcDir}.`);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

let newCount = 0;
for (const file of pngs) {
  const destPath = join(destDir, file);
  if (!existsSync(destPath)) newCount++;
  copyFileSync(join(srcDir, file), destPath);
}

const totalInDest = readdirSync(destDir).filter((f) => f.toLowerCase().endsWith(".png")).length;

console.log(`Imported ${pngs.length} icons → ${destDir}`);
console.log(`  ${newCount} new, ${pngs.length - newCount} updated`);
console.log(`  ${totalInDest} icons total in destination`);
