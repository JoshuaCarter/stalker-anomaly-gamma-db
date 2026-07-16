// Registry of optional starting-loadout mods.
//
// The base game's new_game_loadouts.ltx is handled separately in generate-index.mjs
// (it also drives item-loadouts.json and the inStartingLoadout weapon flag). Each
// entry below is an *additional* loadout the player can swap to from the site's Mods
// menu; it only ever emits its own starting-loadouts-<id>.json and (if it ships
// companions) some icons + name translations. Mods never touch the base data.
//
// To add a loadout mod:
//   1. Drop its files under data/<pack>/source/ (the ltx, and for a companion mod the
//      sprite sheet + grid ltx + eng/rus string tables).
//   2. Add one entry here.
//   3. Add an `app_label_loadout_mod_<id>` app-translation (en/ru/fr) for the menu label.
//   4. Run `node scripts/generate-index.mjs --pack <pack>` — it parses the ltx, injects
//      companion names, extracts companion icons, and re-hashes the manifest. The site
//      discovers the new mod automatically from that manifest.
//
// `companions` is optional; omit it for a plain loadout swap with no companion picks.
export const LOADOUT_MODS = [
  {
    id: "drunks",
    ltx: "new_game_loadouts_drunks.ltx",
    // No `companions` block: the mod's companion pick-items
    // (<faction>_sim_squad_comp_N_comp_item) fall back to a placeholder icon and a
    // "Companion N" name in the site, so we don't maintain the sprite sheet / names.
    //
    // To ship real portraits + names for a mod, add a companions block naming the
    // source files (all under data/<pack>/source/):
    //   companions: {
    //     ltx: "items_companion_x.ltx",   // grid coords + inv_name keys per comp_item
    //     dds: "companions_xcv.dds",       // uncompressed 32-bit BGRA sprite sheet
    //     eng: "st_items_comp_x.eng.xml",  // en name string table
    //     rus: "st_items_comp_x.rus.xml",  // ru name string table
    //   },
  },
];
