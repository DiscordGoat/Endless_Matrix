import { RoadGenerator } from "../../game/RoadGenerator.js";
import { getRandomCrate } from "../../game/CrateDefinitions.js";
import { createRaider, RAIDER_TYPES } from "../../game/RaiderDefinitions.js";
import { getRandomGem } from "../../game/GemDefinitions.js";
import { getNextRarity, RARITY_LABELS, TOWER_DEFINITIONS, RARITY_COLORS } from "../../game/TowerDefinitions.js";

const FIRST_TIER_GRID_SIZE = 50;
const CELL_SIZE = 32;
const MIN_ZOOM = 0.38;
const MAX_ZOOM = 2.4;
const TAU = Math.PI * 2;
const ASSET_SOURCES = {
  tree: `${import.meta.env.BASE_URL}assets/tree.png`,
  boulder: `${import.meta.env.BASE_URL}assets/boulder.png`,
  minigun: `${import.meta.env.BASE_URL}assets/minigun.png`,
  cannon: `${import.meta.env.BASE_URL}assets/cannon.png`,
  walker_frame1: `${import.meta.env.BASE_URL}assets/walker_frame1.png`,
  walker_frame2: `${import.meta.env.BASE_URL}assets/walker_frame2.png`,
  car: `${import.meta.env.BASE_URL}assets/car.png`,
  fastcar: `${import.meta.env.BASE_URL}assets/fastcar.png`
};
const PLAYER_MAX_HEALTH = 100;
const STARTING_RESOURCES = 10;
const WAVE_COUNT = 100;
const WAVE_SPAWN_INTERVAL = 0.45;
const RAIDER_SPAWN_INTERVALS = {
  walker: {
    common: 0.42,
    uncommon: 0.52,
    rare: 0.68,
    epic: 0.82,
    legendary: 0.96
  },
  car: {
    common: 1.15
  },
  fastcar: {
    common: 1.05
  }
};
const GEM_DROP_CHANCE_PER_WAVE = 0.05;
const MAX_TOWER_SHOTS_PER_UPDATE = 32;
const RAIDER_BAR_REVEAL_MS = 2000;
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
  10: [{ type: "car", rarity: "common", count: 6 }]
};

export class GameFrameScreen {
  #flavorManager;
  #saveService;
  #element = null;
  #canvas = null;
  #ctx = null;
  #animationFrame = null;
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
  #road = null;
  #rerollIndex = 0;
  #assets = new Map();
  #roadGenerator = new RoadGenerator();
  #playerHealth = PLAYER_MAX_HEALTH;
  #resources = STARTING_RESOURCES;
  #wave = 1;
  #waveStarted = false;
  #spawning = false;
  #spawnQueue = [];
  #spawnTimer = 0;
  #raiders = [];
  #nextRaiderId = 1;
  #gameOver = false;
  #runInitialized = false;
  #activeRunLevel = null;
  #runCoins = 0;
  #runGems = [];
  #runCrates = [];
  #runSettled = false;
  #rewardMessageDelay = 0;
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
  #effects = [];

  constructor({ flavorManager, saveService }) {
    this.#flavorManager = flavorManager;
    this.#saveService = saveService;
  }

