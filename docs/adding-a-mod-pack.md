# Adding a New Mod Pack

This guide walks through adding a new S.T.A.L.K.E.R. Anomaly modpack (or a new
version of an existing one) to the database, end to end. The database is
data-driven: a pack is just a folder of CSVs under `data/<pack-id>/` that the
pipeline transforms into JSON under `site/public/data/<pack-id>/`, plus one
entry in `packs.json` so the UI can show it.

The existing packs (`gamma-0.9.5`, `gamma-0.9.4`, `anomaly-1.5.3`, `gra-2.5`,
`gra-2.4`) are all worked examples — copy the closest one when in doubt.

## Overview

1. Export the pack's data from the game with [USADE](https://github.com/SaloEater/Universal-Stalker-Anomaly-Data-Export).
2. Pick a pack ID and create `data/<pack-id>/`.
3. Import the exported CSVs into that folder.
4. (Optional) Add supplementary source files — loadouts, synthetic items, constants.
5. (Optional) Extract item icons.
6. Run the data pipeline to generate JSON.
7. Register the pack in `site/public/data/packs.json`.
8. Build and verify.

## Prerequisites

- **Node.js ≥ 20.11** — the scripts use `import.meta.dirname` (added in 20.11 /
  21.2); pinned via `engines` in `package.json`.
