# Stalker DB (in-game)

Site pack JSON on disk, plus a small Lua loader (`STALKER_DB`). One zip per pack in `packs.json` (skips `deprecated`). No extra mods required.

Install with MO2. Language radio (English / Russian / French) picks which `translations.json` table fills `name` and `descr`. The MO2 folder is `Stalker DB - GAMMA 0.9.5` (or Anomaly / Grim Raid).

The zip is the committed `site/public/data/<pack>/` tree (all `.json`, including traders). `STALKER_DB.init()` loads that tree (`on_game_start`, or earlier if you call an API). Item groups are top-level files that have `items` with an `id` (`pistols.json` -> `pistols`). `materials.json` is not a group (ids collide with medicine). `misc` is last so a real cat wins on duplicate `id`. Other JSON stays in the cache; `STALKER_DB.json("calibers.json")` after init.

Unions: `weapons` (guns + melee + launchers), `weapon-attach` (scopes, silencers, grenade-launchers), `armor` (outfits, helmets).

## Use

Default API is shared and readonly. Writes are ignored (one log per row). `list()` is a real array of those rows; do not insert or swap slots. `pairs` on a sealed table (row or `json()` tree) is empty; use fields, `ipairs(list)`, or `open` if you need to walk a copy.

```lua
STALKER_DB.init() -- optional; on_game_start and every API call also init
local row = STALKER_DB.get("wpn_ak74")
if STALKER_DB.is(sec, "weapons") then
end
local pistols = STALKER_DB.list("pistols", "st_upgr_cost", "desc")
local rec = STALKER_DB.craft(sec) -- raw recipe plus name/descr, or nil
-- ingredient keys stay st_* (use STALKER_DB.translate(ing.name))
-- row is the JSON item plus name and descr (keys kept)
-- STALKER_DB.json("calibers.json")
-- STALKER_DB.json("traders/stalker_sidorovich.json")
```

Need a working copy? `open` once at load, stash the handle. Same methods as `STALKER_DB` (no `open`). First `get`/`list`/`json`/`craft` on the handle copies from the master and caches. Later calls reuse that copy. `open` after the game is running (`actor_on_first_update`) returns `nil`. Same id during load returns the same handle. Do not invent a new id every call.

```lua
local db

function on_game_load()
    db = STALKER_DB.open("cool_mod")
end

local row = db.get("wpn_ak74")
row.cost = 1 -- only this handle
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

UTC stamp. Tag `v2026-08-30-2214`. Zip and `meta.ini` use `2026.08.30-2214` (dots on the date, hyphen before hhmm) so MO2 does not show `2026.0.0.0-08-30-2214`.
