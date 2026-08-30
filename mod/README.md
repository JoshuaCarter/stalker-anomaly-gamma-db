# Stalker DB (in-game)

Item catalog for other Anomaly / GAMMA mods. One zip per game pack. No extra mods required.

Install with MO2. The folder name stays `Stalker DB - GAMMA 0.9.5` (or Anomaly / Grim Raid). Version is in the zip name and `meta.ini` only, so MO2 treats updates as the same mod.

## Use

```lua
local row = STALKER_DB.get("wpn_ak74")
if STALKER_DB.is_weapon(sec) then
end
local pistols = STALKER_DB.list("weapons_pistols", "cost", "desc")
local parts = STALKER_DB.craft(sec) -- { { sec, amount }, ... } or nil
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