- **A local checkout of this repo.** The data-pipeline scripts
  (`generate-index.mjs`, `generate-traders.mjs`, `import-game-exports.mjs`,
  `prune-icons.mjs`) use only Node built-ins — you do **not** need `npm install`
  just to generate a pack. `npm install` is only required for the build/verify
  step (8) and general dev (see the README's Development section).
- **The modpack installed under MO2 + USADE** — only if you're producing a fresh
  export (step 1). If you already have the `export_*.csv` files, skip straight to
  step 3.
- **Python 3 + Pillow** — only for the standalone icon-extraction path (step 5);
  not needed if you run the icon extractor as an MO2 plugin or skip icons.

## 1. Export the pack's data (USADE)

Item data comes from [USADE](https://github.com/SaloEater/Universal-Stalker-Anomaly-Data-Export)
(Universal S.T.A.L.K.E.R. Anomaly Data Export) by
[SaloEater](https://github.com/SaloEater) — an **in-game Lua exporter** driven
from Anomaly's debug menu. It ships as a `gamedata/` mod plus a standalone Python
script for icons. A working copy lives locally at
`C:\Source\Other\Universal-Stalker-Anomaly-Data-Export`.

The exporter emits **translation keys, not display text** — every header, item
name, and description is written as a key like `pda_encyclopedia_name` or
`st_wpn_ak74`. The actual English/Russian strings are resolved separately into
the translation CSVs, which keeps the data CSVs language-independent. See
[translation-encoding.md](translation-encoding.md): the translation CSVs are
Windows-1251 encoded and the pipeline decodes them automatically.

### Install

1. Copy USADE's `gamedata/` into the modpack so its files are active in MO2 (the
   helper `scripts/copy-usade-to-gamma.mjs` does this for the local GAMMA 0.9.5
   install — edit the hard-coded source/destination paths for your setup).
2. Launch the game and **load a save** (the exporter reads live game objects).
3. Open the debug launcher UI with **F7** to reach the export commands.

### Run the export

The F7 menu lists one command per data file (`Export weapons`, `Export ammo`,
`Export traders`, …) plus four control commands:

- **Export all** — runs every per-file export in one go (it deliberately skips
  `Export translations`, `Export complete item list`, `Export item icons`, and
  `Export traders mapping`, and runs weapons/outfits/melee last because they're
  **async** — wait for all their `[END]` console messages before continuing).
- **Export translation keys** — writes the set of translation keys collected so
  far in the session to `translation_keys.csv`.
- **Export translations** — reads `translation_keys.csv` back and resolves each
  key into the current game language. It depends on a *complete* keys file, so
  it's run as a pair with **Export translation keys** (see below).
- **Change headers mode** — toggles between translation **keys** (mode 1) and
  **translated values** (mode 0). The items DB **requires keys mode (1)**, which
  is the default — don't switch it to translated, or the generated headers break.

Output CSVs are written to the game's `bin/` folder — under MO2 that surfaces in
`MO2/overwrite/bin` (the exporter groups a session's files under a timestamped
subfolder).

### Translations workflow

Translations are per-language and need **both** translation commands, run as a
pair *after* the data export, once per language you want:

1. Set the game's language in **Settings** to the language pack you want to
   export (e.g. English or Russian).
2. Run **Export all** and wait for every `[END]` message in the console —
   including the async weapons/outfits/melee ones.
3. Run **Export translation keys**. Do this *after* step 2 completes: although
   Export all runs this command internally, it runs it *before* the async
   weapon/outfit exports register their name and description keys, so the file
   Export all leaves behind is missing those. Re-running it now captures the
   complete key set.
4. Run **Export translations** — it reads that complete `translation_keys.csv`,
   resolves each key with the engine, and writes `<locale>.csv` (`en_us.csv` for
   English, `ru_ru.csv` for Russian).
5. Switch the game to the next language and repeat steps 2–4.

The exporter resolves keys using whatever language pack the game has loaded
(whatever you set in **Settings**) — no language is special-cased for the
*translation* itself. The `eng`/`rus` settings are only special-cased for the
output *filename*: they auto-name the file `en_us.csv` / `ru_ru.csv`, while any
other language is written to a generic `export_translations.csv` that you rename
to the matching `<locale>.csv` yourself. The DB pipeline currently reads
`en`, `ru`, and `fr`.

> Some `export_*` files only appear when the relevant mod is installed (e.g.
> `export_magazine_info.csv` and `export_mag_capacity.csv` come from the
> Magazines mod; `export_outfit_exchange.csv` from the outfit-exchange mod). The
> pipeline skips cleanly when any optional CSV is missing — see
> [Optional inputs](#optional-and-mod-specific-inputs).

> The exporter assumes GAMMA's config layout in places (craft category numbering,
> treasure sections, GAMMA-only globals). On plain Anomaly or other packs some
> commands no-op or need nil-guards; run them individually and watch the console
> rather than relying on **Export all** to succeed wholesale.

## 2. Pick a pack ID

The pack ID is a lowercase kebab-case slug used as the folder name and as the
`id` in `packs.json` and URLs. Follow the existing convention of
`<modpack>-<version>`, e.g. `gamma-0.9.5`, `anomaly-1.5.3`, `gra-2.5`.

## 3. Import the exported CSVs

Create `data/<pack-id>/` and copy the exported CSVs into it. The repo includes a
helper that copies every `*.csv` from a source directory:

```bash
node scripts/import-game-exports.mjs --pack <pack-id> --src "C:\path\to\overwrite\bin"
```

- `--src` defaults to `C:\Stalker_GAMMA\overwrite\bin`.
- The destination `data/<pack-id>/` must already exist.
- Translation CSVs (`en_us.csv`, `ru_ru.csv`, `fr_fr.csv`, `translation_keys.csv`)
  are **replaced** by default. Pass `--merge-translations` to instead add only
  new keys to the existing files.

You can also just copy the files in manually. Translation CSVs must keep their
Windows-1251 bytes intact — don't open and re-save them in a UTF-8 editor (this
is the corruption described in [translation-encoding.md](translation-encoding.md)).

### What the pipeline reads

The generator (`scripts/generate-index.mjs`) categorizes searchable items by
filename. The core item CSVs map to categories like so:

| CSV (prefix)                     | Category / output            |
| -------------------------------- | ---------------------------- |
| `export_weapons_pistol`          | Pistols                      |
| `export_weapons_smg`             | SMGs                         |
| `export_weapons_shotgun`         | Shotguns                     |
| `export_weapons_rifle`           | Rifles                       |
| `export_weapons_sniper`          | Snipers                      |
| `export_weapons_melee`           | Melee                        |
| `export_weapons_explosive`       | Launchers                    |
| `export_ammo`                    | Ammo                         |
| `export_explosives`              | Explosives                   |
| `export_outfits_outfit_helmet`   | Helmets                      |
| `export_outfits_*`               | Outfits                      |
| `export_belt_attachments`        | Belt Attachments             |
| `export_artefacts`               | Artefacts                    |
| `export_eatable`                 | Food                         |
| `export_medicine`                | Medicine                     |
| `export_mutant_parts_prices`     | Mutant Parts                 |
| `export_scopes`                  | Scopes (kits split out)      |
| `export_silencers`               | Silencers                    |
| `export_grenade_launchers`       | Grenade Launchers            |

The full mapping (and the relationship/lookup CSVs that don't become categories —
drops, recipes, disassembly, upgrades, trader stock, etc.) lives in the
`FILE_CONFIG` and `SKIP_FILES` tables at the top of `scripts/generate-index.mjs`.
Any `export_*.csv` not in either table logs a `No config for …, skipping` warning
and is ignored — harmless, but worth scanning the build output for if you expect
a file to be picked up.

## 4. Optional and mod-specific inputs

These all live under `data/<pack-id>/` (or its `source/` subfolder) and are
picked up automatically when present; the pipeline skips them silently when
absent. See `data/gamma-0.9.5/` for a full example.

| File / folder                          | Produces / effect                                              |
| -------------------------------------- | -------------------------------------------------------------- |
| `traders/<trader>/*.csv`               | Per-trader JSON + `traders-meta.json` (stock, prices, origin)  |
| `source/new_game_loadouts.ltx`         | `starting-loadouts.json`, `item-loadouts.json`                 |
| `synthetic-items.json`                 | Hand-authored items the exporter can't emit (e.g. Lucifer)     |
| `pba-constants.json`                   | Copied through (Perk Based Artefacts)                          |
| `gbo-constants.json`                   | Copied through (GAMMA Balance Overhaul)                        |
| `export_outfit_exchange.csv`           | `outfit-exchange.json`                                         |
| `export_toolkit_map_rates.csv`         | `toolkit-rates.json`                                           |
| `export_mutant_profiles.csv`           | `mutant-profiles.json`                                         |
| `export_npc_armor_profiles.csv`        | `npc-armor-profiles.json`                                      |
| `export_magazine_info.csv` + `export_mag_capacity.csv` + `export_weapon_magazine_map.csv` | Magazines category + capacity (durable store) |

> **Durable stores:** `magazines.json`, `mag-capacity.json`, and
> `weapon-magazines.json` are merged non-destructively — regenerating from an
> export taken *without* the relevant mod won't drop previously committed data.

### Per-pack parser config (`pack.json`)

The generator's default CSV parser is the **legacy** one (kept for the older
committed packs). Current USADE, however, outputs standard **RFC 4180** CSV — so
a freshly exported pack should opt into the RFC 4180 parser with a
`data/<pack-id>/pack.json`:

