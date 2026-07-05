import { RoadGenerator } from "../../game/RoadGenerator.js";
import { createFlavorFromLevel, createRoadFromLevel, createTilesFromLevel, getTierOneLevel } from "../../game/LevelDefinitions.js";
import { getRandomCrate } from "../../game/CrateDefinitions.js";
import { createRaider, RAIDER_TYPES } from "../../game/RaiderDefinitions.js";
import { getRandomGem } from "../../game/GemDefinitions.js";
import { BASE_COIN_DROP_CHANCE, BASE_RAIDER_RESOURCE_MULTIPLIER, getCoinYieldMultiplier, getCrateDropChance, getGemDropChance, getStartingResourceBonus } from "../../game/PerkDefinitions.js";
import { getNextRarity, RARITIES, RARITY_LABELS, TOWER_DEFINITIONS, RARITY_COLORS } from "../../game/TowerDefinitions.js";
import { getResearchKey, getResearchNode, getTowerResearchNodes } from "../../game/ResearchDefinitions.js";
import { getCachedImage } from "../AssetCache.js";
import { queueCoinReward, queueGemReward, queueTextReward } from "../RewardPopup.js";

const FIRST_TIER_GRID_SIZE = 50;
const CELL_SIZE = 32;
const TARGET_BUCKET_SIZE = CELL_SIZE * 4;
const MONOLITH_LIFT = CELL_SIZE * 0.9;
const MONOLITH_INSET = CELL_SIZE * 0.18;
const MIN_ZOOM = 0.38;
const MAX_ZOOM = 2.4;
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
const DEFAULT_WAVE_COUNT = 20;
const LEVEL_WAVE_COUNTS = {
  2: 25,
  3: 30
};
const RUN_AUTOSAVE_INTERVAL_MS = 10000;
const TOWER_POPUP_OPEN_DELAY_MS = 50;
const FPS_SAMPLE_INTERVAL_MS = 250;
const MAX_ACTIVE_EFFECTS = 140;
const GAME_SPEEDS = [1, 2, 4, 16];
const RESEARCH_RARITY_INDEX = RARITIES.indexOf("rare");
const PENETRATION_RADIUS = CELL_SIZE * 2;
const AIRBURST_BOMB_DELAY_SECONDS = 0.5;
const AIRBURST_BOMB_RADIUS = CELL_SIZE * 2;
const FACTORY_ACTIVATIONS_PER_WAVE = 2;
const TARGET_PRIORITIES = [
  { id: "strongest", label: "strg" },
  { id: "first", label: "fst" },
  { id: "last", label: "lst" }
];
const DEVELOPER_COMMANDS = ["spawnraider", "setresources", "giveitem"];
const GIVE_ITEM_SUGGESTIONS = ["singularity", "copper", "bronze", "silver", "gold"];
const WAVE_SPAWN_INTERVAL = 0.45;
const WAVE_SPAWN_SPACING_MULTIPLIER = 1.6;
const JET_ORBIT_CIRCUITS = 3;
const JET_ORBIT_DURATION = 10;
const JET_ORBIT_RADIUS_CELLS = 600 / 100 * JET_ORBIT_DURATION / TAU;
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
  }
};
const MAX_TOWER_SHOTS_PER_UPDATE = 32;
const RAIDER_BAR_REVEAL_MS = 2000;
const RAYGUN_FREEZE_SPEED_MULTIPLIERS = {
  common: 0.55,
  uncommon: 0.5,
  rare: 0.45,
  epic: 0.4,
  legendary: 0.25
};
const RAYGUN_FREEZE_DURATIONS = {
  common: 5,
  uncommon: 10,
  rare: 15,
  epic: 20,
  legendary: 25
};
const WAVE_DEFINITIONS = {
  1: [{ type: "walker", rarity: "common", count: 10 }],
  2: [
    { type: "walker", rarity: "common", count: 10 },
    { type: "walker", rarity: "uncommon", count: 3 }
  ],
  3: [{ type: "walker", rarity: "uncommon", count: 10 }],
  4: [
    { type: "walker", rarity: "common", count: 10 },
    { type: "walker", rarity: "uncommon", count: 10 }
  ],
  5: [{ type: "walker", rarity: "uncommon", count: 20 }],
  6: [{ type: "walker", rarity: "common", count: 50 }],
  7: [
    { type: "walker", rarity: "uncommon", count: 20 },
    { type: "walker", rarity: "rare", count: 3 }
  ],
  8: [
    { type: "walker", rarity: "rare", count: 10 },
    { type: "walker", rarity: "epic", count: 3 }
  ],
  9: [
    { type: "walker", rarity: "rare", count: 20 },
    { type: "walker", rarity: "legendary", count: 3 }
  ],
  10: [
    { type: "car", rarity: "common", count: 4 },
    { type: "walker", rarity: "rare", count: 8 }
  ],
  11: [
    { type: "car", rarity: "common", count: 6 },
    { type: "walker", rarity: "epic", count: 5 }
  ],
  12: [
    { type: "car", rarity: "uncommon", count: 4 },
    { type: "walker", rarity: "rare", count: 10 }
  ],
  13: [
    { type: "car", rarity: "rare", count: 3 },
    { type: "car", rarity: "uncommon", count: 2 }
  ],
  14: [
    { type: "car", rarity: "rare", count: 3 },
    { type: "fastcar", rarity: "common", count: 8 }
  ],
  15: [
    { type: "car", rarity: "epic", count: 2 },
    { type: "fastcar", rarity: "common", count: 8 },
    { type: "walker", rarity: "epic", count: 4 }
  ],
  16: [
    { type: "car", rarity: "epic", count: 2 },
    { type: "fastcar", rarity: "uncommon", count: 6 },
    { type: "walker", rarity: "rare", count: 10 }
  ],
  17: [
    { type: "car", rarity: "epic", count: 3 },
    { type: "fastcar", rarity: "rare", count: 5 },
    { type: "walker", rarity: "legendary", count: 5 }
  ],
  18: [
    { type: "car", rarity: "epic", count: 4 },
    { type: "fastcar", rarity: "rare", count: 6 },
    { type: "walker", rarity: "epic", count: 8 }
  ],
  19: [
    { type: "car", rarity: "epic", count: 5 },
    { type: "fastcar", rarity: "rare", count: 4 },
    { type: "walker", rarity: "legendary", count: 10 }
  ],
  20: [
    { type: "heavy_transport", rarity: "uncommon", count: 6 },
    { type: "car", rarity: "rare", count: 3 },
    { type: "fastcar", rarity: "rare", count: 6 },
    { type: "walker", rarity: "legendary", count: 5 }
  ],
  21: [
    { type: "walker", rarity: "rare", count: 22 },
    { type: "fastcar", rarity: "rare", count: 6 },
    { type: "car", rarity: "rare", count: 4 }
  ],
  22: [
    { type: "walker", rarity: "epic", count: 10 },
    { type: "car", rarity: "epic", count: 4 },
    { type: "fastcar", rarity: "rare", count: 7 }
  ],
  23: [
    { type: "heavy_transport", rarity: "uncommon", count: 4 },
    { type: "walker", rarity: "legendary", count: 5 },
    { type: "fastcar", rarity: "rare", count: 8 }
  ],
  24: [
    { type: "heavy_transport", rarity: "rare", count: 3 },
    { type: "car", rarity: "epic", count: 5 },
    { type: "walker", rarity: "epic", count: 12 }
  ],
  25: [
    { type: "heavy_transport", rarity: "rare", count: 4 },
    { type: "car", rarity: "epic", count: 6 },
    { type: "fastcar", rarity: "rare", count: 8 },
    { type: "walker", rarity: "legendary", count: 6 }
  ]
};
const LEVEL_WAVE_DEFINITIONS = {
  21: createTierTwoWaveDefinitions(0),
  22: createTierTwoWaveDefinitions(1),
  23: createTierTwoWaveDefinitions(2),
  24: createTierTwoWaveDefinitions(3),
  25: createTierTwoWaveDefinitions(4)
};

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
          <button class="gameframe-end" type="button">End Game</button>
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

    this.#canvas.width = Math.floor(width * dpr);
    this.#canvas.height = Math.floor(height * dpr);
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#markStaticLayerDirty();

    const worldWidth = this.#worldWidth();
    const worldHeight = this.#worldHeight();
    const fitScale = Math.min(width / worldWidth, height / worldHeight);
    this.#camera.scale = clamp(fitScale * 1.08, MIN_ZOOM, MAX_ZOOM);
    this.#camera.x = (width - worldWidth * this.#camera.scale) / 2;
    this.#camera.y = (height - worldHeight * this.#camera.scale) / 2;
    this.#clampCamera();
    this.#draw();
  };

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
      this.#updateFpsDisplay(now);

      if (this.#running) {
        const scaledDt = dt * this.#gameSpeed;
        this.#time += scaledDt;
        this.#updateWave(scaledDt);
        this.#autosaveRun(now);
      }

      if (this.#running || this.#needsDraw || this.#effects.length > 0) {
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
    this.#closeTowerPopup();
    this.#syncRunHud();
  }

  #restoreRunState(run) {
    this.#playerHealth = clamp(run.playerHealth, 0, PLAYER_MAX_HEALTH);
    this.#resources = Math.max(0, run.resources);
    this.#runCoins = run.runCoins || 0;
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
    this.#closeTowerPopup();
    this.#syncRunHud();
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
    return LEVEL_WAVE_COUNTS[this.#level] || DEFAULT_WAVE_COUNT;
  }

  #getWaveDefinition(wave) {
    return LEVEL_WAVE_DEFINITIONS[this.#level]?.[wave]
      || WAVE_DEFINITIONS[wave]
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

    this.#drawStaticLayer(worldSize);
    this.#drawRoadFlow();
    this.#drawTowerRanges();
    this.#drawPlacementSelection();
    this.#drawTowers();
    this.#drawRaiders();
    this.#drawEffects();
    this.#drawMapHealthBars(worldSize);
    this.#drawEdgeGradient(worldSize, this.#time);

    this.#ctx.restore();
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

    this.#ctx.drawImage(this.#staticLayerCanvas, 0, 0);
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
    const offset = (performance.now() * 0.028) % (CELL_SIZE * 1.8);

    this.#ctx.save();
    this.#ctx.setLineDash([CELL_SIZE * 0.32, CELL_SIZE * 1.5]);
    this.#ctx.lineDashOffset = -offset;
    this.#ctx.strokeStyle = "rgba(224, 252, 255, 0.34)";
    this.#ctx.lineWidth = CELL_SIZE * 0.28;
    this.#strokeRoadPath();
    this.#ctx.restore();
  }

  #drawPlacementSelection() {
    if (!this.#selectedArea) return;

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
  }

  #drawTowerRanges() {
    const tower = this.#selectedTower;
    const area = this.#selectedArea;

    if (tower) {
      const center = this.#getTowerCenter(tower);
      const stats = getEffectiveTowerStats(tower);
      if (stats.rangeCells <= 0) return;
      this.#drawRangeCircle(center.x, center.y, stats.rangeCells * CELL_SIZE, RARITY_COLORS[tower.rarity]);
    } else if (area?.valid) {
      const tower = this.#getFirstPlaceableTower();
      if (!tower) return;
      const rect = this.#getAreaDrawRect(area);
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      this.#drawRangeCircle(center.x, center.y, tower.rarities.common.rangeCells * CELL_SIZE, "rgba(255, 255, 255, 0.92)");
    }
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
    for (const tower of this.#towers) {
      const definition = TOWER_DEFINITIONS[tower.type];
      const footprint = getTowerFootprint(definition);
      const center = this.#getTowerCenter(tower);
      const assetKey = getTowerDrawAssetKey(definition, tower);
      const image = this.#assets.get(assetKey);
      const surfaceRect = this.#getTowerSurfaceRect(tower);
      const size = surfaceRect
        ? Math.min(surfaceRect.width, surfaceRect.height) * 1.05
        : CELL_SIZE * footprint * 1.12;

      this.#ctx.save();
      this.#ctx.translate(center.x, center.y);
      this.#ctx.rotate(tower.angle);
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
      const outline = surfaceRect || {
        x: tower.x * CELL_SIZE,
        y: tower.y * CELL_SIZE,
        width: CELL_SIZE * footprint,
        height: CELL_SIZE * footprint
      };
      this.#ctx.strokeStyle = this.#selectedTower === tower ? RARITY_COLORS[tower.rarity] : "rgba(255, 255, 255, 0.22)";
      this.#ctx.lineWidth = this.#selectedTower === tower ? 2.5 : 1;
      this.#ctx.strokeRect(outline.x + 2, outline.y + 2, outline.width - 4, outline.height - 4);
      this.#ctx.restore();
    }
  }

  #drawEffects() {
    const now = performance.now();
    this.#effects = this.#effects.filter((effect) => {
      if (effect.done) return false;
      if (effect.type === "missile") return true;
      return now - effect.startedAt < effect.duration;
    });
    if (this.#effects.length > MAX_ACTIVE_EFFECTS) {
      this.#effects.splice(0, this.#effects.length - MAX_ACTIVE_EFFECTS);
    }

    for (const effect of this.#effects) {
      const progress = effect.type === "missile"
        ? clamp(effect.elapsed / effect.durationSeconds, 0, 1)
        : clamp((now - effect.startedAt) / effect.duration, 0, 1);

      if (effect.type === "projectile") {
        this.#drawProjectileEffect(effect, progress);
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
      }
    }
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
      upgradeButton.disabled = !unlocked || this.#resources < cost;
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

    if (!nextRarity) {
      upgradeButton.setAttribute("aria-label", "Tower is already at max tier");
      upgradeButton.title = "Max tier";
      upgradeButton.dataset.upgradeRarity = "";
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
      upgradeButton.disabled = !unlocked || this.#resources < cost;
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
      targetPriority: "first",
      research: "",
      angle: -Math.PI / 2
    };
    this.#towers.push(tower);
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

  #toggleTowerResearchOptions() {
    if (!this.#selectedTower) return;
    const options = this.#element.querySelector("[data-tower-research-options]");
    const open = options?.dataset.open !== "true";
    this.#refreshTowerResearchControls(this.#selectedTower, { open });
  }

  #assignSelectedTowerResearch(researchId) {
    const tower = this.#selectedTower;
    if (!tower) return;
    if (researchId === "none") {
      tower.research = "";
    } else if (this.#canAssignResearch(tower, researchId)) {
      tower.research = researchId;
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
    tower.rarity = nextRarity;
    tower.spent += cost;
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

    this.#resources += this.#getRecycleValue(tower);
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
    return Math.max(0, baseCost - (this.#hasAssignedResearch("factory", "assembly_line") ? 5 : 0));
  }

  #hasAssignedResearch(towerId, researchId) {
    return this.#towers.some((tower) => tower.type === towerId && tower.research === researchId);
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
    this.#waveStarted = false;
    this.#grantWaveRewards(this.#wave);

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

    if (Math.random() < BASE_COIN_DROP_CHANCE) {
      const coins = Math.round(10 * getCoinYieldMultiplier(perks));
      this.#runCoins += coins;
      queueCoinReward(coins);
    }

    if (Math.random() < getGemDropChance(perks)) {
      const gemId = getRandomGem();
      this.#runGems.push(gemId);
      queueGemReward(gemId);
    }

    if (Math.random() < getCrateDropChance(perks)) {
      const crateId = getRandomCrate();
      this.#runCrates.push(crateId);
      queueTextReward({
        kicker: "Crate Found",
        value: `+1 ${crateId} crate`,
        tone: "crate"
      });
    }

    this.#saveActiveRun();
  }

  #spawnRaider(type, rarity) {
    this.#raiders.push(createRaider({
      type,
      rarity,
      id: this.#nextRaiderId++
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
      }

      if (isFlyingRaider(raider) && raider.flightPhase === "circling") {
        raider.flightTime = (Number(raider.flightTime) || 0) + dt;

        if (raider.flightTime >= JET_ORBIT_CIRCUITS * JET_ORBIT_DURATION) {
          raider.flightPhase = "road";
          raider.progress = 0;
        }
        continue;
      }

      raider.progress += (getEffectiveRaiderSpeed(raider) / 100) * dt;

      if (raider.progress >= endProgress) {
        raider.alive = false;
        this.#damagePlayer(raider.damage);
      }
    }

    this.#raiders = this.#raiders.filter((raider) => raider.alive);
  }

  #updateTowers(dt) {
    for (const tower of this.#towers) {
      const stats = getEffectiveTowerStats(tower);
      tower.cooldown -= dt;

      if (tower.type === "factory") {
        this.#updateFactory(tower, stats);
        continue;
      }

      if (tower.type === "antiair") {
        if (tower.cooldown <= 0) {
          const target = this.#findTowerTarget(tower);
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
    this.#resources += getFactoryResourceYield(tower, stats);
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
      const stats = getEffectiveTowerStats(tower);
      while ((tower.factoryActivations || 0) < FACTORY_ACTIVATIONS_PER_WAVE) {
        this.#triggerFactory(tower, stats);
        this.#addFactoryBeamEffect(tower);
      }
    }
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

  #findTowerTarget(tower) {
    const stats = getEffectiveTowerStats(tower);
    const center = this.#getTowerCenter(tower);
    const range = stats.rangeCells * CELL_SIZE;
    const rangeSq = range * range;
    const priority = tower.targetPriority || "first";
    let best = null;
    let bestScore = -Infinity;
    let bestTie = -Infinity;

    for (const raider of this.#getRaiderCandidatesInRange(center, range)) {
      if (!raider.alive) continue;
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

    raider.freezeSpeedMultiplier = getRaygunFreezeSpeedMultiplier(tower, raider);
    raider.frozenUntil = this.#time + (RAYGUN_FREEZE_DURATIONS[tower.rarity] ?? RAYGUN_FREEZE_DURATIONS.common);
    raider.embrittled = tower.research === "embrittlement";
    this.#revealRaiderBars(raider);
  }

  #damageRaider(raider, damage, tower = null) {
    const brittle = isRaiderFrozen(raider, this.#time) && raider.embrittled;
    let remaining = brittle ? damage * 2 : damage;
    this.#revealRaiderBars(raider);

    if (raider.shield > 0) {
      const shieldDamageMultiplier = getShieldDamageMultiplier(tower);
      const potentialShieldDamage = remaining * shieldDamageMultiplier;
      const shieldDamage = Math.min(raider.shield, potentialShieldDamage);
      const rawDamageUsed = shieldDamage / shieldDamageMultiplier;
      raider.shield -= shieldDamage;
      remaining -= rawDamageUsed;
    }

    raider.health -= remaining;

    if (brittle && raider.alive) {
      raider.frozenUntil = 0;
      raider.freezeSpeedMultiplier = 1;
      raider.embrittled = false;
    }

    if (raider.health <= 0) {
      this.#addRaiderExplosion(raider);
      raider.alive = false;
      this.#resources += raider.resources * BASE_RAIDER_RESOURCE_MULTIPLIER;
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
    if (tower.type === "minigun" && (tower.research === "high_caliber" || tower.research === "sniper")) {
      const chance = tower.research === "sniper" ? 0.3 : 0.6;
      if (Math.random() < chance) {
        const targetPosition = this.#getCachedRaiderPosition(target);
        this.#damageRaidersInRadius(targetPosition.x, targetPosition.y, PENETRATION_RADIUS, stats.damage, tower, target);
      }
    }

    if (tower.type === "cannon" && tower.research === "airburst") {
      const targetPosition = this.#getCachedRaiderPosition(target);
      this.#spawnAirburstBombs(tower, targetPosition, stats.damage * 0.25);
    }
  }

  #getTowerHitDamage(tower, baseDamage) {
    if (tower.type === "minigun" && tower.research === "headshot" && Math.random() < 0.2) {
      return baseDamage * 2;
    }
    if (tower.type === "cannon" && tower.research === "shellshocked" && Math.random() < 0.2) {
      return baseDamage * 2;
    }
    return baseDamage;
  }

  #damageRaidersInRadius(x, y, radius, damage, tower, exclude = null, options = {}) {
    const radiusSq = radius * radius;
    const candidates = options.liveScan ? this.#raiders : this.#getRaiderCandidatesInRange({ x, y }, radius);
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

  #spawnAirburstBombs(tower, targetPosition, damage) {
    const offsets = [
      { x: -CELL_SIZE * 0.5, y: -CELL_SIZE * 0.5 },
      { x: CELL_SIZE * 0.5, y: -CELL_SIZE * 0.5 },
      { x: -CELL_SIZE * 0.5, y: CELL_SIZE * 0.5 },
      { x: CELL_SIZE * 0.5, y: CELL_SIZE * 0.5 }
    ];

    for (const offset of offsets) {
      this.#effects.push({
        type: "airburst-bomb",
        x: targetPosition.x + offset.x,
        y: targetPosition.y + offset.y,
        radius: AIRBURST_BOMB_RADIUS,
        damage,
        tower,
        color: "rgba(255, 188, 79, 0.96)",
        elapsed: 0,
        delaySeconds: AIRBURST_BOMB_DELAY_SECONDS,
        startedAt: performance.now(),
        duration: AIRBURST_BOMB_DELAY_SECONDS * 1000 + 420
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
      this.#resources += amount * emergencyFactories;
    }

    if (this.#playerHealth <= 0) {
      this.#gameOver = true;
      this.#finishRun({ victory: false });
    }
  }

  #finishRun({ victory, context = this.#context }) {
    if (this.#runSettled || !context) return;

    this.#running = false;
    this.#waveStarted = false;
    this.#spawning = false;
    this.#spawnQueue = [];
    this.#raiders = [];
    this.#runSettled = true;
    this.#runInitialized = false;
    this.#saveService.clearActiveRun();

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
        crates: [...this.#runCrates]
      }
    });
  }

  #drawRaiders() {
    const now = performance.now();

    for (const raider of this.#raiders) {
      const position = this.#getCachedRaiderPosition(raider);
      const definition = RAIDER_TYPES[raider.type];
      const frameIndex = Math.floor(this.#time / definition.frameDuration) % definition.frames.length;
      const image = this.#assets.get(getRaiderAssetKey(definition, definition.frames[frameIndex], raider.rarity));

      if (image?.complete && image.naturalWidth > 0) {
        this.#drawRaiderAsset(raider, image, position);
      } else {
        this.#drawRaiderFallback(raider, position);
      }

      if (this.#shouldDrawRaiderBars(raider, now)) {
        this.#drawRaiderBars(raider, position);
      }
    }
  }

  #shouldDrawRaiderBars(raider, now = performance.now()) {
    return (raider.healthBarsVisibleUntil || 0) > now;
  }

  #revealRaiderBars(raider) {
    raider.healthBarsVisibleUntil = performance.now() + RAIDER_BAR_REVEAL_MS;
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

    return this.#getRaiderAngle(raider.progress);
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

  #requestDraw() {
    this.#needsDraw = true;
  }

  #drawEdgeGradient(worldSize, time) {
    const gradient = this.#ctx.createLinearGradient(0, 0, worldSize, worldSize);
    const colors = this.#getWaveColors(time);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[2]);

    this.#ctx.save();
    this.#ctx.strokeStyle = gradient;
    this.#ctx.lineWidth = 3;
    this.#ctx.shadowColor = colors[1];
    this.#ctx.shadowBlur = 8 + this.#getBreath(time) * 8;
    this.#ctx.strokeRect(1.5, 1.5, worldSize - 3, worldSize - 3);

    this.#drawEdgeFire(worldSize, time, colors);
    this.#ctx.restore();
  }

  #drawEdgeFire(worldSize, time, colors) {
    const breath = this.#getBreath(time);
    const flameDepth = CELL_SIZE * (1.35 + breath * 0.45);

    this.#ctx.save();
    this.#ctx.globalCompositeOperation = "lighter";

    this.#drawFireSide("top", worldSize, flameDepth, time, colors);
    this.#drawFireSide("right", worldSize, flameDepth, time + 7.1, colors);
    this.#drawFireSide("bottom", worldSize, flameDepth, time + 13.4, colors);
    this.#drawFireSide("left", worldSize, flameDepth, time + 19.8, colors);

    this.#ctx.restore();
  }

  #drawFireSide(side, worldSize, depth, time, colors) {
    const step = CELL_SIZE;
    const segments = Math.ceil(worldSize / step);

    for (let layer = 0; layer < 2; layer++) {
      const layerDepth = depth * (1 - layer * 0.17);
      const alpha = 0.18 - layer * 0.035;
      const lineWidth = 9 - layer * 1.5;
      const phase = time * (0.9 + layer * 0.18) + this.#gradientSeed[`phase${String.fromCharCode(65 + layer % 3)}`];

      this.#ctx.beginPath();

      for (let index = 0; index <= segments; index++) {
        const along = index * step;
        const wave =
          Math.sin(index * 0.72 + phase) * 0.54 +
          Math.sin(index * 1.37 - phase * 0.72) * 0.32 +
          Math.sin(index * 2.11 + phase * 0.38) * 0.18;
        const lick = Math.max(0, wave) * layerDepth;
        const inset = 2 + lick + layer * 5;
        const point = edgePoint(side, along, inset, worldSize);

        if (index === 0) this.#ctx.moveTo(point.x, point.y);
        else this.#ctx.lineTo(point.x, point.y);
      }

      this.#ctx.strokeStyle = withAlpha(colors[layer % colors.length], alpha);
      this.#ctx.lineWidth = lineWidth;
      this.#ctx.lineCap = "round";
      this.#ctx.lineJoin = "round";
      this.#ctx.shadowColor = colors[layer % colors.length];
      this.#ctx.shadowBlur = 8 - layer * 2;
      this.#ctx.stroke();
    }
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
    const margin = 80;

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

