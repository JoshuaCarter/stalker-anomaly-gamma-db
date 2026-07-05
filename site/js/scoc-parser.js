/**
 * S.T.A.L.K.E.R. Anomaly .scoc (Lua marshal) parser.
 *
 * Parses the Lua marshal binary format to extract equipped item data.
 * Specifically reads: beltMemory (artifact belt slots) and
 * game_object[0].actor_binder.active_slot.
 */
const ScocParser = (() => {
    "use strict";

    const TAG_NIL = 0x00;
    const TAG_BOOL = 0x01;
    const TAG_NUMBER = 0x03;
    const TAG_STRING = 0x04;
    const TAG_TABLE = 0x05;
    const MARSHAL_MARKER = 0x8E;

    /**
     * Parse a .scoc file and extract equipped item info.
     * @param {ArrayBuffer} buffer  Raw .scoc file contents.
     * @returns {{ beltItemIds: Set<number>, activeSlot: number, stats: Object | null, playerStashIds: Set<number> }}
     *   beltItemIds: set of object IDs currently in artifact belt slots
     *   activeSlot: active weapon slot number (0=knife, 1=pistol, 2=primary, 3=secondary, etc.)
     *   stats: compact progression-statistics summary (see extractStats), or null
     *   playerStashIds: container object IDs the player owns (deployed + workshop stashes)
     */
    function parse(buffer) {
        const data = new Uint8Array(buffer);
        if (data.length < 2 || data[0] !== MARSHAL_MARKER) {
            throw new Error("Not a valid .scoc file");
        }

        const state = { data, pos: 1 };
        const root = readValue(state);
        if (!root || typeof root !== "object") {
            throw new Error("Failed to parse .scoc root table");
        }

        const result = { beltItemIds: new Set(), activeSlot: -1, stats: extractStats(root), playerStashIds: new Set() };

        // Extract active_slot from game_object[0].actor_binder
        const gameObject = root["game_object"];
        if (gameObject && typeof gameObject === "object") {
            const actor = gameObject["0"];
            if (actor && actor["actor_binder"]) {
                const slot = actor["actor_binder"]["active_slot"];
                if (typeof slot === "number") result.activeSlot = slot;
            }
        }

        // Extract beltMemory: { outfitId: { items: { itemId: true, ... } } }
        const beltMemory = root["beltMemory"];
        if (beltMemory && typeof beltMemory === "object") {
            for (const outfitId of Object.keys(beltMemory)) {
                const entry = beltMemory[outfitId];
                if (entry && entry["items"] && typeof entry["items"] === "object") {
                    for (const itemId of Object.keys(entry["items"])) {
                        result.beltItemIds.add(Number(itemId));
                    }
                }
            }
        }

        // Player-owned container object IDs. The .scop parser can identify the fixed
        // workshop_stash by section name, but deployed stash boxes (placeable_case, …)
        // aren't recognizable that way — the game tracks their IDs here instead:
        //   player_created_stashes = { containerId: deployItemSection }  (deployed boxes)
        //   workshop_stashes       = { markerId: containerId }           (base stashes)
        const created = root["player_created_stashes"];
        if (created && typeof created === "object") {
            for (const id of Object.keys(created)) {
                const n = Number(id);
                if (Number.isFinite(n)) result.playerStashIds.add(n);
            }
        }
        const workshops = root["workshop_stashes"];
        if (workshops && typeof workshops === "object") {
            for (const v of Object.values(workshops)) {
                if (typeof v === "number") result.playerStashIds.add(v);
            }
        }

        return result;
    }

    /**
     * Build a compact progression summary from script-state keys in the root table.
     * All keys are optional (GAMMA-specific modules degrade gracefully on vanilla
     * Anomaly saves) — returns null when nothing recognizable is present.
     * Shape is JSON-serializable so it can be persisted with the inventory model.
     */
    function extractStats(root) {
        const isObj = (v) => v !== null && typeof v === "object";
        const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
        const count = (map) => (isObj(map) ? Object.keys(map).length : 0);
        const truthyKeys = (map) => (isObj(map)
            ? Object.keys(map).filter(k => map[k] === true || map[k] === 1)
            : []);

        const stats = {};
        const gs = isObj(root.game_statistics) ? root.game_statistics : null;

        // Global counters: killed_stalkers, killed_monsters, deaths, tasks_completed,
        // artefacts_found, stashes_found, items_disassembled, level_changes, emissions…
        if (gs && isObj(gs.actor_statistics)) {
            const actor = {};
            for (const [k, v] of Object.entries(gs.actor_statistics)) {
                if (num(v) !== null) actor[k] = Math.round(v);
            }
            if (Object.keys(actor).length) stats.actor = actor;
        }
        if (gs && isObj(gs.actor_visited_levels)) {
            stats.visitedLevels = truthyKeys(gs.actor_visited_levels).sort();
            stats.totalLevels = count(gs.actor_visited_levels);
        }
        if (gs && isObj(gs.actor_visited_smarts)) {
            stats.smartsVisited = truthyKeys(gs.actor_visited_smarts).length;
            stats.smartsTotal = count(gs.actor_visited_smarts);
        }
        if (gs && isObj(gs.actor_achievements)) {
            stats.achievementsUnlocked = truthyKeys(gs.actor_achievements).length;
            stats.achievementsTotal = count(gs.actor_achievements);
        }
        if (gs && isObj(gs.actor_articles)) stats.articles = truthyKeys(gs.actor_articles).length;
        if (gs && isObj(gs.actor_notes)) stats.notes = count(gs.actor_notes);

        if (isObj(root.task_info)) stats.tasksDone = count(root.task_info);

        const treasure = root.treasure_manager;
        if (isObj(treasure) && (isObj(treasure.caches) || num(treasure.caches_count) !== null)) {
            stats.stashesFound = truthyKeys(treasure.caches).length;
            stats.stashesTotal = num(treasure.caches_count) !== null
                ? Math.round(treasure.caches_count)
                : count(treasure.caches);
        }

        const ft = root.fast_travel_system;
        if (isObj(ft) && (num(ft.locations_found) !== null || isObj(ft.spawned_zones))) {
            stats.fastTravelFound = num(ft.locations_found) !== null ? Math.round(ft.locations_found) : 0;
            stats.fastTravelTotal = count(ft.spawned_zones);
        }

        if (isObj(root.visited_campfires)) stats.campfires = count(root.visited_campfires);
        if (isObj(root.known_recipe)) stats.recipes = count(root.known_recipe);

        // Skill XP progression (GAMMA): strength / endurance / scavenging / survival
        if (isObj(root.skills_levels)) {
            const skills = [];
            for (const [id, s] of Object.entries(root.skills_levels)) {
                if (!isObj(s)) continue;
                skills.push({
                    id,
                    level: num(s.current_level ?? s.level) ?? 0,
                    maxLevel: num(s.max_level) ?? 0,
                    xp: num(s.experience) ?? 0,
                    req: num(s.requirement) ?? 0,
                    prevReq: num(s.prev_requirement) ?? 0,
                });
            }
            if (skills.length) stats.skills = skills;
        }

        if (typeof root.default_faction === "string" && root.default_faction) {
            stats.faction = root.default_faction;
        }

        // MilPDA addon: faction progress + recent-kill feed (capped by the game, not all kills)
        const milpda = root.milpda;
        if (isObj(milpda)) {
            if (isObj(milpda.faction_data)) {
                const factions = [];
                for (const [id, f] of Object.entries(milpda.faction_data)) {
                    if (!isObj(f)) continue;
                    factions.push({
                        id,
                        progress: num(f.progress) !== null ? Math.round(f.progress) : 0,
                        blacklisted: f.blacklisted === true,
                    });
                }
                if (factions.length) stats.factions = factions;
            }
            if (isObj(milpda.tracked_bodies)) {
                const kills = Object.values(milpda.tracked_bodies)
                    .filter(isObj)
                    .sort((a, b) => (num(b.tod) ?? 0) - (num(a.tod) ?? 0))
                    .slice(0, 10)
                    .map(b => ({
                        name: typeof b.name === "string" ? b.name : "",
                        comm: typeof b.comm === "string" ? b.comm : (typeof b.community === "string" ? b.community : ""),
                        level: typeof b.level === "string" ? b.level : (typeof b.level_name === "string" ? b.level_name : ""),
                    }));
                if (kills.length) stats.kills = kills;
            }
        }

        const stealth = root.stealth_kills;
        if (isObj(stealth) && isObj(stealth.victims)) {
            stats.stealthKills = count(stealth.victims);
        }

        return Object.keys(stats).length ? stats : null;
    }

    function readValue(state) {
        const { data } = state;
        if (state.pos >= data.length) return null;

        const tag = data[state.pos++];

        if (tag === TAG_NIL) return null;

        if (tag === TAG_BOOL) {
            return data[state.pos++] !== 0;
        }

        if (tag === TAG_NUMBER) {
            const view = new DataView(data.buffer, data.byteOffset + state.pos, 8);
            state.pos += 8;
            return view.getFloat64(0, true);
        }

        if (tag === TAG_STRING) {
            const len = data[state.pos] | (data[state.pos + 1] << 8) |
                        (data[state.pos + 2] << 16) | (data[state.pos + 3] << 24);
            state.pos += 4;
            let s = "";
            for (let i = 0; i < len; i++) s += String.fromCharCode(data[state.pos + i]);
            state.pos += len;
            return s;
        }

        if (tag === TAG_TABLE) {
            const subtype = data[state.pos++];
            const dataSize = data[state.pos] | (data[state.pos + 1] << 8) |
                             (data[state.pos + 2] << 16) | (data[state.pos + 3] << 24);
            state.pos += 4;
            const end = state.pos + dataSize;
            const result = {};
            while (state.pos < end) {
                const key = readValue(state);
                if (key === null) break;
                const val = readValue(state);
                result[String(key)] = val;
            }
            state.pos = end;
            return result;
        }

        // Unknown tag — skip to avoid infinite loop
        return undefined;
    }

    return { parse };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ScocParser;
globalThis.ScocParser = ScocParser;
