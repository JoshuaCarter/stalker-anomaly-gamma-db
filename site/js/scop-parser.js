/**
 * S.T.A.L.K.E.R. Anomaly .scop save file parser.
 *
 * Parses LZO1X-compressed save files and extracts actor inventory items.
 * Requires LZO1X global (from lzo1x.js).
 *
 * Format reference: docs/stalker-anomaly-save-format.md
 */
const ScopParser = (() => {
    "use strict";

    const ALIFE_VERSION = 6;
    const OBJECT_CHUNK_ID = 2;
    const REGISTRY_CHUNK_ID = 9; // alife_registry_container (relations, infoportions, …)
    const CFS_COMPRESS_MARK = 0x80000000;
    const M_SPAWN = 1;
    const NO_PARENT = 0xFFFF;
    const ACTOR_ID = 0;
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

    const STASH_SECTIONS = new Set(["workshop_stash"]);

    // [communities] order from GAMMA 0.9.5 game_relations.ltx. The relations
    // registry stores faction goodwill keyed by this numeric index, not by name.
    // Indices 5–17 are the player-facing factions; the rest are engine-internal
    // (actor/monster/trader, the DoctorX actor_* relation rows, arena_enemy).
    const COMMUNITY_NAMES = [
        "actor", "monster", "trader", "army_npc", "greh_npc", "bandit", "dolg",
        "ecolog", "freedom", "killer", "army", "monolith", "greh", "stalker",
        "zombied", "csky", "isg", "renegade", "actor_stalker", "actor_bandit",
        "actor_dolg", "actor_freedom", "actor_csky", "actor_ecolog", "actor_killer",
        "actor_army", "actor_monolith", "actor_zombied", "actor_greh", "actor_isg",
        "actor_renegade", "arena_enemy",
    ];
    const DISPLAY_COMMUNITY_MIN = 5;
    const DISPLAY_COMMUNITY_MAX = 17;
    // community_goodwill_limits from game_relations.ltx — values outside this
    // (with slack) signal a misaligned parse, so we bail rather than show garbage.
    const GOODWILL_SANITY = 100000;

    /**
     * Parse a .scop file and extract actor inventory, stash items, and actor position.
     *
     * @param {ArrayBuffer} buffer   Raw .scop file contents.
     * @param {Set<string>} knownIds Set of known item section names from index.json.
     * @returns {{ items: Array<{sectionName: string, id: number, parentId: number, ammoTypeIndex: number, equipSlot: number, condition: number}>,
     *             stashItems: Array<{sectionName: string, id: number, parentId: number, ammoTypeIndex: number, equipSlot: number, condition: number}>,
     *             stashContainers: Array<{id: number, levelId: string | null, x: number, z: number}>,
     *             objectCount: number,
     *             actorPosition: {x: number, y: number, z: number, graphId: number, levelId: string} | null }}
     */
    function parse(buffer, knownIds) {
        if (buffer.byteLength > MAX_FILE_SIZE) {
            throw new Error("Save file too large (>50 MB)");
        }
        if (buffer.byteLength < 12) {
            throw new Error("File too small to be a valid save");
        }

        const view = new DataView(buffer);
        const marker = view.getUint32(0, true);
        if (marker !== 0xFFFFFFFF) {
            throw new Error("Not a valid .scop save file (bad header marker)");
        }

        const version = view.getUint32(4, true);
        if (version !== ALIFE_VERSION) {
            throw new Error(`Unsupported save version ${version} (expected ${ALIFE_VERSION})`);
        }

        const uncompressedSize = view.getUint32(8, true);
        const compressed = new Uint8Array(buffer, 12);

        let decompressed;
        try {
            decompressed = globalThis.LZO1X.decompress(compressed, uncompressedSize);
        } catch (e) {
            throw new Error("Failed to decompress save file — it may be corrupted");
        }

        // Walk chunks to find object registry (chunk ID 2)
        const objData = findChunk(decompressed, OBJECT_CHUNK_ID);
        if (!objData) {
            throw new Error("Could not find object registry in save file");
        }

        // Parse object entries
        const parsed = parseObjects(objData, knownIds);
        // Best-effort: actor faction goodwill from the relations registry (chunk 9).
        // Null if the chunk is absent, LZHUF-compressed, or fails sanity checks —
        // the UI falls back to MilPDA reputation in that case.
        parsed.communityGoodwill = parseActorGoodwill(decompressed);
        return parsed;
    }

    /**
     * Locate a chunk and report whether it is LZHUF-compressed (without throwing).
     */
    function findChunkInfo(data, targetId) {
        let pos = 0;
        while (pos + 8 <= data.length) {
            const rawId = readU32(data, pos);
            const chunkSize = readU32(data, pos + 4);
            const id = rawId & 0x7FFFFFFF;
            if (id === targetId) {
                return {
                    data: data.subarray(pos + 8, pos + 8 + chunkSize),
                    isCompressed: (rawId & CFS_COMPRESS_MARK) !== 0,
                };
            }
            pos += 8 + chunkSize;
        }
        return null;
    }

    /**
     * Extract the actor's per-faction goodwill from the registry container (chunk 9).
     *
     * Layout (alife_registry_container.cpp, see docs/save-progression-data.md):
     *   Registry 0 InfoPortions  — skipped to reach Relations
     *   Registry 1 Relations     — per-owner personal + community goodwill
     *
     * @returns {{ [factionId: string]: number } | null} goodwill keyed by faction,
     *          or null when unavailable / the parse looks misaligned.
     */
    function parseActorGoodwill(decompressed) {
        try {
            const info = findChunkInfo(decompressed, REGISTRY_CHUNK_ID);
            // We have no LZHUF decoder, so a compressed registry can't be read here.
            if (!info || info.isCompressed) return null;
            const d = info.data;
            const afterInfoPortions = skipInfoPortionsRegistry(d, 0);
            if (afterInfoPortions < 0) return null;
            return readActorCommunityGoodwill(d, afterInfoPortions);
        } catch (e) {
            return null; // goodwill is strictly best-effort
        }
    }

    /**
     * Walk past Registry 0 (InfoPortions) to the start of Registry 1 (Relations).
     * Returns the new offset, or -1 if the data looks malformed.
     *
     *   u32 entry_count
     *   per entry: u16 owner_id, u32 info_count, info_count × stringZ
     */
    function skipInfoPortionsRegistry(d, pos) {
        const entryCount = readU32(d, pos); pos += 4;
        if (entryCount > 200000) return -1;
        for (let i = 0; i < entryCount; i++) {
            if (pos + 6 > d.length) return -1;
            pos += 2; // owner_id
            const infoCount = readU32(d, pos); pos += 4;
            if (infoCount > 200000) return -1;
            for (let j = 0; j < infoCount; j++) {
                const nul = findNull(d, pos, d.length);
                if (nul < 0) return -1;
                pos = nul + 1;
            }
        }
        return pos;
    }

    /**
     * Read Registry 1 (Relations) and return the actor's community goodwill.
     *
     *   u32 entry_count
     *   per entry: u16 owner_id
     *     u32 personal_count,  personal_count × (u16 target_id, s32 goodwill)
     *     u32 community_count, community_count × (s32 community_index, s32 goodwill)
     */
    function readActorCommunityGoodwill(d, pos) {
        const entryCount = readU32(d, pos); pos += 4;
        if (entryCount > 200000) return null;
        for (let i = 0; i < entryCount; i++) {
            if (pos + 2 > d.length) return null;
            const ownerId = readU16(d, pos); pos += 2;

            const personalCount = readU32(d, pos); pos += 4;
            if (personalCount > 200000) return null;
            pos += personalCount * 6; // u16 + s32 per personal relation

            if (pos + 4 > d.length) return null;
            const communityCount = readU32(d, pos); pos += 4;
            // Legit saves carry ~32 communities; anything wild means we drifted.
            if (communityCount > 256) return null;
            if (pos + communityCount * 8 > d.length) return null;

            if (ownerId !== ACTOR_ID) {
                pos += communityCount * 8;
                continue;
            }

            const goodwill = {};
            for (let c = 0; c < communityCount; c++) {
                const idx = readS32(d, pos); pos += 4;
                const value = readS32(d, pos); pos += 4;
                // Out-of-range index or value ⇒ misaligned parse: discard entirely.
                if (idx < 0 || idx > 255) return null;
                if (value < -GOODWILL_SANITY || value > GOODWILL_SANITY) return null;
                const name = COMMUNITY_NAMES[idx];
                if (name && idx >= DISPLAY_COMMUNITY_MIN && idx <= DISPLAY_COMMUNITY_MAX) {
                    goodwill[name] = value;
                }
            }
            return Object.keys(goodwill).length ? goodwill : null;
        }
        return null;
    }

    /**
     * Find a chunk by ID in the decompressed IWriter chunk stream.
     */
    function findChunk(data, targetId) {
        let pos = 0;
        while (pos + 8 <= data.length) {
            const rawId = readU32(data, pos);
            const chunkSize = readU32(data, pos + 4);
            const id = rawId & 0x7FFFFFFF;
            const isCompressed = (rawId & CFS_COMPRESS_MARK) !== 0;

            if (id === targetId) {
                const chunkData = data.subarray(pos + 8, pos + 8 + chunkSize);
                if (isCompressed) {
                    // LZHUF compressed chunk — first 4 bytes are uncompressed size
                    // For now, we don't expect the object registry to be LZHUF-compressed
                    // in standard Anomaly saves. If it is, throw a descriptive error.
                    throw new Error("Object registry chunk is LZHUF-compressed (not yet supported)");
                }
                return chunkData;
            }
            pos += 8 + chunkSize;
        }
        return null;
    }

    /**
     * Parse the object registry and extract actor inventory + stash items.
     */
    function parseObjects(data, knownIds) {
        const objectCount = readU32(data, 0);
        let pos = 4;

        // First pass: parse all objects
        const allSpawns = [];
        const stashIds = new Set();
        let actorSpawn = null;
        // graphId → level mapping built from named objects (smart terrains, level changers)
        const graphToLevel = new Map();

        for (let i = 0; i < objectCount && pos < data.length; i++) {
            const spawnSize = readU16(data, pos); pos += 2;
            const spawnEnd = pos + spawnSize;
            const spawn = parseSpawnPacket(data, pos, spawnSize);
            pos = spawnEnd;
            const updateSize = readU16(data, pos); pos += 2;
            pos += updateSize;

            if (spawn) {
                allSpawns.push(spawn);
                if (STASH_SECTIONS.has(spawn.sectionName)) {
                    stashIds.add(spawn.id);
                }
                if (spawn.id === ACTOR_ID) {
                    actorSpawn = spawn;
                }
                // Build graphId→level from objects with recognizable level-prefixed names
                if (spawn.graphId >= 0 && spawn.nameReplace) {
                    const level = nameToLevel(spawn.nameReplace);
                    if (level) graphToLevel.set(spawn.graphId, level);
                }
            }
        }

        // Resolve a graphId to a level using collected mappings
        function resolveLevel(graphId) {
            if (graphId < 0) return null;
            const direct = graphToLevel.get(graphId);
            if (direct) return direct;
            let bestDist = Infinity, bestLevel = null;
            for (const [gid, lvl] of graphToLevel) {
                const d = Math.abs(gid - graphId);
                if (d < bestDist) { bestDist = d; bestLevel = lvl; }
            }
            return bestLevel;
        }

        // Actor position
        let actorPosition = null;
        if (actorSpawn && actorSpawn.graphId >= 0) {
            const levelId = resolveLevel(actorSpawn.graphId);
            if (levelId) {
                actorPosition = {
                    x: actorSpawn.posX, y: actorSpawn.posY, z: actorSpawn.posZ,
                    graphId: actorSpawn.graphId, levelId,
                    name: actorSpawn.nameReplace || '',
                };
            }
        }

        // Equipped weapons (slot 2 = primary, slot 3 = secondary)
        if (actorPosition) {
            for (const spawn of allSpawns) {
                if (spawn.parentId === ACTOR_ID && spawn.id !== ACTOR_ID) {
                    if (spawn.equipSlot === 2) actorPosition.primaryWeapon = spawn.sectionName;
                    if (spawn.equipSlot === 3) actorPosition.secondaryWeapon = spawn.sectionName;
                }
            }
        }

        // Player stash position(s) and container descriptors
        const stashPositions = [];
        const stashContainers = [];
        for (const spawn of allSpawns) {
            if (STASH_SECTIONS.has(spawn.sectionName)) {
                const levelId = spawn.graphId >= 0 ? resolveLevel(spawn.graphId) : null;
                if (levelId) {
                    stashPositions.push({ x: spawn.posX, z: spawn.posZ, levelId });
                }
                stashContainers.push({ id: spawn.id, levelId, x: spawn.posX, z: spawn.posZ });
            }
        }

        // Anomaly positions (zone_* sections, excluding campfires)
        const anomalies = [];
        for (const spawn of allSpawns) {
            if (spawn.sectionName.startsWith('zone_') &&
                !spawn.sectionName.startsWith('zone_campfire') &&
                spawn.parentId === NO_PARENT &&
                spawn.graphId >= 0) {
                const levelId = resolveLevel(spawn.graphId);
                if (levelId) {
                    anomalies.push({ section: spawn.sectionName, x: spawn.posX, z: spawn.posZ, levelId });
                }
            }
        }

        // Resolve section name: strip addon suffixes to find known base item.
        // Handles both vanilla (_wpn_addon_*) and GAMMA-style (_p1x42, etc.) suffixes.
        function resolveSection(name) {
            if (knownIds.has(name)) return name;
            // Try _wpn_addon_ split first (most specific)
            const addonIdx = name.indexOf("_wpn_addon_");
            if (addonIdx > 0) {
                const base = name.substring(0, addonIdx);
                if (knownIds.has(base)) return base;
            }
            // Progressively strip trailing _segment parts to find longest known base
            let end = name.length;
            while (true) {
                end = name.lastIndexOf("_", end - 1);
                if (end <= 0) break;
                const candidate = name.substring(0, end);
                if (knownIds.has(candidate)) return candidate;
            }
            return null;
        }

        // Second pass: categorize items
        const items = [];
        const stashItems = [];

        for (const spawn of allSpawns) {
            const resolved = resolveSection(spawn.sectionName);
            if (spawn.parentId === ACTOR_ID && spawn.id !== ACTOR_ID && resolved) {
                items.push({ sectionName: resolved, id: spawn.id, parentId: spawn.parentId, ammoTypeIndex: spawn.ammoTypeIndex, equipSlot: spawn.equipSlot, condition: spawn.condition });
            } else if (stashIds.has(spawn.parentId) && resolved) {
                stashItems.push({ sectionName: resolved, id: spawn.id, parentId: spawn.parentId, ammoTypeIndex: spawn.ammoTypeIndex, equipSlot: spawn.equipSlot, condition: spawn.condition });
            }
        }

        return { items, stashItems, stashContainers, objectCount, actorPosition, stashPositions, anomalies };
    }

    // Level prefix → level ID mapping for resolving object names to levels
    const LEVEL_PREFIX_MAP = {
        esc: 'l01_escape', gar: 'l02_garbage', agr: 'l03_agroprom',
        val: 'l04_darkvalley', bar: 'l05_bar', ros: 'l06_rostok',
        mil: 'l07_military', yan: 'l08_yantar', dead: 'l09_deadcity',
        lim: 'l10_limansk', rad: 'l10_radar', red: 'l10_red_forest',
        hos: 'l11_hospital', pri: 'l11_pripyat',
        cnpp: 'l12_stancia', gen: 'l13_generators',
        jup: 'jupiter', zat: 'zaton', mar: 'k00_marsh',
        dark: 'k01_darkscape', trc: 'k02_trucks_cemetery',
        pol: 'y04_pole', cop: 'pripyat',
    };

    /**
     * Parse the essential fields from a spawn packet.
     */
    function parseSpawnPacket(data, offset, size) {
        try {
            let p = offset;
            const end = offset + size;

            // u16 M_SPAWN
            const msgType = readU16(data, p); p += 2;
            if (msgType !== M_SPAWN) return null;

            // stringZ section_name
            const secEnd = findNull(data, p, end);
            if (secEnd < 0) return null;
            const sectionName = readStringZ(data, p, secEnd);
            p = secEnd + 1;

            // stringZ name_replace
            const nameEnd = findNull(data, p, end);
            if (nameEnd < 0) return null;
            const nameReplace = readStringZ(data, p, nameEnd);
            p = nameEnd + 1;

            // u8 legacy_gameid + u8 s_RP
            p += 2;

            // vec3 o_Position (3x float32 LE)
            if (p + 12 > end) return null;
            const posX = readF32(data, p);
            const posY = readF32(data, p + 4);
            const posZ = readF32(data, p + 8);
            p += 12;

            // vec3 o_Angle (12 bytes, skip)
            p += 12;

            // u16 RespawnTime
            p += 2;

            // u16 ID
            const id = readU16(data, p); p += 2;

            // u16 ID_Parent
            const parentId = readU16(data, p); p += 2;

            const result = { sectionName, nameReplace, id, parentId, posX, posY, posZ, graphId: -1, ammoTypeIndex: -1, equipSlot: -1, condition: -1 };

            // Skip: ID_Phantom(2) + s_flags(2) + SPAWN_VERSION(2) + m_gameType(2) + script_server_object_version(2)
            p += 10;
            // client_data_size + client_data
            if (p + 2 > end) return result;
            const cdSize = readU16(data, p); p += 2;
            // Extract equip slot from client_data byte 1:
            // high nibble = inventory slot (0=ruck, 2=weapon1, 3=weapon2, etc.)
            // low nibble: 1=equipped in slot, 3=in ruck
            if (cdSize >= 2) {
                const slotByte = data[p + 1];
                const slot = (slotByte >> 4) & 0x0F;
                const state = slotByte & 0x0F;
                if (slot > 0 && state === 1) {
                    result.equipSlot = slot;
                }
            }
            p += cdSize;
            // m_tSpawnID
            p += 2;
            // state_size + STATE_Write data
            if (p + 2 > end) return result;
            const stateSize = readU16(data, p); p += 2;
            if (stateSize < 2) return result;
            const stateEnd = p + stateSize;

            // CSE_ALifeObject: first field is m_tGraphID (u16)
            result.graphId = readU16(data, p);

            if (stateSize < 40) return result;

            // Parse STATE to reach weapon ammo_type:
            // CSE_ALifeObject: graphID(2) + dist(4) + directCtrl(4) + nodeID(4) + flags(4) + ini_stringZ + story_id(4) + spawn_story_id(4)
            let sp = p;
            sp += 18; // 2+4+4+4+4
            const iniNullPos = findNull(data, sp, stateEnd);
            if (iniNullPos < 0) return result;
            sp = iniNullPos + 1;
            sp += 8; // story_id + spawn_story_id
            // CSE_ALifeDynamicObjectVisual: visual_write = stringZ + u8 flags
            const visNullPos = findNull(data, sp, stateEnd);
            if (visNullPos < 0) return result;
            sp = visNullPos + 1;
            sp += 1; // visual flags
            // CSE_ALifeInventoryItem: condition(4) + upgrade_count(4) + upgrades[]
            if (sp + 8 > stateEnd) return result;
            result.condition = readF32(data, sp);
            sp += 4; // condition
            const upgCount = readU32(data, sp); sp += 4;
            for (let u = 0; u < upgCount && sp < stateEnd; u++) {
                const uNull = findNull(data, sp, stateEnd);
                if (uNull < 0) return result;
                sp = uNull + 1;
            }
            // CSE_ALifeItemWeapon: a_current(2) + a_elapsed(2) + wpn_state(1) + addon_flags(1) + ammo_type(1)
            if (sp + 7 > stateEnd) return result;
            sp += 4; // a_current + a_elapsed
            sp += 2; // wpn_state + addon_flags
            result.ammoTypeIndex = data[sp];

            return result;
        } catch (e) {
            return null; // Skip malformed packets
        }
    }

    /**
     * Resolve an object name to a level ID using known level prefixes.
     */
    function nameToLevel(name) {
        if (!name) return null;
        const idx = name.indexOf("_");
        if (idx <= 0) return null;
        return LEVEL_PREFIX_MAP[name.substring(0, idx)] || null;
    }

    // --- Binary helpers ---

    function readU16(data, offset) {
        return data[offset] | (data[offset + 1] << 8);
    }

    function readU32(data, offset) {
        return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
    }

    function readS32(data, offset) {
        // The | 0 coercion keeps the high-bit sign, unlike readU32's >>> 0.
        return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) | 0;
    }

    const _f32buf = new ArrayBuffer(4);
    const _f32u8 = new Uint8Array(_f32buf);
    const _f32view = new DataView(_f32buf);
    function readF32(data, offset) {
        _f32u8[0] = data[offset];
        _f32u8[1] = data[offset + 1];
        _f32u8[2] = data[offset + 2];
        _f32u8[3] = data[offset + 3];
        return _f32view.getFloat32(0, true);
    }

    function findNull(data, start, end) {
        for (let i = start; i < end; i++) {
            if (data[i] === 0) return i;
        }
        return -1;
    }

    function readStringZ(data, start, nullPos) {
        let s = "";
        for (let i = start; i < nullPos; i++) s += String.fromCharCode(data[i]);
        return s;
    }

    return { parse };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ScopParser;
globalThis.ScopParser = ScopParser;
