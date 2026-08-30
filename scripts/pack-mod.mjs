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

function xml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const LANG_LABEL = { en: "English", ru: "Russian", fr: "French" };

function packLocales(id) {
  const path = join(DATA, id, "translations.json");
  if (!existsSync(path)) {
    return ["en"];
  }
  const t = JSON.parse(readFileSync(path, "utf8"));
  if (Array.isArray(t.locales) && t.locales.length) {
    return t.locales.filter((k) => t[k]);
  }
  return ["en", "ru", "fr"].filter((k) => t[k]);
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

function writeFomod(dest, version, pack, locales) {
  const name = `Stalker DB - ${pack.name}`;
  const ver = String(version).replaceAll("-", ".");
  mkdirSync(join(dest, "fomod", "lang"), { recursive: true });
  const plugins = locales
    .map((lang, i) => {
      writeFileSync(join(dest, "fomod", "lang", lang), lang + "\n");
      const rec = i === 0 ? "\n              <typeDescriptor><type name=\"Recommended\"/></typeDescriptor>" : "";
      return `            <plugin name="${xml(LANG_LABEL[lang] || lang)}">
              <description>Item names.</description>
              <files>
                <file source="fomod/lang/${lang}" destination="gamedata/configs/db/lang" />
              </files>${rec}
            </plugin>`;
    })
    .join("\n");
  writeFileSync(
    join(dest, "fomod", "info.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<fomod>
  <Name>${xml(name)}</Name>
  <Version>${xml(ver)}</Version>
  <Author>Stalker DB</Author>
  <Description>Item catalog for other mods.</Description>
</fomod>
`,
  );
  writeFileSync(
    join(dest, "fomod", "ModuleConfig.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://qconsulting.ca/fo3/ModConfig5.0.xsd">
  <moduleName>${xml(name)}</moduleName>
  <requiredInstallFiles>
    <folder source="gamedata" destination="gamedata" />
    <file source="meta.ini" destination="meta.ini" />
  </requiredInstallFiles>
  <installSteps order="Explicit">
    <installStep name="Language">
      <optionalFileGroups order="Explicit">
        <group name="Language" type="SelectExactlyOne">
          <plugins order="Explicit">
${plugins}
          </plugins>
        </group>
      </optionalFileGroups>
    </installStep>
  </installSteps>
</config>
`,
  );
}

const ZIP_PY = `
import sys, zipfile
from pathlib import Path
stage, out = Path(sys.argv[1]), Path(sys.argv[2])
if out.exists():
    out.unlink()
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for path in sorted(stage.rglob("*")):
        if path.is_file():
            zf.write(path, path.relative_to(stage).as_posix())
`;

function zipStage(stage, zipPath) {
  const attempts =
    process.platform === "win32" ? [["py", "-3"], ["python"], ["python3"]] : [["python3"], ["python"]];
  for (const [cmd, ...pre] of attempts) {
    const r = spawnSync(cmd, [...pre, "-c", ZIP_PY, stage, zipPath], { stdio: "inherit" });
    if (r.status === 0) {
      return;
    }
  }
  throw new Error("python required to zip");
}

function buildZip(pack, version, outDir) {
  const zip = `StalkerDB_${pack.id}_${String(version).replaceAll("-", ".")}.zip`;
  const stage = join(outDir, `_stage_${pack.id}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, "gamedata", "scripts"), { recursive: true });
  for (const f of SCRIPTS) {
    copyFileSync(join(MOD, "gamedata", "scripts", f), join(stage, "gamedata", "scripts", f));
  }
  const n = copyWhitelist(pack.id, join(stage, "gamedata", "configs", "db"));
  writeFileSync(join(stage, "gamedata", "configs", "db", "lang"), "en\n");
  stampMeta(stage, version, pack);
  writeFomod(stage, version, pack, packLocales(pack.id));
  zipStage(stage, join(outDir, zip));
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
