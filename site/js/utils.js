// ─── Pure utility / helper functions ─────────────────────────────────────────
import { SKIP_KEYS, HEAL_FIELDS, FACTION_ICONS } from './constants.js';

export function malfunctionChance(reliabilityPct) {
    const condShotDec = 0.01 - (reliabilityPct / 10000);
    return (2 * condShotDec * 2000) / 10;
}

// Canonical ammo penetration tiers from the GAMMA ADB br_class rework LTX header,
// weakest to strongest. kAp is the round's armour-piercing coefficient (the value
// the player armour formula gates on); labelKey is the i18n key for its display
// name. See docs/gamma-actor-damage-formula.md.
export const BALLISTIC_TIERS = [
    { kAp: 0.17, labelKey: "app_pen_tier_pistol_fmj" },
    { kAp: 0.23, labelKey: "app_pen_tier_slug" },
    { kAp: 0.27, labelKey: "app_pen_tier_rifle_fmj" },
    { kAp: 0.33, labelKey: "app_pen_tier_sniper_fmj" },
    { kAp: 0.38, labelKey: "app_pen_tier_pistol_ap" },
    { kAp: 0.45, labelKey: "app_pen_tier_ap_slug" },
    { kAp: 0.49, labelKey: "app_pen_tier_545_ap" },
    { kAp: 0.52, labelKey: "app_pen_tier_556_ap" },
    { kAp: 0.57, labelKey: "app_pen_tier_762x39_ap" },
    { kAp: 0.62, labelKey: "app_pen_tier_762x51_ap" },
    { kAp: 0.80, labelKey: "app_pen_tier_762x54_ap" },
];
export const BALLISTIC_AP_TIERS = BALLISTIC_TIERS.map((t) => t.kAp);

// Deterministic at-a-glance ballistic rating (BR+) for an outfit/helmet: the mean
// fraction of a bullet's damage the armour blocks across BALLISTIC_AP_TIERS — body
// shot, 100% condition, bare item (no plates/artefacts/boosters). Combines GAMMA's
// two armour buckets: flat protection (boneArmor × FireWound adjuster 0.8) and the
// +40% premitigation earned when a round is stopped (threshold ≥ k_ap, where
// threshold = 1 − hitFractionActor = the displayed BR Class). Returns 0..100, or
// null when the raw fields are absent (older packs / plain Anomaly).
export function ballisticRating(boneArmor, hitFractionActor) {
    if (typeof boneArmor !== "number" || typeof hitFractionActor !== "number") return null;
    const br = boneArmor * 0.8;              // flat softening bucket (BR%)
    const threshold = 1 - hitFractionActor;  // penetration gate (= BR Class)
    let sum = 0;
    for (const kAp of BALLISTIC_AP_TIERS) {
        const damageTaken = threshold >= kAp ? 0.6 * (1 - br) : (1 - br);
        sum += 1 - damageTaken;
    }
    return (sum / BALLISTIC_AP_TIERS.length) * 100;
}

export function isNonZero(val) {
    if (val == null || val === "" || val === 0 || val === "0" || val === "0%") return false;
    if (typeof val === "string") {
        const n = parseFloat(val);
        if (!isNaN(n) && n === 0) return false;
    }
    return true;
}

export function buildStatRows(item, headers) {
    if (!item || !headers.length) return [];
    const rows = [];
    for (const h of headers) {
        if (SKIP_KEYS.has(h)) continue;
        rows.push({ key: h, value: item[h], isSection: false });
    }
    return rows;
}

export function buildDropFactions(drops) {
    if (!drops) return [];
    return Object.entries(drops).map(([name, ranks]) => ({
        name,
        ranks,
        icon: FACTION_ICONS[name] || FACTION_ICONS[name.toLowerCase()] || null,
    })).sort((a, b) => a.name.localeCompare(b.name));
}

export function categorySlug(category) {
    return category.toLowerCase().replace(/ /g, "-");
}

export function buildPathUrl(state) {
    if (state.buildPlanner && state.pack) return `/db/${state.pack}/build-planner`;
    if (state.damageSim && state.pack) return state.armorMode ? `/db/${state.pack}/armor` : `/db/${state.pack}/ballistics`;
    if (state.maps && state.pack) return `/db/${state.pack}/maps`;
    if (state.trading && state.pack) return `/db/${state.pack}/trading`;
    if (state.playerInventory && state.pack) return `/db/${state.pack}/inventory`;
    if (state.toolsLanding && state.pack) return `/db/${state.pack}/tools`;
    if (state.versionCompare && state.pack) return `/db/${state.pack}/version-compare`;
    if (state.startingLoadouts && state.pack) return `/db/${state.pack}/starting-loadouts`;
    if (state.factionPools && state.pack) return `/db/${state.pack}/faction-drops`;
    if (state.favorites && state.pack) return `/db/${state.pack}/favorites`;
    if (state.recent && state.pack) return `/db/${state.pack}/recent`;
    if (state.cat && state.pack) {
        return `/db/${state.pack}/${categorySlug(state.cat)}`;
    }
    return "/";
}

export function parsePathUrl(pathname) {
    const result = { pack: null, cat: null, buildPlanner: false, damageSim: false, maps: false, trading: false, playerInventory: false, favorites: false, recent: false, versionCompare: false, startingLoadouts: false, factionPools: false, toolsLanding: false, armorProtection: false };
    const path = pathname.replace(/\/+$/, "") || "/";
    if (path === "/build-planner") { result.buildPlanner = true; return result; }
    if (path === "/version-compare") { result.versionCompare = true; return result; }
    const m = path.match(/^\/db\/([^/]+)(?:\/([^/]+))?$/);
    if (m) {
        result.pack = m[1];
        if (m[2] === "build-planner") result.buildPlanner = true;
        else if (m[2] === "ballistics") result.damageSim = true;
        else if (m[2] === "maps") result.maps = true;
        else if (m[2] === "trading") result.trading = true;
        else if (m[2] === "inventory") result.playerInventory = true;
        else if (m[2] === "tools") result.toolsLanding = true;
        else if (m[2] === "armor") result.armorProtection = true;
        else if (m[2] === "version-compare") result.versionCompare = true;
        else if (m[2] === "starting-loadouts") result.startingLoadouts = true;
        else if (m[2] === "faction-drops") result.factionPools = true;
        else if (m[2] === "favorites") result.favorites = true;
        else if (m[2] === "recent") result.recent = true;
        else if (m[2]) result.cat = m[2];
    }
    return result;
}

export function saveCategoryFilters(packId, slug, state) {
    try {
        localStorage.setItem(`catFilters:${packId}:${slug}`, JSON.stringify(state));
    } catch (e) { /* quota or private mode */ }
}

export function loadCategoryFilters(packId, slug) {
    try {
        const raw = localStorage.getItem(`catFilters:${packId}:${slug}`);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

export function debounce(fn, ms) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}



