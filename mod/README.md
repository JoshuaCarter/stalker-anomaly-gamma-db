# Stalker DB (in-game)

Item catalog for other Anomaly / GAMMA mods. One zip per game pack. No extra mods required.

Install with MO2. The installer asks for a language (English, Russian, French). Item names come from that locale. Folder name stays `Stalker DB - GAMMA 0.9.5` (or Anomaly / Grim Raid).

## Use

```lua
local row = STALKER_DB.get("wpn_ak74")
if STALKER_DB.is_weapon(sec) then
end
local pistols = STALKER_DB.list("weapons_pistols", "st_upgr_cost", "desc")
local parts = STALKER_DB.craft(sec) -- { { sec, amount }, ... } or nil
-- row is the JSON item plus name (translated)
```

Short name in your own script:

```lua
SDB = STALKER_DB
```

Missing pack files return nothing (`nil` / `false` / `{}`). Same script in every zip.

## Build

From the repo root:

```bash
npm run pack-mod -- --check
npm run pack-mod -- --release --out dist/mod
```

## Version

UTC stamp when CI publishes. GitHub tag is `v2026-08-30-2214`. Zip and `meta.ini` use dots (`StalkerDB_gamma-0.9.5_2026.08.30.2214.zip`) so MO2 does not treat the date as a short `yyyy-mm` and drop day/time.

JSON comes from committed `site/public/data/<pack>/` (same files the website already built with `generate-index.mjs`). Pack does not regenerate.