  mount(context) {
    const requestedLevel = context.params.level || 1;

    if (!this.#runInitialized || this.#activeRunLevel !== requestedLevel) {
      this.#level = requestedLevel;
      this.#activeRunLevel = requestedLevel;
      this.#generateMapFlavor();
      this.#resetRunState();
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
          <div class="run-pill">${this.#flavor.biome.label}</div>
          <div class="run-pill" data-wave-display>Wave ${this.#wave} / ${WAVE_COUNT}</div>
          <button class="gameframe-end" type="button">End Game</button>
        </div>
        <div class="player-stat-strip">
          <div class="run-pill" data-resource-display>${this.#resources}R</div>
          <div class="run-pill" data-run-coin-display>+${this.#runCoins} Coins</div>
          <div class="run-pill" data-run-gem-display>+${this.#runGems.length} Gems</div>
          <div class="run-pill" data-run-crate-display>+${this.#runCrates.length} Crates</div>
        </div>
      </header>
      <div class="reward-layer" data-reward-layer></div>
      <button class="time-toggle" type="button" aria-label="Start time" data-running="false">
        <span class="time-icon" aria-hidden="true"></span>
      </button>
      <div class="speed-options" aria-label="Game speed">
        <button class="speed-button active" type="button" data-speed="1">1x</button>
        <button class="speed-button" type="button" data-speed="4">4x</button>
        <button class="speed-button" type="button" data-speed="8">8x</button>
        <button class="speed-button" type="button" data-speed="16">16x</button>
      </div>
      <button class="gameframe-restart" type="button" aria-label="Restart map">Restart</button>
      <button class="gameframe-back" type="button">Back</button>
      <section class="tower-popup" data-tower-popup>
        <div class="tower-popup-title" data-tower-popup-title>Tower</div>
        <div class="tower-popup-actions" data-placement-panel></div>
        <div class="tower-popup-actions" data-tower-panel>
          <button class="tower-popup-button" type="button" data-upgrade-tower>Upgrade</button>
          <button class="tower-popup-button danger" type="button" data-recycle-tower>Recycle</button>
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

    screen.querySelector(".gameframe-restart").addEventListener("click", () => {
      this.#restartMap();
    });

    screen.querySelector(".gameframe-end").addEventListener("click", () => {
      this.#endGame(context);
    });

    screen.querySelectorAll(".speed-button").forEach((button) => {
      button.addEventListener("click", () => {
        this.#setGameSpeed(Number(button.dataset.speed));
      });
    });

    screen.querySelector("[data-placement-panel]").addEventListener("click", (event) => {
      const button = event.target.closest("[data-place-tower]");
      if (button) this.#placeTower(button.dataset.placeTower);
    });
    screen.querySelector("[data-upgrade-tower]").addEventListener("click", () => this.#upgradeSelectedTower());
    screen.querySelector("[data-recycle-tower]").addEventListener("click", () => this.#recycleSelectedTower());

    this.#gradientSeed = createGradientSeed();
    this.#loadAssets();
    this.#bindInput();
    this.#resize();
    this.#start();

    window.addEventListener("resize", this.#resize);

    return screen;
  }

  unmount() {
    cancelAnimationFrame(this.#animationFrame);
    window.removeEventListener("resize", this.#resize);
    this.#pointers.clear();
    this.#element = null;
    this.#canvas = null;
    this.#ctx = null;
  }

  #bindInput() {
    this.#canvas.addEventListener("pointerdown", this.#handlePointerDown);
    this.#canvas.addEventListener("pointermove", this.#handlePointerMove);
    this.#canvas.addEventListener("pointerup", this.#handlePointerEnd);
    this.#canvas.addEventListener("pointercancel", this.#handlePointerEnd);
    this.#canvas.addEventListener("wheel", this.#handleWheel, { passive: false });
  }

  #resize = () => {
    if (!this.#canvas || !this.#ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.#canvas.width = Math.floor(width * dpr);
    this.#canvas.height = Math.floor(height * dpr);
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const worldSize = this.#worldSize();
    const fitScale = Math.min(width / worldSize, height / worldSize);
    this.#camera.scale = clamp(fitScale * 1.08, MIN_ZOOM, MAX_ZOOM);
    this.#camera.x = (width - worldSize * this.#camera.scale) / 2;
    this.#camera.y = (height - worldSize * this.#camera.scale) / 2;
    this.#clampCamera();
    this.#draw();
  };

  #start() {
    this.#lastFrameTime = performance.now();

    const tick = (now) => {
      const dt = Math.min(0.05, (now - this.#lastFrameTime) / 1000);
      this.#lastFrameTime = now;

      if (this.#running) {
        const scaledDt = dt * this.#gameSpeed;
        this.#time += scaledDt;
        this.#updateWave(scaledDt);
      }

      this.#draw();
      this.#animationFrame = requestAnimationFrame(tick);
    };

    this.#animationFrame = requestAnimationFrame(tick);
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
  }

  #restartMap() {
    this.#rerollIndex++;
    this.#time = 0;
    this.#running = false;
    this.#element.querySelector(".time-toggle").dataset.running = "false";
    this.#element.querySelector(".time-toggle").setAttribute("aria-label", "Start time");
    this.#gradientSeed = createGradientSeed();
    this.#generateMapFlavor();
    this.#resetRunState();
    this.#draw();
  }

  #endGame(context) {
    this.#running = false;
    this.#waveStarted = false;
    this.#spawning = false;
    this.#spawnQueue = [];
    this.#settleRun();
    this.#runInitialized = false;
    context.navigate("level-select");
  }

  #setGameSpeed(speed) {
    this.#gameSpeed = clamp(speed, 1, 16);

    this.#element.querySelectorAll(".speed-button").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.speed) === this.#gameSpeed);
    });
  }

  #resetRunState() {
    this.#playerHealth = PLAYER_MAX_HEALTH;
    this.#resources = STARTING_RESOURCES;
    this.#runCoins = 0;
    this.#runGems = [];
    this.#runCrates = [];
    this.#runSettled = false;
    this.#rewardMessageDelay = 0;
    this.#wave = 1;
    this.#waveStarted = false;
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
    this.#closeTowerPopup();
    this.#syncRunHud();
  }

  #startCurrentWave() {
    this.#waveStarted = true;
    this.#spawning = true;
    this.#spawnQueue = this.#buildWaveQueue(this.#wave);
    this.#spawnTimer = 0;
    this.#syncRunHud();
  }

  #buildWaveQueue(wave) {
    const definition = WAVE_DEFINITIONS[wave] || [{ type: "walker", rarity: "common", count: Math.min(50, wave * 10) }];
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
    return RAIDER_SPAWN_INTERVALS[type]?.[rarity] ?? WAVE_SPAWN_INTERVAL;
  }

  #generateMapFlavor() {
    this.#flavor = this.#flavorManager.getFlavor({
      tier: 1,
      level: this.#level,
      gridSize: FIRST_TIER_GRID_SIZE,
      seedOffset: this.#rerollIndex
    });
    this.#road = this.#roadGenerator.generate({
      gridSize: FIRST_TIER_GRID_SIZE,
      obstacles: this.#flavor.elements,
      seed: 20000 + this.#level * 131 + this.#rerollIndex * 7919
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
      return;
    }

    if (this.#pointers.size === 2) {
      const distance = this.#getPinchDistance();
      if (this.#lastPinchDistance > 0) {
        const center = this.#getPinchCenter();
        this.#zoomAt(center.x, center.y, distance / this.#lastPinchDistance);
      }

      this.#lastPinchDistance = distance;
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
    }
  };