```json
{
  "csvStyle": "rfc4180",
  "encoding": { "en_us.csv": "utf-8" }
}
```

- `csvStyle`: `"rfc4180"` for current USADE exports (standard quoted CSV); omit
  to fall back to the legacy parser (which handles the old exporter's
  `"val";"val"` semicolon sub-values). When in doubt, set `"rfc4180"` for any new
  export — a wrong choice shows up as garbled multi-value fields.
- `encoding`: per-file overrides for translation decoding (default
  `windows-1251`).

## 5. Extract item icons (optional)

Icons live in `site/public/img/icons/<item-id>.png` and come from USADE's
`scripts/extract-weapon-and-outfit-icons.py`. It reads
the icon→atlas mapping from `data/export_item_icons.csv` (produced by the
**Export item icons** F7 command — note this one is *not* part of **Export all**),
slices the named cell out of each `gamedata/textures` atlas, and writes one PNG
per item ID. It runs two ways:

- **As an MO2 plugin** (PyQt6 + `mobase`) — drop the `.py` into MO2's `plugins/`
  and it decodes textures through the engine's DDS reader.
- **Standalone** via `scripts/extract-weapon-and-outfit-icons.bat` (which just
  calls `python extract-weapon-and-outfit-icons.py`). This path needs **Pillow**
  (`pip install -r requirements.txt`). Per USADE's README, add an MO2 executable
  pointing at the `.bat` and starting in your Anomaly folder so the relative
  `data/` and `gamedata/textures` paths resolve, then run it.

