# Stalker DB (in-game)

Site pack JSON on disk, plus a small Lua loader (`STALKER_DB`). One zip per pack in `packs.json` (skips `deprecated`). No extra mods required.

Install with MO2. Language radio (English / Russian / French) picks which `translations.json` table fills `name` and `descr`. The MO2 folder is `Stalker DB - GAMMA 0.9.5` (or Anomaly / Grim Raid).

The zip is the committed `site/public/data/<pack>/` tree (all `.json`, including traders). `STALKER_DB` indexes item category files by site slug (`pistols.json` -> `pistols`). Other JSON (calibers, drops, upgrades, traders, materials, index, ...) is on disk only; use `STALKER_DB.json("calibers.json")` or read it yourself. `materials.json` is not an item group (ids collide with medicine).

Item groups: `pistols`, `smgs`, `rifles`, `snipers`, `shotguns`, `melee`, `launchers`, `scopes`, `silencers`, `grenade-launchers`, `tactical-kits`, `weapon-parts`, `outfits`, `helmets`, `ammo`, `mutant-parts`, `outfit-parts`, `medicine`, `food`, `artefacts`, `explosives`, `belt-attachments`, `magazines`, `misc`.

Unions: `weapons` (guns + melee + launchers), `weapon-attach` (scopes, silencers, grenade-launchers), `armor` (outfits, helmets).

## Use

```lua
local row = STALKER_DB.get("wpn_ak74")
if STALKER_DB.is(sec, "weapons") then
end
local pistols = STALKER_DB.list("pistols", "st_upgr_cost", "desc")
local parts = STALKER_DB.craft(sec) -- { { sec, amount }, ... } or nil
-- craft maps ingredient st_* keys to section ids; unmatched rows are dropped and logged
-- raw recipes: STALKER_DB.json("craft-recipes.json")
-- row is the JSON item plus name and descr (keys kept)
-- STALKER_DB.translate("st_wpn_aps_descr")
-- STALKER_DB.json("calibers.json")
```

```lua
SDB = STALKER_DB
```

Missing files return nothing (`nil` / `false` / `{}`). Same script in every zip.

## Build

```bash
npm run pack-mod -- --check
npm run pack-mod -- --release --out dist/mod
```

CI publishes when `mod/` or `pack-mod.mjs` changes, or via workflow_dispatch. It does not publish on site JSON-only commits.

## Version

UTC stamp. Tag `v2026-08-30-2214`. Zip / `meta.ini` use dots (`StalkerDB_gamma-0.9.5_2026.08.30.2214.zip`) so MO2 keeps day and time.
