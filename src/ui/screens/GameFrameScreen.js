import { RoadGenerator } from "../../game/RoadGenerator.js";
import { createFlavorFromLevel, createRoadFromLevel, createTilesFromLevel, getTierOneLevel } from "../../game/LevelDefinitions.js";
import { getRandomCrate } from "../../game/CrateDefinitions.js";
import { createRaider, RAIDER_TYPES } from "../../game/RaiderDefinitions.js";
import { getRandomGem } from "../../game/GemDefinitions.js";
import { BASE_COIN_DROP_CHANCE, BASE_RAIDER_RESOURCE_MULTIPLIER, getCoinYieldMultiplier, getCrateDropChance, getGemDropChance, getStartingResourceBonus } from "../../game/PerkDefinitions.js";
import { getNextRarity, RARITIES, RARITY_LABELS, TOWER_DEFINITIONS, RARITY_COLORS } from "../../game/TowerDefinitions.js";
import { RunTelemetry, copyLatestTelemetryRun, downloadLatestTelemetryRun, enableTelemetry, isTelemetryEnabled } from "../../game/TelemetryService.js";
import { getResearchKey, getResearchNode, getTowerResearchNodes } from "../../game/ResearchDefinitions.js";
import { applyResearchStatTuning, getCombatNumber, getCombatRarityNumber, getResearchEffectNumber } from "../../game/TowerTuning.js";
import { getCachedImage } from "../AssetCache.js";
import { queueCoinReward, queueGemReward, queueTextReward } from "../RewardPopup.js";

const FIRST_TIER_GRID_SIZE = 50;
const CELL_SIZE = 32;
const TARGET_BUCKET_SIZE = CELL_SIZE * 4;
const MONOLITH_LIFT = CELL_SIZE * 0.9;
const MONOLITH_INSET = CELL_SIZE * 0.18;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.2;
const TAU = Math.PI * 2;
const ASSET_BASE_URL = import.meta.env.BASE_URL;
const RUNTIME_ASSET_BASE = `${ASSET_BASE_URL}assets/runtime`;
const ASSET_SOURCES = {
  tree: `${RUNTIME_ASSET_BASE}/scenery/tree.png`,
  boulder: `${RUNTIME_ASSET_BASE}/scenery/boulder.png`,
  ...Object.fromEntries(Object.values(TOWER_DEFINITIONS).flatMap((tower) => {
    const assetNames = [tower.asset, tower.emptyAsset, tower.missileAsset].filter(Boolean);
    const baseAssets = assetNames.map((asset) => [asset, `${RUNTIME_ASSET_BASE}/towers/${asset}.png`]);
    if (tower.usesRarityAssets === false) return baseAssets;
    return assetNames.flatMap((asset) => [
      [asset, `${RUNTIME_ASSET_BASE}/towers/${asset}.png`],
      ...RARITIES.map((rarity) => {
        const key = getRarityAssetName(asset, rarity);
        return [key, `${RUNTIME_ASSET_BASE}/towers/${key}.png`];
      })
    ]);
  })),
  ...Object.fromEntries(Object.values(RAIDER_TYPES).flatMap((raider) => (
    raider.frames.flatMap((asset) => {
      const baseAsset = [[asset, `${RUNTIME_ASSET_BASE}/raiders/${asset}.png`]];
      if (raider.usesRarityAssets === false) return baseAsset;
      return [
        ...baseAsset,
        ...RARITIES.map((rarity) => {
          const key = getRarityAssetName(asset, rarity);
          return [key, `${RUNTIME_ASSET_BASE}/raiders/${key}.png`];
        })
      ];
    })
  )))
};
const PLAYER_MAX_HEALTH = 100;
const STARTING_RESOURCES = 10;
const MAX_AUTHORED_WAVE_COUNT = 100;
const RUN_AUTOSAVE_INTERVAL_MS = 10000;
const TOWER_POPUP_OPEN_DELAY_MS = 50;
const FPS_SAMPLE_INTERVAL_MS = 250;
const MAX_ACTIVE_EFFECTS = 140;
const GAME_SPEEDS = [1, 2, 4, 16];
const RESEARCH_RARITY_INDEX = RARITIES.indexOf("rare");
const FACTORY_ACTIVATIONS_PER_WAVE = 2;
const FACTORY_SLOT_MULTIPLIERS = [1, 0.7, 0.5, 0.35, 0.25];
const CAMERA_EDGE_DRAG_MARGIN = 160;
const ROAD_FLOW_IDLE_FRAME_INTERVAL_MS = 33;
const TARGET_PRIORITIES = [
  { id: "strongest", label: "strg" },
  { id: "first", label: "fst" },
  { id: "last", label: "lst" }
];
const DEVELOPER_COMMANDS = ["spawnraider", "setresources", "giveitem", "telemetry", "copytelemetry"];
const GIVE_ITEM_SUGGESTIONS = ["singularity", "copper", "bronze", "silver", "gold"];
const WAVE_SPAWN_INTERVAL = 0.45;
const WAVE_SPAWN_SPACING_MULTIPLIER = 1.6;
const JET_ORBIT_CIRCUITS_BY_RARITY = Object.fromEntries(RARITIES.map((rarity, index) => [rarity, index + 1]));
const JET_ORBIT_DURATION = 10;
const JET_ORBIT_RADIUS_CELLS = 600 / 100 * JET_ORBIT_DURATION / TAU;
const JET_ENTRY_PROGRESS_CELLS = Math.max(2, JET_ORBIT_RADIUS_CELLS);
const RAIDER_SPAWN_INTERVALS = {
  walker: {
    common: 0.42,
    uncommon: 0.52,
    rare: 0.68,
    epic: 0.82,
    legendary: 0.96
  },
  car: {
    common: 1.15,
    uncommon: 1.25,
    rare: 1.35,
    epic: 1.45,
    legendary: 1.55
  },
  vertext: {
    common: 1.15,
    uncommon: 1.25,
    rare: 1.35,
    epic: 1.45,
    legendary: 1.55
  },
  fastcar: {
    common: 1.05,
    uncommon: 1.15,
    rare: 1.25,
    epic: 1.35,
    legendary: 1.45
  },
  heavy_transport: {
    common: 1.65,
    uncommon: 1.75,
    rare: 1.85,
    epic: 1.95,
    legendary: 2.05
  },
  jet: {
    common: 1.65,
    uncommon: 1.65,
    rare: 1.65,
    epic: 1.65,
    legendary: 1.65
  },
  nestor: {
    common: 1.65,
    uncommon: 1.65,
    rare: 1.65,
    epic: 1.65,
    legendary: 1.65
  },
  serpent: {
    common: 0.82,
    uncommon: 0.82,
    rare: 0.82,
    epic: 0.82,
    legendary: 0.82
  },
  wraith: {
    common: 0.9,
    uncommon: 0.95,
    rare: 1.0,
    epic: 1.05,
    legendary: 1.1
  }
};
const MAX_TOWER_SHOTS_PER_UPDATE = 32;
const RAIDER_BAR_REVEAL_MS = 2000;
const WAVE_DEFINITIONS = Object.fromEntries([
  [1, [["walker", "common", 6]]],
  [2, [["walker", "common", 8]]],
  [3, [["walker", "common", 10]]],
  [4, [["walker", "common", 12], ["walker", "uncommon", 1]]],
  [5, [["walker", "common", 14], ["walker", "uncommon", 2]]],
  [6, [["walker", "common", 16], ["walker", "uncommon", 3]]],
  [7, [["walker", "common", 18], ["walker", "uncommon", 4]]],
  [8, [["walker", "common", 20], ["walker", "uncommon", 5]]],
  [9, [["walker", "common", 22], ["walker", "uncommon", 6]]],
  [10, [["walker", "common", 24], ["walker", "uncommon", 8], ["walker", "rare", 1]]],
  [11, [["walker", "common", 22], ["walker", "uncommon", 8], ["car", "common", 1]]],
  [12, [["walker", "common", 24], ["walker", "uncommon", 8], ["car", "common", 2]]],
  [13, [["walker", "common", 24], ["walker", "rare", 3], ["car", "common", 2]]],
  [14, [["walker", "uncommon", 18], ["walker", "rare", 4], ["car", "common", 3]]],
  [15, [["walker", "uncommon", 20], ["car", "common", 4], ["fastcar", "common", 2]]],
  [16, [["walker", "uncommon", 22], ["walker", "rare", 5], ["car", "common", 4], ["fastcar", "common", 3]]],
  [17, [["walker", "rare", 8], ["car", "common", 5], ["fastcar", "common", 4]]],
  [18, [["walker", "rare", 10], ["car", "uncommon", 2], ["car", "common", 4], ["fastcar", "common", 5]]],
  [19, [["walker", "rare", 12], ["car", "uncommon", 3], ["fastcar", "uncommon", 2], ["fastcar", "common", 5]]],
  [20, [["walker", "rare", 14], ["car", "uncommon", 4], ["fastcar", "uncommon", 4], ["walker", "epic", 2]]],
  [21, [["walker", "rare", 12], ["car", "uncommon", 4], ["fastcar", "uncommon", 4], ["heavy_transport", "common", 1]]],
  [22, [["walker", "rare", 14], ["car", "uncommon", 5], ["fastcar", "uncommon", 4], ["heavy_transport", "common", 2]]],
  [23, [["walker", "rare", 16], ["car", "rare", 2], ["fastcar", "uncommon", 5], ["heavy_transport", "common", 2]]],
  [24, [["walker", "epic", 4], ["car", "rare", 3], ["fastcar", "uncommon", 6], ["heavy_transport", "common", 3]]],
  [25, [["walker", "epic", 5], ["car", "rare", 4], ["fastcar", "rare", 2], ["heavy_transport", "uncommon", 2]]],
  [26, [["walker", "epic", 6], ["car", "rare", 4], ["fastcar", "rare", 3], ["heavy_transport", "uncommon", 3]]],
  [27, [["walker", "epic", 8], ["car", "rare", 5], ["fastcar", "rare", 3], ["heavy_transport", "uncommon", 4]]],
  [28, [["walker", "legendary", 2], ["car", "rare", 5], ["fastcar", "rare", 4], ["heavy_transport", "rare", 2]]],
  [29, [["walker", "legendary", 3], ["car", "epic", 2], ["fastcar", "rare", 5], ["heavy_transport", "rare", 3]]],
  [30, [["walker", "legendary", 4], ["car", "epic", 3], ["fastcar", "rare", 6], ["heavy_transport", "rare", 4]]],
  [31, [["walker", "legendary", 3], ["car", "rare", 4], ["fastcar", "rare", 5], ["heavy_transport", "rare", 3], ["jet", "common", 1]]],
  [32, [["walker", "legendary", 4], ["car", "epic", 2], ["fastcar", "rare", 5], ["heavy_transport", "rare", 3], ["jet", "common", 2]]],
  [33, [["walker", "legendary", 5], ["car", "epic", 3], ["fastcar", "rare", 6], ["heavy_transport", "rare", 3], ["jet", "common", 3]]],
  [34, [["car", "epic", 4], ["fastcar", "rare", 7], ["heavy_transport", "rare", 4], ["jet", "common", 4]]],
  [35, [["walker", "legendary", 6], ["car", "epic", 4], ["fastcar", "epic", 2], ["heavy_transport", "rare", 4], ["jet", "uncommon", 2]]],
  [36, [["walker", "legendary", 7], ["car", "epic", 5], ["fastcar", "epic", 3], ["heavy_transport", "rare", 5], ["jet", "uncommon", 3]]],
  [37, [["car", "epic", 5], ["fastcar", "epic", 4], ["heavy_transport", "epic", 2], ["jet", "uncommon", 4]]],
  [38, [["walker", "legendary", 8], ["car", "epic", 6], ["fastcar", "epic", 4], ["heavy_transport", "epic", 3], ["jet", "rare", 2]]],
  [39, [["car", "legendary", 2], ["fastcar", "epic", 5], ["heavy_transport", "epic", 4], ["jet", "rare", 3]]],
  [40, [["walker", "legendary", 10], ["car", "legendary", 3], ["fastcar", "epic", 6], ["heavy_transport", "epic", 5], ["jet", "rare", 4]]],
  [41, [["walker", "legendary", 8], ["car", "epic", 5], ["heavy_transport", "epic", 4], ["jet", "rare", 3], ["nestor", "common", 1]]],
  [42, [["walker", "legendary", 8], ["car", "epic", 6], ["fastcar", "epic", 4], ["heavy_transport", "epic", 4], ["jet", "rare", 3], ["nestor", "common", 2]]],
  [43, [["car", "legendary", 3], ["fastcar", "epic", 5], ["heavy_transport", "epic", 5], ["jet", "rare", 4], ["nestor", "common", 3]]],
  [44, [["walker", "legendary", 10], ["car", "legendary", 4], ["fastcar", "epic", 5], ["heavy_transport", "epic", 5], ["jet", "rare", 4], ["nestor", "uncommon", 2]]],
  [45, [["car", "legendary", 4], ["fastcar", "legendary", 2], ["heavy_transport", "epic", 6], ["jet", "rare", 5], ["nestor", "uncommon", 3]]],
  [46, [["walker", "legendary", 12], ["car", "legendary", 5], ["fastcar", "legendary", 2], ["heavy_transport", "legendary", 2], ["jet", "epic", 2], ["nestor", "uncommon", 4]]],
  [47, [["car", "legendary", 5], ["fastcar", "legendary", 3], ["heavy_transport", "legendary", 3], ["jet", "epic", 3], ["nestor", "rare", 2]]],
  [48, [["walker", "legendary", 14], ["car", "legendary", 6], ["fastcar", "legendary", 3], ["heavy_transport", "legendary", 3], ["jet", "epic", 3], ["nestor", "rare", 3]]],
  [49, [["car", "legendary", 7], ["fastcar", "legendary", 4], ["heavy_transport", "legendary", 4], ["jet", "epic", 4], ["nestor", "epic", 2]]],
  [50, [["walker", "legendary", 16], ["car", "legendary", 8], ["fastcar", "legendary", 4], ["heavy_transport", "legendary", 5], ["jet", "epic", 5], ["nestor", "epic", 3]]],
  [51, [["car", "legendary", 6], ["fastcar", "legendary", 4], ["heavy_transport", "legendary", 4], ["jet", "epic", 4], ["nestor", "rare", 3], ["serpent", "common", 8]]],
  [52, [["car", "legendary", 6], ["fastcar", "legendary", 5], ["heavy_transport", "legendary", 4], ["jet", "epic", 4], ["nestor", "rare", 3], ["serpent", "common", 12]]],
  [53, [["walker", "legendary", 12], ["car", "legendary", 7], ["fastcar", "legendary", 5], ["heavy_transport", "legendary", 5], ["jet", "epic", 4], ["nestor", "rare", 4], ["serpent", "uncommon", 8]]],
  [54, [["car", "legendary", 8], ["fastcar", "legendary", 5], ["heavy_transport", "legendary", 5], ["jet", "epic", 5], ["nestor", "epic", 3], ["serpent", "uncommon", 12]]],
  [55, [["walker", "legendary", 14], ["car", "legendary", 8], ["fastcar", "legendary", 6], ["heavy_transport", "legendary", 5], ["jet", "legendary", 2], ["nestor", "epic", 3], ["serpent", "rare", 8]]],
  [56, [["car", "legendary", 9], ["fastcar", "legendary", 6], ["heavy_transport", "legendary", 6], ["jet", "legendary", 3], ["nestor", "epic", 4], ["serpent", "rare", 12]]],
  [57, [["walker", "legendary", 16], ["car", "legendary", 10], ["fastcar", "legendary", 6], ["heavy_transport", "legendary", 6], ["jet", "legendary", 3], ["nestor", "legendary", 2], ["serpent", "epic", 8]]],
  [58, [["car", "legendary", 10], ["fastcar", "legendary", 7], ["heavy_transport", "legendary", 7], ["jet", "legendary", 4], ["nestor", "legendary", 3], ["serpent", "epic", 10]]],
  [59, [["walker", "legendary", 18], ["car", "legendary", 11], ["fastcar", "legendary", 7], ["heavy_transport", "legendary", 7], ["jet", "legendary", 4], ["nestor", "legendary", 3], ["serpent", "legendary", 6]]],
  [60, [["walker", "legendary", 20], ["car", "legendary", 12], ["fastcar", "legendary", 8], ["heavy_transport", "legendary", 8], ["jet", "legendary", 5], ["nestor", "legendary", 4], ["serpent", "legendary", 8]]],
  [61, [["car", "legendary", 10], ["fastcar", "legendary", 8], ["heavy_transport", "legendary", 7], ["jet", "legendary", 4], ["nestor", "legendary", 3], ["serpent", "epic", 10], ["wraith", "common", 4]]],
  [62, [["car", "legendary", 10], ["fastcar", "legendary", 8], ["heavy_transport", "legendary", 8], ["jet", "legendary", 4], ["nestor", "legendary", 3], ["serpent", "epic", 12], ["wraith", "common", 6]]],
  [63, [["walker", "legendary", 16], ["car", "legendary", 11], ["fastcar", "legendary", 8], ["heavy_transport", "legendary", 8], ["jet", "legendary", 5], ["nestor", "legendary", 4], ["serpent", "legendary", 8], ["wraith", "uncommon", 5]]],
  [64, [["car", "legendary", 12], ["fastcar", "legendary", 9], ["heavy_transport", "legendary", 8], ["jet", "legendary", 5], ["nestor", "legendary", 4], ["serpent", "legendary", 9], ["wraith", "uncommon", 7]]],
  [65, [["walker", "legendary", 18], ["car", "legendary", 12], ["fastcar", "legendary", 9], ["heavy_transport", "legendary", 9], ["jet", "legendary", 5], ["nestor", "legendary", 4], ["serpent", "legendary", 10], ["wraith", "rare", 5]]],
  [66, [["car", "legendary", 13], ["fastcar", "legendary", 10], ["heavy_transport", "legendary", 9], ["jet", "legendary", 6], ["nestor", "legendary", 5], ["serpent", "legendary", 10], ["wraith", "rare", 7]]],
  [67, [["walker", "legendary", 20], ["car", "legendary", 13], ["fastcar", "legendary", 10], ["heavy_transport", "legendary", 10], ["jet", "legendary", 6], ["nestor", "legendary", 5], ["serpent", "legendary", 11], ["wraith", "epic", 5]]],
  [68, [["car", "legendary", 14], ["fastcar", "legendary", 11], ["heavy_transport", "legendary", 10], ["jet", "legendary", 6], ["nestor", "legendary", 5], ["serpent", "legendary", 12], ["wraith", "epic", 7]]],
  [69, [["walker", "legendary", 22], ["car", "legendary", 14], ["fastcar", "legendary", 11], ["heavy_transport", "legendary", 11], ["jet", "legendary", 7], ["nestor", "legendary", 6], ["serpent", "legendary", 12], ["wraith", "legendary", 5]]],
  [70, [["walker", "legendary", 24], ["car", "legendary", 15], ["fastcar", "legendary", 12], ["heavy_transport", "legendary", 12], ["jet", "legendary", 7], ["nestor", "legendary", 6], ["serpent", "legendary", 14], ["wraith", "legendary", 7]]],
  [71, [["car", "legendary", 12], ["fastcar", "legendary", 12], ["heavy_transport", "legendary", 10], ["jet", "legendary", 7], ["nestor", "legendary", 5], ["serpent", "legendary", 12], ["wraith", "legendary", 6], ["vertext", "common", 1]]],
  [72, [["car", "legendary", 13], ["fastcar", "legendary", 12], ["heavy_transport", "legendary", 10], ["jet", "legendary", 7], ["nestor", "legendary", 5], ["serpent", "legendary", 13], ["wraith", "legendary", 7], ["vertext", "common", 2]]],
  [73, [["walker", "legendary", 20], ["car", "legendary", 14], ["fastcar", "legendary", 12], ["heavy_transport", "legendary", 11], ["jet", "legendary", 8], ["nestor", "legendary", 6], ["serpent", "legendary", 13], ["wraith", "legendary", 7], ["vertext", "uncommon", 2]]],
  [74, [["car", "legendary", 15], ["fastcar", "legendary", 13], ["heavy_transport", "legendary", 11], ["jet", "legendary", 8], ["nestor", "legendary", 6], ["serpent", "legendary", 14], ["wraith", "legendary", 8], ["vertext", "uncommon", 3]]],
  [75, [["walker", "legendary", 22], ["car", "legendary", 15], ["fastcar", "legendary", 13], ["heavy_transport", "legendary", 12], ["jet", "legendary", 8], ["nestor", "legendary", 6], ["serpent", "legendary", 15], ["wraith", "legendary", 8], ["vertext", "rare", 2]]],
  [76, [["car", "legendary", 16], ["fastcar", "legendary", 14], ["heavy_transport", "legendary", 12], ["jet", "legendary", 9], ["nestor", "legendary", 7], ["serpent", "legendary", 15], ["wraith", "legendary", 9], ["vertext", "rare", 3]]],
  [77, [["walker", "legendary", 24], ["car", "legendary", 16], ["fastcar", "legendary", 14], ["heavy_transport", "legendary", 13], ["jet", "legendary", 9], ["nestor", "legendary", 7], ["serpent", "legendary", 16], ["wraith", "legendary", 9], ["vertext", "epic", 2]]],
  [78, [["car", "legendary", 17], ["fastcar", "legendary", 15], ["heavy_transport", "legendary", 13], ["jet", "legendary", 9], ["nestor", "legendary", 7], ["serpent", "legendary", 17], ["wraith", "legendary", 10], ["vertext", "epic", 3]]],
  [79, [["walker", "legendary", 26], ["car", "legendary", 18], ["fastcar", "legendary", 15], ["heavy_transport", "legendary", 14], ["jet", "legendary", 10], ["nestor", "legendary", 8], ["serpent", "legendary", 17], ["wraith", "legendary", 10], ["vertext", "legendary", 2]]],
  [80, [["walker", "legendary", 28], ["car", "legendary", 18], ["fastcar", "legendary", 16], ["heavy_transport", "legendary", 15], ["jet", "legendary", 10], ["nestor", "legendary", 8], ["serpent", "legendary", 18], ["wraith", "legendary", 11], ["vertext", "legendary", 3]]],
  [81, [["walker", "legendary", 26], ["car", "legendary", 18], ["fastcar", "legendary", 16], ["heavy_transport", "legendary", 14], ["jet", "legendary", 10], ["nestor", "legendary", 8], ["serpent", "legendary", 18], ["wraith", "legendary", 10], ["vertext", "epic", 4]]],
  [82, [["walker", "legendary", 28], ["car", "legendary", 19], ["fastcar", "legendary", 16], ["heavy_transport", "legendary", 15], ["jet", "legendary", 10], ["nestor", "legendary", 8], ["serpent", "legendary", 19], ["wraith", "legendary", 11], ["vertext", "epic", 5]]],
  [83, [["walker", "legendary", 30], ["car", "legendary", 19], ["fastcar", "legendary", 17], ["heavy_transport", "legendary", 15], ["jet", "legendary", 11], ["nestor", "legendary", 9], ["serpent", "legendary", 19], ["wraith", "legendary", 11], ["vertext", "legendary", 4]]],
  [84, [["walker", "legendary", 32], ["car", "legendary", 20], ["fastcar", "legendary", 17], ["heavy_transport", "legendary", 16], ["jet", "legendary", 11], ["nestor", "legendary", 9], ["serpent", "legendary", 20], ["wraith", "legendary", 12], ["vertext", "legendary", 5]]],
  [85, [["walker", "legendary", 34], ["car", "legendary", 20], ["fastcar", "legendary", 18], ["heavy_transport", "legendary", 16], ["jet", "legendary", 12], ["nestor", "legendary", 9], ["serpent", "legendary", 20], ["wraith", "legendary", 12], ["vertext", "legendary", 6]]],
  [86, [["walker", "legendary", 36], ["car", "legendary", 21], ["fastcar", "legendary", 18], ["heavy_transport", "legendary", 17], ["jet", "legendary", 12], ["nestor", "legendary", 10], ["serpent", "legendary", 21], ["wraith", "legendary", 13], ["vertext", "legendary", 6]]],
  [87, [["walker", "legendary", 38], ["car", "legendary", 21], ["fastcar", "legendary", 19], ["heavy_transport", "legendary", 17], ["jet", "legendary", 13], ["nestor", "legendary", 10], ["serpent", "legendary", 22], ["wraith", "legendary", 13], ["vertext", "legendary", 7]]],
  [88, [["walker", "legendary", 40], ["car", "legendary", 22], ["fastcar", "legendary", 19], ["heavy_transport", "legendary", 18], ["jet", "legendary", 13], ["nestor", "legendary", 10], ["serpent", "legendary", 22], ["wraith", "legendary", 14], ["vertext", "legendary", 8]]],
  [89, [["walker", "legendary", 42], ["car", "legendary", 22], ["fastcar", "legendary", 20], ["heavy_transport", "legendary", 18], ["jet", "legendary", 14], ["nestor", "legendary", 11], ["serpent", "legendary", 23], ["wraith", "legendary", 14], ["vertext", "legendary", 8]]],
  [90, [["walker", "legendary", 44], ["car", "legendary", 23], ["fastcar", "legendary", 20], ["heavy_transport", "legendary", 19], ["jet", "legendary", 14], ["nestor", "legendary", 11], ["serpent", "legendary", 24], ["wraith", "legendary", 15], ["vertext", "legendary", 9]]],
  [91, [["walker", "legendary", 46], ["car", "legendary", 23], ["fastcar", "legendary", 21], ["heavy_transport", "legendary", 19], ["jet", "legendary", 15], ["nestor", "legendary", 11], ["serpent", "legendary", 24], ["wraith", "legendary", 15], ["vertext", "legendary", 9]]],
  [92, [["walker", "legendary", 48], ["car", "legendary", 24], ["fastcar", "legendary", 21], ["heavy_transport", "legendary", 20], ["jet", "legendary", 15], ["nestor", "legendary", 12], ["serpent", "legendary", 25], ["wraith", "legendary", 16], ["vertext", "legendary", 10]]],
  [93, [["walker", "legendary", 50], ["car", "legendary", 24], ["fastcar", "legendary", 22], ["heavy_transport", "legendary", 20], ["jet", "legendary", 16], ["nestor", "legendary", 12], ["serpent", "legendary", 26], ["wraith", "legendary", 16], ["vertext", "legendary", 10]]],
  [94, [["walker", "legendary", 52], ["car", "legendary", 25], ["fastcar", "legendary", 22], ["heavy_transport", "legendary", 21], ["jet", "legendary", 16], ["nestor", "legendary", 12], ["serpent", "legendary", 26], ["wraith", "legendary", 17], ["vertext", "legendary", 11]]],
  [95, [["walker", "legendary", 54], ["car", "legendary", 25], ["fastcar", "legendary", 23], ["heavy_transport", "legendary", 21], ["jet", "legendary", 17], ["nestor", "legendary", 13], ["serpent", "legendary", 27], ["wraith", "legendary", 17], ["vertext", "legendary", 11]]],
  [96, [["walker", "legendary", 56], ["car", "legendary", 26], ["fastcar", "legendary", 23], ["heavy_transport", "legendary", 22], ["jet", "legendary", 17], ["nestor", "legendary", 13], ["serpent", "legendary", 28], ["wraith", "legendary", 18], ["vertext", "legendary", 12]]],
  [97, [["walker", "legendary", 58], ["car", "legendary", 26], ["fastcar", "legendary", 24], ["heavy_transport", "legendary", 22], ["jet", "legendary", 18], ["nestor", "legendary", 13], ["serpent", "legendary", 28], ["wraith", "legendary", 18], ["vertext", "legendary", 12]]],
  [98, [["walker", "legendary", 60], ["car", "legendary", 27], ["fastcar", "legendary", 24], ["heavy_transport", "legendary", 23], ["jet", "legendary", 18], ["nestor", "legendary", 14], ["serpent", "legendary", 29], ["wraith", "legendary", 19], ["vertext", "legendary", 13]]],
  [99, [["walker", "legendary", 62], ["car", "legendary", 27], ["fastcar", "legendary", 25], ["heavy_transport", "legendary", 23], ["jet", "legendary", 19], ["nestor", "legendary", 14], ["serpent", "legendary", 30], ["wraith", "legendary", 19], ["vertext", "legendary", 13]]],
  [100, [["walker", "legendary", 64], ["car", "legendary", 28], ["fastcar", "legendary", 26], ["heavy_transport", "legendary", 24], ["jet", "legendary", 20], ["nestor", "legendary", 15], ["serpent", "legendary", 32], ["wraith", "legendary", 20], ["vertext", "legendary", 15]]]
].map(([wave, entries]) => [
  wave,
  entries.map(([type, rarity, count]) => ({ type, rarity, count }))
]));