The repo helper `scripts/setup-icon-extractor.mjs` wires this up for the local
GAMMA 0.9.5 install — it copies the plugin into MO2 and `export_item_icons.csv`
to where the plugin expects it (paths are machine-specific; edit before use).

Copy the resulting PNGs into `site/public/img/icons/`. They're shared across all
packs and keyed by item ID, so an icon already present for a shared item is
reused — you only need to extract icons new to this pack. After extraction, prune
orphaned icons:

```bash
node scripts/prune-icons.mjs --dry-run   # preview
node scripts/prune-icons.mjs             # delete icons with no matching item ID in any pack
```

Items with no icon fall back to `img/icons/unknown.png`.

## 6. Run the data pipeline

```bash
node scripts/generate-index.mjs --pack <pack-id>
```

This reads `data/<pack-id>/`, writes JSON to `site/public/data/<pack-id>/`, and
internally invokes `generate-traders.mjs`. It generates the per-category files,
`index.json` (the global search index), the relationship JSONs, `translations.json`,
`categories.json`, and a `manifest.json` of content hashes for cache busting.

Watch the console output for `No config for …` warnings (unexpected/unhandled
CSVs) and any `WARNING:` lines (e.g. missing scope/silencer items that would leave
weapon-addon mappings empty).

App UI strings and item-name overrides are shared across packs, not per-pack:

- App UI strings → `data/app_translations.json` (en **and** ru required), copied
  to `site/public/data/app_translations.json` by the generator.
- Item name overrides → `data/supplementary_translations.json`, merged into each
  pack's `translations.json`.

Never edit the generated `site/public/data/<pack-id>/translations.json` directly —
it is regenerated every run.

## 7. Register the pack in the UI

Add an entry to the `packs` array in `site/public/data/packs.json`:

```json
{
  "id": "<pack-id>",
  "name": "Display Name 1.2.3",
  "baseCarryWeight": 33,
  "links": [
    { "url": "https://discord.gg/...", "icon": "discord", "label": "Discord" },
    { "url": "https://...",            "icon": "globe",   "label": "Website" }
  ]
}
```

Fields:

- `id` — must match the data folder name.
- `name` — shown in the pack switcher.
- `baseCarryWeight` — base actor carry weight for the pack (33 for all current packs).
- `links` — optional external links (`icon` is a lucide icon name; see `site/src/icons.js`).
- `status` / `statusColor` — optional badge, e.g. `"experimental"` (blue) or `"old"` (red).
- `deprecated: true` — marks an older version.
- `default` (top-level key, not per-pack) — the pack ID loaded on first visit.

## 8. Build and verify

```bash
npm run build
```

Then load the site, switch to the new pack, and confirm categories, item detail
(drops, recipes, disassembly, upgrades), traders, and translations all populate.

> Do **not** start `npm run dev` to verify — the maintainer runs the dev server
> themselves. Use `npm run build`.

## Updating an existing pack

To refresh a pack with a newer export, repeat steps 1, 3, and 6 against the same
pack ID. `--merge-translations` on import only adds keys missing from the
existing CSV (it never overwrites values) — it is *not* how corrections are
kept. Hand-corrections never go in the pack's exported translation CSVs: item
name/description overrides belong in `data/supplementary_translations.json` and
UI strings in `data/app_translations.json` (both shared across packs, merged in
at generate time). Some numeric drift between re-exports (weights, etc.) is
expected baseline noise from differing modpack state, not a regression.
