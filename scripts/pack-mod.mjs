#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOD = join(ROOT, "mod");
const DATA = join(ROOT, "site", "public", "data");
const SCRIPTS = ["stalker_db.script", "stalker_db_json.script"];

// keep in sync with mod/gamedata/scripts/stalker_db.script FILES
const FILES = [
  "pistols.json",
  "smgs.json",
  "rifles.json",
  "snipers.json",
  "shotguns.json",
  "melee.json",
  "launchers.json",
  "scopes.json",
  "silencers.json",
  "grenade-launchers.json",
  "tactical-kits.json",
  "weapon-parts.json",
  "outfits.json",
  "helmets.json",
  "ammo.json",
  "mutant-parts.json",
  "outfit-parts.json",
  "medicine.json",
  "food.json",
  "artefacts.json",
  "explosives.json",
  "belt-attachments.json",
  "misc.json",
  "translations.json",
  "craft-recipes.json",
];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) {
    return "";
  }
  const next = process.argv[i + 1];
  return !next || next.startsWith("--") ? true : next;
}

function activePacks() {
  return JSON.parse(readFileSync(join(DATA, "packs.json"), "utf8")).packs.filter((p) => !p.deprecated);
}

function dateVersion(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}`;
}

function copyWhitelist(id, destDb) {
  mkdirSync(destDb, { recursive: true });
  let n = 0;
  for (const file of FILES) {
    const src = join(DATA, id, file);
    if (!existsSync(src)) {
      continue;
    }
    copyFileSync(src, join(destDb, file));
    n++;
  }
  return n;
}

function stampMeta(dest, version, pack) {
  const ver = String(version).replaceAll("-", ".");
  writeFileSync(
    join(dest, "meta.ini"),
    `[General]
gameName=Anomaly
modid=0
version=${ver}
newestVersion=${ver}
category=0
nexusFileStatus=1
installationFile=StalkerDB_${pack.id}.zip
comments=Stalker DB - ${pack.name}
notes=
`,
  );
}

const ZIP_PY = `
import sys, zipfile
from pathlib import Path
parent, folder, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
if out.exists():
    out.unlink()
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for path in sorted((parent / folder).rglob("*")):
        if path.is_file():
            zf.write(path, path.relative_to(parent).as_posix())
`;

function zipFolder(parent, folder, zipPath) {
  const attempts =
    process.platform === "win32" ? [["py", "-3"], ["python"], ["python3"]] : [["python3"], ["python"]];
  for (const [cmd, ...pre] of attempts) {
    const r = spawnSync(cmd, [...pre, "-c", ZIP_PY, parent, folder, zipPath], { stdio: "inherit" });
    if (r.status === 0) {
      return;
    }
  }
  throw new Error("python required to zip");
}

function buildZip(pack, version, outDir) {
  const folder = `Stalker DB - ${pack.name}`;
  const zip = `StalkerDB_${pack.id}_${version}.zip`;
  const stage = join(outDir, folder);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, "gamedata", "scripts"), { recursive: true });
  for (const f of SCRIPTS) {
    copyFileSync(join(MOD, "gamedata", "scripts", f), join(stage, "gamedata", "scripts", f));
  }
  const n = copyWhitelist(pack.id, join(stage, "gamedata", "configs", "db"));
  stampMeta(stage, version, pack);
  zipFolder(outDir, folder, join(outDir, zip));
  rmSync(stage, { recursive: true, force: true });
  return n;
}

function runCheck() {
  const id = "gamma-0.9.5";
  const pistols = join(DATA, id, "pistols.json");
  const data = JSON.parse(readFileSync(pistols, "utf8"));
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("pistols.json has no items");
  }
  const tmp = join(ROOT, "dist", "mod-check");
  rmSync(tmp, { recursive: true, force: true });
  const n = copyWhitelist(id, join(tmp, "gamedata", "configs", "db"));
  rmSync(tmp, { recursive: true, force: true });
  console.log(`ok: ${id} pistols=${data.items.length} files=${n}`);
}

function runRelease() {
  const outDir = arg("out") || join(ROOT, "dist", "mod");
  mkdirSync(outDir, { recursive: true });
  const version = (arg("version") !== true && arg("version")) || dateVersion();
  const rebuilt = [];
  for (const p of activePacks()) {
    const n = buildZip(p, version, outDir);
    rebuilt.push(`${p.id} (${n} files)`);
  }
  writeFileSync(join(outDir, "VERSION"), version + "\n");
  writeFileSync(join(outDir, "NOTES"), `rebuilt: ${rebuilt.join(", ")}\n`);
  console.log(`version ${version}`);
  console.log(`rebuilt: ${rebuilt.join(", ")}`);
}

if (arg("check")) {
  runCheck();
} else if (arg("release")) {
  runRelease();
} else {
  console.error("usage: pack-mod.mjs --check | --release [--out dir] [--version YYYY-MM-DD-HHMM]");
  process.exit(1);
}