export class GameFrameScreen {
  #flavorManager;
  #saveService;
  #element = null;
  #canvas = null;
  #ctx = null;
  #animationFrame = null;
  #needsDraw = true;
  #staticLayerCanvas = null;
  #staticLayerCtx = null;
  #staticLayerDirty = true;
  #level = 1;
  #camera = {
    x: 0,
    y: 0,
    scale: 1
  };
  #pointers = new Map();
  #lastPinchDistance = 0;
  #running = false;
  #time = 0;
  #gameSpeed = 1;
  #lastFrameTime = 0;
  #fps = {
    frames: 0,
    lastSampleAt: 0,
    display: 0
  };
  #gradientSeed = {
    hueA: 182,
    hueB: 196,
    hueC: 168,
    phaseA: 0,
    phaseB: 0,
    phaseC: 0,
    speedA: 0,
    speedB: 0,
    speedC: 0
  };
  #flavor = null;
  #levelDefinition = null;
  #road = null;
  #tiles = [];
  #rerollIndex = 0;
  #assets = new Map();
  #roadGenerator = new RoadGenerator();
  #playerHealth = PLAYER_MAX_HEALTH;
  #resources = STARTING_RESOURCES;
  #wave = 1;
  #waveStarted = false;
  #waveElapsed = 0;
  #waveFactoryInterval = 30;
  #spawning = false;
  #spawnQueue = [];
  #spawnTimer = 0;
  #raiders = [];
  #raiderPositions = new Map();
  #raiderById = new Map();
  #raiderBuckets = new Map();
  #nextRaiderId = 1;
  #gameOver = false;
  #runInitialized = false;
  #activeRunLevel = null;
  #context = null;
  #runCoins = 0;
  #coinYield = 0;
  #runGems = [];
  #runCrates = [];
  #runSettled = false;
  #tap = {
    active: false,
    startX: 0,
    startY: 0,
    moved: false
  };
  #selectedArea = null;
  #selectedTower = null;
  #towers = [];
  #nextTowerId = 1;
  #towerPopupOpenTimer = 0;
  #towerPopupOpenToken = 0;
  #effects = [];
  #lastRunSaveAt = 0;
  #telemetry = new RunTelemetry();
  #lastTelemetrySampleAt = 0;
  #lastRoadFlowDrawAt = 0;

  constructor({ flavorManager, saveService }) {
    this.#flavorManager = flavorManager;
    this.#saveService = saveService;
  }

  mount(context) {
    this.#context = context;
    const activeRun = context.params.resume ? this.#saveService.getActiveRun() : null;
    const requestedLevel = activeRun?.level || context.params.level || 1;

    if (!this.#runInitialized || this.#activeRunLevel !== requestedLevel) {
      this.#level = requestedLevel;
      this.#activeRunLevel = requestedLevel;
      this.#generateMapFlavor();
      if (activeRun && activeRun.level === requestedLevel) {
        this.#restoreRunState(activeRun);
      } else {
        this.#resetRunState();
        this.#saveActiveRun();
      }
      this.#runInitialized = true;
    }

    const screen = document.createElement("main");
    screen.className = "gameframe-screen";
    screen.setAttribute("aria-label", `Level ${this.#level} game frame`);

    screen.innerHTML = `
      <canvas class="game-canvas" aria-label="Level grid"></canvas>
      <header class="gameframe-hud">
        <div class="run-status-strip">
          <div class="run-pill">Level ${this.#level}</div>
          <div class="run-pill" data-wave-display>Wave ${this.#wave} / ${this.#getWaveCount()}</div>
          ${isTelemetryEnabled() ? `<div class="run-pill telemetry-pill">TEL PRIMED</div>` : ""}
          <div class="gameframe-action-stack">
            <button class="gameframe-end" type="button">End Game</button>
            <button class="gameframe-landscape" type="button" data-landscape-button>Landscape</button>
          </div>
        </div>
        <div class="player-stat-strip">
          <div class="run-pill fps-pill" data-fps-display>FPS --</div>
          <div class="run-pill" data-resource-display>${Math.floor(this.#resources)}R</div>
        </div>
      </header>
      <button class="time-toggle" type="button" aria-label="${this.#running ? "Pause time" : "Start time"}" data-running="${this.#running}">
        <span class="time-icon" aria-hidden="true"></span>
      </button>
      <div class="speed-control" aria-label="Game speed">
        <input
          class="speed-slider"
          type="range"
          min="0"
          max="${GAME_SPEEDS.length - 1}"
          step="1"
          value="${getGameSpeedIndex(this.#gameSpeed)}"
          aria-label="Game speed"
          data-speed-slider
        >
        <div class="speed-notches" aria-hidden="true">
          ${GAME_SPEEDS.map((speed) => `<span>${speed}x</span>`).join("")}
        </div>
      </div>
      <button class="gameframe-back" type="button">Back</button>
      <section class="developer-console" data-developer-console>
        <form class="developer-console-form" data-developer-console-form>
          <span class="developer-console-prompt" aria-hidden="true">&gt;</span>
          <input
            class="developer-console-input"
            data-developer-console-input
            type="text"
            list="developer-console-suggestions"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            aria-label="Developer command"
          >
          <datalist id="developer-console-suggestions" data-developer-console-suggestions></datalist>
        </form>
        <div class="developer-console-status" data-developer-console-status></div>
      </section>
      <section class="tower-popup" data-tower-popup>
        <div class="tower-popup-title" data-tower-popup-title>Tower</div>
        <div class="tower-popup-actions" data-placement-panel></div>
        <div class="tower-popup-actions" data-tower-panel>
          <div class="target-priority-group" data-target-priority-group aria-label="Target priority"></div>
          <div class="factory-credit-info" data-factory-credit-info hidden></div>
          <div class="tower-research-summary" data-tower-research-summary></div>
          <button class="tower-popup-button tower-research-button" type="button" data-open-research>
            <span class="tower-action-icon research" aria-hidden="true">
              <img src="${RUNTIME_ASSET_BASE}/other/research.png" alt="" draggable="false" />
            </span>
            <span data-open-research-label>Research</span>
          </button>
          <div class="tower-research-options" data-tower-research-options></div>
          <div class="tower-action-row">
            <button class="tower-popup-button tower-action-button" type="button" data-upgrade-tower aria-label="Upgrade tower" title="Upgrade tower">
              <span class="tower-action-icon upgrade" style="--upgrade-icon-url: url('${RUNTIME_ASSET_BASE}/other/upgrade.png')" aria-hidden="true"></span>
              <span class="tower-action-meta" data-upgrade-tower-meta>--</span>
            </button>
            <button class="tower-popup-button tower-action-button danger" type="button" data-recycle-tower aria-label="Recycle tower" title="Recycle tower">
              <span class="tower-action-icon recycle" aria-hidden="true">
                <img src="${RUNTIME_ASSET_BASE}/other/recycle.png" alt="" draggable="false" />
              </span>
              <span class="tower-action-meta" data-recycle-tower-meta>--</span>
            </button>
          </div>
        </div>
      </section>
    `;

    this.#element = screen;
    this.#canvas = screen.querySelector(".game-canvas");
    this.#ctx = this.#canvas.getContext("2d");

    screen.querySelector(".gameframe-back").addEventListener("click", () => {
      context.navigate("level-select");
    });

    screen.querySelector(".time-toggle").addEventListener("click", () => {
      this.#toggleTime();
    });

    screen.querySelector(".gameframe-end").addEventListener("click", () => {
      this.#endGame(context);
    });

    screen.querySelector("[data-landscape-button]").addEventListener("click", () => {
      this.#requestLandscapeMode();
    });

    screen.querySelector("[data-speed-slider]").addEventListener("input", (event) => {
      this.#setGameSpeed(GAME_SPEEDS[Number(event.currentTarget.value)] || 1);
    });

    screen.querySelector("[data-placement-panel]").addEventListener("click", (event) => {
      const button = event.target.closest("[data-place-tower]");
      if (button) this.#placeTower(button.dataset.placeTower);
    });
    screen.querySelector("[data-target-priority-group]").addEventListener("click", (event) => {
      const button = event.target.closest("[data-target-priority]");
      if (button) this.#setSelectedTowerPriority(button.dataset.targetPriority);
    });
    screen.querySelector("[data-open-research]").addEventListener("click", () => this.#toggleTowerResearchOptions());
    screen.querySelector("[data-tower-research-options]").addEventListener("click", (event) => {
      const button = event.target.closest("[data-assign-research]");
      if (button) this.#assignSelectedTowerResearch(button.dataset.assignResearch);
    });
    screen.querySelector("[data-upgrade-tower]").addEventListener("click", () => this.#upgradeSelectedTower());
    screen.querySelector("[data-recycle-tower]").addEventListener("click", () => this.#recycleSelectedTower());
    screen.querySelector("[data-developer-console-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      this.#submitDeveloperCommand();
    });
    screen.querySelector("[data-developer-console-input]").addEventListener("input", () => {
      this.#refreshDeveloperSuggestions();
    });

    this.#gradientSeed = createGradientSeed();
    this.#loadAssets();
    this.#bindInput();
    this.#resize();
    this.#start();

    window.addEventListener("resize", this.#resize);

    return screen;
  }

  unmount() {
    this.#saveActiveRun();
    this.#cancelTowerPopupOpen();
    cancelAnimationFrame(this.#animationFrame);
    window.removeEventListener("resize", this.#resize);
    window.removeEventListener("keydown", this.#handleKeyDown);
    this.#pointers.clear();
    this.#element = null;
    this.#canvas = null;
    this.#ctx = null;
    this.#context = null;
  }

  #bindInput() {
    this.#canvas.addEventListener("pointerdown", this.#handlePointerDown);
    this.#canvas.addEventListener("pointermove", this.#handlePointerMove);
    this.#canvas.addEventListener("pointerup", this.#handlePointerEnd);
    this.#canvas.addEventListener("pointercancel", this.#handlePointerEnd);
    this.#canvas.addEventListener("wheel", this.#handleWheel, { passive: false });
    window.addEventListener("keydown", this.#handleKeyDown);
  }

  #resize = () => {
    if (!this.#canvas || !this.#ctx) return;

    const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    const width = window.innerWidth;
    const height = window.innerHeight;
    const previousWidth = Number.parseFloat(this.#canvas.style.width) || 0;
    const previousHeight = Number.parseFloat(this.#canvas.style.height) || 0;
    const canPreserveCamera = previousWidth > 0 && previousHeight > 0;
    const previousCenter = canPreserveCamera
      ? {
          x: (previousWidth / 2 - this.#camera.x) / this.#camera.scale,
          y: (previousHeight / 2 - this.#camera.y) / this.#camera.scale
        }
      : null;

    this.#canvas.width = Math.floor(width * dpr);
    this.#canvas.height = Math.floor(height * dpr);
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#markStaticLayerDirty();

    const worldWidth = this.#worldWidth();
    const worldHeight = this.#worldHeight();
    if (previousCenter) {
      this.#camera.x = width / 2 - previousCenter.x * this.#camera.scale;
      this.#camera.y = height / 2 - previousCenter.y * this.#camera.scale;
    } else {
      const fitScale = Math.min(width / worldWidth, height / worldHeight);
      this.#camera.scale = clamp(fitScale * 1.08, MIN_ZOOM, MAX_ZOOM);
      this.#camera.x = (width - worldWidth * this.#camera.scale) / 2;
      this.#camera.y = (height - worldHeight * this.#camera.scale) / 2;
    }
    this.#clampCamera();
    this.#draw();
  };

  async #requestLandscapeMode() {
    const button = this.#element?.querySelector("[data-landscape-button]");
    if (!button) return;

    button.disabled = true;
    button.textContent = "Landscape...";

    try {
      if (!document.fullscreenElement && this.#element?.requestFullscreen) {
        await this.#element.requestFullscreen({ navigationUI: "hide" });
      }

      if (screen.orientation?.lock) {
        await screen.orientation.lock("landscape");
        button.textContent = "Landscape On";
      } else {
        button.textContent = "Rotate Device";
      }
    } catch {
      button.textContent = "Rotate Device";
    } finally {
      button.disabled = false;
      window.setTimeout(() => {
        if (this.#element?.contains(button)) button.textContent = "Landscape";
      }, 1800);
    }
  }

  #start() {
    this.#lastFrameTime = performance.now();
    this.#fps = {
      frames: 0,
      lastSampleAt: this.#lastFrameTime,
      display: 0
    };

    const tick = (now) => {
      const dt = Math.min(0.05, (now - this.#lastFrameTime) / 1000);
      this.#lastFrameTime = now;
      this.#telemetry.recordFrame(dt * 1000);
      this.#updateFpsDisplay(now);

      if (this.#running) {
        const scaledDt = dt * this.#gameSpeed;
        this.#time += scaledDt;
        this.#updateWave(scaledDt);
        this.#autosaveRun(now);
      }

      const shouldAnimateRoadFlow = this.#shouldAnimateRoadFlow(now);
      if (this.#running || this.#needsDraw || this.#effects.length > 0 || shouldAnimateRoadFlow) {
        if (shouldAnimateRoadFlow) {
          this.#lastRoadFlowDrawAt = now;
        }
        this.#draw();
      }

      this.#animationFrame = requestAnimationFrame(tick);
    };

    this.#animationFrame = requestAnimationFrame(tick);
  }

  #updateFpsDisplay(now) {
    this.#fps.frames += 1;
    const elapsed = now - this.#fps.lastSampleAt;
    if (elapsed < FPS_SAMPLE_INTERVAL_MS) return;

    this.#fps.display = Math.round((this.#fps.frames * 1000) / elapsed);
    this.#fps.frames = 0;
    this.#fps.lastSampleAt = now;

    const fpsDisplay = this.#element?.querySelector("[data-fps-display]");
    if (fpsDisplay) {
      fpsDisplay.textContent = `FPS ${this.#fps.display}`;
    }

    if (now - this.#lastTelemetrySampleAt >= 1000) {
      this.#lastTelemetrySampleAt = now;
      this.#telemetry.recordPerformanceSample({
        fps: this.#fps.display,
        wave: this.#wave,
        activeRaiders: this.#raiders.length,
        activeEffects: this.#effects.length,
        towerCount: this.#towers.length,
        resources: this.#resources,
        zoom: this.#camera.scale,
        visibleRaiders: this.#countVisibleRaiders(),
        visibleTowers: this.#countVisibleTowers()
      });
    }
  }

  #shouldAnimateRoadFlow(now) {
    return Boolean(
      this.#road?.cells?.length &&
      !this.#gameOver &&
      now - this.#lastRoadFlowDrawAt >= ROAD_FLOW_IDLE_FRAME_INTERVAL_MS
    );
  }

  #countVisibleTowers() {
    if (!this.#towers.length) return 0;
    const visible = this.#getVisibleWorldRect(CELL_SIZE * 4);
    return this.#towers.reduce((count, tower) => (
      count + (this.#rectsIntersect(visible, this.#getTowerFootprintRect(tower)) ? 1 : 0)
    ), 0);
  }

  #countVisibleRaiders() {
    if (!this.#raiders.length) return 0;
    const visible = this.#getVisibleWorldRect(CELL_SIZE * 3);
    return this.#raiders.reduce((count, raider) => {
      const position = this.#getCachedRaiderPosition(raider);
      return count + (this.#pointInRect(position.x, position.y, visible) ? 1 : 0);
    }, 0);
  }

  #toggleTime() {
    if (this.#gameOver) return;

    if (!this.#waveStarted) {
      this.#startCurrentWave();
    }

    this.#running = !this.#running;
    const button = this.#element.querySelector(".time-toggle");
    button.dataset.running = String(this.#running);
    button.setAttribute("aria-label", this.#running ? "Pause time" : "Start time");
    this.#saveActiveRun();
    this.#requestDraw();
  }

  #endGame(context) {
    this.#finishRun({ victory: false, context });
  }

  #setGameSpeed(speed) {
    this.#gameSpeed = normalizeGameSpeed(speed);

    const slider = this.#element.querySelector("[data-speed-slider]");
    if (slider) {
      slider.value = String(getGameSpeedIndex(this.#gameSpeed));
    }
    this.#saveActiveRun();
    this.#requestDraw();
  }

  #resetRunState() {
    this.#playerHealth = PLAYER_MAX_HEALTH;
    this.#resources = STARTING_RESOURCES + getStartingResourceBonus(this.#saveService.getSnapshot().perks);
    this.#runCoins = 0;
    this.#coinYield = 0;
    this.#runGems = [];
    this.#runCrates = [];
    this.#runSettled = false;
    this.#wave = 1;
    this.#waveStarted = false;
    this.#waveElapsed = 0;
    this.#waveFactoryInterval = 30;
    this.#spawning = false;
    this.#spawnQueue = [];
    this.#spawnTimer = 0;
    this.#raiders = [];
    this.#nextRaiderId = 1;
    this.#gameOver = false;
    this.#selectedArea = null;
    this.#selectedTower = null;
    this.#towers = [];
    this.#nextTowerId = 1;
    this.#effects = [];
    this.#lastRunSaveAt = 0;
    this.#startTelemetryRun();
    this.#closeTowerPopup();
    this.#syncRunHud();
  }

  #restoreRunState(run) {
    this.#playerHealth = clamp(run.playerHealth, 0, PLAYER_MAX_HEALTH);
    this.#resources = Math.max(0, run.resources);
    this.#runCoins = run.runCoins || 0;
    this.#coinYield = Math.max(0, Math.round(Number(run.coinYield) || 0));
    this.#runGems = [...(run.runGems || [])];
    this.#runCrates = [...(run.runCrates || [])];
    this.#runSettled = false;
    this.#wave = clamp(Math.round(run.wave || 1), 1, this.#getWaveCount());
    this.#waveStarted = Boolean(run.waveStarted);
    this.#waveElapsed = Math.max(0, Number(run.waveElapsed) || 0);
    this.#waveFactoryInterval = Math.max(0.1, Number(run.waveFactoryInterval) || 30);
    this.#spawning = Boolean(run.spawning);
    this.#spawnQueue = [...(run.spawnQueue || [])];
    this.#spawnTimer = Number(run.spawnTimer) || 0;
    this.#raiders = [...(run.raiders || [])];
    this.#nextRaiderId = Math.max(1, Math.round(run.nextRaiderId || 1));
    this.#gameOver = false;
    this.#selectedArea = null;
    this.#selectedTower = null;
    this.#towers = [...(run.towers || [])];
    this.#nextTowerId = Math.max(1, Math.round(run.nextTowerId || 1));
    this.#running = Boolean(run.running);
    this.#time = Math.max(0, Number(run.time) || 0);
    this.#gameSpeed = normalizeGameSpeed(run.gameSpeed);
    this.#effects = [];
    this.#lastRunSaveAt = performance.now();
    this.#startTelemetryRun();
    this.#closeTowerPopup();
    this.#syncRunHud();
  }

  #startTelemetryRun() {
    this.#telemetry = new RunTelemetry();
    this.#lastTelemetrySampleAt = performance.now();
    this.#telemetry.startRun({
      level: this.#level,
      waveCount: this.#getWaveCount(),
      startingResources: this.#resources,
      gameSpeed: this.#gameSpeed,
      perks: this.#saveService.getSnapshot().perks
    });
  }

  #autosaveRun(now = performance.now()) {
    if (now - this.#lastRunSaveAt < RUN_AUTOSAVE_INTERVAL_MS) return;
    this.#saveActiveRun(now);
  }

  #saveActiveRun(now = performance.now()) {
    if (this.#runSettled || this.#gameOver) return;

    this.#lastRunSaveAt = now;
    this.#saveService.saveActiveRun({
      schemaVersion: 1,
      savedAt: Date.now(),
      level: this.#level,
      activeRunLevel: this.#activeRunLevel,
      playerHealth: this.#playerHealth,
      resources: this.#resources,
      wave: this.#wave,
      waveStarted: this.#waveStarted,
      waveElapsed: this.#waveElapsed,
      waveFactoryInterval: this.#waveFactoryInterval,
      spawning: this.#spawning,
      spawnQueue: this.#spawnQueue.map((entry) => ({ ...entry })),
      spawnTimer: this.#spawnTimer,
      raiders: this.#raiders.map((raider) => ({ ...raider })),
      nextRaiderId: this.#nextRaiderId,
      towers: this.#towers.map((tower) => ({ ...tower })),
      nextTowerId: this.#nextTowerId,
      runCoins: this.#runCoins,
      coinYield: this.#coinYield,
      runGems: [...this.#runGems],
      runCrates: [...this.#runCrates],
      running: this.#running,
      time: this.#time,
      gameSpeed: this.#gameSpeed
    });
  }

  #startCurrentWave() {
    this.#waveStarted = true;
    this.#spawning = true;
    this.#spawnQueue = this.#buildWaveQueue(this.#wave);
    this.#telemetry.recordWaveStart({ wave: this.#wave, queue: this.#spawnQueue });
    this.#spawnTimer = 0;
    this.#waveElapsed = 0;
    this.#waveFactoryInterval = Math.max(0.1, this.#estimateWaveDuration(this.#spawnQueue) / FACTORY_ACTIVATIONS_PER_WAVE);
    this.#resetFactoriesForWave();
    this.#syncRunHud();
    this.#saveActiveRun();
  }

  #buildWaveQueue(wave) {
    const definition = this.#getWaveDefinition(wave);
    return this.#spreadWaveEntries(definition).map((entry) => ({
      type: entry.type,
      rarity: entry.rarity,
      spawnInterval: this.#getSpawnInterval(entry.type, entry.rarity)
    }));
  }

  #spreadWaveEntries(entries) {
    const groups = entries.map((entry) => ({
      type: entry.type,
      rarity: entry.rarity,
      total: entry.count,
      remaining: entry.count,
      emitted: 0
    }));
    const queue = [];
    const totalCount = groups.reduce((sum, group) => sum + group.total, 0);

    for (let i = 0; i < totalCount; i++) {
      const next = groups
        .filter((group) => group.remaining > 0)
        .sort((a, b) => (a.emitted / a.total) - (b.emitted / b.total))[0];

      queue.push({ type: next.type, rarity: next.rarity });
      next.remaining--;
      next.emitted++;
    }

    return queue;
  }

  #getSpawnInterval(type, rarity) {
    return (RAIDER_SPAWN_INTERVALS[type]?.[rarity] ?? WAVE_SPAWN_INTERVAL) * WAVE_SPAWN_SPACING_MULTIPLIER;
  }

  #getWaveCount() {
    return this.#level <= 20 ? this.#level * 5 : MAX_AUTHORED_WAVE_COUNT;
  }

  #getWaveDefinition(wave) {
    return WAVE_DEFINITIONS[wave]
      || [{ type: "walker", rarity: "common", count: Math.min(50, wave * 10) }];
  }

  #generateMapFlavor() {
    this.#levelDefinition = getTierOneLevel(this.#level);
    if (this.#levelDefinition) {
      this.#flavor = createFlavorFromLevel(this.#levelDefinition);
      this.#road = createRoadFromLevel(this.#levelDefinition);
      this.#tiles = createTilesFromLevel(this.#levelDefinition);
      return;
    }

    const gridSize = this.#gridWidth();
    this.#flavor = this.#flavorManager.getFlavor({
      tier: 1,
      level: this.#level,
      gridSize,
      seedOffset: this.#rerollIndex
    });
    this.#road = this.#roadGenerator.generate({
      gridSize,
      obstacles: this.#flavor.elements,
      seed: 20000 + this.#level * 131 + this.#rerollIndex * 7919
    });
    this.#tiles = createTilesFromLevel({
      level: this.#level,
      dimensions: { width: this.#gridWidth(), height: this.#gridHeight() },
      generator: { seed: 20000 + this.#level * 131 + this.#rerollIndex * 7919 },
      elements: this.#flavor.elements,
      road: this.#road
    });
  }

  #handlePointerDown = (event) => {
    this.#canvas.setPointerCapture(event.pointerId);
    this.#tap.active = true;
    this.#tap.startX = event.clientX;
    this.#tap.startY = event.clientY;
    this.#tap.moved = false;
    this.#pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      previousX: event.clientX,
      previousY: event.clientY
    });

    if (this.#pointers.size === 2) {
      this.#lastPinchDistance = this.#getPinchDistance();
    }
  };

  #handlePointerMove = (event) => {
    const pointer = this.#pointers.get(event.pointerId);
    if (!pointer) return;

    const totalMove = Math.hypot(event.clientX - this.#tap.startX, event.clientY - this.#tap.startY);
    if (totalMove > 8) {
      this.#tap.moved = true;
    }

    pointer.previousX = pointer.x;
    pointer.previousY = pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (this.#pointers.size === 1) {
      this.#camera.x += pointer.x - pointer.previousX;
      this.#camera.y += pointer.y - pointer.previousY;
      this.#clampCamera();
      this.#requestDraw();
      return;
    }

    if (this.#pointers.size === 2) {
      const distance = this.#getPinchDistance();
      if (this.#lastPinchDistance > 0) {
        const center = this.#getPinchCenter();
        this.#zoomAt(center.x, center.y, distance / this.#lastPinchDistance);
      }

      this.#lastPinchDistance = distance;
      this.#requestDraw();
    }
  };

  #handlePointerEnd = (event) => {
    const moved = Math.hypot(event.clientX - this.#tap.startX, event.clientY - this.#tap.startY);
    const cleanTap = this.#tap.active && !this.#tap.moved && moved <= 8 && this.#pointers.size === 1;

    this.#pointers.delete(event.pointerId);
    this.#lastPinchDistance = this.#pointers.size === 2 ? this.#getPinchDistance() : 0;
    this.#tap.active = false;

    if (cleanTap) {
      this.#handleMapTap(event.clientX, event.clientY);
      this.#requestDraw();
    }
  };

  #handleWheel = (event) => {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    this.#zoomAt(event.clientX, event.clientY, zoomFactor);
  };

  #handleKeyDown = (event) => {
    const consoleInput = this.#element?.querySelector("[data-developer-console-input]");
    const consoleOpen = this.#element?.querySelector("[data-developer-console]")?.classList.contains("active");

    if (event.key === "`" || event.key === "~") {
      event.preventDefault();
      this.#toggleDeveloperConsole();
      return;
    }

    if (consoleOpen && event.key === "Escape") {
      event.preventDefault();
      this.#closeDeveloperConsole();
      return;
    }

    if (event.target === consoleInput) return;
    if (event.key !== "1" || event.repeat || this.#gameOver) return;

    this.#spawnRaider("jet", "common");
    this.#saveActiveRun();
    this.#requestDraw();
  };

  #toggleDeveloperConsole() {
    const consoleElement = this.#element?.querySelector("[data-developer-console]");
    if (!consoleElement) return;

    if (consoleElement.classList.contains("active")) {
      this.#closeDeveloperConsole();
    } else {
      this.#openDeveloperConsole();
    }
  }

  #openDeveloperConsole() {
    const consoleElement = this.#element?.querySelector("[data-developer-console]");
    const input = this.#element?.querySelector("[data-developer-console-input]");
    if (!consoleElement || !input) return;

    consoleElement.classList.add("active");
    this.#refreshDeveloperSuggestions();
    requestAnimationFrame(() => input.focus());
  }

  #closeDeveloperConsole() {
    const consoleElement = this.#element?.querySelector("[data-developer-console]");
    const input = this.#element?.querySelector("[data-developer-console-input]");
    if (!consoleElement || !input) return;

    consoleElement.classList.remove("active");
    input.blur();
  }

  #submitDeveloperCommand() {
    const input = this.#element?.querySelector("[data-developer-console-input]");
    if (!input) return;

    const command = input.value.trim();
    if (!command) return;

    const [name, ...args] = command.split(/\s+/);
    const normalizedName = name.toLowerCase();

    if (normalizedName === "spawnraider") {
      this.#runSpawnRaiderCommand(args);
    } else if (normalizedName === "setresources") {
      this.#runSetResourcesCommand(args);
    } else if (normalizedName === "giveitem") {
      this.#runGiveItemCommand(args);
    } else if (normalizedName === "telemetry") {
      this.#runTelemetryCommand();
    } else if (normalizedName === "copytelemetry") {
      this.#runCopyTelemetryCommand();
    } else {
      this.#setDeveloperConsoleStatus(`Unknown command: ${name}`, false);
      return;
    }

    input.value = "";
    this.#refreshDeveloperSuggestions();
  }

  #runSpawnRaiderCommand(args) {
    const type = args[0]?.toLowerCase();
    if (!type || !RAIDER_TYPES[type]) {
      this.#setDeveloperConsoleStatus(`Use: spawnraider ${Object.keys(RAIDER_TYPES).join("|")}`, false);
      return;
    }

    this.#spawnRaider(type, "common");
    this.#setDeveloperConsoleStatus(`Spawned ${RAIDER_TYPES[type].label}`, true);
    this.#saveActiveRun();
    this.#requestDraw();
  }

  #runSetResourcesCommand(args) {
    const amount = Number(args[0]);
    if (!Number.isInteger(amount) || amount < 0) {
      this.#setDeveloperConsoleStatus("Use: setresources <int>", false);
      return;
    }

    this.#resources = amount;
    this.#setDeveloperConsoleStatus(`Resources set to ${amount}`, true);
    this.#syncRunHud();
    this.#saveActiveRun();
    this.#requestDraw();
  }

  #runGiveItemCommand(args) {
    const item = args[0]?.toLowerCase();
    if (!item) {
      this.#setDeveloperConsoleStatus(`Use: giveitem ${GIVE_ITEM_SUGGESTIONS.join("|")}`, false);
      return;
    }

    if (item === "singularity" || item === "singularities") {
      this.#saveService.addSingularities(1);
      this.#setDeveloperConsoleStatus("Added 1 Singularity", true);
      return;
    }

    const crateId = item === "copper" || item === "coppercrate" || item === "bronze" || item === "bronzecrate"
      ? "bronze"
      : item === "silver" || item === "silvercrate"
        ? "silver"
        : item === "gold" || item === "goldcrate"
          ? "gold"
          : "";

    if (crateId) {
      this.#saveService.addCrates([crateId]);
      this.#setDeveloperConsoleStatus(`Added 1 ${crateId === "bronze" ? "Copper" : crateId} crate`, true);
      return;
    }

    this.#setDeveloperConsoleStatus(`Unknown item: ${item}`, false);
  }

  #runTelemetryCommand() {
    enableTelemetry();

    if (downloadLatestTelemetryRun()) {
      this.#setDeveloperConsoleStatus("Downloaded latest telemetry JSON", true);
    } else {
      this.#setDeveloperConsoleStatus("Telemetry enabled. Finish a run first.", false);
    }
  }

  async #runCopyTelemetryCommand() {
    enableTelemetry();

    try {
      if (await copyLatestTelemetryRun()) {
        this.#setDeveloperConsoleStatus("Copied latest telemetry JSON", true);
      } else {
        this.#setDeveloperConsoleStatus("Telemetry enabled. Finish a run first.", false);
      }
    } catch {
      this.#setDeveloperConsoleStatus("Clipboard copy blocked by browser", false);
    }
  }

  #refreshDeveloperSuggestions() {
    const input = this.#element?.querySelector("[data-developer-console-input]");
    const datalist = this.#element?.querySelector("[data-developer-console-suggestions]");
    if (!input || !datalist) return;

    const value = input.value.trim().toLowerCase();
    const [name] = value.split(/\s+/);
    const suggestions = name === "spawnraider" || value.startsWith("spawnraider ")
      ? Object.keys(RAIDER_TYPES).map((type) => `spawnraider ${type}`)
      : name === "giveitem" || value.startsWith("giveitem ")
        ? GIVE_ITEM_SUGGESTIONS.map((item) => `giveitem ${item}`)
        : [
          ...DEVELOPER_COMMANDS,
          ...Object.keys(RAIDER_TYPES).map((type) => `spawnraider ${type}`),
          "setresources 100",
          ...GIVE_ITEM_SUGGESTIONS.map((item) => `giveitem ${item}`)
        ];

    datalist.innerHTML = suggestions
      .filter((suggestion) => suggestion.startsWith(value))
      .map((suggestion) => `<option value="${suggestion}"></option>`)
      .join("");
  }

  #setDeveloperConsoleStatus(message, success) {
    const status = this.#element?.querySelector("[data-developer-console-status]");
    if (!status) return;

    status.textContent = message;
    status.dataset.tone = success ? "success" : "error";
  }

  #zoomAt(clientX, clientY, factor) {
    const previousScale = this.#camera.scale;
    const nextScale = clamp(previousScale * factor, MIN_ZOOM, MAX_ZOOM);
    const worldX = (clientX - this.#camera.x) / previousScale;
    const worldY = (clientY - this.#camera.y) / previousScale;

    this.#camera.scale = nextScale;
    this.#camera.x = clientX - worldX * nextScale;
    this.#camera.y = clientY - worldY * nextScale;
    this.#clampCamera();
    this.#requestDraw();
  }

  #draw() {
    if (!this.#ctx) return;
    this.#needsDraw = false;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const worldSize = this.#worldSize();

    this.#ctx.clearRect(0, 0, width, height);
    this.#ctx.fillStyle = "#02050a";
    this.#ctx.fillRect(0, 0, width, height);

    this.#ctx.save();
    this.#ctx.translate(this.#camera.x, this.#camera.y);
    this.#ctx.scale(this.#camera.scale, this.#camera.scale);

    this.#measureDrawSection("static_layer", () => this.#drawStaticLayer(worldSize));
    this.#measureDrawSection("tower_footprint_masks", () => this.#drawOccupiedTowerFootprintMasks());
    this.#measureDrawSection("road_flow", () => this.#drawRoadFlow());
    this.#measureDrawSection("tower_ranges", () => this.#drawTowerRanges());
    this.#measureDrawSection("placement_selection", () => this.#drawPlacementSelection());
    this.#measureDrawSection("tower_sprites", () => this.#drawTowers());
    this.#measureDrawSection("raiders", () => this.#drawRaiders());
    this.#measureDrawSection("effects", () => this.#drawEffects());
    this.#measureDrawSection("map_health_bars", () => this.#drawMapHealthBars(worldSize));
    this.#measureDrawSection("edge_fire", () => this.#drawEdgeGradient(worldSize, this.#time));

    this.#ctx.restore();
  }

  #measureDrawSection(name, draw) {
    if (!this.#telemetry.enabled) return draw();

    const startedAt = performance.now();
    const metadata = draw() || {};
    this.#telemetry.recordRenderSection(name, performance.now() - startedAt, {
      zoom: this.#camera.scale,
      ...metadata
    });
    return metadata;
  }

  #markStaticLayerDirty() {
    this.#staticLayerDirty = true;
    this.#requestDraw();
  }

  #drawStaticLayer(worldSize) {
    if (!this.#staticLayerCanvas || this.#staticLayerCanvas.width !== worldSize || this.#staticLayerCanvas.height !== worldSize) {
      this.#staticLayerCanvas = document.createElement("canvas");
      this.#staticLayerCanvas.width = worldSize;
      this.#staticLayerCanvas.height = worldSize;
      this.#staticLayerCtx = this.#staticLayerCanvas.getContext("2d");
      this.#staticLayerDirty = true;
    }

    if (this.#staticLayerDirty) {
      const liveCtx = this.#ctx;
      this.#ctx = this.#staticLayerCtx;
      this.#ctx.clearRect(0, 0, worldSize, worldSize);
      this.#drawGridBase(worldSize);
      this.#drawGridLines(worldSize);
      this.#drawRoad(false);
      this.#drawTiles();
      this.#drawFlavorElements();
      this.#ctx = liveCtx;
      this.#staticLayerDirty = false;
    }

    const visible = this.#getVisibleWorldRect(CELL_SIZE * 2);
    const sourceX = Math.floor(clamp(visible.x, 0, worldSize));
    const sourceY = Math.floor(clamp(visible.y, 0, worldSize));
    const sourceRight = Math.ceil(clamp(visible.x + visible.width, 0, worldSize));
    const sourceBottom = Math.ceil(clamp(visible.y + visible.height, 0, worldSize));
    const sourceWidth = Math.max(1, sourceRight - sourceX);
    const sourceHeight = Math.max(1, sourceBottom - sourceY);

    this.#ctx.drawImage(
      this.#staticLayerCanvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight
    );
  }

  #drawGridBase(worldSize) {
    this.#ctx.fillStyle = "#050b12";
    this.#ctx.fillRect(0, 0, worldSize, worldSize);
  }

  #drawGridLines(worldSize) {
    this.#ctx.strokeStyle = "rgba(170, 244, 255, 0.14)";
    this.#ctx.lineWidth = 1;

    for (let i = 0; i <= this.#gridWidth(); i++) {
      const pos = i * CELL_SIZE;

      this.#ctx.beginPath();
      this.#ctx.moveTo(pos, 0);
      this.#ctx.lineTo(pos, this.#worldHeight());
      this.#ctx.stroke();
    }

    for (let i = 0; i <= this.#gridHeight(); i++) {
      const pos = i * CELL_SIZE;
      this.#ctx.beginPath();
      this.#ctx.moveTo(0, pos);
      this.#ctx.lineTo(this.#worldWidth(), pos);
      this.#ctx.stroke();
    }
  }

  #drawFlavorElements() {
    if (!this.#flavor) return;

    for (const element of this.#flavor.elements) {
      this.#drawFlavorElement(element);
    }
  }

  #drawRoad(includeFlow = true) {
    if (!this.#road?.cells?.length) return;

    this.#ctx.save();
    this.#ctx.lineCap = "butt";
    this.#ctx.lineJoin = "miter";

    this.#ctx.strokeStyle = "rgba(166, 241, 255, 0.28)";
    this.#ctx.lineWidth = CELL_SIZE * 0.72;
    this.#strokeRoadPath();

    this.#ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    this.#ctx.lineWidth = 1.5;
    this.#strokeRoadPath();

    if (includeFlow) {
      this.#drawRoadFlow();
    }
    this.#ctx.restore();
  }

  #drawTiles() {
    if (!this.#tiles.length) return;

    this.#ctx.save();
    this.#ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
    this.#ctx.lineWidth = 1.8;
    this.#ctx.shadowColor = "rgba(255, 255, 255, 0.18)";
    this.#ctx.shadowBlur = 8;

    for (const tile of this.#tiles) {
      const x = tile.x * CELL_SIZE;
      const y = tile.y * CELL_SIZE;
      const width = tile.width * CELL_SIZE;
      const height = tile.height * CELL_SIZE;

      this.#ctx.strokeRect(x + 3, y + 3, width - 6, height - 6);
      this.#ctx.save();
      this.#ctx.shadowBlur = 0;
      this.#ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
      this.#ctx.beginPath();
      this.#ctx.moveTo(x + CELL_SIZE, y + 5);
      this.#ctx.lineTo(x + CELL_SIZE, y + height - 5);
      this.#ctx.moveTo(x + 5, y + CELL_SIZE);
      this.#ctx.lineTo(x + width - 5, y + CELL_SIZE);
      this.#ctx.stroke();
      this.#ctx.restore();
    }

    this.#ctx.restore();
  }

  #strokeRoadPath() {
    const cells = this.#getRoadDrawCells();

    this.#ctx.beginPath();
    cells.forEach((cell, index) => {
      const x = cell.x * CELL_SIZE + CELL_SIZE / 2;
      const y = cell.y * CELL_SIZE + CELL_SIZE / 2;
      if (index === 0) this.#ctx.moveTo(x, y);
      else this.#ctx.lineTo(x, y);
    });
    this.#ctx.stroke();
  }

  #getRoadDrawCells() {
    const cells = this.#road.cells;
    if (cells.length < 2) return cells;

    const first = cells[0];
    const second = cells[1];
    const last = cells[cells.length - 1];
    const beforeLast = cells[cells.length - 2];

    return [
      {
        x: first.x + (first.x - second.x),
        y: first.y + (first.y - second.y)
      },
      ...cells,
      {
        x: last.x + (last.x - beforeLast.x),
        y: last.y + (last.y - beforeLast.y)
      }
    ];
  }

  #drawRoadFlow() {
    if (!this.#road?.cells?.length) return { rendered: 0, skipped: 1 };
    const offset = (performance.now() * 0.028) % (CELL_SIZE * 1.8);

    this.#ctx.save();
    this.#ctx.setLineDash([CELL_SIZE * 0.32, CELL_SIZE * 1.5]);
    this.#ctx.lineDashOffset = -offset;
    this.#ctx.strokeStyle = "rgba(224, 252, 255, 0.34)";
    this.#ctx.lineWidth = CELL_SIZE * 0.28;
    this.#strokeRoadPath();
    this.#ctx.restore();
    return { rendered: 1, skipped: 0 };
  }

  #drawPlacementSelection() {
    if (!this.#selectedArea) return { rendered: 0, skipped: 1 };

    const rect = this.#getAreaDrawRect(this.#selectedArea);
    const color = this.#selectedArea.valid
      ? "rgba(255, 255, 255, 0.9)"
      : "rgba(255, 101, 116, 0.95)";

    this.#ctx.save();
    this.#ctx.fillStyle = this.#selectedArea.valid
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(255, 101, 116, 0.13)";
    this.#ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    this.#ctx.strokeStyle = color;
    this.#ctx.lineWidth = 2;
    this.#ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    this.#ctx.restore();
    return { rendered: 1, skipped: 0 };
  }

  #drawTowerRanges() {
    const tower = this.#selectedTower;
    const area = this.#selectedArea;

    if (tower) {
      const center = this.#getTowerCenter(tower);
      const stats = this.#getEffectiveTowerStats(tower);
      if (stats.rangeCells <= 0) return { rendered: 0, skipped: 1 };
      this.#drawRangeCircle(center.x, center.y, stats.rangeCells * CELL_SIZE, RARITY_COLORS[tower.rarity]);
      return { rendered: 1, skipped: 0 };
    } else if (area?.valid) {
      const tower = this.#getFirstPlaceableTower();
      if (!tower) return { rendered: 0, skipped: 1 };
      const rect = this.#getAreaDrawRect(area);
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      this.#drawRangeCircle(center.x, center.y, tower.rarities.common.rangeCells * CELL_SIZE, "rgba(255, 255, 255, 0.92)");
      return { rendered: 1, skipped: 0 };
    }
    return { rendered: 0, skipped: 1 };
  }

  #drawRangeCircle(x, y, range, color) {
    const gradient = this.#ctx.createRadialGradient(x, y, 0, x, y, range);
    gradient.addColorStop(0, withAlpha(color, 0.1));
    gradient.addColorStop(0.78, withAlpha(color, 0.045));
    gradient.addColorStop(1, withAlpha(color, 0));

    this.#ctx.save();
    this.#ctx.fillStyle = gradient;
    this.#ctx.beginPath();
    this.#ctx.arc(x, y, range, 0, Math.PI * 2);
    this.#ctx.fill();
    this.#ctx.strokeStyle = withAlpha(color, 0.28);
    this.#ctx.lineWidth = 1.5;
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #drawTowers() {
    const visible = this.#getVisibleWorldRect(CELL_SIZE * 4);
    let rendered = 0;
    let skipped = 0;

    for (const tower of this.#towers) {
      const definition = TOWER_DEFINITIONS[tower.type];
      const footprint = getTowerFootprint(definition);
      const center = this.#getTowerCenter(tower);
      const assetKey = getTowerDrawAssetKey(definition, tower);
      const image = this.#assets.get(assetKey);
      const surfaceRect = this.#getTowerSurfaceRect(tower);
      const outline = this.#getTowerFootprintRect(tower);
      if (!this.#rectsIntersect(visible, outline)) {
        skipped++;
        continue;
      }
      rendered++;

      const size = surfaceRect
        ? Math.min(surfaceRect.width, surfaceRect.height) * 1.05
        : CELL_SIZE * footprint * 1.12;

      this.#ctx.save();
      this.#ctx.translate(center.x, center.y);
      this.#ctx.rotate(tower.angle + getTowerAssetRotationOffset(tower.type));
      this.#ctx.globalCompositeOperation = "lighter";

      if (image?.complete && image.naturalWidth > 0) {
        this.#ctx.drawImage(image, -size / 2, -size / 2, size, size);
      } else {
        this.#ctx.strokeStyle = RARITY_COLORS[tower.rarity];
        this.#ctx.lineWidth = 3;
        this.#ctx.strokeRect(-CELL_SIZE * 0.6, -CELL_SIZE * 0.6, CELL_SIZE * 1.2, CELL_SIZE * 1.2);
        this.#ctx.beginPath();
        this.#ctx.moveTo(0, 0);
        this.#ctx.lineTo(CELL_SIZE, 0);
        this.#ctx.stroke();
      }

      this.#ctx.restore();

      this.#ctx.save();
      this.#ctx.strokeStyle = this.#selectedTower === tower ? RARITY_COLORS[tower.rarity] : "rgba(255, 255, 255, 0.22)";
      this.#ctx.lineWidth = this.#selectedTower === tower ? 2.5 : 1;
      this.#ctx.strokeRect(outline.x + 2, outline.y + 2, outline.width - 4, outline.height - 4);
      this.#ctx.restore();
    }
    return { rendered, skipped };
  }

  #drawOccupiedTowerFootprintMasks() {
    if (!this.#towers.length) return { rendered: 0, skipped: 0 };

    const visible = this.#getVisibleWorldRect(CELL_SIZE);
    let rendered = 0;
    let skipped = 0;
    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "source-over";
    for (const tower of this.#towers) {
      const rect = this.#getTowerFootprintRect(tower);
      if (!this.#rectsIntersect(visible, rect)) {
        skipped++;
        continue;
      }
      const inset = 4;
      const fillWidth = Math.max(0, rect.width - inset * 2);
      const fillHeight = Math.max(0, rect.height - inset * 2);
      if (fillWidth <= 0 || fillHeight <= 0) continue;

      this.#ctx.fillStyle = tower.surface === "monolith"
        ? "rgb(61, 67, 80)"
        : "#050b12";
      this.#ctx.fillRect(rect.x + inset, rect.y + inset, fillWidth, fillHeight);
      rendered++;
    }
    this.#ctx.restore();
    return { rendered, skipped };
  }

  #getTowerFootprintRect(tower) {
    const surfaceRect = this.#getTowerSurfaceRect(tower);
    if (surfaceRect) return surfaceRect;

    const definition = TOWER_DEFINITIONS[tower.type];
    const footprint = getTowerFootprint(definition);
    return {
      x: tower.x * CELL_SIZE,
      y: tower.y * CELL_SIZE,
      width: CELL_SIZE * footprint,
      height: CELL_SIZE * footprint
    };
  }

  #drawEffects() {
    const now = performance.now();
    const visible = this.#getVisibleWorldRect(CELL_SIZE * 6);
    let rendered = 0;
    let skipped = 0;
    this.#effects = this.#effects.filter((effect) => {
      if (effect.done) return false;
      if (effect.type === "missile") return true;
      return now - effect.startedAt < effect.duration;
    });
    if (this.#effects.length > MAX_ACTIVE_EFFECTS) {
      this.#effects.splice(0, this.#effects.length - MAX_ACTIVE_EFFECTS);
    }

    for (const effect of this.#effects) {
      if (!this.#effectIntersectsVisibleRect(effect, visible)) {
        skipped++;
        continue;
      }
      const progress = effect.type === "missile"
        ? clamp(effect.elapsed / effect.durationSeconds, 0, 1)
        : clamp((now - effect.startedAt) / effect.duration, 0, 1);
      const effectSection = this.#getEffectTelemetrySection(effect);
      const startedAt = this.#telemetry.enabled ? performance.now() : 0;

      if (effect.type === "projectile") {
        this.#drawProjectileEffect(effect, progress);
      } else if (effect.type === "rail-beam") {
        this.#drawRailBeamEffect(effect, progress);
      } else if (effect.type === "electric-arc") {
        this.#drawElectricArcEffect(effect, progress);
      } else if (effect.type === "missile") {
        this.#drawMissileEffect(effect, progress);
      } else if (effect.type === "muzzle") {
        this.#drawMuzzleEffect(effect, progress);
      } else if (effect.type === "explosion") {
        this.#drawExplosionEffect(effect, progress);
      } else if (effect.type === "airburst-bomb") {
        this.#drawAirburstBombEffect(effect, progress);
      } else if (effect.type === "factory-beam") {
        this.#drawFactoryBeamEffect(effect, progress);
      } else if (effect.type === "radar-pulse") {
        this.#drawRadarPulseEffect(effect, progress);
      } else if (effect.type === "tower-upgrade-reveal") {
        this.#drawTowerUpgradeRevealEffect(effect, progress);
      } else if (effect.type === "tower-research-bloom") {
        this.#drawTowerResearchBloomEffect(effect, progress);
      }

      rendered++;
      if (this.#telemetry.enabled) {
        this.#telemetry.recordRenderSection(effectSection, performance.now() - startedAt, {
          zoom: this.#camera.scale,
          rendered: 1,
          skipped: 0
        });
      }
    }

    return { rendered, skipped };
  }

  #getEffectTelemetrySection(effect) {
    if (effect.type === "tower-upgrade-reveal") return `effect:upgrade:${effect.rarity || "unknown"}`;
    if (effect.type === "tower-research-bloom") return "effect:tower-research-bloom";
    if (effect.type === "rail-beam") return "effect:rail-beam";
    if (effect.type === "electric-arc") return "effect:electric-arc";
    if (effect.type === "projectile") return `effect:projectile:${effect.towerType || "tower"}`;
    return `effect:${effect.type}`;
  }

  #drawProjectileEffect(effect, progress) {
    const eased = 1 - Math.pow(1 - progress, 3);
    const x = effect.from.x + (effect.to.x - effect.from.x) * eased;
    const y = effect.from.y + (effect.to.y - effect.from.y) * eased;

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.strokeStyle = effect.color;
    this.#ctx.lineWidth = effect.research === "high_caliber" ? 3.2 : effect.towerType === "cannon" ? 4 : 1.6;
    this.#ctx.shadowColor = effect.color;
    this.#ctx.shadowBlur = effect.towerType === "cannon" ? 10 : 4;
    this.#ctx.beginPath();
    this.#ctx.moveTo(effect.from.x + (x - effect.from.x) * 0.62, effect.from.y + (y - effect.from.y) * 0.62);
    this.#ctx.lineTo(x, y);
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #drawMuzzleEffect(effect, progress) {
    const radius = CELL_SIZE * (0.32 + progress * 0.55);
    const alpha = 1 - progress;

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.fillStyle = withAlpha(effect.color, alpha * 0.52);
    this.#ctx.shadowColor = effect.color;
    this.#ctx.shadowBlur = 8;
    this.#ctx.beginPath();
    this.#ctx.arc(effect.x, effect.y, radius, 0, TAU);
    this.#ctx.fill();
    this.#ctx.restore();
  }

  #drawExplosionEffect(effect, progress) {
    const radius = CELL_SIZE * (0.2 + progress * 1.15);
    const alpha = 1 - progress;

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.strokeStyle = withAlpha(effect.color, alpha * 0.85);
    this.#ctx.fillStyle = withAlpha(effect.color, alpha * 0.14);
    this.#ctx.lineWidth = 3;
    this.#ctx.shadowColor = effect.color;
    this.#ctx.shadowBlur = 8;
    this.#ctx.beginPath();
    this.#ctx.arc(effect.x, effect.y, radius, 0, TAU);
    this.#ctx.fill();
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #drawMissileEffect(effect, progress) {
    const target = this.#getRaiderById(effect.targetId);
    const to = target ? this.#getCachedRaiderPosition(target) : effect.lastTargetPosition;
    const eased = progress < 1 ? 1 - Math.pow(1 - progress, 2.4) : 1;
    const x = effect.from.x + (to.x - effect.from.x) * eased;
    const y = effect.from.y + (to.y - effect.from.y) * eased;
    const angle = Math.atan2(to.y - effect.from.y, to.x - effect.from.x) + Math.PI / 2;
    const image = this.#assets.get(getRarityAssetName(effect.asset, effect.rarity));
    const size = CELL_SIZE * 0.52;

    effect.lastTargetPosition = { x: to.x, y: to.y };

    this.#ctx.save();
    this.#ctx.translate(x, y);
    this.#ctx.rotate(angle);
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.shadowColor = effect.color;
    this.#ctx.shadowBlur = 6;

    if (image?.complete && image.naturalWidth > 0) {
      this.#ctx.drawImage(image, -size / 2, -size / 2, size, size);
    } else {
      this.#ctx.strokeStyle = effect.color;
      this.#ctx.lineWidth = 2;
      this.#ctx.beginPath();
      this.#ctx.moveTo(0, -size * 0.5);
      this.#ctx.lineTo(size * 0.2, size * 0.28);
      this.#ctx.lineTo(0, size * 0.5);
      this.#ctx.lineTo(-size * 0.2, size * 0.28);
      this.#ctx.closePath();
      this.#ctx.stroke();
    }

    this.#ctx.restore();
  }

  #drawFactoryBeamEffect(effect, progress) {
    const fade = Math.sin(progress * Math.PI);

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.strokeStyle = withAlpha(effect.color, 0.3 + fade * 0.7);
    this.#ctx.lineWidth = CELL_SIZE * (0.28 + fade * 0.24);
    this.#ctx.shadowColor = effect.color;
    this.#ctx.shadowBlur = 28;
    this.#ctx.beginPath();
    this.#ctx.moveTo(effect.x, effect.y);
    this.#ctx.lineTo(effect.x, -CELL_SIZE * 5);
    this.#ctx.stroke();

    this.#ctx.fillStyle = withAlpha(effect.color, 0.2 + fade * 0.42);
    this.#ctx.beginPath();
    this.#ctx.arc(effect.x, effect.y, CELL_SIZE * (0.36 + fade * 0.5), 0, TAU);
    this.#ctx.fill();
    this.#ctx.restore();
  }

  #drawRailBeamEffect(effect, progress) {
    const target = this.#getRaiderById(effect.targetId);
    const to = target ? this.#getCachedRaiderPosition(target) : effect.lastTargetPosition;
    if (!to) return;
    effect.lastTargetPosition = { x: to.x, y: to.y };
    const pulse = Math.sin(progress * Math.PI);
    const alpha = 0.34 + pulse * 0.66;
    const color = effect.shieldOnly ? "rgba(96, 172, 255, 0.98)" : effect.color;

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.lineCap = "round";
    this.#ctx.shadowColor = color;
    this.#ctx.shadowBlur = 18 + pulse * 16;
    this.#ctx.strokeStyle = withAlpha(color, alpha);
    this.#ctx.lineWidth = CELL_SIZE * (0.12 + pulse * 0.08);
    this.#ctx.beginPath();
    this.#ctx.moveTo(effect.from.x, effect.from.y);
    this.#ctx.lineTo(to.x, to.y);
    this.#ctx.stroke();

    this.#ctx.shadowBlur = 8;
    this.#ctx.strokeStyle = "rgba(224, 252, 255, 0.92)";
    this.#ctx.lineWidth = CELL_SIZE * 0.035;
    this.#ctx.beginPath();
    this.#ctx.moveTo(effect.from.x, effect.from.y);
    this.#ctx.lineTo(to.x, to.y);
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #drawElectricArcEffect(effect, progress) {
    const alpha = 1 - progress;
    const branches = Math.max(1, Math.round(effect.branches || 3));
    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.lineCap = "round";
    this.#ctx.strokeStyle = withAlpha(effect.color, alpha * 0.92);
    this.#ctx.lineWidth = CELL_SIZE * 0.055;
    this.#ctx.shadowColor = effect.color;
    this.#ctx.shadowBlur = 16;

    for (let branch = 0; branch < branches; branch++) {
      this.#ctx.beginPath();
      for (let step = 0; step <= 6; step++) {
        const t = step / 6;
        const x = effect.from.x + (effect.to.x - effect.from.x) * t;
        const y = effect.from.y + (effect.to.y - effect.from.y) * t;
        const jitter = Math.sin((branch + 1) * 7.31 + step * 2.17 + progress * 18) * CELL_SIZE * 0.16 * (1 - Math.abs(t - 0.5));
        const angle = Math.atan2(effect.to.y - effect.from.y, effect.to.x - effect.from.x) + Math.PI / 2;
        const px = x + Math.cos(angle) * jitter;
        const py = y + Math.sin(angle) * jitter;
        if (step === 0) this.#ctx.moveTo(px, py);
        else this.#ctx.lineTo(px, py);
      }
      this.#ctx.stroke();
    }

    this.#ctx.restore();
  }

  #drawTowerUpgradeRevealEffect(effect, progress) {
    if (effect.rarity === "common") {
      this.#drawUpgradeSmokeEffect(effect, progress);
    } else if (effect.rarity === "uncommon") {
      this.#drawUpgradeMatrixEffect(effect, progress);
    } else if (effect.rarity === "rare") {
      this.#drawUpgradeLightningEffect(effect, progress);
    } else if (effect.rarity === "epic") {
      this.#drawUpgradeShieldEffect(effect, progress);
    } else {
      this.#drawUpgradeTornadoEffect(effect, progress);
    }
  }

  #drawTowerResearchBloomEffect(effect, progress) {
    const pulse = Math.sin(progress * Math.PI);
    const fade = 1 - progress;
    const radius = effect.size * (0.48 + progress * 0.42);

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.strokeStyle = withAlpha(effect.color, fade * 0.95);
    this.#ctx.fillStyle = withAlpha(effect.color, pulse * 0.16);
    this.#ctx.lineWidth = 2 + pulse * 3;
    this.#ctx.shadowColor = effect.color;
    this.#ctx.shadowBlur = 18 + pulse * 24;
    this.#ctx.beginPath();
    this.#ctx.arc(effect.x, effect.y, radius, 0, TAU);
    this.#ctx.fill();
    this.#ctx.stroke();

    this.#ctx.strokeStyle = withAlpha(effect.color, fade * 0.55);
    this.#ctx.lineWidth = 1.5;
    for (let index = 0; index < 4; index++) {
      const angle = index * (TAU / 4) + progress * TAU * 0.18;
      const inner = effect.size * 0.18;
      const outer = effect.size * (0.56 + pulse * 0.16);
      this.#ctx.beginPath();
      this.#ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
      this.#ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
      this.#ctx.stroke();
    }
    this.#ctx.restore();
  }

  #drawUpgradeSmokeEffect(effect, progress) {
    const alpha = 1 - progress;
    const radiusBase = effect.size * (0.28 + progress * 0.42);

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "source-over";
    for (let index = 0; index < 10; index++) {
      const angle = index * 1.73;
      const distance = radiusBase * (0.22 + (index % 4) * 0.12);
      const radius = effect.size * (0.13 + ((index % 3) * 0.035)) * (1 + progress * 0.7);
      this.#ctx.fillStyle = `rgba(218, 230, 230, ${alpha * (0.12 + (index % 2) * 0.08)})`;
      this.#ctx.beginPath();
      this.#ctx.arc(
        effect.x + Math.cos(angle) * distance,
        effect.y + Math.sin(angle) * distance,
        radius,
        0,
        TAU
      );
      this.#ctx.fill();
    }
    this.#ctx.restore();
  }

  #drawUpgradeMatrixEffect(effect, progress) {
    const alpha = 1 - progress * 0.72;
    const columns = 7;
    const height = effect.size * 1.35;

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.fillStyle = `rgba(144, 222, 120, ${alpha})`;
    this.#ctx.font = `${Math.max(10, effect.size * 0.11)}px monospace`;
    this.#ctx.textAlign = "center";
    this.#ctx.textBaseline = "middle";
    for (let column = 0; column < columns; column++) {
      const x = effect.x - effect.size * 0.48 + (column / (columns - 1)) * effect.size * 0.96;
      const offset = (progress * height * 1.3 + column * 17) % height;
      for (let row = 0; row < 5; row++) {
        const y = effect.y - height / 2 + ((offset + row * effect.size * 0.22) % height);
        this.#ctx.globalAlpha = alpha * (1 - row * 0.13);
        this.#ctx.fillText((column + row + Math.floor(progress * 20)) % 2 === 0 ? "1" : "0", x, y);
      }
    }
    this.#ctx.restore();
  }

  #drawUpgradeLightningEffect(effect, progress) {
    const descent = clamp(progress / 0.72, 0, 1);
    const impact = clamp((progress - 0.62) / 0.38, 0, 1);
    const fade = 1 - progress * 0.72;
    const startY = effect.y - effect.size * 1.35;
    const endY = effect.y + effect.size * 0.08;
    const visibleEndY = startY + (endY - startY) * (1 - Math.pow(1 - descent, 2.2));
    const segments = 9;

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.strokeStyle = `rgba(96, 172, 255, ${0.35 + fade * 0.65})`;
    this.#ctx.lineWidth = 2.2 + (1 - progress) * 2.8;
    this.#ctx.shadowColor = "rgba(96, 172, 255, 0.95)";
    this.#ctx.shadowBlur = 18 + impact * 16;

    this.#ctx.beginPath();
    this.#ctx.moveTo(effect.x - effect.size * 0.22, startY);
    for (let step = 1; step <= segments; step++) {
      const t = step / segments;
      const y = startY + (visibleEndY - startY) * t;
      const bend = Math.sin((step * 2.41) + effect.x * 0.01) * effect.size * 0.16;
      const crawl = Math.sin(progress * TAU * 2 + step * 1.8) * effect.size * 0.035;
      const x = effect.x + bend * (1 - t * 0.18) + crawl;
      this.#ctx.lineTo(x, y);
    }
    this.#ctx.stroke();

    this.#ctx.lineWidth = 1.4;
    for (let branch = 0; branch < 4; branch++) {
      const branchStart = 0.18 + branch * 0.14;
      if (descent < branchStart) continue;
      const t = Math.min(0.92, branchStart + 0.08);
      const y = startY + (visibleEndY - startY) * t;
      const side = branch % 2 === 0 ? -1 : 1;
      const x = effect.x + Math.sin((branch + 1) * 2.7) * effect.size * 0.12;
      const length = effect.size * (0.18 + branch * 0.035);
      this.#ctx.beginPath();
      this.#ctx.moveTo(x, y);
      this.#ctx.lineTo(x + side * length, y + effect.size * (0.05 + branch * 0.02));
      this.#ctx.lineTo(x + side * length * 0.72, y + effect.size * (0.17 + branch * 0.03));
      this.#ctx.stroke();
    }

    if (impact > 0) {
      const ringRadius = effect.size * (0.2 + impact * 0.62);
      const alpha = 1 - impact;
      this.#ctx.strokeStyle = `rgba(96, 172, 255, ${alpha * 0.85})`;
      this.#ctx.lineWidth = 2.4;
      this.#ctx.beginPath();
      this.#ctx.arc(effect.x, effect.y, ringRadius, 0, TAU);
      this.#ctx.stroke();

      this.#ctx.fillStyle = `rgba(224, 252, 255, ${alpha * 0.34})`;
      this.#ctx.beginPath();
      this.#ctx.arc(effect.x, effect.y, effect.size * (0.16 + impact * 0.18), 0, TAU);
      this.#ctx.fill();
    }
    this.#ctx.restore();
  }

  #drawUpgradeShieldEffect(effect, progress) {
    const forming = progress < 0.38;
    const local = forming ? progress / 0.38 : (progress - 0.38) / 0.62;
    const radius = effect.size * (forming ? 0.34 + local * 0.24 : 0.58 + local * 0.34);
    const alpha = forming ? local : 1 - local;

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.strokeStyle = `rgba(177, 102, 255, ${0.32 + alpha * 0.68})`;
    this.#ctx.lineWidth = forming ? 2.5 : 2;
    this.#ctx.shadowColor = "rgba(177, 102, 255, 0.9)";
    this.#ctx.shadowBlur = 16;
    for (let ring = 0; ring < 3; ring++) {
      this.#ctx.beginPath();
      for (let point = 0; point < 6; point++) {
        const angle = point * TAU / 6 + ring * 0.18;
        const x = effect.x + Math.cos(angle) * (radius - ring * effect.size * 0.08);
        const y = effect.y + Math.sin(angle) * (radius - ring * effect.size * 0.08);
        if (point === 0) this.#ctx.moveTo(x, y);
        else this.#ctx.lineTo(x, y);
      }
      this.#ctx.closePath();
      this.#ctx.stroke();
    }

    if (!forming) {
      for (let shard = 0; shard < 10; shard++) {
        const angle = shard * TAU / 10;
        const inner = radius * 0.72;
        const outer = radius * (0.96 + local * 0.34);
        this.#ctx.beginPath();
        this.#ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
        this.#ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
        this.#ctx.stroke();
      }
    }
    this.#ctx.restore();
  }

  #drawUpgradeTornadoEffect(effect, progress) {
    const swirlProgress = Math.min(1, progress / 0.68);
    const burstProgress = Math.max(0, (progress - 0.58) / 0.42);
    const alpha = 1 - burstProgress * 0.68;
    const height = effect.size * 1.55;

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.strokeStyle = `rgba(255, 182, 54, ${0.34 + alpha * 0.58})`;
    this.#ctx.lineWidth = 2.4 + swirlProgress * 1.6;
    this.#ctx.shadowColor = "rgba(255, 182, 54, 0.95)";
    this.#ctx.shadowBlur = 18 + swirlProgress * 18;
    for (let strand = 0; strand < 7; strand++) {
      this.#ctx.beginPath();
      for (let step = 0; step <= 28; step++) {
        const t = step / 28;
        const taper = 1 - Math.abs(t - 0.58) * 0.8;
        const angle = strand * TAU / 7 + t * TAU * 2.15 + progress * TAU * 3.2;
        const radius = effect.size * (0.07 + t * 0.34 + taper * 0.18 + burstProgress * 0.34);
        const y = effect.y + (t - 0.58) * height * (1 - swirlProgress * 0.16);
        const x = effect.x + Math.cos(angle) * radius;
        this.#ctx.globalAlpha = alpha * (0.46 + t * 0.48) * (0.88 + Math.sin(angle) * 0.12);
        if (step === 0) this.#ctx.moveTo(x, y);
        else this.#ctx.lineTo(x, y);
      }
      this.#ctx.stroke();
    }
    this.#ctx.globalAlpha = 1;

    for (let ring = 0; ring < 5; ring++) {
      const local = (progress * 1.45 + ring * 0.18) % 1;
      const y = effect.y + (local - 0.58) * height;
      const radius = effect.size * (0.18 + local * 0.52 + burstProgress * 0.18);
      const alphaRing = (1 - Math.abs(local - 0.58) * 1.4) * alpha * 0.5;
      if (alphaRing <= 0) continue;
      this.#ctx.strokeStyle = `rgba(255, 226, 128, ${alphaRing})`;
      this.#ctx.lineWidth = 1.4;
      this.#ctx.beginPath();
      this.#ctx.ellipse(effect.x, y, radius, radius * 0.22, progress * TAU + ring, 0, TAU);
      this.#ctx.stroke();
    }

    if (burstProgress > 0) {
      this.#ctx.strokeStyle = `rgba(255, 214, 92, ${(1 - burstProgress) * 0.9})`;
      this.#ctx.lineWidth = 2.2;
      this.#ctx.shadowBlur = 28;
      for (let ray = 0; ray < 22; ray++) {
        const angle = ray * TAU / 22 + Math.sin(ray * 1.9) * 0.08;
        const inner = effect.size * (0.12 + burstProgress * 0.12);
        const outer = effect.size * (0.44 + burstProgress * 0.78);
        this.#ctx.beginPath();
        this.#ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
        this.#ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
        this.#ctx.stroke();
      }
    }
    this.#ctx.restore();
  }

  #handleMapTap(clientX, clientY) {
    const raider = this.#getRaiderAtScreenPoint(clientX, clientY);
    if (raider) {
      this.#revealRaiderBars(raider);
      return;
    }

    const cell = this.#screenToGrid(clientX, clientY);
    const world = this.#screenToWorld(clientX, clientY);
    const hadSelection = Boolean(this.#selectedArea || this.#selectedTower || this.#element.querySelector("[data-tower-popup]")?.classList.contains("active"));

    if (!this.#isInBounds(cell.x, cell.y) && !this.#getMonolithAtWorldPoint(world.x, world.y)) {
      this.#clearSelection();
      return;
    }

    const tower = this.#getTowerAtWorldPoint(world.x, world.y) || this.#getTowerAtCell(cell.x, cell.y);
    if (tower) {
      if (this.#selectedTower === tower) {
        this.#openTowerPanel(tower);
        return;
      }

      if (hadSelection) {
        this.#clearSelection();
        return;
      }

      this.#selectedTower = tower;
      this.#selectedArea = null;
      this.#closeTowerPopup();
      return;
    }

    const monolith = this.#getMonolithAtWorldPoint(world.x, world.y) || this.#getMonolithAtCell(cell.x, cell.y);
    if (monolith) {
      const area = {
        x: monolith.x,
        y: monolith.y,
        width: monolith.width,
        height: monolith.height,
        surface: "monolith"
      };
      const valid = this.#canPlaceFootprint(area.x, area.y, area.width, { allowMonolith: true });

      if (
        this.#selectedArea &&
        this.#selectedArea.x === area.x &&
        this.#selectedArea.y === area.y &&
        valid
      ) {
        this.#openPlacementPanel(area);
        return;
      }

      if (hadSelection) {
        this.#clearSelection();
        return;
      }

      this.#selectedArea = { ...area, valid };
      this.#selectedTower = null;
      this.#closeTowerPopup();
      return;
    }

    const tile = this.#getTileAtCell(cell.x, cell.y);
    const area = tile
      ? { x: tile.x, y: tile.y, width: tile.width, height: tile.height, surface: "tile" }
      : this.#normalize2x2(cell.x, cell.y);
    const valid = Boolean(tile) && this.#canPlaceFootprint(area.x, area.y, 2);

    if (
      this.#selectedArea &&
      this.#selectedArea.x === area.x &&
      this.#selectedArea.y === area.y &&
      valid
    ) {
      this.#openPlacementPanel(area);
      return;
    }

    if (hadSelection) {
      this.#clearSelection();
      return;
    }

    if (!tile || this.#isObstacleCell(cell.x, cell.y)) {
      this.#clearSelection();
      return;
    }

    this.#selectedArea = { ...area, valid };
    this.#selectedTower = null;
    this.#closeTowerPopup();
  }

  #screenToGrid(clientX, clientY) {
    const world = this.#screenToWorld(clientX, clientY);

    return {
      x: Math.floor(world.x / CELL_SIZE),
      y: Math.floor(world.y / CELL_SIZE)
    };
  }

  #screenToWorld(clientX, clientY) {
    const worldX = (clientX - this.#camera.x) / this.#camera.scale;
    const worldY = (clientY - this.#camera.y) / this.#camera.scale;

    return {
      x: worldX,
      y: worldY
    };
  }

  #normalize2x2(x, y) {
    return {
      x: clamp(x, 0, this.#gridWidth() - 2),
      y: clamp(y, 0, this.#gridHeight() - 2)
    };
  }

  #canPlaceFootprint(x, y, footprint, { allowMonolith = false } = {}) {
    if (x < 0 || y < 0 || x + footprint - 1 >= this.#gridWidth() || y + footprint - 1 >= this.#gridHeight()) return false;

    for (let yy = y; yy < y + footprint; yy++) {
      for (let xx = x; xx < x + footprint; xx++) {
        if (this.#isRoadCell(xx, yy)) return false;
        if (this.#isObstacleCell(xx, yy, { ignoreMonolith: allowMonolith })) return false;
        if (this.#getTowerAtCell(xx, yy)) return false;
      }
    }

    return true;
  }

  #isInBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.#gridWidth() && y < this.#gridHeight();
  }

  #isRoadCell(x, y) {
    return this.#road.cells.some((cell) => cell.x === x && cell.y === y);
  }

  #isObstacleCell(x, y, { ignoreMonolith = false } = {}) {
    return this.#flavor.elements.some((item) => {
      if (ignoreMonolith && item.type === "monolith") return false;
      return x >= item.x && x < item.x + item.width && y >= item.y && y < item.y + item.height;
    });
  }

  #getMonolithAtCell(x, y) {
    return this.#flavor.elements.find((item) => {
      return item.type === "monolith" && x >= item.x && x < item.x + item.width && y >= item.y && y < item.y + item.height;
    });
  }

  #getTileAtCell(x, y) {
    return this.#tiles.find((tile) => {
      return x >= tile.x && x < tile.x + tile.width && y >= tile.y && y < tile.y + tile.height;
    });
  }

  #getTowerAtCell(x, y) {
    return this.#towers.find((tower) => {
      const footprint = getTowerFootprint(TOWER_DEFINITIONS[tower.type]);
      return x >= tower.x && x < tower.x + footprint && y >= tower.y && y < tower.y + footprint;
    });
  }

  #getTowerAtWorldPoint(x, y) {
    return this.#towers.find((tower) => {
      const rect = this.#getTowerSurfaceRect(tower);
      if (!rect) return false;
      return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
    });
  }

  #getFirstPlaceableTower() {
    return Object.values(TOWER_DEFINITIONS).find((tower) => {
      return tower.rarities.common.rangeCells > 0 && this.#saveService.isTowerUnlocked(tower.id, "common");
    });
  }

  #getRaiderAtScreenPoint(clientX, clientY) {
    const world = this.#screenToWorld(clientX, clientY);
    const hitRadius = CELL_SIZE * 0.82;
    let best = null;
    let bestDistance = Infinity;

    for (const raider of this.#raiders) {
      if (!raider.alive) continue;
      const position = this.#getRaiderPosition(raider);
      const distance = Math.hypot(world.x - position.x, world.y - position.y);
      const isBetterTie = best && distance === bestDistance && raider.progress > best.progress;

      if (distance <= hitRadius && (distance < bestDistance || isBetterTie)) {
        best = raider;
        bestDistance = distance;
      }
    }

    return best;
  }

  #openPlacementPanel(area) {
    this.#selectedArea = { ...area, valid: true };
    const popup = this.#element.querySelector("[data-tower-popup]");
    const title = this.#element.querySelector("[data-tower-popup-title]");
    const placementPanel = this.#element.querySelector("[data-placement-panel]");
    const towerPanel = this.#element.querySelector("[data-tower-panel]");
    const placeableTowers = Object.values(TOWER_DEFINITIONS)
      .filter((tower) => area.surface === "monolith" ? tower.id === "factory" : tower.id !== "factory")
      .sort((a, b) => Number(a.id === "factory") - Number(b.id === "factory"));

    title.textContent = "Tower Placement";
    placementPanel.innerHTML = placeableTowers.map((tower) => {
      const unlocked = this.#saveService.isTowerUnlocked(tower.id, "common");
      const cost = tower.rarities.common.placementCost;
      const assetKey = getTowerAssetKey(tower, "common");
      const title = unlocked ? `${tower.label} - ${cost}R` : `${tower.label} Locked`;
      return `
        <button
          class="tower-popup-button tower-placement-icon"
          type="button"
          data-place-tower="${tower.id}"
          aria-label="${title}"
          title="${title}"
          ${!unlocked || this.#resources < cost ? "disabled" : ""}
        >
          <img src="${RUNTIME_ASSET_BASE}/towers/${assetKey}.png" alt="" draggable="false" />
        </button>
      `;
    }).join("");
    placementPanel.style.display = "grid";
    towerPanel.style.display = "none";
    this.#openTowerPopupAfterDelay(popup);
  }

  #refreshTowerPopupAffordability() {
    if (!this.#element) return;
    const popup = this.#element.querySelector("[data-tower-popup]");
    if (!popup?.classList.contains("active")) return;

    if (this.#selectedArea?.valid) {
      const placementPanel = this.#element.querySelector("[data-placement-panel]");
      placementPanel.querySelectorAll("[data-place-tower]").forEach((button) => {
        const tower = TOWER_DEFINITIONS[button.dataset.placeTower];
        if (!tower) return;
        const unlocked = this.#saveService.isTowerUnlocked(tower.id, "common");
        const cost = tower.rarities.common.placementCost;
        button.disabled = !unlocked || this.#resources < cost || !this.#canPlaceTowerOnSelectedArea(tower.id);
      });
      return;
    }

    if (this.#selectedTower) {
      const tower = this.#selectedTower;
      const definition = TOWER_DEFINITIONS[tower.type];
      const nextRarity = getNextRarity(tower.rarity);
      const upgradeButton = this.#element.querySelector("[data-upgrade-tower]");
      if (!definition || !upgradeButton || !nextRarity) return;
      const unlocked = this.#saveService.isTowerUnlocked(tower.type, nextRarity);
      const cost = this.#getTowerUpgradeCost(tower, nextRarity);
      this.#setTowerUpgradeButtonReady(upgradeButton, unlocked && this.#resources >= cost, nextRarity);
    }
  }

  #openTowerPanel(tower) {
    const popup = this.#element.querySelector("[data-tower-popup]");
    const title = this.#element.querySelector("[data-tower-popup-title]");
    const placementPanel = this.#element.querySelector("[data-placement-panel]");
    const towerPanel = this.#element.querySelector("[data-tower-panel]");
    const upgradeButton = this.#element.querySelector("[data-upgrade-tower]");
    const recycleButton = this.#element.querySelector("[data-recycle-tower]");
    const upgradeMeta = this.#element.querySelector("[data-upgrade-tower-meta]");
    const recycleMeta = this.#element.querySelector("[data-recycle-tower-meta]");
    const nextRarity = getNextRarity(tower.rarity);
    const definition = TOWER_DEFINITIONS[tower.type];
    const priorityGroup = this.#element.querySelector("[data-target-priority-group]");
    const factoryInfo = this.#element.querySelector("[data-factory-credit-info]");

    title.textContent = `${RARITY_LABELS[tower.rarity]} ${definition.label}`;
    this.#refreshTowerResearchControls(tower, { open: false });
    const recycleValue = Math.floor(this.#getRecycleValue(tower));
    recycleButton.setAttribute("aria-label", `Recycle tower for ${recycleValue} resources`);
    recycleButton.title = `Recycle +${recycleValue}R`;
    recycleMeta.textContent = `+${recycleValue}R`;
    priorityGroup.innerHTML = tower.type === "factory" ? "" : `
      <div class="target-priority-label">Target</div>
      <div class="target-priority-options">
        ${TARGET_PRIORITIES.map((priority) => `
          <button
            class="target-priority-button${(tower.targetPriority || "first") === priority.id ? " active" : ""}"
            type="button"
            data-target-priority="${priority.id}"
          >${priority.label}</button>
        `).join("")}
      </div>
    `;

    if (tower.type === "factory") {
      const stats = this.#getEffectiveTowerStats(tower);
      const creditAge = this.#getFactoryCreditAge(tower);
      const yieldPerWave = getFactoryResourceYield(tower, stats, this.#getFactorySlotMultiplier(tower), creditAge);
      factoryInfo.hidden = false;
      factoryInfo.textContent = `Credit Age: ${creditAge} | Yield: ${yieldPerWave}R/wave`;
    } else {
      factoryInfo.hidden = true;
      factoryInfo.textContent = "";
    }

    if (!nextRarity) {
      upgradeButton.setAttribute("aria-label", "Tower is already at max tier");
      upgradeButton.title = "Max tier";
      upgradeButton.dataset.upgradeRarity = "";
      upgradeButton.dataset.upgradeReady = "false";
      upgradeButton.style.removeProperty("--upgrade-ready-color");
      upgradeMeta.textContent = "Max";
      upgradeButton.disabled = true;
    } else {
      const unlocked = this.#saveService.isTowerUnlocked(tower.type, nextRarity);
      const cost = this.#getTowerUpgradeCost(tower, nextRarity);
      const nextLabel = RARITY_LABELS[nextRarity];
      upgradeButton.setAttribute("aria-label", unlocked ? `Upgrade tower to ${nextLabel} for ${cost} resources` : `${nextLabel} upgrade locked`);
      upgradeButton.title = unlocked ? `Upgrade - ${cost}R` : `${nextLabel} locked`;
      upgradeButton.dataset.upgradeRarity = nextRarity;
      upgradeMeta.textContent = `${cost}R`;
      this.#setTowerUpgradeButtonReady(upgradeButton, unlocked && this.#resources >= cost, nextRarity, { initialize: true });
    }

    placementPanel.style.display = "none";
    towerPanel.style.display = "grid";
    this.#openTowerPopupAfterDelay(popup);
  }

  #closeTowerPopup() {
    if (!this.#element) return;
    this.#cancelTowerPopupOpen();
    this.#element.querySelector("[data-tower-popup]")?.classList.remove("active");
  }

  #openTowerPopupAfterDelay(popup) {
    this.#cancelTowerPopupOpen();
    popup.classList.remove("active");
    const token = ++this.#towerPopupOpenToken;

    this.#towerPopupOpenTimer = window.setTimeout(() => {
      if (!this.#element || token !== this.#towerPopupOpenToken) return;
      popup.classList.add("active");
      this.#towerPopupOpenTimer = 0;
    }, TOWER_POPUP_OPEN_DELAY_MS);
  }

  #setTowerUpgradeButtonReady(button, ready, rarity, options = {}) {
    const hadState = button.dataset.upgradeReady === "true" || button.dataset.upgradeReady === "false";
    const wasReady = button.dataset.upgradeReady === "true";
    const nextReady = Boolean(ready);
    const color = rarity ? RARITY_COLORS[rarity] : "";

    button.disabled = !nextReady;
    button.dataset.upgradeReady = String(nextReady);
    if (color) {
      button.style.setProperty("--upgrade-ready-color", color);
    } else {
      button.style.removeProperty("--upgrade-ready-color");
    }

    if (!options.initialize && hadState && !wasReady && nextReady) {
      this.#playUpgradeReadyGlow(button);
    }
  }

  #playUpgradeReadyGlow(button) {
    button.classList.remove("upgrade-ready-glow");
    void button.offsetWidth;
    button.classList.add("upgrade-ready-glow");
    window.setTimeout(() => {
      if (button.isConnected) button.classList.remove("upgrade-ready-glow");
    }, 5000);
  }

  #cancelTowerPopupOpen() {
    this.#towerPopupOpenToken++;
    if (!this.#towerPopupOpenTimer) return;
    window.clearTimeout(this.#towerPopupOpenTimer);
    this.#towerPopupOpenTimer = 0;
  }

  #clearSelection() {
    this.#selectedArea = null;
    this.#selectedTower = null;
    this.#closeTowerPopup();
  }

  #placeTower(towerId) {
    if (!this.#selectedArea?.valid) return;
    const definition = TOWER_DEFINITIONS[towerId];
    if (!definition) return;
    const stats = definition.rarities.common;
    if (!this.#canPlaceTowerOnSelectedArea(towerId)) return;
    if (!this.#saveService.isTowerUnlocked(towerId, "common")) return;
    if (this.#resources < stats.placementCost) return;

    this.#resources -= stats.placementCost;
    const factoryActivations = towerId === "factory" && this.#waveStarted
      ? Math.min(FACTORY_ACTIVATIONS_PER_WAVE, Math.floor(this.#waveElapsed / this.#waveFactoryInterval))
      : 0;
    const tower = {
      id: this.#nextTowerId++,
      type: towerId,
      x: this.#selectedArea.x,
      y: this.#selectedArea.y,
      surface: this.#selectedArea.surface || "ground",
      rarity: "common",
      spent: stats.placementCost,
      cooldown: towerId === "factory" ? Math.max(0, this.#waveFactoryInterval * (factoryActivations + 1) - this.#waveElapsed) : 0,
      factoryActivations,
      creditAge: 1,
      targetPriority: "first",
      research: "",
      angle: -Math.PI / 2
    };
    this.#towers.push(tower);
    this.#telemetry.recordTowerPlaced(tower);
    this.#addTowerUpgradeRevealEffect(tower);
    this.#selectedArea = null;
    this.#selectedTower = tower;
    this.#closeTowerPopup();
    this.#syncRunHud();
    this.#saveActiveRun();
    this.#requestDraw();
  }

  #canPlaceTowerOnSelectedArea(towerId) {
    const definition = TOWER_DEFINITIONS[towerId];
    if (!definition || !this.#selectedArea?.valid) return false;
    const isMonolith = this.#selectedArea.surface === "monolith";
    if (towerId === "factory" && !isMonolith) return false;
    if (towerId !== "factory" && isMonolith) return false;
    return this.#canPlaceFootprint(this.#selectedArea.x, this.#selectedArea.y, getTowerFootprint(definition), { allowMonolith: isMonolith });
  }

  #setSelectedTowerPriority(priority) {
    if (!this.#selectedTower || !TARGET_PRIORITIES.some((item) => item.id === priority)) return;

    this.#selectedTower.targetPriority = priority;
    this.#openTowerPanel(this.#selectedTower);
    this.#saveActiveRun();
    this.#requestDraw();
  }

  #drawAirburstBombEffect(effect, progress) {
    const armProgress = clamp(effect.elapsed / effect.delaySeconds, 0, 1);
    const radius = CELL_SIZE * (0.12 + armProgress * 0.14);

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.fillStyle = withAlpha(effect.color, 0.34 + armProgress * 0.42);
    this.#ctx.strokeStyle = effect.color;
    this.#ctx.lineWidth = 2;
    this.#ctx.shadowColor = effect.color;
    this.#ctx.shadowBlur = 8;
    this.#ctx.beginPath();
    this.#ctx.rect(effect.x - radius, effect.y - radius, radius * 2, radius * 2);
    this.#ctx.fill();
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #drawRadarPulseEffect(effect, progress) {
    const alpha = 1 - progress;
    const radius = effect.range * (0.18 + progress * 0.82);

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.strokeStyle = withAlpha(effect.color, alpha * 0.42);
    this.#ctx.lineWidth = 2;
    this.#ctx.beginPath();
    this.#ctx.arc(effect.x, effect.y, radius, 0, TAU);
    this.#ctx.stroke();

    this.#ctx.strokeStyle = withAlpha(effect.color, alpha * 0.72);
    this.#ctx.lineWidth = 1.5;
    this.#ctx.beginPath();
    this.#ctx.moveTo(effect.x, effect.y);
    this.#ctx.lineTo(effect.to.x, effect.to.y);
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #toggleTowerResearchOptions() {
    if (!this.#selectedTower) return;
    const options = this.#element.querySelector("[data-tower-research-options]");
    const open = options?.dataset.open !== "true";
    this.#refreshTowerResearchControls(this.#selectedTower, { open });
  }

  #assignSelectedTowerResearch(researchId) {
    const tower = this.#selectedTower;
    if (!tower) return;
    const previousResearch = tower.research || "";
    if (researchId === "none") {
      tower.research = "";
    } else if (this.#canAssignResearch(tower, researchId)) {
      tower.research = researchId;
    }

    if ((tower.research || "") !== previousResearch) {
      this.#telemetry.recordResearchAssigned(tower, previousResearch);
      this.#addTowerResearchBloomEffect(tower);
    }
    this.#refreshTowerResearchControls(tower, { open: false });
    this.#saveActiveRun();
    this.#requestDraw();
  }

  #refreshTowerResearchControls(tower, { open }) {
    const summary = this.#element.querySelector("[data-tower-research-summary]");
    const button = this.#element.querySelector("[data-open-research]");
    const buttonLabel = this.#element.querySelector("[data-open-research-label]");
    const options = this.#element.querySelector("[data-tower-research-options]");
    const nodes = getTowerResearchNodes(tower.type);
    const eligible = nodes.length > 0 && RARITIES.indexOf(tower.rarity) >= RESEARCH_RARITY_INDEX;
    const assigned = tower.research ? getResearchNode(tower.type, tower.research) : null;

    summary.textContent = assigned ? `Research: ${assigned.shortLabel}` : eligible ? "Research: Empty" : "Research unlocks at Rare";
    button.style.display = nodes.length > 0 ? "grid" : "none";
    button.disabled = !eligible;
    buttonLabel.textContent = assigned ? assigned.shortLabel : "Research";
    options.dataset.open = String(Boolean(open && eligible));

    if (!open || !eligible) {
      options.innerHTML = "";
      return;
    }

    const save = this.#saveService.getSnapshot();
    options.innerHTML = [
      `<button class="tower-research-option${!tower.research ? " active" : ""}" type="button" data-assign-research="none">None</button>`,
      ...nodes.map((node) => {
        const capacity = save.research[getResearchKey(node.towerId, node.id)] || 0;
        const used = this.#getResearchUsage(node.towerId, node.id);
        const usedByOtherTowers = this.#getResearchUsage(node.towerId, node.id, tower);
        const active = tower.research === node.id;
        const available = active || usedByOtherTowers < capacity;
        return `
          <button
            class="tower-research-option${active ? " active" : ""}"
            type="button"
            data-assign-research="${node.id}"
            ${available ? "" : "disabled"}
          >
            <strong>${node.shortLabel}</strong>
            <span>${used}/${capacity}</span>
          </button>
        `;
      })
    ].join("");
  }

  #canAssignResearch(tower, researchId) {
    const node = getResearchNode(tower.type, researchId);
    if (!node || RARITIES.indexOf(tower.rarity) < RESEARCH_RARITY_INDEX) return false;
    const save = this.#saveService.getSnapshot();
    const capacity = save.research[getResearchKey(tower.type, researchId)] || 0;
    return this.#getResearchUsage(tower.type, researchId, tower) < capacity;
  }

  #getResearchUsage(towerId, researchId, excludeTower = null) {
    return this.#towers.filter((tower) => (
      tower !== excludeTower && tower.type === towerId && tower.research === researchId
    )).length;
  }

  #upgradeSelectedTower() {
    const tower = this.#selectedTower;
    if (!tower) return;
    const nextRarity = getNextRarity(tower.rarity);
    if (!nextRarity || !this.#saveService.isTowerUnlocked(tower.type, nextRarity)) return;
    const cost = this.#getTowerUpgradeCost(tower, nextRarity);
    if (this.#resources < cost) return;

    this.#resources -= cost;
    const previousRarity = tower.rarity;
    tower.rarity = nextRarity;
    tower.spent += cost;
    this.#telemetry.recordTowerUpgraded(tower, cost, previousRarity);
    this.#addTowerUpgradeRevealEffect(tower);
    if (tower.type === "factory") {
      tower.cooldown = Math.min(tower.cooldown, this.#waveFactoryInterval);
    } else if (tower.type === "antiair") {
      tower.cooldown = Math.min(tower.cooldown, TOWER_DEFINITIONS[tower.type].rarities[nextRarity].attackInterval);
    }
    this.#openTowerPanel(tower);
    this.#syncRunHud();
    this.#saveActiveRun();
    this.#requestDraw();
  }

  #recycleSelectedTower() {
    const tower = this.#selectedTower;
    if (!tower) return;

    const refund = this.#getRecycleValue(tower);
    this.#resources += refund;
    this.#telemetry.recordTowerRecycled(tower, refund);
    this.#towers = this.#towers.filter((item) => item !== tower);
    this.#clearSelection();
    this.#syncRunHud();
    this.#saveActiveRun();
    this.#requestDraw();
  }

  #getRecycleValue(tower) {
    return tower.spent * 0.5;
  }

  #getTowerUpgradeCost(tower, rarity) {
    const baseCost = TOWER_DEFINITIONS[tower.type].rarities[rarity].placementCost;
    const discount = this.#hasAssignedResearch("factory", "assembly_line")
      ? getResearchEffectNumber("factory", "assembly_line", "upgradeDiscount", 5)
      : 0;
    return Math.max(0, baseCost - discount);
  }

  #hasAssignedResearch(towerId, researchId) {
    return this.#towers.some((tower) => tower.type === towerId && tower.research === researchId);
  }

  #getAssignedResearchCount(towerId, researchId) {
    return this.#towers.filter((tower) => tower.type === towerId && tower.research === researchId).length;
  }

  #updateWave(dt) {
    if (this.#waveStarted) {
      this.#waveElapsed += dt;
    }
    this.#updateSpawning(dt);
    this.#updateRaiders(dt);
    this.#rebuildRaiderSpatialIndex();
    this.#updateMissiles(dt);
    this.#rebuildRaiderSpatialIndex();
    this.#updateTowers(dt);
    this.#checkWaveEnd();
    this.#syncRunHud();
  }

  #updateSpawning(dt) {
    if (!this.#spawning) return;

    this.#spawnTimer -= dt;

    while (this.#spawnTimer <= 0 && this.#spawnQueue.length > 0) {
      const next = this.#spawnQueue.shift();
      this.#spawnRaider(next.type, next.rarity);
      this.#spawnTimer += next.spawnInterval;
    }

    if (this.#spawnQueue.length <= 0) {
      this.#spawning = false;
    }
  }

  #checkWaveEnd() {
    if (!this.#waveStarted || this.#spawning || this.#raiders.length > 0) return;

    const shouldContinue = this.#running;
    this.#flushFactoriesForWaveEnd();
    this.#ageFactoriesForWaveEnd();
    this.#waveStarted = false;
    this.#grantWaveRewards(this.#wave);
    this.#telemetry.recordWaveEnd({
      wave: this.#wave,
      durationSeconds: this.#waveElapsed,
      resources: this.#resources,
      playerHealth: this.#playerHealth
    });

    if (this.#wave >= this.#getWaveCount()) {
      this.#finishRun({ victory: true });
    } else {
      this.#wave++;
      if (shouldContinue) {
        this.#startCurrentWave();
      }
      this.#saveActiveRun();
    }
  }

  #grantWaveRewards(wave) {
    const perks = this.#saveService.getSnapshot().perks;
    this.#grantFactoryMineRewards(wave);

    if (Math.random() < BASE_COIN_DROP_CHANCE) {
      const coins = Math.round(10 * getCoinYieldMultiplier(perks)) + this.#coinYield;
      this.#coinYield = 0;
      this.#runCoins += coins;
      this.#telemetry.recordReward({ kind: "coins", amount: coins, wave });
      queueCoinReward(coins);
    }

    if (Math.random() < getGemDropChance(perks)) {
      const gemId = getRandomGem();
      this.#runGems.push(gemId);
      this.#telemetry.recordReward({ kind: "gem", amount: 1, id: gemId, wave });
      queueGemReward(gemId);
    }

    if (Math.random() < getCrateDropChance(perks)) {
      const crateId = getRandomCrate();
      this.#runCrates.push(crateId);
      this.#telemetry.recordReward({ kind: "crate", amount: 1, id: crateId, wave });
      queueTextReward({
        kicker: "Crate Found",
        value: `+1 ${crateId} crate`,
        tone: "crate"
      });
    }

    this.#saveActiveRun();
  }

  #grantFactoryMineRewards(wave) {
    const goldMines = this.#getAssignedResearchCount("factory", "gold_mine");
    if (goldMines > 0) {
      const coins = goldMines * getResearchEffectNumber("factory", "gold_mine", "coinsPerWave", 4);
      this.#coinYield += coins;
      this.#telemetry.recordReward({ kind: "coin_yield", amount: coins, id: "factory:gold_mine", wave });
    }

    const gemMines = this.#getAssignedResearchCount("factory", "gem_mine");
    for (let index = 0; index < gemMines; index++) {
      if (Math.random() >= getResearchEffectNumber("factory", "gem_mine", "gemChancePerWave", 0.2)) continue;
      const gemId = getRandomGem();
      this.#runGems.push(gemId);
      this.#telemetry.recordReward({ kind: "gem", amount: 1, id: `factory:gem_mine:${gemId}`, wave });
      queueGemReward(gemId);
    }
  }

  #spawnRaider(type, rarity, options = {}) {
    this.#raiders.push(createRaider({
      type,
      rarity,
      id: this.#nextRaiderId++,
      progress: Math.max(0, Number(options.progress) || 0)
    }));
  }

  #updateRaiders(dt) {
    const endProgress = Math.max(0, this.#road.cells.length - 1);

    for (const raider of this.#raiders) {
      if (!raider.alive) continue;

      if (raider.frozenUntil && this.#time >= raider.frozenUntil) {
        raider.frozenUntil = 0;
        raider.freezeSpeedMultiplier = 1;
        raider.embrittled = false;
        raider.slowAssistSource = null;
      }

      if (isFlyingRaider(raider) && raider.flightPhase === "entry" && raider.progress >= JET_ENTRY_PROGRESS_CELLS) {
        raider.flightPhase = "circling";
        raider.flightTime = 0;
        raider.progress = JET_ENTRY_PROGRESS_CELLS;
        continue;
      }

      if (isFlyingRaider(raider) && raider.flightPhase === "circling") {
        raider.flightTime = (Number(raider.flightTime) || 0) + dt;

        if (raider.flightTime >= getJetOrbitCircuits(raider.rarity) * JET_ORBIT_DURATION) {
          raider.flightPhase = "road";
          raider.progress = 0;
        }
        continue;
      }

      raider.progress += (getEffectiveRaiderSpeed(raider) / 100) * dt;

      if (raider.progress >= endProgress) {
        if (this.#tryPanicRailgunBeforeLeak(raider)) continue;
        raider.alive = false;
        this.#telemetry.recordLeak(raider, raider.damage);
        this.#damagePlayer(raider.damage);
      }
    }

    this.#raiders = this.#raiders.filter((raider) => raider.alive);
  }

  #tryPanicRailgunBeforeLeak(raider) {
    const tower = this.#towers.find((candidate) => (
      candidate.type === "railgun" &&
      candidate.research === "panic" &&
      candidate.cooldown <= 0 &&
      canTowerTargetRaider(candidate, raider)
    ));
    if (!tower) return false;
    this.#fireRailgunPanic(tower, raider);
    tower.cooldown = getResearchEffectNumber(tower, "panicCooldown", 100);
    return true;
  }

  #updateTowers(dt) {
    for (const tower of this.#towers) {
      const stats = this.#getEffectiveTowerStats(tower);
      tower.cooldown -= dt;

      if (tower.type === "factory") {
        this.#updateFactory(tower, stats);
        continue;
      }

      if (tower.type === "radar") {
        if (tower.cooldown <= 0) {
          const target = this.#findRadarTarget(tower);
          if (target) {
            const revealDurationMs = (stats.revealDuration || 5) * 1000;
            this.#disableRaiderCloak(target, revealDurationMs, tower);
            this.#telemetry.recordRadarReveal(tower, target, revealDurationMs);
            this.#addRadarPulseEffect(tower, target, stats);
            tower.cooldown = stats.attackInterval;
          } else {
            tower.cooldown = 0;
          }
        }
        continue;
      }

      if (tower.type === "railgun") {
        if (tower.cooldown <= 0) {
          const panicTarget = tower.research === "panic" ? this.#findRailgunPanicTarget(tower) : null;
          const target = panicTarget || this.#findRailgunTarget(tower, stats);
          if (panicTarget) {
            this.#fireRailgunPanic(tower, panicTarget);
            tower.cooldown = getResearchEffectNumber(tower, "panicCooldown", 100);
          } else if (target) {
            this.#fireRailgun(tower, target, stats);
            tower.cooldown = stats.attackInterval;
          } else {
            tower.cooldown = 0;
          }
        }
        continue;
      }

      if (tower.type === "antiair") {
        if (tower.cooldown <= 0) {
          const target = this.#findAntiAirTarget(tower, stats);
          if (target) {
            this.#fireAntiAirMissile(tower, target, stats);
            tower.cooldown = stats.attackInterval;
          } else {
            tower.cooldown = 0;
          }
        }
        continue;
      }

      let shots = 0;
      while (tower.cooldown <= 0 && shots < MAX_TOWER_SHOTS_PER_UPDATE) {
        const target = this.#findTowerTarget(tower);
        if (!target) {
          tower.cooldown = 0;
          break;
        }

        const center = this.#getTowerCenter(tower);
        const targetPosition = this.#getCachedRaiderPosition(target);
        tower.angle = Math.atan2(targetPosition.y - center.y, targetPosition.x - center.x);
        const damage = this.#getTowerHitDamage(tower, stats.damage);
        this.#addTowerShotEffects(tower, center, targetPosition);
        this.#damageRaider(target, damage, tower);
        this.#applyResearchShotEffects(tower, target, stats);
        if (tower.type === "raygun") {
          this.#freezeRaider(target, tower);
        }
        tower.cooldown += stats.attackInterval;
        shots++;
      }

      if (shots >= MAX_TOWER_SHOTS_PER_UPDATE) {
        tower.cooldown = Math.max(0, tower.cooldown);
      }
    }

    this.#raiders = this.#raiders.filter((raider) => raider.alive);
  }

  #getEffectiveTowerStats(tower) {
    const stats = getEffectiveTowerStats(tower);
    if (!tower || tower.type === "factory") return stats;

    for (const radar of this.#towers) {
      if (radar === tower || radar.type !== "radar" || !radar.research) continue;
      const radarStats = getEffectiveTowerStats(radar);
      const radarCenter = this.#getTowerCenter(radar);
      const towerCenter = this.#getTowerCenter(tower);
      const dx = towerCenter.x - radarCenter.x;
      const dy = towerCenter.y - radarCenter.y;
      const range = (radarStats.rangeCells || 0) * CELL_SIZE;
      if (dx * dx + dy * dy > range * range) continue;

      const attackIntervalMultiplier = getResearchEffectNumber(radar, "auraAttackIntervalMultiplier", 1);
      const rangeMultiplier = getResearchEffectNumber(radar, "auraRangeMultiplier", 1);
      if (attackIntervalMultiplier !== 1 && Number.isFinite(stats.attackInterval)) {
        stats.attackInterval *= attackIntervalMultiplier;
      }
      if (rangeMultiplier !== 1 && Number.isFinite(stats.rangeCells)) {
        stats.rangeCells *= rangeMultiplier;
      }
    }

    return stats;
  }

  #rebuildRaiderSpatialIndex() {
    this.#raiderPositions.clear();
    this.#raiderById.clear();
    this.#raiderBuckets.clear();

    for (const raider of this.#raiders) {
      if (!raider.alive) continue;

      const position = this.#getRaiderPosition(raider);
      this.#raiderPositions.set(raider.id, position);
      this.#raiderById.set(raider.id, raider);

      const bucketX = Math.floor(position.x / TARGET_BUCKET_SIZE);
      const bucketY = Math.floor(position.y / TARGET_BUCKET_SIZE);
      const key = `${bucketX},${bucketY}`;
      let bucket = this.#raiderBuckets.get(key);
      if (!bucket) {
        bucket = [];
        this.#raiderBuckets.set(key, bucket);
      }
      bucket.push(raider);
    }
  }

  #getCachedRaiderPosition(raider) {
    let position = this.#raiderPositions.get(raider.id);
    if (!position) {
      position = this.#getRaiderPosition(raider);
      this.#raiderPositions.set(raider.id, position);
    }
    return position;
  }

  #getRaiderById(id) {
    const cached = this.#raiderById.get(id);
    if (cached?.alive) return cached;
    return this.#raiders.find((raider) => raider.id === id && raider.alive) || null;
  }

  #getRaiderCandidatesInRange(center, range) {
    if (this.#raiderBuckets.size <= 0) return this.#raiders;

    const minX = Math.floor((center.x - range) / TARGET_BUCKET_SIZE);
    const maxX = Math.floor((center.x + range) / TARGET_BUCKET_SIZE);
    const minY = Math.floor((center.y - range) / TARGET_BUCKET_SIZE);
    const maxY = Math.floor((center.y + range) / TARGET_BUCKET_SIZE);
    const candidates = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const bucket = this.#raiderBuckets.get(`${x},${y}`);
        if (bucket) candidates.push(...bucket);
      }
    }

    return candidates;
  }

  #updateMissiles(dt) {
    this.#updateAirburstBombs(dt);
    this.#updateRailBeamEffects(dt);

    for (const effect of this.#effects) {
      if (effect.type !== "missile" || effect.done) continue;

      effect.elapsed += dt;
      const target = this.#getRaiderById(effect.targetId);
      if (target) {
        effect.lastTargetPosition = this.#getCachedRaiderPosition(target);
      }

      if (effect.elapsed < effect.durationSeconds) continue;

      if (target) {
        const impact = this.#getCachedRaiderPosition(target);
        this.#effects.push({
          type: "explosion",
          x: impact.x,
          y: impact.y,
          color: effect.color,
          startedAt: performance.now(),
          duration: 420
        });
        this.#damageRaider(target, effect.damage, effect.tower);
      } else if (effect.lastTargetPosition) {
        this.#effects.push({
          type: "explosion",
          x: effect.lastTargetPosition.x,
          y: effect.lastTargetPosition.y,
          color: effect.color,
          startedAt: performance.now(),
          duration: 300
        });
      }

      effect.done = true;
    }

    this.#raiders = this.#raiders.filter((raider) => raider.alive);
  }

  #updateRailBeamEffects(dt) {
    for (const effect of this.#effects) {
      if (effect.type !== "rail-beam" || effect.done) continue;

      effect.elapsed += dt;
      const target = this.#getRaiderById(effect.targetId);
      if (!target) {
        effect.done = true;
        continue;
      }

      const progress = clamp(effect.elapsed / effect.durationSeconds, 0, 1);
      const desiredDamage = effect.damage * progress;
      const damageDelta = Math.max(0, desiredDamage - effect.appliedDamage);
      if (damageDelta > 0) {
        if (effect.shieldOnly) {
          this.#damageRaiderShieldOnly(target, damageDelta, effect.tower);
        } else {
          this.#damageRaider(target, damageDelta, effect.tower);
        }
        effect.appliedDamage += damageDelta;
      }

      if (progress >= 1 || !target.alive) {
        if (target.alive && effect.voltaic) {
          this.#applyRailgunVoltaicEffect(effect.tower, target, effect.stats);
        }
        effect.done = true;
      }
    }

    this.#raiders = this.#raiders.filter((raider) => raider.alive);
  }

  #updateAirburstBombs(dt) {
    for (const effect of this.#effects) {
      if (effect.type !== "airburst-bomb" || effect.done) continue;

      effect.elapsed += dt;
      if (effect.elapsed < effect.delaySeconds) continue;

      this.#damageRaidersInRadius(effect.x, effect.y, effect.radius, effect.damage, effect.tower, null, { liveScan: true });
      this.#effects.push({
        type: "explosion",
        x: effect.x,
        y: effect.y,
        color: effect.color,
        startedAt: performance.now(),
        duration: 420
      });
      effect.done = true;
    }

    this.#raiders = this.#raiders.filter((raider) => raider.alive);
  }

  #updateFactory(tower, stats) {
    if (!this.#waveStarted || (tower.factoryActivations || 0) >= FACTORY_ACTIVATIONS_PER_WAVE) return;

    while (tower.cooldown <= 0 && (tower.factoryActivations || 0) < FACTORY_ACTIVATIONS_PER_WAVE) {
      this.#triggerFactory(tower, stats);
      this.#addFactoryBeamEffect(tower);
    }
  }

  #triggerFactory(tower, stats) {
    const yieldAmount = this.#getFactoryActivationYield(tower, stats);
    this.#resources += yieldAmount;
    this.#telemetry.recordFactoryYield(tower, yieldAmount);
    tower.factoryActivations = (tower.factoryActivations || 0) + 1;
    tower.cooldown += this.#waveFactoryInterval;
  }

  #resetFactoriesForWave() {
    for (const tower of this.#towers) {
      if (tower.type !== "factory") continue;
      tower.factoryActivations = 0;
      tower.cooldown = this.#waveFactoryInterval;
    }
  }

  #flushFactoriesForWaveEnd() {
    for (const tower of this.#towers) {
      if (tower.type !== "factory") continue;
      const stats = this.#getEffectiveTowerStats(tower);
      while ((tower.factoryActivations || 0) < FACTORY_ACTIVATIONS_PER_WAVE) {
        this.#triggerFactory(tower, stats);
        this.#addFactoryBeamEffect(tower);
      }
    }
  }

  #ageFactoriesForWaveEnd() {
    for (const tower of this.#towers) {
      if (tower.type !== "factory") continue;
      tower.creditAge = this.#getFactoryCreditAge(tower) + 1;
    }
  }

  #getFactoryCreditAge(tower) {
    return Math.max(1, Math.round(Number(tower.creditAge) || 1));
  }

  #getFactoryActivationYield(tower, stats) {
    const totalYield = getFactoryResourceYield(tower, stats, this.#getFactorySlotMultiplier(tower), this.#getFactoryCreditAge(tower));
    const firstActivation = Math.floor(totalYield * 0.5);
    return (tower.factoryActivations || 0) <= 0 ? firstActivation : totalYield - firstActivation;
  }

  #getFactorySlotMultiplier(tower) {
    const factories = this.#towers
      .filter((candidate) => candidate.type === "factory")
      .sort((a, b) => a.id - b.id);
    const index = Math.max(0, factories.findIndex((candidate) => candidate === tower));
    return FACTORY_SLOT_MULTIPLIERS[index] ?? FACTORY_SLOT_MULTIPLIERS.at(-1);
  }

  #estimateWaveDuration(spawnQueue) {
    const spawnDuration = spawnQueue.reduce((sum, entry) => sum + (entry.spawnInterval || 0), 0);
    return Math.max(6, spawnDuration + 8);
  }

  #addFactoryBeamEffect(tower) {
    const center = this.#getTowerCenter(tower);
    this.#effects.push({
      type: "factory-beam",
      x: center.x,
      y: center.y,
      color: RARITY_COLORS[tower.rarity],
      startedAt: performance.now(),
      duration: 200
    });
  }

  #addTowerUpgradeRevealEffect(tower) {
    const center = this.#getTowerCenter(tower);
    const surfaceRect = this.#getTowerSurfaceRect(tower);
    const footprint = getTowerFootprint(TOWER_DEFINITIONS[tower.type]);
    const size = surfaceRect
      ? Math.max(surfaceRect.width, surfaceRect.height)
      : footprint * CELL_SIZE;
    this.#effects.push({
      type: "tower-upgrade-reveal",
      rarity: tower.rarity,
      x: center.x,
      y: center.y,
      size,
      color: RARITY_COLORS[tower.rarity],
      startedAt: performance.now(),
      duration: 1000
    });
  }

  #addTowerResearchBloomEffect(tower) {
    const center = this.#getTowerCenter(tower);
    const rect = this.#getTowerFootprintRect(tower);
    const size = Math.max(rect.width, rect.height);
    this.#effects.push({
      type: "tower-research-bloom",
      x: center.x,
      y: center.y,
      size,
      color: RARITY_COLORS[tower.rarity] || "rgba(68, 255, 239, 0.95)",
      startedAt: performance.now(),
      duration: 1000
    });
  }

  #addRadarPulseEffect(tower, target, stats) {
    const center = this.#getTowerCenter(tower);
    const targetPosition = this.#getCachedRaiderPosition(target);
    tower.angle = Math.atan2(targetPosition.y - center.y, targetPosition.x - center.x);
    this.#effects.push({
      type: "radar-pulse",
      x: center.x,
      y: center.y,
      to: targetPosition,
      range: stats.rangeCells * CELL_SIZE,
      color: RARITY_COLORS[tower.rarity],
      startedAt: performance.now(),
      duration: 260
    });
  }

  #fireAntiAirMissile(tower, target, stats) {
    const center = this.#getTowerCenter(tower);
    const targetPosition = this.#getCachedRaiderPosition(target);
    tower.angle = Math.atan2(targetPosition.y - center.y, targetPosition.x - center.x);
    this.#effects.push({
      type: "missile",
      from: center,
      targetId: target.id,
      lastTargetPosition: targetPosition,
      asset: TOWER_DEFINITIONS[tower.type].missileAsset,
      rarity: tower.rarity,
      color: RARITY_COLORS[tower.rarity],
      damage: stats.damage,
      tower,
      elapsed: 0,
      durationSeconds: getMissileDuration(tower, stats),
      startedAt: performance.now()
    });
  }

  #fireRailgun(tower, target, stats) {
    const center = this.#getTowerCenter(tower);
    const targetPosition = this.#getCachedRaiderPosition(target);
    tower.angle = Math.atan2(targetPosition.y - center.y, targetPosition.x - center.x);
    const shieldOnly = getResearchEffectNumber(tower, "shieldOnly", 0) > 0;
    if (shieldOnly) {
      this.#damageRaiderShieldOnly(target, Math.max(0, target.shield), tower);
    }
    this.#effects.push({
      type: "rail-beam",
      from: this.#getTowerMuzzle(tower, center, targetPosition),
      targetId: target.id,
      lastTargetPosition: targetPosition,
      color: RARITY_COLORS[tower.rarity],
      damage: shieldOnly ? 0 : stats.damage,
      appliedDamage: 0,
      shieldOnly,
      voltaic: tower.research === "voltaic",
      stats,
      tower,
      elapsed: 0,
      durationSeconds: getRailgunBeamDurationSeconds(tower),
      startedAt: performance.now(),
      duration: getRailgunBeamDurationSeconds(tower) * 1000
    });
  }

  #fireRailgunPanic(tower, target) {
    const center = this.#getTowerCenter(tower);
    const exit = this.#getRoadExitPosition();
    tower.angle = Math.atan2(exit.y - center.y, exit.x - center.x);
    this.#effects.push({
      type: "electric-arc",
      from: this.#getTowerMuzzle(tower, center, exit),
      to: exit,
      color: RARITY_COLORS[tower.rarity],
      startedAt: performance.now(),
      duration: 360,
      branches: 5
    });
    this.#destroyRaiderInstantly(target, tower);
  }

  #findRadarTarget(tower) {
    const now = performance.now();
    const cloakedTarget = this.#findTowerTarget(tower, (raider) => (
      isCloakedRaider(raider) && !isRaiderCloakDisabled(raider, now)
    ));
    return cloakedTarget || this.#findTowerTarget(tower);
  }

  #findTowerTarget(tower, filter = null) {
    const stats = this.#getEffectiveTowerStats(tower);
    const center = this.#getTowerCenter(tower);
    const range = stats.rangeCells * CELL_SIZE;
    const rangeSq = range * range;
    const priority = tower.targetPriority || "first";
    let best = null;
    let bestScore = -Infinity;
    let bestTie = -Infinity;

    for (const raider of this.#getRaiderCandidatesInRange(center, range)) {
      if (!raider.alive) continue;
      if (filter && !filter(raider)) continue;
      if (!canTowerTargetRaider(tower, raider)) continue;
      const position = this.#getCachedRaiderPosition(raider);
      const dx = position.x - center.x;
      const dy = position.y - center.y;
      if (dx * dx + dy * dy > rangeSq) continue;

      let score = raider.progress;
      let tie = raider.id;
      if (priority === "strongest") {
        score = getRaiderStrength(raider);
        tie = raider.progress;
      } else if (priority === "last") {
        score = raider.id;
        tie = -raider.progress;
      }

      if (score > bestScore || (score === bestScore && tie > bestTie)) {
        best = raider;
        bestScore = score;
        bestTie = tie;
      }
    }

    return best;
  }

  #findRaygunTarget(center, range) {
    let best = null;
    let bestSpeed = -Infinity;
    let bestProgress = -Infinity;
    const rangeSq = range * range;

    for (const raider of this.#getRaiderCandidatesInRange(center, range)) {
      if (!raider.alive || isRaiderFrozen(raider, this.#time) || isFlyingRaider(raider)) continue;
      const position = this.#getCachedRaiderPosition(raider);
      const dx = position.x - center.x;
      const dy = position.y - center.y;
      if (dx * dx + dy * dy > rangeSq) continue;

      const speed = getEffectiveRaiderSpeed(raider);
      if (speed > bestSpeed || (speed === bestSpeed && raider.progress > bestProgress)) {
        best = raider;
        bestSpeed = speed;
        bestProgress = raider.progress;
      }
    }

    return best;
  }

  #freezeRaider(raider, tower) {
    if (!raider.alive || isRaiderFrozen(raider, this.#time)) return;

    const speedMultiplier = getRaygunFreezeSpeedMultiplier(tower, raider);
    const durationSeconds = getRaygunFreezeDuration(tower);
    raider.freezeSpeedMultiplier = speedMultiplier;
    raider.frozenUntil = this.#time + durationSeconds;
    raider.embrittled = tower.research === "embrittlement";
    raider.slowAssistSource = {
      towerId: tower.id,
      until: raider.frozenUntil
    };
    this.#telemetry.recordSlowApplied(tower, raider, {
      durationSeconds,
      speedMultiplier
    });
    this.#revealRaiderBars(raider);
  }

  #damageRaider(raider, damage, tower = null) {
    const brittle = isRaiderFrozen(raider, this.#time) && raider.embrittled;
    const rawDamage = brittle ? damage * getResearchEffectNumber("raygun", "embrittlement", "brittleDamageMultiplier", 2) : damage;
    let remaining = rawDamage;
    const startingHealth = Math.max(0, raider.health);
    const startingShield = Math.max(0, raider.shield);
    this.#revealRaiderBars(raider);

    if (raider.shield > 0) {
      const shieldDamageMultiplier = getShieldDamageMultiplier(tower);
      const potentialShieldDamage = remaining * shieldDamageMultiplier;
      const shieldDamage = Math.min(raider.shield, potentialShieldDamage);
      const rawDamageUsed = shieldDamage / shieldDamageMultiplier;
      raider.shield -= shieldDamage;
      remaining -= rawDamageUsed;
    }

    const damageTakenCap = RAIDER_TYPES[raider.type]?.damageTakenCap;
    if (Number.isFinite(damageTakenCap)) {
      remaining = Math.min(remaining, damageTakenCap);
    }

    raider.health -= remaining;
    const healthDamage = Math.max(0, startingHealth - Math.max(0, raider.health));
    const shieldDamage = Math.max(0, startingShield - Math.max(0, raider.shield));
    const killed = raider.health <= 0;
    const effectiveDamage = healthDamage + shieldDamage;
    this.#telemetry.recordTowerDamage(tower, {
      healthDamage,
      shieldDamage,
      rawDamage,
      killed,
      target: getRaiderTelemetryTarget(raider)
    });
    if (effectiveDamage > 0 && raider.slowAssistSource?.until >= this.#time) {
      this.#telemetry.recordSlowAssistDamage(raider.slowAssistSource.towerId, effectiveDamage, getRaiderTelemetryTarget(raider));
    }
    if (effectiveDamage > 0 && isCloakedRaider(raider) && raider.cloakRevealSource?.until >= performance.now()) {
      this.#telemetry.recordRevealAssistDamage(raider.cloakRevealSource.towerId, effectiveDamage, getRaiderTelemetryTarget(raider));
    }

    if (brittle && raider.alive) {
      raider.frozenUntil = 0;
      raider.freezeSpeedMultiplier = 1;
      raider.embrittled = false;
      raider.slowAssistSource = null;
    }

    if (killed) {
      this.#addRaiderExplosion(raider);
      raider.alive = false;
      this.#resources += raider.resources * BASE_RAIDER_RESOURCE_MULTIPLIER;
      this.#handleRaiderDeathSplit(raider);
    }
  }

  #handleRaiderDeathSplit(raider) {
    const split = RAIDER_TYPES[raider.type]?.splitOnDeath;
    if (!split) return;

    for (let index = 0; index < split.count; index++) {
      this.#spawnRaider(split.type, raider.rarity, {
        progress: Math.max(0, raider.progress - index * 0.08)
      });
    }
  }

  #addTowerShotEffects(tower, from, to) {
    const color = getTowerProjectileColor(tower);
    const direction = Math.atan2(to.y - from.y, to.x - from.x);
    const muzzleDistance = tower.type === "cannon" ? CELL_SIZE * 1.08 : CELL_SIZE * 0.88;
    const muzzle = {
      x: from.x + Math.cos(direction) * muzzleDistance,
      y: from.y + Math.sin(direction) * muzzleDistance
    };

    this.#effects.push({
      type: "projectile",
      towerType: tower.type,
      research: tower.research || "",
      from: muzzle,
      to,
      color,
      startedAt: performance.now(),
      duration: getProjectileDuration(tower)
    });

    if (tower.type === "cannon") {
      this.#effects.push({
        type: "muzzle",
        x: muzzle.x,
        y: muzzle.y,
        color: "rgba(255, 159, 67, 0.95)",
        startedAt: performance.now(),
        duration: 170
      });
    }

    if (tower.type === "minigun" && tower.research === "gatling") {
      this.#effects.push({
        type: "muzzle",
        x: muzzle.x,
        y: muzzle.y,
        color: "rgba(255, 120, 42, 0.95)",
        startedAt: performance.now(),
        duration: 120
      });
    }
  }

  #applyResearchShotEffects(tower, target, stats) {
    const penetrationChance = getResearchEffectNumber(tower, "penetrationChance", 0);
    if (penetrationChance > 0) {
      const radius = getResearchEffectNumber(tower, "penetrationRadiusCells", 2) * CELL_SIZE;
      const damage = stats.damage * getResearchEffectNumber(tower, "penetrationDamageMultiplier", 1);
      if (Math.random() < penetrationChance) {
        const targetPosition = this.#getCachedRaiderPosition(target);
        this.#damageRaidersInRadius(targetPosition.x, targetPosition.y, radius, damage, tower, target);
      }
    }

    if (getResearchEffectNumber(tower, "airburstEnabled", 0) > 0) {
      const targetPosition = this.#getCachedRaiderPosition(target);
      const damage = stats.damage * getResearchEffectNumber(tower, "airburstBombDamageMultiplier", 0.25);
      this.#spawnAirburstBombs(tower, targetPosition, damage);
    }
  }

  #getTowerHitDamage(tower, baseDamage) {
    const criticalChance = getResearchEffectNumber(tower, "criticalChance", 0);
    if (criticalChance > 0 && Math.random() < criticalChance) {
      return baseDamage * getResearchEffectNumber(tower, "criticalDamageMultiplier", 2);
    }
    return baseDamage;
  }

  #damageRaidersInRadius(x, y, radius, damage, tower, exclude = null, options = {}) {
    const radiusSq = radius * radius;
    const candidates = options.liveScan ? [...this.#raiders] : this.#getRaiderCandidatesInRange({ x, y }, radius);
    for (const raider of candidates) {
      if (!raider.alive || raider === exclude) continue;
      const position = options.liveScan ? this.#getRaiderPosition(raider) : this.#getCachedRaiderPosition(raider);
      const dx = position.x - x;
      const dy = position.y - y;
      if (dx * dx + dy * dy <= radiusSq) {
        this.#damageRaider(raider, damage, tower);
      }
    }
  }

  #applyRailgunVoltaicEffect(tower, target, stats) {
    const chance = getResearchEffectNumber(tower, "penetrationChance", 0);
    const radius = getResearchEffectNumber(tower, "penetrationRadiusCells", 3) * CELL_SIZE;
    const damage = stats.damage * getResearchEffectNumber(tower, "penetrationDamageMultiplier", 0.5);
    if (chance <= 0 || radius <= 0 || damage <= 0) return;

    const origin = this.#getCachedRaiderPosition(target);
    const radiusSq = radius * radius;
    for (const raider of this.#getRaiderCandidatesInRange(origin, radius)) {
      if (!raider.alive || raider === target) continue;
      if (!canTowerTargetRaider(tower, raider)) continue;
      if (Math.random() >= chance) continue;

      const position = this.#getCachedRaiderPosition(raider);
      const dx = position.x - origin.x;
      const dy = position.y - origin.y;
      if (dx * dx + dy * dy > radiusSq) continue;

      this.#effects.push({
        type: "electric-arc",
        from: origin,
        to: position,
        color: RARITY_COLORS[tower.rarity],
        startedAt: performance.now(),
        duration: 260,
        branches: 3
      });
      this.#damageRaider(raider, damage, tower);
    }
  }

  #spawnAirburstBombs(tower, targetPosition, damage) {
    const bombCount = Math.max(1, Math.round(getResearchEffectNumber(tower, "airburstBombCount", 4)));
    const radius = getResearchEffectNumber(tower, "airburstBombRadiusCells", 2) * CELL_SIZE;
    const delaySeconds = getResearchEffectNumber(tower, "airburstBombDelaySeconds", 0.5);

    for (let index = 0; index < bombCount; index++) {
      const angle = (TAU / bombCount) * index + Math.PI / 4;
      const offsetDistance = CELL_SIZE * 0.7;
      this.#effects.push({
        type: "airburst-bomb",
        x: targetPosition.x + Math.cos(angle) * offsetDistance,
        y: targetPosition.y + Math.sin(angle) * offsetDistance,
        radius,
        damage,
        tower,
        color: "rgba(255, 188, 79, 0.96)",
        elapsed: 0,
        delaySeconds,
        startedAt: performance.now(),
        duration: delaySeconds * 1000 + 420
      });
    }
  }

  #addRaiderExplosion(raider) {
    const position = this.#getRaiderPosition(raider);
    this.#effects.push({
      type: "explosion",
      x: position.x,
      y: position.y,
      color: getRaiderColor(raider.rarity),
      startedAt: performance.now(),
      duration: 360
    });
  }

  #getTowerCenter(tower) {
    const surfaceRect = this.#getTowerSurfaceRect(tower);
    if (surfaceRect) {
      return {
        x: surfaceRect.x + surfaceRect.width / 2,
        y: surfaceRect.y + surfaceRect.height / 2
      };
    }

    const footprint = getTowerFootprint(TOWER_DEFINITIONS[tower.type]);
    return {
      x: (tower.x + footprint / 2) * CELL_SIZE,
      y: (tower.y + footprint / 2) * CELL_SIZE
    };
  }

  #getTowerMuzzle(tower, center, targetPosition) {
    const direction = Math.atan2(targetPosition.y - center.y, targetPosition.x - center.x);
    const footprint = getTowerFootprint(TOWER_DEFINITIONS[tower.type]);
    const muzzleDistance = CELL_SIZE * footprint * 0.44;
    return {
      x: center.x + Math.cos(direction) * muzzleDistance,
      y: center.y + Math.sin(direction) * muzzleDistance
    };
  }

  #getRoadExitPosition() {
    const cell = this.#road.cells.at(-1) || { x: 0, y: 0 };
    return {
      x: cell.x * CELL_SIZE + CELL_SIZE / 2,
      y: cell.y * CELL_SIZE + CELL_SIZE / 2
    };
  }

  #getAreaDrawRect(area) {
    if (area.surface === "monolith") {
      const monolith = this.#getMonolithAtCell(area.x, area.y);
      if (monolith) return this.#getMonolithTopRect(monolith);
    }

    return {
      x: area.x * CELL_SIZE,
      y: area.y * CELL_SIZE,
      width: (area.width || 2) * CELL_SIZE,
      height: (area.height || 2) * CELL_SIZE
    };
  }

  #getTowerSurfaceRect(tower) {
    if (tower.surface !== "monolith" && tower.type !== "factory") return null;

    const monolith = this.#getMonolithAtCell(tower.x, tower.y);
    return monolith ? this.#getMonolithTopRect(monolith) : null;
  }

  #getMonolithAtWorldPoint(x, y) {
    return this.#flavor.elements.find((item) => {
      if (item.type !== "monolith") return false;
      const rect = this.#getMonolithTopRect(item);
      return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
    });
  }

  #getMonolithTopRect(element) {
    return {
      x: element.x * CELL_SIZE + MONOLITH_INSET,
      y: element.y * CELL_SIZE - MONOLITH_LIFT,
      width: element.width * CELL_SIZE - MONOLITH_INSET * 2,
      height: element.height * CELL_SIZE - MONOLITH_INSET * 2
    };
  }

  #damagePlayer(amount) {
    this.#playerHealth = Math.max(0, this.#playerHealth - amount);
    const emergencyFactories = this.#towers.filter((tower) => tower.type === "factory" && tower.research === "emergency").length;
    if (emergencyFactories > 0) {
      this.#resources += amount * emergencyFactories * getResearchEffectNumber("factory", "emergency", "damageRefundMultiplier", 1);
    }

    if (this.#playerHealth <= 0) {
      this.#gameOver = true;
      this.#finishRun({ victory: false });
    }
  }

  #finishRun({ victory, context = this.#context }) {
    if (this.#runSettled || !context) return;

    if (this.#coinYield > 0) {
      this.#runCoins += this.#coinYield;
      this.#coinYield = 0;
    }

    this.#running = false;
    this.#waveStarted = false;
    this.#spawning = false;
    this.#spawnQueue = [];
    this.#raiders = [];
    this.#runSettled = true;
    this.#runInitialized = false;
    this.#saveService.clearActiveRun();
    const telemetryPayload = this.#telemetry.finishRun({
      victory,
      level: this.#level,
      wave: this.#wave,
      playerHealth: this.#playerHealth,
      resources: this.#resources,
      coins: this.#runCoins,
      gems: this.#runGems,
      crates: this.#runCrates
    });

    const button = this.#element?.querySelector(".time-toggle");
    if (button) {
      button.dataset.running = "false";
      button.setAttribute("aria-label", "Start time");
    }

    context.navigate("game-end", {
      rewards: {
        victory,
        level: this.#level,
        coins: this.#runCoins,
        gems: [...this.#runGems],
        crates: [...this.#runCrates],
        telemetryAvailable: Boolean(telemetryPayload)
      }
    });
  }

  #drawRaiders() {
    const now = performance.now();
    const visible = this.#getVisibleWorldRect(CELL_SIZE * 3);
    let rendered = 0;
    let skipped = 0;

    for (const raider of this.#raiders) {
      const position = this.#getCachedRaiderPosition(raider);
      if (!this.#pointInRect(position.x, position.y, visible)) {
        skipped++;
        continue;
      }
      rendered++;
      const definition = RAIDER_TYPES[raider.type];
      const frameIndex = Math.floor(this.#time / definition.frameDuration) % definition.frames.length;
      const image = this.#assets.get(getRaiderAssetKey(definition, definition.frames[frameIndex], raider.rarity));

      this.#ctx.save();
      if (isCloakedRaider(raider) && !isRaiderCloakDisabled(raider, now)) {
        this.#ctx.globalAlpha = getCloakVisibility(this.#time, raider.id);
      }

      if (image?.complete && image.naturalWidth > 0) {
        this.#drawRaiderAsset(raider, image, position);
      } else {
        this.#drawRaiderFallback(raider, position);
      }
      this.#ctx.restore();

      if (this.#shouldDrawRaiderBars(raider, now)) {
        this.#drawRaiderBars(raider, position);
      }
    }
    return { rendered, skipped };
  }

  #findAntiAirTarget(tower, stats) {
    return this.#findTowerTarget(tower, (raider) => (
      this.#canReserveAntiAirMissile(raider, stats.damage)
    ));
  }

  #findRailgunTarget(tower, stats) {
    return this.#findTowerTarget(tower, (raider) => {
      if (tower.research === "static_electricity") {
        return Math.max(0, Number(raider.shield) || 0) > 0;
      }
      return Math.max(0, Number(raider.health) || 0) + Math.max(0, Number(raider.shield) || 0) > 0;
    });
  }

  #findRailgunPanicTarget(tower) {
    const threshold = getResearchEffectNumber(tower, "panicProgressThreshold", 0.985);
    const endProgress = Math.max(1, this.#road.cells.length - 1);
    let best = null;
    for (const raider of this.#raiders) {
      if (!raider.alive) continue;
      if ((raider.progress || 0) / endProgress < threshold) continue;
      if (!canTowerTargetRaider(tower, raider)) continue;
      if (!best || raider.progress > best.progress) best = raider;
    }
    return best;
  }

  #destroyRaiderInstantly(raider, tower) {
    const healthDamage = Math.max(0, Number(raider.health) || 0);
    const shieldDamage = Math.max(0, Number(raider.shield) || 0);
    this.#telemetry.recordTowerDamage(tower, {
      healthDamage,
      shieldDamage,
      rawDamage: healthDamage + shieldDamage,
      killed: true,
      target: getRaiderTelemetryTarget(raider)
    });
    this.#addRaiderExplosion(raider);
    raider.health = 0;
    raider.shield = 0;
    raider.alive = false;
    this.#resources += raider.resources * BASE_RAIDER_RESOURCE_MULTIPLIER;
    this.#handleRaiderDeathSplit(raider);
  }

  #damageRaiderShieldOnly(raider, damage, tower = null) {
    if (!raider.alive || damage <= 0 || raider.shield <= 0) return;
    const shieldDamage = Math.min(Math.max(0, raider.shield), damage);
    raider.shield -= shieldDamage;
    this.#revealRaiderBars(raider);
    this.#telemetry.recordTowerDamage(tower, {
      healthDamage: 0,
      shieldDamage,
      rawDamage: damage,
      killed: false,
      target: getRaiderTelemetryTarget(raider)
    });
    if (shieldDamage > 0 && raider.slowAssistSource?.until >= this.#time) {
      this.#telemetry.recordSlowAssistDamage(raider.slowAssistSource.towerId, shieldDamage, getRaiderTelemetryTarget(raider));
    }
    if (shieldDamage > 0 && isCloakedRaider(raider) && raider.cloakRevealSource?.until >= performance.now()) {
      this.#telemetry.recordRevealAssistDamage(raider.cloakRevealSource.towerId, shieldDamage, getRaiderTelemetryTarget(raider));
    }
  }

  #canReserveAntiAirMissile(raider, damage) {
    const capacity = this.#getRaiderRemainingMissileCapacity(raider);
    const reserved = this.#getReservedMissileDamage(raider.id);
    if (capacity <= 0) return false;
    if (reserved <= 0) return true;
    return reserved + (Number(damage) || 0) <= capacity;
  }

  #getRaiderRemainingMissileCapacity(raider) {
    return Math.max(0, (Number(raider.health) || 0) + (Number(raider.shield) || 0));
  }

  #getReservedMissileDamage(raiderId) {
    return this.#effects.reduce((total, effect) => {
      if (effect.type !== "missile" || effect.done || effect.targetId !== raiderId) return total;
      return total + (Number(effect.damage) || 0);
    }, 0);
  }

  #shouldDrawRaiderBars(raider, now = performance.now()) {
    return (raider.healthBarsVisibleUntil || 0) > now;
  }

  #revealRaiderBars(raider, durationMs = RAIDER_BAR_REVEAL_MS) {
    raider.healthBarsVisibleUntil = Math.max(
      raider.healthBarsVisibleUntil || 0,
      performance.now() + durationMs
    );
  }

  #disableRaiderCloak(raider, durationMs, tower = null) {
    const until = performance.now() + durationMs;
    raider.cloakDisabledUntil = Math.max(raider.cloakDisabledUntil || 0, until);
    if (tower) {
      raider.cloakRevealSource = {
        towerId: tower.id,
        until: raider.cloakDisabledUntil
      };
    }
    this.#revealRaiderBars(raider, durationMs);
  }

  #drawRaiderBars(raider, position) {
    const width = CELL_SIZE * 1.18;
    const height = 4;
    const x = position.x - width / 2;
    const y = position.y - CELL_SIZE * 0.98;
    const healthPct = clamp(raider.health / raider.maxHealth, 0, 1);
    const shieldPct = raider.maxShield > 0 ? clamp(raider.shield / raider.maxShield, 0, 1) : 0;

    this.#ctx.save();
    this.#ctx.fillStyle = "rgba(2, 5, 10, 0.84)";
    this.#ctx.fillRect(x, y, width, height);
    this.#ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    this.#ctx.fillRect(x, y, width * healthPct, height);

    if (shieldPct > 0) {
      this.#ctx.fillStyle = "rgba(96, 172, 255, 0.88)";
      this.#ctx.fillRect(x, y - height - 2, width * shieldPct, height);
    }

    this.#ctx.strokeStyle = "rgba(224, 252, 255, 0.42)";
    this.#ctx.lineWidth = 1;
    this.#ctx.strokeRect(x, y, width, height);
    this.#ctx.restore();
  }

  #drawMapHealthBars(worldSize) {
    if (!this.#visibleRectTouchesWorldEdge(CELL_SIZE * 2)) return { rendered: 0, skipped: 1 };

    const healthPct = clamp(this.#playerHealth / PLAYER_MAX_HEALTH, 0, 1);
    const inset = CELL_SIZE * 0.42;
    const fullLength = worldSize - inset * 2;
    const activeLength = fullLength * healthPct;
    const center = worldSize / 2;
    const start = center - activeLength / 2;
    const end = center + activeLength / 2;

    this.#ctx.save();

    this.#ctx.strokeStyle = "rgba(224, 252, 255, 0.24)";
    this.#ctx.lineWidth = 3;
    this.#ctx.lineCap = "butt";
    this.#ctx.beginPath();
    this.#ctx.moveTo(inset, inset);
    this.#ctx.lineTo(worldSize - inset, inset);
    this.#ctx.moveTo(inset, worldSize - inset);
    this.#ctx.lineTo(worldSize - inset, worldSize - inset);
    this.#ctx.moveTo(inset, inset);
    this.#ctx.lineTo(inset, worldSize - inset);
    this.#ctx.moveTo(worldSize - inset, inset);
    this.#ctx.lineTo(worldSize - inset, worldSize - inset);
    this.#ctx.stroke();

    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.strokeStyle = "rgba(68, 255, 239, 0.9)";
    this.#ctx.lineWidth = 11;
    this.#ctx.shadowColor = "rgba(68, 255, 239, 0.66)";
    this.#ctx.shadowBlur = 8;
    this.#ctx.beginPath();
    this.#ctx.moveTo(start, inset);
    this.#ctx.lineTo(end, inset);
    this.#ctx.moveTo(start, worldSize - inset);
    this.#ctx.lineTo(end, worldSize - inset);
    this.#ctx.moveTo(inset, start);
    this.#ctx.lineTo(inset, end);
    this.#ctx.moveTo(worldSize - inset, start);
    this.#ctx.lineTo(worldSize - inset, end);
    this.#ctx.stroke();

    this.#ctx.restore();
    return { rendered: 1, skipped: 0 };
  }

  #drawRaiderAsset(raider, image, position) {
    const definition = RAIDER_TYPES[raider.type];
    const size = CELL_SIZE * (definition.assetScale || 1.35);

    this.#ctx.save();
    this.#ctx.translate(position.x, position.y);
    this.#ctx.rotate(this.#getRaiderDrawAngle(raider) + getRaiderAssetRotationOffset(raider.type));
    this.#ctx.globalCompositeOperation = "lighter";
    if (isRaiderFrozen(raider, this.#time)) {
      this.#drawFreezeHalo(size);
    }
    this.#ctx.drawImage(image, -size / 2, -size / 2, size, size);
    this.#ctx.restore();
  }

  #drawRaiderFallback(raider, position) {
    this.#ctx.save();
    this.#ctx.translate(position.x, position.y);
    if (raider.type === "jet") {
      this.#ctx.rotate(this.#getRaiderDrawAngle(raider));
    }
    if (isRaiderFrozen(raider, this.#time)) {
      this.#drawFreezeHalo(CELL_SIZE * 1.35);
    }
    this.#ctx.strokeStyle = getRaiderColor(raider.rarity);
    this.#ctx.lineWidth = 2;

    if (raider.type === "car") {
      this.#ctx.strokeRect(-14, -8, 28, 16);
      this.#ctx.beginPath();
      this.#ctx.arc(-8, 9, 3, 0, Math.PI * 2);
      this.#ctx.arc(8, 9, 3, 0, Math.PI * 2);
      this.#ctx.stroke();
      this.#ctx.restore();
      return;
    }

    if (raider.type === "jet") {
      this.#ctx.beginPath();
      this.#ctx.moveTo(0, -22);
      this.#ctx.lineTo(8, 8);
      this.#ctx.lineTo(22, 17);
      this.#ctx.lineTo(5, 18);
      this.#ctx.lineTo(0, 26);
      this.#ctx.lineTo(-5, 18);
      this.#ctx.lineTo(-22, 17);
      this.#ctx.lineTo(-8, 8);
      this.#ctx.closePath();
      this.#ctx.stroke();
      this.#ctx.beginPath();
      this.#ctx.moveTo(0, -16);
      this.#ctx.lineTo(0, 18);
      this.#ctx.stroke();
      this.#ctx.restore();
      return;
    }

    this.#ctx.beginPath();
    this.#ctx.arc(0, -7, 4, 0, Math.PI * 2);
    this.#ctx.moveTo(0, -3);
    this.#ctx.lineTo(0, 10);
    this.#ctx.moveTo(-7, 2);
    this.#ctx.lineTo(7, 2);
    this.#ctx.moveTo(0, 10);
    this.#ctx.lineTo(-6, 18);
    this.#ctx.moveTo(0, 10);
    this.#ctx.lineTo(6, 18);
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #drawFreezeHalo(size) {
    const radius = size * 0.42;

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "source-over";
    this.#ctx.fillStyle = "rgba(124, 226, 255, 0.18)";
    this.#ctx.strokeStyle = "rgba(124, 226, 255, 0.72)";
    this.#ctx.lineWidth = Math.max(2, size * 0.04);
    this.#ctx.shadowColor = "rgba(124, 226, 255, 0.62)";
    this.#ctx.shadowBlur = size * 0.08;
    this.#ctx.beginPath();
    this.#ctx.ellipse(0, size * 0.24, radius, radius * 0.28, 0, 0, TAU);
    this.#ctx.fill();
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #getRaiderPosition(raider) {
    if (isFlyingRaider(raider) && raider.flightPhase === "circling") {
      return this.#getJetOrbitState(raider).position;
    }

    return this.#getRoadPosition(raider.progress);
  }

  #getRaiderDrawAngle(raider) {
    if (isFlyingRaider(raider) && raider.flightPhase === "circling") {
      return this.#getJetOrbitState(raider).angle + Math.PI;
    }

    if (raider.type === "walker") {
      return this.#getWalkerDrawAngle(raider.progress);
    }

    return this.#getRaiderAngle(raider.progress);
  }

  #getWalkerDrawAngle(progress) {
    const index = Math.floor(progress);
    const cells = this.#road.cells;
    const a = cells[index] || cells[0];
    const b = cells[index + 1] || a;
    const dx = b.x - a.x;

    if (dx > 0) return Math.PI / 2;
    if (dx < 0) return -Math.PI / 2;
    return 0;
  }

  #getJetOrbitState(raider) {
    const entrance = this.#getRoadPosition(0);
    const cells = this.#road.cells;
    const a = cells[0] || { x: 0, y: 0 };
    const b = cells[1] || { x: a.x + 1, y: a.y };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const radius = JET_ORBIT_RADIUS_CELLS * CELL_SIZE;
    const angle = Math.PI + TAU * ((Number(raider.flightTime) || 0) / JET_ORBIT_DURATION);
    const center = {
      x: entrance.x + (dx / length) * radius,
      y: entrance.y + (dy / length) * radius
    };

    return {
      angle,
      position: {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      }
    };
  }

  #getRoadPosition(progress) {
    const index = Math.floor(progress);
    const fraction = progress - index;
    const cells = this.#road.cells;
    const a = cells[index] || cells[0];
    const b = cells[index + 1] || a;

    return {
      x: (a.x + (b.x - a.x) * fraction) * CELL_SIZE + CELL_SIZE / 2,
      y: (a.y + (b.y - a.y) * fraction) * CELL_SIZE + CELL_SIZE / 2
    };
  }

  #getRaiderAngle(progress) {
    const index = Math.floor(progress);
    const cells = this.#road.cells;
    const a = cells[index] || cells[0];
    const b = cells[index + 1] || a;
    return Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
  }

  #syncRunHud() {
    if (!this.#element) return;

    const resourceDisplay = this.#element.querySelector("[data-resource-display]");
    const runCoinDisplay = this.#element.querySelector("[data-run-coin-display]");
    const runGemDisplay = this.#element.querySelector("[data-run-gem-display]");
    const runCrateDisplay = this.#element.querySelector("[data-run-crate-display]");
    const waveDisplay = this.#element.querySelector("[data-wave-display]");

    if (resourceDisplay) {
      resourceDisplay.textContent = `${Math.floor(this.#resources)}R`;
    }

    if (runCoinDisplay) {
      runCoinDisplay.textContent = `+${this.#runCoins} Coins`;
    }

    if (runGemDisplay) {
      runGemDisplay.textContent = `+${this.#runGems.length} Gems`;
    }

    if (runCrateDisplay) {
      runCrateDisplay.textContent = `+${this.#runCrates.length} Crates`;
    }

    if (waveDisplay) {
      waveDisplay.textContent = this.#gameOver ? "Game Over" : `Wave ${this.#wave} / ${this.#getWaveCount()}`;
    }

    this.#refreshTowerPopupAffordability();
  }

  #drawFlavorElement(element) {
    const image = this.#assets.get(element.type);

    if (image?.complete && image.naturalWidth > 0) {
      this.#drawAssetElement(element, image);
      return;
    }

    if (element.type === "tree") {
      this.#drawWireTree(element);
    } else if (element.type === "boulder") {
      this.#drawWireBoulder(element);
    } else if (element.type === "lake") {
      this.#drawWireLake(element);
    } else if (element.type === "monolith") {
      this.#drawMonolith(element);
    }
  }

  #drawAssetElement(element, image) {
    const x = (element.x + element.width / 2) * CELL_SIZE;
    const y = (element.y + element.height / 2) * CELL_SIZE;
    const size = getAssetSize(element.type) * element.scale;

    this.#ctx.save();
    this.#ctx.translate(x, y);
    this.#applyDirectionalCant(element.cant);
    this.#ctx.rotate(getAssetRotation(element));
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.drawImage(image, -size / 2, -size / 2, size, size);
    this.#ctx.restore();
  }

  #drawWireTree(element) {
    const x = (element.x + element.width / 2) * CELL_SIZE;
    const y = (element.y + element.height / 2) * CELL_SIZE;
    const scale = element.scale;

    this.#ctx.save();
    this.#ctx.translate(x, y);
    this.#ctx.rotate(element.rotation * 0.12);
    this.#applyDirectionalCant(element.cant);
    this.#ctx.scale(scale, scale);

    this.#ctx.strokeStyle = "rgba(144, 222, 120, 0.74)";
    this.#ctx.lineWidth = 1.6;
    this.#ctx.lineJoin = "round";
    this.#ctx.shadowColor = "rgba(144, 222, 120, 0.18)";
    this.#ctx.shadowBlur = 8;

    this.#ctx.beginPath();
    this.#ctx.moveTo(0, -12);
    this.#ctx.lineTo(10, 7);
    this.#ctx.lineTo(3, 7);
    this.#ctx.lineTo(8, 15);
    this.#ctx.lineTo(-8, 15);
    this.#ctx.lineTo(-3, 7);
    this.#ctx.lineTo(-10, 7);
    this.#ctx.closePath();
    this.#ctx.stroke();

    this.#ctx.beginPath();
    this.#ctx.moveTo(0, 14);
    this.#ctx.lineTo(0, 20);
    this.#ctx.stroke();

    this.#ctx.restore();
  }

  #drawWireBoulder(element) {
    const x = (element.x + element.width / 2) * CELL_SIZE;
    const y = (element.y + element.height / 2) * CELL_SIZE;
    const radius = CELL_SIZE * 0.38 * element.scale;

    this.#ctx.save();
    this.#ctx.translate(x, y);
    this.#ctx.rotate(element.rotation);
    this.#applyDirectionalCant(element.cant);

    this.#ctx.strokeStyle = "rgba(176, 184, 196, 0.74)";
    this.#ctx.lineWidth = 1.8;
    this.#ctx.lineJoin = "round";
    this.#ctx.shadowColor = "rgba(176, 184, 196, 0.12)";
    this.#ctx.shadowBlur = 8;

    this.#ctx.beginPath();
    for (let index = 0; index < 9; index++) {
      const angle = (index / 9) * Math.PI * 2;
      const wobble = 0.78 + Math.sin(index * 1.7 + element.rotation) * 0.14;
      const px = Math.cos(angle) * radius * wobble;
      const py = Math.sin(angle) * radius * wobble;

      if (index === 0) this.#ctx.moveTo(px, py);
      else this.#ctx.lineTo(px, py);
    }
    this.#ctx.closePath();
    this.#ctx.stroke();

    this.#ctx.beginPath();
    this.#ctx.moveTo(-radius * 0.35, -radius * 0.1);
    this.#ctx.lineTo(radius * 0.25, -radius * 0.32);
    this.#ctx.moveTo(-radius * 0.1, radius * 0.22);
    this.#ctx.lineTo(radius * 0.42, radius * 0.08);
    this.#ctx.stroke();

    this.#ctx.restore();
  }

  #drawWireLake(element) {
    const x = (element.x + element.width / 2) * CELL_SIZE;
    const y = (element.y + element.height / 2) * CELL_SIZE;
    const radiusX = Math.max(CELL_SIZE, element.width * CELL_SIZE * 0.5);
    const radiusY = Math.max(CELL_SIZE, element.height * CELL_SIZE * 0.5);

    this.#ctx.save();
    this.#ctx.translate(x, y);
    this.#ctx.rotate((element.rotation || 0) * 0.08);
    this.#ctx.strokeStyle = "rgba(96, 172, 255, 0.62)";
    this.#ctx.fillStyle = "rgba(96, 172, 255, 0.12)";
    this.#ctx.lineWidth = 2;
    this.#ctx.shadowColor = "rgba(96, 172, 255, 0.22)";
    this.#ctx.shadowBlur = 12;

    this.#ctx.beginPath();
    this.#ctx.ellipse(0, 0, radiusX * 0.92, radiusY * 0.74, 0, 0, TAU);
    this.#ctx.fill();
    this.#ctx.stroke();

    this.#ctx.setLineDash([CELL_SIZE * 0.34, CELL_SIZE * 0.24]);
    this.#ctx.beginPath();
    this.#ctx.ellipse(0, 0, radiusX * 0.64, radiusY * 0.42, 0, 0, TAU);
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #drawMonolith(element) {
    const x = element.x * CELL_SIZE;
    const y = element.y * CELL_SIZE;
    const width = element.width * CELL_SIZE;
    const height = element.height * CELL_SIZE;
    const top = this.#getMonolithTopRect(element);
    const topX = top.x;
    const topY = top.y;
    const topWidth = top.width;
    const topHeight = top.height;
    const baseX = x;
    const baseY = y + MONOLITH_INSET;
    const baseWidth = width;
    const baseHeight = height;

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "source-over";

    this.#ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    this.#ctx.fillRect(baseX + CELL_SIZE * 0.22, baseY + CELL_SIZE * 0.38, baseWidth, baseHeight);

    this.#ctx.fillStyle = "rgba(15, 19, 27, 0.98)";
    this.#ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    this.#ctx.lineWidth = 1.8;
    this.#ctx.beginPath();
    this.#ctx.moveTo(topX, topY + topHeight);
    this.#ctx.lineTo(topX + topWidth, topY + topHeight);
    this.#ctx.lineTo(baseX + baseWidth, baseY + baseHeight);
    this.#ctx.lineTo(baseX, baseY + baseHeight);
    this.#ctx.closePath();
    this.#ctx.fill();
    this.#ctx.stroke();

    this.#ctx.fillStyle = "rgba(35, 42, 55, 0.98)";
    this.#ctx.beginPath();
    this.#ctx.moveTo(topX + topWidth, topY);
    this.#ctx.lineTo(baseX + baseWidth, baseY);
    this.#ctx.lineTo(baseX + baseWidth, baseY + baseHeight);
    this.#ctx.lineTo(topX + topWidth, topY + topHeight);
    this.#ctx.closePath();
    this.#ctx.fill();
    this.#ctx.stroke();

    this.#ctx.fillStyle = "rgba(24, 30, 41, 0.98)";
    this.#ctx.beginPath();
    this.#ctx.moveTo(topX, topY);
    this.#ctx.lineTo(baseX, baseY);
    this.#ctx.lineTo(baseX, baseY + baseHeight);
    this.#ctx.lineTo(topX, topY + topHeight);
    this.#ctx.closePath();
    this.#ctx.fill();
    this.#ctx.stroke();

    this.#ctx.fillStyle = "rgba(230, 236, 246, 0.18)";
    this.#ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    this.#ctx.shadowColor = "rgba(255, 255, 255, 0.28)";
    this.#ctx.shadowBlur = 14;
    this.#ctx.beginPath();
    this.#ctx.moveTo(topX, topY);
    this.#ctx.lineTo(topX + topWidth, topY);
    this.#ctx.lineTo(topX + topWidth, topY + topHeight);
    this.#ctx.lineTo(topX, topY + topHeight);
    this.#ctx.closePath();
    this.#ctx.fill();
    this.#ctx.stroke();

    this.#ctx.shadowBlur = 0;
    this.#ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    for (let step = 1; step < element.width; step++) {
      const px = topX + step * (topWidth / element.width);
      this.#ctx.beginPath();
      this.#ctx.moveTo(px, topY + 4);
      this.#ctx.lineTo(px, topY + topHeight - 4);
      this.#ctx.stroke();
    }
    for (let step = 1; step < element.height; step++) {
      const py = topY + step * (topHeight / element.height);
      this.#ctx.beginPath();
      this.#ctx.moveTo(topX + 4, py);
      this.#ctx.lineTo(topX + topWidth - 4, py);
      this.#ctx.stroke();
    }

    this.#ctx.strokeStyle = "rgba(255, 255, 255, 0.52)";
    this.#ctx.beginPath();
    this.#ctx.moveTo(topX + 2, topY + 2);
    this.#ctx.lineTo(topX + topWidth - 2, topY + 2);
    this.#ctx.lineTo(topX + topWidth - 2, topY + topHeight - 2);
    this.#ctx.lineTo(topX + 2, topY + topHeight - 2);
    this.#ctx.closePath();
    this.#ctx.stroke();

    this.#ctx.restore();
  }

  #applyDirectionalCant(cant) {
    if (!cant) return;

    const horizontalSkew = clamp(cant.x, -1, 1) * -0.18;
    const verticalSkew = clamp(cant.y, -1, 1) * 0.24;
    const horizontalSquash = 1 - Math.abs(cant.x) * 0.08;
    const verticalSquash = 1 - Math.abs(cant.y) * 0.12;
    this.#ctx.transform(horizontalSquash, horizontalSkew, verticalSkew, verticalSquash, 0, 0);
  }

  #loadAssets() {
    for (const [type, source] of Object.entries(ASSET_SOURCES)) {
      const image = getCachedImage(source, () => {
        if (type === "tree" || type === "boulder") {
          this.#markStaticLayerDirty();
        } else {
          this.#requestDraw();
        }
      });
      this.#assets.set(type, image);
    }
  }

  #getVisibleWorldRect(padding = 0) {
    const scale = Math.max(0.0001, this.#camera.scale);
    const left = (-this.#camera.x) / scale - padding;
    const top = (-this.#camera.y) / scale - padding;
    const width = window.innerWidth / scale + padding * 2;
    const height = window.innerHeight / scale + padding * 2;

    return {
      x: left,
      y: top,
      width,
      height
    };
  }

  #rectsIntersect(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  #pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }

  #visibleRectTouchesWorldEdge(padding = 0) {
    const rect = this.#getVisibleWorldRect(padding);
    return (
      rect.x <= padding ||
      rect.y <= padding ||
      rect.x + rect.width >= this.#worldWidth() - padding ||
      rect.y + rect.height >= this.#worldHeight() - padding
    );
  }

  #effectIntersectsVisibleRect(effect, visible) {
    if (effect.type === "projectile" || effect.type === "factory-beam" || effect.type === "radar-pulse" || effect.type === "rail-beam" || effect.type === "electric-arc") {
      const from = effect.from || { x: effect.x, y: effect.y };
      const to = effect.to || effect.lastTargetPosition || { x: effect.x, y: -CELL_SIZE * 5 };
      const rect = {
        x: Math.min(from.x, to.x),
        y: Math.min(from.y, to.y),
        width: Math.abs(to.x - from.x),
        height: Math.abs(to.y - from.y)
      };
      return this.#rectsIntersect(visible, {
        x: rect.x - CELL_SIZE,
        y: rect.y - CELL_SIZE,
        width: rect.width + CELL_SIZE * 2,
        height: rect.height + CELL_SIZE * 2
      });
    }

    if (effect.type === "missile") {
      const to = effect.lastTargetPosition || effect.from;
      const rect = {
        x: Math.min(effect.from.x, to.x) - CELL_SIZE,
        y: Math.min(effect.from.y, to.y) - CELL_SIZE,
        width: Math.abs(to.x - effect.from.x) + CELL_SIZE * 2,
        height: Math.abs(to.y - effect.from.y) + CELL_SIZE * 2
      };
      return this.#rectsIntersect(visible, rect);
    }

    if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y)) return true;
    const radius = Math.max(CELL_SIZE, Number(effect.radius) || Number(effect.size) || CELL_SIZE * 2);
    return this.#rectsIntersect(visible, {
      x: effect.x - radius,
      y: effect.y - radius,
      width: radius * 2,
      height: radius * 2
    });
  }

  #requestDraw() {
    this.#needsDraw = true;
  }

  #drawEdgeGradient(worldSize, time) {
    const edgeSides = this.#getVisibleEdgeSides(worldSize, CELL_SIZE * 3);
    if (edgeSides.length <= 0) return { rendered: 0, skipped: 1 };

    const gradient = this.#ctx.createLinearGradient(0, 0, worldSize, worldSize);
    const colors = this.#getWaveColors(time);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[2]);

    this.#ctx.save();
    this.#ctx.strokeStyle = gradient;
    this.#ctx.lineWidth = Math.max(1.25, 3 / Math.sqrt(this.#camera.scale));
    this.#ctx.shadowColor = colors[1];
    this.#ctx.shadowBlur = this.#getEdgeShadowBlur(8 + this.#getBreath(time) * 8);
    for (const side of edgeSides) {
      this.#drawEdgeBorderSegment(side, worldSize);
    }

    this.#drawEdgeFire(worldSize, time, colors, edgeSides);
    this.#ctx.restore();
    return { rendered: edgeSides.length, skipped: 4 - edgeSides.length };
  }

  #getVisibleEdgeSides(worldSize, padding) {
    const rect = this.#getVisibleWorldRect(padding);
    const startX = clamp(rect.x - padding, 0, worldSize);
    const endX = clamp(rect.x + rect.width + padding, 0, worldSize);
    const startY = clamp(rect.y - padding, 0, worldSize);
    const endY = clamp(rect.y + rect.height + padding, 0, worldSize);
    const sides = [];

    if (rect.y <= padding && endX > startX) {
      sides.push({ side: "top", start: startX, end: endX });
    }
    if (rect.x + rect.width >= worldSize - padding && endY > startY) {
      sides.push({ side: "right", start: startY, end: endY });
    }
    if (rect.y + rect.height >= worldSize - padding && endX > startX) {
      sides.push({ side: "bottom", start: startX, end: endX });
    }
    if (rect.x <= padding && endY > startY) {
      sides.push({ side: "left", start: startY, end: endY });
    }

    return sides;
  }

  #drawEdgeBorderSegment(edge, worldSize) {
    const start = edgePoint(edge.side, edge.start, 1.5, worldSize);
    const end = edgePoint(edge.side, edge.end, 1.5, worldSize);

    this.#ctx.beginPath();
    this.#ctx.moveTo(start.x, start.y);
    this.#ctx.lineTo(end.x, end.y);
    this.#ctx.stroke();
  }

  #drawEdgeFire(worldSize, time, colors, edgeSides) {
    const breath = this.#getBreath(time);
    const flameDepth = CELL_SIZE * (1.35 + breath * 0.45);

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";

    const offsets = { top: 0, right: 7.1, bottom: 13.4, left: 19.8 };
    for (const edge of edgeSides) {
      this.#drawFireSide(edge, worldSize, flameDepth, time + offsets[edge.side], colors);
    }

    this.#ctx.restore();
  }

  #drawFireSide(edge, worldSize, depth, time, colors) {
    const zoom = this.#camera.scale;
    const step = CELL_SIZE * (zoom > 1.4 ? 1.75 : zoom > 0.75 ? 1.25 : 1);
    const start = Math.floor(edge.start / step) * step;
    const end = Math.ceil(edge.end / step) * step;
    const segments = Math.max(1, Math.ceil((end - start) / step));
    const widthScale = 1 / Math.sqrt(Math.max(1, zoom * 0.8));
    const shadowScale = this.#getEdgeShadowBlur(1) / 1;

    for (let layer = 0; layer < 2; layer++) {
      const layerDepth = depth * (1 - layer * 0.17);
      const alpha = 0.18 - layer * 0.035;
      const lineWidth = (9 - layer * 1.5) * widthScale;
      const phase = time * (0.9 + layer * 0.18) + this.#gradientSeed[`phase${String.fromCharCode(65 + layer % 3)}`];

      this.#ctx.beginPath();

      for (let index = 0; index <= segments; index++) {
        const along = clamp(start + index * step, edge.start, edge.end);
        const waveIndex = along / CELL_SIZE;
        const wave =
          Math.sin(waveIndex * 0.72 + phase) * 0.54 +
          Math.sin(waveIndex * 1.37 - phase * 0.72) * 0.32 +
          Math.sin(waveIndex * 2.11 + phase * 0.38) * 0.18;
        const lick = Math.max(0, wave) * layerDepth;
        const inset = 2 + lick + layer * 5;
        const point = edgePoint(edge.side, along, inset, worldSize);

        if (index === 0) this.#ctx.moveTo(point.x, point.y);
        else this.#ctx.lineTo(point.x, point.y);
      }

      this.#ctx.strokeStyle = withAlpha(colors[layer % colors.length], alpha);
      this.#ctx.lineWidth = lineWidth;
      this.#ctx.lineCap = "round";
      this.#ctx.lineJoin = "round";
      this.#ctx.shadowColor = colors[layer % colors.length];
      this.#ctx.shadowBlur = (8 - layer * 2) * shadowScale;
      this.#ctx.stroke();
    }
  }

  #getEdgeShadowBlur(baseBlur) {
    if (this.#camera.scale >= 2.4) return baseBlur * 0.35;
    if (this.#camera.scale >= 1.4) return baseBlur * 0.55;
    return baseBlur;
  }

  #getWaveColors(time) {
    const seed = this.#gradientSeed;
    const waveA = Math.sin(time * seed.speedA + seed.phaseA);
    const waveB = Math.sin(time * seed.speedB + seed.phaseB);
    const waveC = Math.sin(time * seed.speedC + seed.phaseC);
    const breath = this.#getBreath(time);

    return [
      hsl(seed.hueA + waveA * 10, 96, 62 + breath * 8, 0.78 + breath * 0.2),
      hsl(seed.hueB + waveB * 12, 98, 58 + breath * 10, 0.7 + breath * 0.22),
      hsl(seed.hueC + waveC * 10, 95, 60 + breath * 8, 0.76 + breath * 0.2)
    ];
  }

  #getBreath(time) {
    return 0.5 + Math.sin(time * 0.9) * 0.5;
  }

  #getPinchDistance() {
    const pointers = Array.from(this.#pointers.values());
    if (pointers.length < 2) return 0;
    return Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
  }

  #getPinchCenter() {
    const pointers = Array.from(this.#pointers.values());
    return {
      x: (pointers[0].x + pointers[1].x) / 2,
      y: (pointers[0].y + pointers[1].y) / 2
    };
  }

  #clampCamera() {
    const worldWidth = this.#worldWidth() * this.#camera.scale;
    const worldHeight = this.#worldHeight() * this.#camera.scale;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = CAMERA_EDGE_DRAG_MARGIN;

    if (worldWidth <= width) {
      this.#camera.x = (width - worldWidth) / 2;
    } else {
      this.#camera.x = clamp(this.#camera.x, width - worldWidth - margin, margin);
    }

    if (worldHeight <= height) {
      this.#camera.y = (height - worldHeight) / 2;
    } else {
      this.#camera.y = clamp(this.#camera.y, height - worldHeight - margin, margin);
    }
  }

  #worldSize() {
    return Math.max(this.#worldWidth(), this.#worldHeight());
  }

  #worldWidth() {
    return this.#gridWidth() * CELL_SIZE;
  }

  #worldHeight() {
    return this.#gridHeight() * CELL_SIZE;
  }

  #gridWidth() {
    return this.#levelDefinition?.dimensions?.width || FIRST_TIER_GRID_SIZE;
  }

  #gridHeight() {
    return this.#levelDefinition?.dimensions?.height || FIRST_TIER_GRID_SIZE;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createGradientSeed() {
  return {
    hueA: randomRange(176, 188),
    hueB: randomRange(190, 205),
    hueC: randomRange(162, 176),
    phaseA: randomRange(0, TAU),
    phaseB: randomRange(0, TAU),
    phaseC: randomRange(0, TAU),
    speedA: randomRange(0.45, 0.75),
    speedB: randomRange(0.32, 0.62),
    speedC: randomRange(0.38, 0.68)
  };
}