function getRaiderAssetKey(definition, asset, rarity) {
  return definition.usesRarityAssets === false ? asset : getRarityAssetName(asset, rarity);
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

function canTowerTargetRaider(tower, raider) {
  const definition = TOWER_DEFINITIONS[tower.type];
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
  const stats = { ...base };

  if (tower.type === "minigun") {
    if (tower.research === "gatling") {
      stats.attackInterval *= 0.7;
    } else if (tower.research === "high_caliber") {
      stats.attackInterval *= 1.3;
    } else if (tower.research === "sniper") {
      stats.attackInterval *= 10;
      stats.rangeCells *= 1.6;
    }
  } else if (tower.type === "cannon") {
    if (tower.research === "airburst") {
      stats.damage *= 0.5;
    } else if (tower.research === "armor_piercing") {
      stats.attackInterval *= 1.5;
    } else if (tower.research === "bigger_guns") {
      stats.attackInterval *= 10;
      stats.damage *= 2.2;
    }
  } else if (tower.type === "raygun") {
    if (tower.research === "absolute_stasis") {
      stats.attackInterval *= 10;
    }
  }

  return stats;
}

function getFactoryResourceYield(tower, stats) {
  return tower.research === "overtime" ? stats.resourceYield * 1.5 : stats.resourceYield;
}

function getShieldDamageMultiplier(tower) {
  if (!tower) return 1;
  if (tower.type === "minigun" && tower.research === "armor_piercing") return 0.75;
  if (tower.type === "cannon" && tower.research === "armor_piercing") return 3.6;
  if (tower.type === "minigun") return 0.5;
  if (tower.type === "cannon") return 2;
  return 1;
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
  if (tower.type === "cannon") return 120;
  if (tower.type === "raygun") return 155;
  if (tower.type === "minigun" && tower.research === "sniper") return 42;
  return 75;
}

function getMissileDuration(tower, stats) {
  const baseDuration = stats.missileDuration || 5;
  return tower.research === "lock_on_array" ? baseDuration / 1.3 : baseDuration;
}

function getRaygunFreezeSpeedMultiplier(tower, raider) {
  if (tower.research === "absolute_stasis") return 0;

  const baseMultiplier = RAYGUN_FREEZE_SPEED_MULTIPLIERS[tower.rarity] ?? RAYGUN_FREEZE_SPEED_MULTIPLIERS.common;
  let slowBonus = 0;
  if (tower.research === "cryo") slowBonus += 0.3;
  if (tower.research === "tracer" && (raider.type === "fastcar" || raider.type === "jet")) slowBonus += 0.6;
  return Math.max(0, baseMultiplier * (1 - slowBonus));
}