  #handleWheel = (event) => {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    this.#zoomAt(event.clientX, event.clientY, zoomFactor);
  };

  #zoomAt(clientX, clientY, factor) {
    const previousScale = this.#camera.scale;
    const nextScale = clamp(previousScale * factor, MIN_ZOOM, MAX_ZOOM);
    const worldX = (clientX - this.#camera.x) / previousScale;
    const worldY = (clientY - this.#camera.y) / previousScale;

    this.#camera.scale = nextScale;
    this.#camera.x = clientX - worldX * nextScale;
    this.#camera.y = clientY - worldY * nextScale;
    this.#clampCamera();
  }

  #draw() {
    if (!this.#ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const worldSize = this.#worldSize();

    this.#ctx.clearRect(0, 0, width, height);
    this.#ctx.fillStyle = "#02050a";
    this.#ctx.fillRect(0, 0, width, height);

    this.#ctx.save();
    this.#ctx.translate(this.#camera.x, this.#camera.y);
    this.#ctx.scale(this.#camera.scale, this.#camera.scale);

    this.#drawGridBase(worldSize);
    this.#drawGridLines(worldSize);
    this.#drawRoad();
    this.#drawPlacementSelection();
    this.#drawTowerRanges();
    this.#drawFlavorElements();
    this.#drawTowers();
    this.#drawRaiders();
    this.#drawEffects();
    this.#drawMapHealthBars(worldSize);
    this.#drawEdgeGradient(worldSize, this.#time);

    this.#ctx.restore();
  }

  #drawGridBase(worldSize) {
    this.#ctx.fillStyle = "#050b12";
    this.#ctx.fillRect(0, 0, worldSize, worldSize);
  }

  #drawGridLines(worldSize) {
    this.#ctx.strokeStyle = "rgba(170, 244, 255, 0.14)";
    this.#ctx.lineWidth = 1;

    for (let i = 0; i <= FIRST_TIER_GRID_SIZE; i++) {
      const pos = i * CELL_SIZE;

      this.#ctx.beginPath();
      this.#ctx.moveTo(pos, 0);
      this.#ctx.lineTo(pos, worldSize);
      this.#ctx.stroke();

      this.#ctx.beginPath();
      this.#ctx.moveTo(0, pos);
      this.#ctx.lineTo(worldSize, pos);
      this.#ctx.stroke();
    }
  }

  #drawFlavorElements() {
    if (!this.#flavor) return;

    for (const element of this.#flavor.elements) {
      this.#drawFlavorElement(element);
    }
  }

  #drawRoad() {
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

    this.#drawRoadFlow();
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

    const x = this.#selectedArea.x * CELL_SIZE;
    const y = this.#selectedArea.y * CELL_SIZE;
    const color = this.#selectedArea.valid
      ? "rgba(255, 255, 255, 0.9)"
      : "rgba(255, 101, 116, 0.95)";

    this.#ctx.save();
    this.#ctx.fillStyle = this.#selectedArea.valid
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(255, 101, 116, 0.13)";
    this.#ctx.fillRect(x, y, CELL_SIZE * 2, CELL_SIZE * 2);
    this.#ctx.strokeStyle = color;
    this.#ctx.lineWidth = 2;
    this.#ctx.strokeRect(x + 2, y + 2, CELL_SIZE * 2 - 4, CELL_SIZE * 2 - 4);
    this.#ctx.restore();
  }

  #drawTowerRanges() {
    const tower = this.#selectedTower;
    const area = this.#selectedArea;

    if (tower) {
      const center = this.#getTowerCenter(tower);
      const stats = TOWER_DEFINITIONS[tower.type].rarities[tower.rarity];
      this.#drawRangeCircle(center.x, center.y, stats.rangeCells * CELL_SIZE, RARITY_COLORS[tower.rarity]);
    } else if (area?.valid) {
      const tower = this.#getFirstPlaceableTower();
      if (!tower) return;
      const center = {
        x: (area.x + 1) * CELL_SIZE,
        y: (area.y + 1) * CELL_SIZE
      };
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
      const center = this.#getTowerCenter(tower);
      const image = this.#assets.get(definition.asset);
      const size = CELL_SIZE * 2.25;

      this.#ctx.save();
      this.#ctx.translate(center.x, center.y);
      this.#ctx.rotate(tower.angle);
      this.#ctx.globalCompositeOperation = "lighter";
      this.#ctx.filter = getTowerFilter(tower.rarity);

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

      this.#ctx.filter = "none";
      this.#ctx.restore();

      this.#ctx.save();
      this.#ctx.strokeStyle = this.#selectedTower === tower ? RARITY_COLORS[tower.rarity] : "rgba(255, 255, 255, 0.22)";
      this.#ctx.lineWidth = this.#selectedTower === tower ? 2.5 : 1;
      this.#ctx.strokeRect(tower.x * CELL_SIZE + 2, tower.y * CELL_SIZE + 2, CELL_SIZE * 2 - 4, CELL_SIZE * 2 - 4);
      this.#ctx.restore();
    }
  }

  #drawEffects() {
    const now = performance.now();
    this.#effects = this.#effects.filter((effect) => now - effect.startedAt < effect.duration);

    for (const effect of this.#effects) {
      const progress = clamp((now - effect.startedAt) / effect.duration, 0, 1);

      if (effect.type === "projectile") {
        this.#drawProjectileEffect(effect, progress);
      } else if (effect.type === "muzzle") {
        this.#drawMuzzleEffect(effect, progress);
      } else if (effect.type === "explosion") {
        this.#drawExplosionEffect(effect, progress);
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
    this.#ctx.lineWidth = effect.towerType === "cannon" ? 4 : 1.6;
    this.#ctx.shadowColor = effect.color;
    this.#ctx.shadowBlur = effect.towerType === "cannon" ? 22 : 8;
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
    this.#ctx.shadowBlur = 24;
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
    this.#ctx.shadowBlur = 20;
    this.#ctx.beginPath();
    this.#ctx.arc(effect.x, effect.y, radius, 0, TAU);
    this.#ctx.fill();
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  #handleMapTap(clientX, clientY) {
    const raider = this.#getRaiderAtScreenPoint(clientX, clientY);
    if (raider) {
      this.#revealRaiderBars(raider);
      return;
    }

    const cell = this.#screenToGrid(clientX, clientY);
    const hadSelection = Boolean(this.#selectedArea || this.#selectedTower || this.#element.querySelector("[data-tower-popup]")?.classList.contains("active"));

    if (!this.#isInBounds(cell.x, cell.y)) {
      this.#clearSelection();
      return;
    }

    const tower = this.#getTowerAtCell(cell.x, cell.y);
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

    const area = this.#normalize2x2(cell.x, cell.y);
    const valid = this.#canPlace2x2(area.x, area.y);

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

    if (this.#isObstacleCell(cell.x, cell.y)) {
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
      x: clamp(x, 0, FIRST_TIER_GRID_SIZE - 2),
      y: clamp(y, 0, FIRST_TIER_GRID_SIZE - 2)
    };
  }

  #canPlace2x2(x, y) {
    if (x < 0 || y < 0 || x + 1 >= FIRST_TIER_GRID_SIZE || y + 1 >= FIRST_TIER_GRID_SIZE) return false;

    for (let yy = y; yy < y + 2; yy++) {
      for (let xx = x; xx < x + 2; xx++) {
        if (this.#isRoadCell(xx, yy)) return false;
        if (this.#isObstacleCell(xx, yy)) return false;
        if (this.#getTowerAtCell(xx, yy)) return false;
      }
    }

    return true;
  }

  #isInBounds(x, y) {
    return x >= 0 && y >= 0 && x < FIRST_TIER_GRID_SIZE && y < FIRST_TIER_GRID_SIZE;
  }

  #isRoadCell(x, y) {
    return this.#road.cells.some((cell) => cell.x === x && cell.y === y);
  }

  #isObstacleCell(x, y) {
    return this.#flavor.elements.some((item) => {
      return x >= item.x && x < item.x + item.width && y >= item.y && y < item.y + item.height;
    });
  }

  #getTowerAtCell(x, y) {
    return this.#towers.find((tower) => x >= tower.x && x < tower.x + 2 && y >= tower.y && y < tower.y + 2);
  }

  #getFirstPlaceableTower() {
    return Object.values(TOWER_DEFINITIONS).find((tower) => this.#saveService.isTowerUnlocked(tower.id, "common"));
  }

  #getRaiderAtScreenPoint(clientX, clientY) {
    const world = this.#screenToWorld(clientX, clientY);
    const hitRadius = CELL_SIZE * 0.82;
    let best = null;
    let bestDistance = Infinity;

    for (const raider of this.#raiders) {
      if (!raider.alive) continue;
      const position = this.#getRoadPosition(raider.progress);
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
    const placeableTowers = Object.values(TOWER_DEFINITIONS);

    title.textContent = "Tower Placement";
    placementPanel.innerHTML = placeableTowers.map((tower) => {
      const unlocked = this.#saveService.isTowerUnlocked(tower.id, "common");
      const cost = tower.rarities.common.placementCost;
      return `
        <button class="tower-popup-button" type="button" data-place-tower="${tower.id}" ${!unlocked || this.#resources < cost ? "disabled" : ""}>
          ${unlocked ? `Place ${tower.label} - ${cost}R` : `${tower.label} Locked`}
        </button>
      `;
    }).join("");
    placementPanel.style.display = "grid";
    towerPanel.style.display = "none";
    popup.classList.add("active");
  }

  #openTowerPanel(tower) {
    const popup = this.#element.querySelector("[data-tower-popup]");
    const title = this.#element.querySelector("[data-tower-popup-title]");
    const placementPanel = this.#element.querySelector("[data-placement-panel]");
    const towerPanel = this.#element.querySelector("[data-tower-panel]");
    const upgradeButton = this.#element.querySelector("[data-upgrade-tower]");
    const recycleButton = this.#element.querySelector("[data-recycle-tower]");
    const nextRarity = getNextRarity(tower.rarity);
    const definition = TOWER_DEFINITIONS[tower.type];

    title.textContent = `${RARITY_LABELS[tower.rarity]} ${definition.label}`;
    recycleButton.textContent = `Recycle +${this.#getRecycleValue(tower)}R`;

    if (!nextRarity) {
      upgradeButton.textContent = "Max Tier";
      upgradeButton.disabled = true;
    } else {
      const unlocked = this.#saveService.isTowerUnlocked(tower.type, nextRarity);
      const cost = definition.rarities[nextRarity].placementCost;
      upgradeButton.textContent = unlocked ? `Upgrade - ${cost}R` : `${RARITY_LABELS[nextRarity]} Locked`;
      upgradeButton.disabled = !unlocked || this.#resources < cost;
    }

    placementPanel.style.display = "none";
    towerPanel.style.display = "grid";
    popup.classList.add("active");
  }

  #closeTowerPopup() {
    if (!this.#element) return;
    this.#element.querySelector("[data-tower-popup]")?.classList.remove("active");
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
    if (!this.#saveService.isTowerUnlocked(towerId, "common")) return;
    if (this.#resources < stats.placementCost) return;

    this.#resources -= stats.placementCost;
    const tower = {
      id: this.#nextTowerId++,
      type: towerId,
      x: this.#selectedArea.x,
      y: this.#selectedArea.y,
      rarity: "common",
      spent: stats.placementCost,
      cooldown: 0,
      angle: -Math.PI / 2
    };
    this.#towers.push(tower);
    this.#selectedArea = null;
    this.#selectedTower = tower;
    this.#closeTowerPopup();
    this.#syncRunHud();
  }

  #upgradeSelectedTower() {
    const tower = this.#selectedTower;
    if (!tower) return;
    const nextRarity = getNextRarity(tower.rarity);
    if (!nextRarity || !this.#saveService.isTowerUnlocked(tower.type, nextRarity)) return;
    const cost = TOWER_DEFINITIONS[tower.type].rarities[nextRarity].placementCost;
    if (this.#resources < cost) return;

    this.#resources -= cost;
    tower.rarity = nextRarity;
    tower.spent += cost;
    this.#openTowerPanel(tower);
    this.#syncRunHud();
  }

  #recycleSelectedTower() {
    const tower = this.#selectedTower;
    if (!tower) return;

    this.#resources += this.#getRecycleValue(tower);
    this.#towers = this.#towers.filter((item) => item !== tower);
    this.#clearSelection();
    this.#syncRunHud();
  }

  #getRecycleValue(tower) {
    return Math.floor(tower.spent * 0.5);
  }

  #updateWave(dt) {
    this.#updateSpawning(dt);
    this.#updateRaiders(dt);
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
    this.#waveStarted = false;
    this.#grantWaveRewards(this.#wave);

    if (this.#wave >= WAVE_COUNT) {
      this.#running = false;
      this.#settleRun();
      const button = this.#element.querySelector(".time-toggle");
      button.dataset.running = "false";
      button.setAttribute("aria-label", "Start time");
    } else {
      this.#wave++;
      if (shouldContinue) {
        this.#startCurrentWave();
      }
    }
  }

  #grantWaveRewards(wave) {
    if (wave % 5 === 0) {
      this.#runCoins += 10;
      this.#showRewardText("+10 Coins!");
    }

    if (Math.random() < GEM_DROP_CHANCE_PER_WAVE) {
      const gemId = getRandomGem();
      this.#runGems.push(gemId);
      this.#showRewardText("+1 Gem!");
    }

    if (wave % 20 === 0) {
      const crateId = getRandomCrate();
      this.#runCrates.push(crateId);
      this.#showRewardText(`+1 ${crateId} crate!`);
    }
  }

  #settleRun() {
    if (this.#runSettled) return;

    this.#saveService.addCoins(this.#runCoins);
    this.#saveService.addGems(this.#runGems);
    this.#saveService.addCrates(this.#runCrates);
    this.#runSettled = true;
  }

  #showRewardText(text) {
    const layer = this.#element?.querySelector("[data-reward-layer]");
    if (!layer) return;

    const item = document.createElement("div");
    item.className = "reward-float";
    item.textContent = text;
    const delay = this.#rewardMessageDelay;
    this.#rewardMessageDelay += 220;

    window.setTimeout(() => {
      if (!this.#element || !layer.isConnected) return;
      layer.append(item);
      item.addEventListener("animationend", () => {
        item.remove();
        if (!layer.children.length) this.#rewardMessageDelay = 0;
      }, { once: true });
    }, delay);
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

      raider.progress += (raider.speed / 100) * dt;

      if (raider.progress >= endProgress) {
        raider.alive = false;
        this.#damagePlayer(raider.damage);
      }
    }

    this.#raiders = this.#raiders.filter((raider) => raider.alive);
  }

  #updateTowers(dt) {
    for (const tower of this.#towers) {
      const stats = TOWER_DEFINITIONS[tower.type].rarities[tower.rarity];
      tower.cooldown -= dt;

      let shots = 0;
      while (tower.cooldown <= 0 && shots < MAX_TOWER_SHOTS_PER_UPDATE) {
        const target = this.#findTowerTarget(tower);
        if (!target) {
          tower.cooldown = 0;
          break;
        }

        const center = this.#getTowerCenter(tower);
        const targetPosition = this.#getRoadPosition(target.progress);
        tower.angle = Math.atan2(targetPosition.y - center.y, targetPosition.x - center.x);
        this.#addTowerShotEffects(tower, center, targetPosition);
        this.#damageRaider(target, stats.damage, tower);
        tower.cooldown += stats.attackInterval;
        shots++;
      }

      if (shots >= MAX_TOWER_SHOTS_PER_UPDATE) {
        tower.cooldown = Math.max(0, tower.cooldown);
      }
    }

    this.#raiders = this.#raiders.filter((raider) => raider.alive);
  }

  #findTowerTarget(tower) {
    const stats = TOWER_DEFINITIONS[tower.type].rarities[tower.rarity];
    const center = this.#getTowerCenter(tower);
    let best = null;
    let bestProgress = -Infinity;

    for (const raider of this.#raiders) {
      if (!raider.alive) continue;
      const position = this.#getRoadPosition(raider.progress);
      const distance = Math.hypot(position.x - center.x, position.y - center.y);

      if (distance <= stats.rangeCells * CELL_SIZE && raider.progress > bestProgress) {
        best = raider;
        bestProgress = raider.progress;
      }
    }

    return best;
  }

  #damageRaider(raider, damage, tower = null) {
    let remaining = damage;
    this.#revealRaiderBars(raider);

    if (raider.shield > 0) {
      const shieldDamageMultiplier = getShieldDamageMultiplier(tower?.type);
      const potentialShieldDamage = remaining * shieldDamageMultiplier;
      const shieldDamage = Math.min(raider.shield, potentialShieldDamage);
      const rawDamageUsed = shieldDamage / shieldDamageMultiplier;
      raider.shield -= shieldDamage;
      remaining -= rawDamageUsed;
    }

    raider.health -= remaining;

    if (raider.health <= 0) {
      this.#addRaiderExplosion(raider);
      raider.alive = false;
      this.#resources += raider.resources;
    }
  }

  #addTowerShotEffects(tower, from, to) {
    const color = RARITY_COLORS[tower.rarity];
    const direction = Math.atan2(to.y - from.y, to.x - from.x);
    const muzzleDistance = tower.type === "cannon" ? CELL_SIZE * 1.08 : CELL_SIZE * 0.88;
    const muzzle = {
      x: from.x + Math.cos(direction) * muzzleDistance,
      y: from.y + Math.sin(direction) * muzzleDistance
    };

    this.#effects.push({
      type: "projectile",
      towerType: tower.type,
      from: muzzle,
      to,
      color,
      startedAt: performance.now(),
      duration: tower.type === "cannon" ? 120 : 75
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
  }

  #addRaiderExplosion(raider) {
    const position = this.#getRoadPosition(raider.progress);
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
    return {
      x: (tower.x + 1) * CELL_SIZE,
      y: (tower.y + 1) * CELL_SIZE
    };
  }

  #damagePlayer(amount) {
    this.#playerHealth = Math.max(0, this.#playerHealth - amount);

    if (this.#playerHealth <= 0) {
      this.#gameOver = true;
      this.#running = false;
      this.#settleRun();
      this.#element.querySelector(".time-toggle").dataset.running = "false";
      this.#element.querySelector(".time-toggle").setAttribute("aria-label", "Start time");
    }
  }

  #drawRaiders() {
    const now = performance.now();

    for (const raider of this.#raiders) {
      const position = this.#getRoadPosition(raider.progress);
      const definition = RAIDER_TYPES[raider.type];
      const frameIndex = Math.floor(this.#time / definition.frameDuration) % definition.frames.length;
      const image = this.#assets.get(definition.frames[frameIndex]);

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
    this.#ctx.shadowBlur = 18;
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
    this.#ctx.rotate(this.#getRaiderAngle(raider.progress));
    this.#ctx.globalCompositeOperation = "lighter";
    this.#ctx.filter = getRaiderFilter(raider.rarity);
    this.#ctx.drawImage(image, -size / 2, -size / 2, size, size);
    this.#ctx.filter = "none";
    this.#ctx.restore();
  }

  #drawRaiderFallback(raider, position) {
    this.#ctx.save();
    this.#ctx.translate(position.x, position.y);
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
      resourceDisplay.textContent = `${this.#resources}R`;
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
      waveDisplay.textContent = this.#gameOver ? "Game Over" : `Wave ${this.#wave} / ${WAVE_COUNT}`;
    }
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
      const image = new Image();
      image.src = source;
      image.addEventListener("load", () => this.#draw());
      this.#assets.set(type, image);
    }
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
    this.#ctx.shadowBlur = 18 + this.#getBreath(time) * 18;
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
    const step = CELL_SIZE / 2;
    const segments = Math.ceil(worldSize / step);

    for (let layer = 0; layer < 4; layer++) {
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
      this.#ctx.shadowBlur = 18 - layer * 2;
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
    const worldSize = this.#worldSize() * this.#camera.scale;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = 80;

    if (worldSize <= width) {
      this.#camera.x = (width - worldSize) / 2;
    } else {
      this.#camera.x = clamp(this.#camera.x, width - worldSize - margin, margin);
    }

    if (worldSize <= height) {
      this.#camera.y = (height - worldSize) / 2;
    } else {
      this.#camera.y = clamp(this.#camera.y, height - worldSize - margin, margin);
    }
  }

  #worldSize() {
    return FIRST_TIER_GRID_SIZE * CELL_SIZE;
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