function hsl(hue, saturation, lightness, alpha) {
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function edgePoint(side, along, inset, worldSize) {
  const clampedAlong = clamp(along, 0, worldSize);

  if (side === "top") return { x: clampedAlong, y: inset };
  if (side === "right") return { x: worldSize - inset, y: clampedAlong };
  if (side === "bottom") return { x: worldSize - clampedAlong, y: worldSize - inset };
  return { x: inset, y: worldSize - clampedAlong };
}

function withAlpha(color, alpha) {
  return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
}

function getAssetSize(type) {
  if (type === "tree") return CELL_SIZE * 2.45;
  if (type === "boulder") return CELL_SIZE * 2.05;
  return CELL_SIZE * 1.5;
}

function getAssetRotation(element) {
  if (element.type === "tree") return 0;
  return element.rotation;
}

function getRaiderColor(rarity) {
  if (rarity === "uncommon") return "rgba(144, 222, 120, 0.9)";
  if (rarity === "rare") return "rgba(96, 172, 255, 0.9)";
  if (rarity === "epic") return "rgba(177, 102, 255, 0.92)";
  if (rarity === "legendary") return "rgba(255, 182, 54, 0.94)";
  return "rgba(255, 255, 255, 0.9)";
}

function getRarityAssetName(asset, rarity) {
  return `${asset}_${rarity}`;
}

function getTowerAssetKey(definition, rarity) {
  return definition.usesRarityAssets === false ? definition.asset : getRarityAssetName(definition.asset, rarity);
}

function getTowerDrawAssetKey(definition, tower) {
  const asset = definition.emptyAsset && tower.cooldown > 0 ? definition.emptyAsset : definition.asset;
  return definition.usesRarityAssets === false ? asset : getRarityAssetName(asset, tower.rarity);
}

function getTowerAssetRotationOffset(type) {
  return type === "railgun" ? Math.PI / 2 : 0;
}

function getRaiderAssetKey(definition, asset, rarity) {
  return definition.usesRarityAssets === false ? asset : getRarityAssetName(asset, rarity);
}

function getJetOrbitCircuits(rarity) {
  return JET_ORBIT_CIRCUITS_BY_RARITY[rarity] || JET_ORBIT_CIRCUITS_BY_RARITY.rare || 3;
}

function getRaiderTelemetryTarget(raider) {
  return {
    raiderId: raider.id,
    type: raider.type,
    rarity: raider.rarity,
    flying: isFlyingRaider(raider),
    cloaked: isCloakedRaider(raider)
  };
}

function getTowerFootprint(definition) {
  return definition?.footprint || 2;
}

function getEffectiveRaiderSpeed(raider) {
  return raider.speed * (raider.freezeSpeedMultiplier || 1);
}

function isFlyingRaider(raider) {
  return Boolean(RAIDER_TYPES[raider.type]?.flying);
}

function isCloakedRaider(raider) {
  return Boolean(RAIDER_TYPES[raider.type]?.cloaked);
}

function isRaiderCloakDisabled(raider, now = performance.now()) {
  return (raider.cloakDisabledUntil || 0) > now;
}

function getCloakVisibility(time, seed = 0) {
  return 0.25 + Math.sin(time * 8 + seed * 1.618) * 0.25;
}

function towerSeesThroughCloak(tower) {
  return (
    tower.type === "radar" ||
    (tower.type === "minigun" && tower.research === "night_vision") ||
    (tower.type === "cannon" && tower.research === "snare")
  );
}

function canTowerTargetRaider(tower, raider) {
  const definition = TOWER_DEFINITIONS[tower.type];
  if (isCloakedRaider(raider) && !isRaiderCloakDisabled(raider) && !towerSeesThroughCloak(tower)) return false;
  if (definition?.flyingOnly) return isFlyingRaider(raider);
  if (!isFlyingRaider(raider)) return true;
  return Boolean(definition?.canTargetFlying);
}

function normalizeGameSpeed(speed) {
  const numericSpeed = Number(speed) || 1;
  return GAME_SPEEDS.reduce((closest, candidate) => (
    Math.abs(candidate - numericSpeed) < Math.abs(closest - numericSpeed) ? candidate : closest
  ), GAME_SPEEDS[0]);
}

function getGameSpeedIndex(speed) {
  return GAME_SPEEDS.indexOf(normalizeGameSpeed(speed));
}

function createTierTwoWaveDefinitions(levelOffset) {
  const bump = Math.max(0, levelOffset);
  return {
    1: [
      { type: "walker", rarity: "uncommon", count: 14 + bump * 2 },
      { type: "walker", rarity: "rare", count: 2 + bump }
    ],
    2: [
      { type: "walker", rarity: "uncommon", count: 18 + bump * 2 },
      { type: "fastcar", rarity: "common", count: 3 + bump }
    ],
    3: [
      { type: "walker", rarity: "rare", count: 10 + bump * 2 },
      { type: "car", rarity: "uncommon", count: 2 + bump }
    ],
    4: [
      { type: "walker", rarity: "uncommon", count: 24 + bump * 3 },
      { type: "fastcar", rarity: "uncommon", count: 4 + bump }
    ],
    5: [
      { type: "car", rarity: "uncommon", count: 5 + bump },
      { type: "walker", rarity: "rare", count: 8 + bump * 2 }
    ],
    6: [
      { type: "walker", rarity: "rare", count: 18 + bump * 2 },
      { type: "fastcar", rarity: "uncommon", count: 5 + bump }
    ],
    7: [
      { type: "walker", rarity: "epic", count: 3 + bump },
      { type: "car", rarity: "uncommon", count: 5 + bump }
    ],
    8: [
      { type: "fastcar", rarity: "rare", count: 4 + bump },
      { type: "walker", rarity: "rare", count: 14 + bump * 2 }
    ],
    9: [
      { type: "car", rarity: "rare", count: 4 + bump },
      { type: "walker", rarity: "epic", count: 4 + bump }
    ],
    10: [
      { type: "heavy_transport", rarity: "common", count: 2 + bump },
      { type: "fastcar", rarity: "uncommon", count: 6 + bump }
    ],
    11: [
      { type: "walker", rarity: "rare", count: 24 + bump * 3 },
      { type: "car", rarity: "rare", count: 4 + bump }
    ],
    12: [
      { type: "fastcar", rarity: "rare", count: 6 + bump },
      { type: "walker", rarity: "epic", count: 6 + bump }
    ],
    13: [
      { type: "car", rarity: "epic", count: 2 + bump },
      { type: "walker", rarity: "rare", count: 18 + bump * 2 }
    ],
    14: [
      { type: "heavy_transport", rarity: "uncommon", count: 2 + bump },
      { type: "fastcar", rarity: "rare", count: 6 + bump }
    ],
    15: [
      { type: "walker", rarity: "epic", count: 10 + bump },
      { type: "car", rarity: "rare", count: 5 + bump }
    ],
    16: [
      { type: "fastcar", rarity: "rare", count: 9 + bump },
      { type: "car", rarity: "epic", count: 3 + bump }
    ],
    17: [
      { type: "heavy_transport", rarity: "uncommon", count: 3 + bump },
      { type: "walker", rarity: "epic", count: 8 + bump }
    ],
    18: [
      { type: "car", rarity: "epic", count: 4 + bump },
      { type: "fastcar", rarity: "rare", count: 8 + bump }
    ],
    19: [
      { type: "walker", rarity: "legendary", count: 3 + bump },
      { type: "heavy_transport", rarity: "rare", count: 2 + bump },
      { type: "fastcar", rarity: "rare", count: 7 + bump }
    ],
    20: [
      { type: "heavy_transport", rarity: "rare", count: 3 + bump },
      { type: "car", rarity: "epic", count: 5 + bump },
      { type: "walker", rarity: "legendary", count: 4 + bump }
    ]
  };
}

function getRaiderAssetRotationOffset(type) {
  return type === "heavy_transport" ? -Math.PI / 2 : 0;
}

function getRaiderStrength(raider) {
  return Math.max(0, raider.health) + Math.max(0, raider.shield);
}

function isRaiderFrozen(raider, time) {
  return (raider.frozenUntil || 0) > time;
}

function getEffectiveTowerStats(tower) {
  const base = TOWER_DEFINITIONS[tower.type].rarities[tower.rarity];
  return applyResearchStatTuning(base, tower);
}

function getFactoryResourceYield(tower, stats, slotMultiplier, creditAge) {
  const baseYield = Math.ceil((creditAge / 4) * (stats.rarityMultiplier || 1) * slotMultiplier);
  return Math.ceil(baseYield * getResearchEffectNumber(tower, "factoryYieldMultiplier", 1));
}

function getShieldDamageMultiplier(tower) {
  if (!tower) return 1;
  return getResearchEffectNumber(
    tower,
    "shieldDamageMultiplier",
    getCombatNumber(tower.type, "shieldDamageMultiplier", 1)
  );
}

function getTowerProjectileColor(tower) {
  if (
    (tower.type === "minigun" && tower.research === "armor_piercing") ||
    (tower.type === "cannon" && tower.research === "armor_piercing")
  ) {
    return "rgba(68, 255, 239, 0.96)";
  }
  return RARITY_COLORS[tower.rarity];
}

function getProjectileDuration(tower) {
  return getResearchEffectNumber(
    tower,
    "projectileDurationMs",
    getCombatNumber(tower.type, "projectileDurationMs", 75)
  );
}

function getRailgunBeamDurationSeconds(tower) {
  return getCombatNumber(tower.type, "beamDurationMs", 500) / 1000;
}

function getMissileDuration(tower, stats) {
  const baseDuration = stats.missileDuration || 5;
  return baseDuration / getResearchEffectNumber(tower, "missileSpeedMultiplier", 1);
}

function getRaygunFreezeDuration(tower) {
  return getCombatRarityNumber("raygun", "freezeDurations", tower.rarity, 5);
}

function getRaygunFreezeSpeedMultiplier(tower, raider) {
  const override = getResearchEffectNumber(tower, "freezeSpeedMultiplierOverride", null);
  if (override !== null) return override;

  const baseMultiplier = getCombatRarityNumber("raygun", "freezeSpeedMultipliers", tower.rarity, 0.55);
  let slowBonus = 0;
  slowBonus += getResearchEffectNumber(tower, "slowBonus", 0);
  if (raider.type === "fastcar" || raider.type === "jet") {
    slowBonus += getResearchEffectNumber(tower, "fastEnemySlowBonus", 0);
  }
  return Math.max(0, baseMultiplier * (1 - slowBonus));
}
