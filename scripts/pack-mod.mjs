#!/usr/bin/env node
import { createHash } from "node:crypto";
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
const PACKS_JSON = join(ROOT, "site", "public", "data", "packs.json");
const DATA = join(ROOT, "site", "public", "data");
const SCRIPTS = ["stalker_db.script", "stalker_db_json.script"];

// keep in sync with mod/gamedata/scripts/stalker_db.script FILES + extras
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

function args(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function md5(s) {
  return createHash("md5").update(s).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function activePacks() {
  const data = readJson(PACKS_JSON);
  return data.packs.filter((p) => !p.deprecated);
}

function folderName(pack) {
  return `Stalker DB - ${pack.name}`;
}

function zipName(pack, version) {
  return `${folderName(pack)} - ${version}.zip`;
}

function luaHash() {
  return md5(
    SCRIPTS.map((f) => readFileSync(join(MOD, "gamedata", "scripts", f))).join("\0"),
  );
}

function packHash(id) {
  const manPath = join(DATA, id, "manifest.json");
  const man = existsSync(manPath) ? readJson(manPath) : {};
  const lines = [];
  for (const file of FILES) {
    const h = man[file];
    if (h) {
      lines.push(`${file}:${h}`);
    } else if (existsSync(join(DATA, id, file))) {
      lines.push(`${file}:${md5(readFileSync(join(DATA, id, file)))}`);
    }
  }
  return md5(lines.join("\n"));
}

function generate(id) {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", "generate-index.mjs"), "--pack", id], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    throw new Error(`generate-index failed for ${id}`);
  }
}

function mkdirp(dir) {
  mkdirSync(dir, { recursive: true });
}

function copyWhitelist(id, destDb) {
  mkdirp(destDb);
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

function stampMeta(dest, version, zip) {
  const text = readFileSync(join(MOD, "meta.ini"), "utf8")
    .replace(/^version=.*$/m, `version=${version}`)
    .replace(/^newestVersion=.*$/m, `newestVersion=${version}`)
    .replace(/^installationFile=.*$/m, `installationFile=${zip}`);
  writeFileSync(join(dest, "meta.ini"), text);
}

function zipFolder(parent, folder, zipPath) {
  if (existsSync(zipPath)) {
    rmSync(zipPath);
  }
  if (process.platform === "win32") {
    const r = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path ${JSON.stringify(join(parent, folder))} -DestinationPath ${JSON.stringify(zipPath)} -Force`,
      ],
      { stdio: "inherit" },
    );
    if (r.status !== 0) {
      throw new Error(`zip failed: ${zipPath}`);
    }
    return;
  }
  const r = spawnSync("zip", ["-r", zipPath, folder], { cwd: parent, stdio: "inherit" });
  if (r.status !== 0) {
    throw new Error(`zip failed: ${zipPath}`);
  }
}

function buildZip(pack, version, outDir) {
  const folder = folderName(pack);
  const zip = zipName(pack, version);
  const stage = join(outDir, folder);
  rmSync(stage, { recursive: true, force: true });
  mkdirp(join(stage, "gamedata", "scripts"));
  mkdirp(join(stage, "gamedata", "configs", "db"));
  for (const f of SCRIPTS) {
    copyFileSync(join(MOD, "gamedata", "scripts", f), join(stage, "gamedata", "scripts", f));
  }
  const n = copyWhitelist(pack.id, join(stage, "gamedata", "configs", "db"));
  stampMeta(stage, version, zip);
  zipFolder(outDir, folder, join(outDir, zip));
  rmSync(stage, { recursive: true, force: true });
  return { zip, files: n };
}

function bump(last) {
  const m = String(last || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    return "1.0.0";
  }
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

function fingerprints() {
  const packs = {};
  for (const p of activePacks()) {
    packs[p.id] = { hash: packHash(p.id) };
  }
  return { lua: luaHash(), packs };
}

function runCheck() {
  const id = "gamma-0.9.5";
  const pistols = join(DATA, id, "pistols.json");
  if (!existsSync(pistols)) {
    generate(id);
  }
  const data = readJson(pistols);
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("pistols.json has no items");
  }
  const tmp = join(ROOT, "dist", "mod-check");
  rmSync(tmp, { recursive: true, force: true });
  const n = copyWhitelist(id, join(tmp, "gamedata", "configs", "db"));
  if (n < 1 || !existsSync(join(tmp, "gamedata", "configs", "db", "pistols.json"))) {
    throw new Error("whitelist copy missed gamedata/configs/db");
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(`ok: ${id} pistols=${data.items.length} files=${n}`);
}

function runRelease(opt) {
  const outDir = opt.out || join(ROOT, "dist", "mod");
  mkdirp(outDir);
  if (!opt["no-generate"]) {
    for (const p of activePacks()) {
      generate(p.id);
    }
  }
  const next = fingerprints();
  const prevPath = opt.prev ? join(opt.prev, "fingerprints.json") : "";
  const prev = prevPath && existsSync(prevPath) ? readJson(prevPath) : null;
  const luaChanged = !prev || prev.lua !== next.lua;
  const changed = [];
  for (const p of activePacks()) {
    const old = prev && prev.packs && prev.packs[p.id];
    if (luaChanged || !old || old.hash !== next.packs[p.id].hash) {
      changed.push(p.id);
    }
  }
  if (prev && !luaChanged && changed.length === 0) {
    console.log("unchanged");
    process.exit(2);
  }
  const version = opt.version || bump(opt["last-version"]);
  const rebuilt = [];
  const copied = [];
  for (const p of activePacks()) {
    const old = prev && prev.packs && prev.packs[p.id];
    if (changed.includes(p.id)) {
      const { zip, files } = buildZip(p, version, outDir);
      next.packs[p.id].zip = zip;
      rebuilt.push(`${p.id} (${files} files)`);
    } else {
      const src = join(opt.prev, old.zip);
      if (!existsSync(src)) {
        const { zip, files } = buildZip(p, version, outDir);
        next.packs[p.id].zip = zip;
        rebuilt.push(`${p.id} (${files} files, prev zip missing)`);
      } else {
        copyFileSync(src, join(outDir, old.zip));
        next.packs[p.id].zip = old.zip;
        copied.push(p.id);
      }
    }
  }
  writeFileSync(join(outDir, "fingerprints.json"), JSON.stringify(next, null, 2) + "\n");
  writeFileSync(join(outDir, "VERSION"), version + "\n");
  writeFileSync(
    join(outDir, "NOTES"),
    `rebuilt: ${rebuilt.join(", ") || "none"}\ncopied: ${copied.join(", ") || "none"}\n`,
  );
  console.log(`version ${version}`);
  console.log(`rebuilt: ${rebuilt.join(", ") || "none"}`);
  console.log(`copied: ${copied.join(", ") || "none"}`);
}

const opt = args(process.argv);
if (opt.check) {
  runCheck();
} else if (opt["fingerprints-only"]) {
  if (!opt["no-generate"]) {
    for (const p of activePacks()) {
      generate(p.id);
    }
  }
  const outDir = opt.out || join(ROOT, "dist", "mod");
  mkdirp(outDir);
  writeFileSync(join(outDir, "fingerprints.json"), JSON.stringify(fingerprints(), null, 2) + "\n");
} else if (opt.release) {
  runRelease(opt);
} else if (opt.version) {
  const outDir = opt.out || join(ROOT, "dist", "mod");
  mkdirp(outDir);
  if (!opt["no-generate"]) {
    for (const p of activePacks()) {
      generate(p.id);
    }
  }
  const fp = fingerprints();
  for (const p of activePacks()) {
    const { zip } = buildZip(p, opt.version, outDir);
    fp.packs[p.id].zip = zip;
  }
  writeFileSync(join(outDir, "fingerprints.json"), JSON.stringify(fp, null, 2) + "\n");
} else {
  console.error("usage: pack-mod.mjs --check | --fingerprints-only | --release | --version X.Y.Z");
  process.exit(1);
}