function getRaiderFilter(rarity) {
  if (rarity === "common") return "none";
  if (rarity === "uncommon") return "sepia(1) saturate(6) hue-rotate(55deg)";
  if (rarity === "rare") return "sepia(1) saturate(5) hue-rotate(165deg)";
  if (rarity === "epic") return "sepia(1) saturate(6) hue-rotate(235deg)";
  return "sepia(1) saturate(6) hue-rotate(15deg)";
}

function getRaiderColor(rarity) {
  if (rarity === "uncommon") return "rgba(144, 222, 120, 0.9)";
  if (rarity === "rare") return "rgba(96, 172, 255, 0.9)";
  if (rarity === "epic") return "rgba(177, 102, 255, 0.92)";
  if (rarity === "legendary") return "rgba(255, 182, 54, 0.94)";
  return "rgba(255, 255, 255, 0.9)";
}

function getShieldDamageMultiplier(towerType) {
  if (towerType === "minigun") return 0.5;
  if (towerType === "cannon") return 2;
  return 1;
}

function getTowerFilter(rarity) {
  if (rarity === "common") return "none";
  if (rarity === "uncommon") return "sepia(1) saturate(5) hue-rotate(55deg)";
  if (rarity === "rare") return "sepia(1) saturate(5) hue-rotate(165deg)";
  if (rarity === "epic") return "sepia(1) saturate(6) hue-rotate(235deg)";
  return "sepia(1) saturate(6) hue-rotate(15deg)";
}
