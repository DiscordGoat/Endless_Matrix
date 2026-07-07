import { RARITIES, RARITY_LABELS, TOWER_DEFINITIONS } from "../../game/TowerDefinitions.js";

const RUNTIME_ASSET_BASE = `${import.meta.env.BASE_URL}assets/runtime`;
const TOWER_UNLOCK_ANIMATION_MS = 200;
const TOWER_UNLOCK_POPUP_HOLD_MS = 1400;

export class TowersScreen {
  #saveService;
  #element = null;
  #context = null;
  #coinAnimation = null;
  #unlockPopupTimer = 0;
  #selectedTowerId = null;
  #previewRarity = "common";

  constructor({ saveService }) {
    this.#saveService = saveService;
  }

  mount(context) {
    this.#context = context;
    const screen = document.createElement("main");
    screen.className = "screen towers-screen";
    screen.setAttribute("aria-label", "Towers");
    this.#element = screen;
    this.#normalizeSelection();
    this.#render(context);
    return screen;
  }

  unmount() {
    if (this.#coinAnimation) {
      cancelAnimationFrame(this.#coinAnimation);
    }
    this.#clearTowerUnlockPopup();
    this.#element = null;
    this.#context = null;
  }

  #render(context) {
    const save = this.#saveService.getSnapshot();
    const selectedTower = this.#selectedTowerId ? TOWER_DEFINITIONS[this.#selectedTowerId] : null;

    this.#element.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-shell level-shell tower-shell" aria-labelledby="towerTitle">
        <header class="tower-header">
          <h1 id="towerTitle" class="screen-title">Towers</h1>
          <div class="coin-readout" data-coin-readout>${save.coins} Coins</div>
        </header>

        <div class="tower-browser${selectedTower ? " inspecting" : ""}">
          ${selectedTower ? this.#renderTowerInspector(selectedTower, save) : this.#renderTowerList(save)}
        </div>

        ${selectedTower ? "" : `
          <footer class="screen-footer">
            <button class="wire-button compact" type="button" data-action="back">Back</button>
          </footer>
        `}
      </section>
    `;

    this.#element.querySelector('[data-action="back"]')?.addEventListener("click", () => {
      context.navigate("main-screen");
    });

    this.#element.querySelectorAll("[data-select-tower]").forEach((button) => {
      button.addEventListener("click", () => {
        this.#selectedTowerId = button.dataset.selectTower;
        this.#previewRarity = this.#getDisplayRarityForTower(this.#selectedTowerId, this.#saveService.getSnapshot());
        this.#render(context);
      });
    });

    this.#element.querySelector("[data-rarity-slider]")?.addEventListener("input", (event) => {
      this.#previewRarity = RARITIES[Number(event.currentTarget.value)] || "common";
      this.#refreshInspectorPreview();
    });

    this.#element.querySelector("[data-unlock-next-tier]")?.addEventListener("click", (event) => {
      this.#handleUnlockNextTier(event.currentTarget);
    });

    this.#element.querySelector("[data-close-tower-inspector]")?.addEventListener("click", () => {
      this.#selectedTowerId = null;
      this.#previewRarity = "common";
      this.#render(context);
    });
  }

  #renderTowerList(save) {
    return `
      <div class="tower-scroll" tabindex="0">
        <div class="tower-grid">
          ${Object.values(TOWER_DEFINITIONS).map((tower) => this.#renderTowerCard(tower, save)).join("")}
        </div>
      </div>
    `;
  }

  #renderTowerCard(tower, save) {
    const highestRarity = this.#getHighestUnlockedRarity(tower.id, save);
    const displayRarity = highestRarity || "common";
    const selected = tower.id === this.#selectedTowerId;
    const assetSource = this.#getTowerAssetSource(tower, displayRarity);
    const status = highestRarity ? RARITY_LABELS[highestRarity] : "Locked";

    return `
      <button
        class="tower-card rarity-${displayRarity}${selected ? " selected" : ""}${highestRarity ? " unlocked" : ""}"
        type="button"
        data-select-tower="${tower.id}"
        aria-label="${tower.label}"
      >
        <img src="${assetSource}" alt="" />
        <span class="tower-card-title">${tower.label}</span>
        <span class="tower-card-cost">${status}</span>
      </button>
    `;
  }

  #renderTowerInspector(tower, save) {
    const previewIndex = RARITIES.indexOf(this.#previewRarity);
    const nextRarity = this.#getNextPurchasableRarity(tower.id, save);
    const highestRarity = this.#getHighestUnlockedRarity(tower.id, save);
    const cost = nextRarity ? tower.unlockCosts[nextRarity] : null;
    const canAfford = nextRarity && save.coins >= cost;
    const assetSource = this.#getTowerAssetSource(tower, this.#previewRarity);

    return `
      <aside class="tower-inspector rarity-${this.#previewRarity}" data-tower-inspector>
        <button class="tower-inspector-close" type="button" data-close-tower-inspector aria-label="Close tower details">X</button>
        <div class="tower-inspector-head">
          <div>
            <h2 data-inspector-title>${tower.label}</h2>
            <span data-inspector-rarity>${RARITY_LABELS[this.#previewRarity]}</span>
          </div>
          <div class="tower-inspector-asset" aria-hidden="true">
            <img data-inspector-asset src="${assetSource}" alt="" draggable="false" />
          </div>
        </div>

        <input
          class="tower-rarity-slider"
          type="range"
          min="0"
          max="${RARITIES.length - 1}"
          step="1"
          value="${previewIndex}"
          data-rarity-slider
          aria-label="Preview tower rarity"
        >

        <div class="tower-rarity-track" aria-hidden="true">
          ${RARITIES.map((rarity) => `<span class="rarity-${rarity}">${RARITY_LABELS[rarity]}</span>`).join("")}
        </div>

        <button
          class="wire-button compact tower-unlock-button"
          type="button"
          data-unlock-next-tier
          ${nextRarity && canAfford ? "" : "disabled"}
        >
          ${nextRarity ? `Unlock ${RARITY_LABELS[nextRarity]} - ${cost} Coins` : `Max Tier: ${RARITY_LABELS[highestRarity || "legendary"]}`}
        </button>

        <div class="tower-stat-grid" data-tower-stat-grid>
          ${this.#renderTowerStats(tower, this.#previewRarity)}
        </div>
      </aside>
    `;
  }

  #renderTowerStats(tower, rarity) {
    const stats = tower.rarities[rarity];
    const rows = [
      ["Cost", stats.placementCost, { suffix: "R" }],
      ["Damage", stats.damage],
      ["Range", stats.rangeCells, { suffix: " cells", decimals: 1 }],
      ["Fire Rate", stats.attackInterval > 0 ? 1 / stats.attackInterval : null, { suffix: "/s", decimals: 2 }],
      ["Yield Mult", stats.rarityMultiplier, { suffix: "x" }],
      ["Reveal Time", stats.revealDuration, { suffix: "s" }],
      ["Missile Time", stats.missileDuration, { suffix: "s", decimals: 2 }]
    ].filter(([, value]) => Number.isFinite(value));

    return rows.map(([label, value, options]) => `
      <div class="tower-stat-row">
        <span>${label}</span>
        <strong>${formatTowerStat(value, options)}</strong>
      </div>
    `).join("");
  }

  #refreshInspectorPreview() {
    const tower = TOWER_DEFINITIONS[this.#selectedTowerId];
    if (!tower || !this.#element) return;

    const inspector = this.#element.querySelector("[data-tower-inspector]");
    const rarityLabel = this.#element.querySelector("[data-inspector-rarity]");
    const asset = this.#element.querySelector("[data-inspector-asset]");
    const statGrid = this.#element.querySelector("[data-tower-stat-grid]");
    if (!inspector || !rarityLabel || !asset || !statGrid) return;

    inspector.className = `tower-inspector rarity-${this.#previewRarity}`;
    rarityLabel.textContent = RARITY_LABELS[this.#previewRarity];
    asset.src = this.#getTowerAssetSource(tower, this.#previewRarity);
    statGrid.innerHTML = this.#renderTowerStats(tower, this.#previewRarity);
  }

  #handleUnlockNextTier(button) {
    if (button.disabled) return;
    const tower = TOWER_DEFINITIONS[this.#selectedTowerId];
    const rarity = this.#getNextPurchasableRarity(tower.id, this.#saveService.getSnapshot());
    if (!rarity) return;
    const cost = tower.unlockCosts[rarity];
    const startCoins = this.#saveService.getSnapshot().coins;

    if (!this.#saveService.canAffordCoins(cost)) {
      this.#flashCoins(false);
      return;
    }

    button.disabled = true;
    this.#runPurchaseAnimation({
      button,
      towerId: tower.id,
      rarity,
      startCoins,
      cost,
      summary: this.#buildTowerUnlockSummary(tower, rarity, cost)
    });
  }

  #runPurchaseAnimation({ button, towerId, rarity, startCoins, cost, summary }) {
    const readout = this.#element.querySelector("[data-coin-readout]");
    const duration = TOWER_UNLOCK_ANIMATION_MS;
    const startedAt = performance.now();

    this.#flashCoins(true);

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const displayCoins = Math.round(startCoins - cost * eased);

      readout.textContent = `${displayCoins} Coins`;
      readout.style.transform = `scale(${1 + Math.sin(progress * Math.PI * 18) * 0.035})`;

      if (progress < 1) {
        this.#coinAnimation = requestAnimationFrame(tick);
        return;
      }

      this.#saveService.spendCoins(cost);
      this.#saveService.unlockTower(towerId, rarity);
      this.#previewRarity = rarity;
      this.#coinAnimation = null;
      readout.textContent = `${this.#saveService.getSnapshot().coins} Coins`;
      readout.style.transform = "";
      this.#showTowerUnlockPopup(summary);
      window.setTimeout(() => {
        if (!this.#element || !this.#context) return;
        this.#render(this.#context);
      }, TOWER_UNLOCK_POPUP_HOLD_MS + TOWER_UNLOCK_ANIMATION_MS);
    };

    this.#coinAnimation = requestAnimationFrame(tick);
  }

  #buildTowerUnlockSummary(tower, rarity, cost) {
    const rarityIndex = RARITIES.indexOf(rarity);
    const previousRarity = RARITIES[rarityIndex - 1] || null;
    const beforeStats = previousRarity ? tower.rarities[previousRarity] : null;
    const afterStats = tower.rarities[rarity];

    return {
      label: tower.label,
      cost,
      previousRarity,
      rarity,
      asset: this.#getTowerAssetSource(tower, rarity),
      rows: this.#getTowerUnlockRows(tower, beforeStats, afterStats)
    };
  }

  #getTowerUnlockRows(tower, beforeStats, afterStats) {
    const rows = [];
    const addRow = (label, beforeValue, afterValue, options = {}) => {
      if (!Number.isFinite(afterValue)) return;
      if (beforeStats && Number.isFinite(beforeValue) && Math.abs(afterValue - beforeValue) < 0.0001) return;
      rows.push({
        label,
        before: beforeStats ? formatTowerStat(beforeValue, options) : "Locked",
        after: formatTowerStat(afterValue, options),
        delta: beforeStats ? formatTowerDelta(beforeValue, afterValue, options) : "New"
      });
    };

    addRow("Damage", beforeStats?.damage, afterStats.damage);
    addRow("Range", beforeStats?.rangeCells, afterStats.rangeCells, { suffix: " cells", decimals: 1 });

    if (afterStats.attackInterval > 0) {
      addRow(
        "Fire Rate",
        beforeStats ? 1 / beforeStats.attackInterval : null,
        1 / afterStats.attackInterval,
        { suffix: "/s", decimals: 2 }
      );
    }

    if (tower.id === "factory") {
      addRow("Yield Mult", beforeStats?.rarityMultiplier, afterStats.rarityMultiplier, { suffix: "x" });
    }

    if (tower.id === "radar") {
      addRow("Reveal Time", beforeStats?.revealDuration, afterStats.revealDuration, { suffix: "s" });
    }

    if (tower.id === "antiair") {
      addRow("Missile Time", beforeStats?.missileDuration, afterStats.missileDuration, {
        suffix: "s",
        decimals: 2,
        lowerIsBetter: true
      });
    }

    return rows;
  }

  #showTowerUnlockPopup(summary) {
    if (!this.#element) return;

    this.#clearTowerUnlockPopup();
    const layer = document.createElement("section");
    layer.className = `tower-unlock-layer rarity-${summary.rarity}`;
    layer.style.setProperty("--tower-unlock-ms", `${TOWER_UNLOCK_ANIMATION_MS}ms`);
    layer.setAttribute("aria-label", `${summary.label} unlocked`);
    layer.innerHTML = `
      <div class="tower-unlock-panel rarity-${summary.rarity}">
        <header class="tower-unlock-header">
          <h2>${summary.label}</h2>
          <span>${summary.previousRarity ? RARITY_LABELS[summary.previousRarity] : "Locked"} -&gt; ${RARITY_LABELS[summary.rarity]}</span>
        </header>

        <div class="tower-unlock-icon" aria-hidden="true">
          <img src="${summary.asset}" alt="" draggable="false" />
        </div>

        <div class="tower-unlock-stats">
          ${summary.rows.map((row) => `
            <div class="tower-unlock-stat">
              <span>${row.label}</span>
              <strong>${row.before} -&gt; ${row.after}</strong>
              <em>${row.delta}</em>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    layer.addEventListener("click", () => this.#clearTowerUnlockPopup());
    this.#element.append(layer);
    this.#unlockPopupTimer = window.setTimeout(() => {
      this.#clearTowerUnlockPopup();
    }, TOWER_UNLOCK_POPUP_HOLD_MS + TOWER_UNLOCK_ANIMATION_MS);
  }

  #clearTowerUnlockPopup() {
    if (this.#unlockPopupTimer) {
      window.clearTimeout(this.#unlockPopupTimer);
      this.#unlockPopupTimer = 0;
    }
    this.#element?.querySelector(".tower-unlock-layer")?.remove();
  }

  #normalizeSelection() {
    if (this.#selectedTowerId && !TOWER_DEFINITIONS[this.#selectedTowerId]) {
      this.#selectedTowerId = null;
    }
    this.#previewRarity = this.#selectedTowerId
      ? this.#getDisplayRarityForTower(this.#selectedTowerId, this.#saveService.getSnapshot())
      : "common";
  }

  #getDisplayRarityForTower(towerId, save) {
    return this.#getHighestUnlockedRarity(towerId, save) || "common";
  }

  #getHighestUnlockedRarity(towerId, save) {
    const owned = save.towerUnlocks[towerId] || [];
    const highestOwnedIndex = owned.reduce((highest, rarity) => Math.max(highest, RARITIES.indexOf(rarity)), -1);
    return RARITIES[highestOwnedIndex] || null;
  }

  #getNextPurchasableRarity(towerId, save) {
    const highestRarity = this.#getHighestUnlockedRarity(towerId, save);
    const highestOwnedIndex = highestRarity ? RARITIES.indexOf(highestRarity) : -1;
    return RARITIES[highestOwnedIndex + 1] || null;
  }

  #getTowerAssetSource(tower, rarity) {
    const asset = tower.usesRarityAssets === false ? tower.asset : `${tower.asset}_${rarity}`;
    return `${RUNTIME_ASSET_BASE}/towers/${asset}.png`;
  }

  #flashCoins(success) {
    const readout = this.#element.querySelector("[data-coin-readout]");
    readout.animate(
      [
        { color: success ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 101, 116, 0.96)", boxShadow: "0 0 0 rgba(68, 255, 239, 0)" },
        { color: success ? "rgba(68, 255, 239, 1)" : "rgba(255, 101, 116, 1)", boxShadow: "0 0 28px rgba(68, 255, 239, 0.36)" },
        { color: "", boxShadow: "" }
      ],
      { duration: 420, easing: "ease-out" }
    );
  }
}

function formatTowerStat(value, options = {}) {
  const decimals = Number.isInteger(options?.decimals) ? options.decimals : 0;
  const rounded = Number(value).toFixed(decimals);
  const trimmed = decimals > 0 ? rounded.replace(/\.?0+$/, "") : rounded;
  return `${trimmed}${options?.suffix || ""}`;
}

function formatTowerDelta(beforeValue, afterValue, options = {}) {
  if (!Number.isFinite(beforeValue) || Math.abs(beforeValue) < 0.0001) {
    return "New";
  }

  const ratio = ((afterValue - beforeValue) / Math.abs(beforeValue)) * 100;
  const effectiveRatio = options.lowerIsBetter ? -ratio : ratio;
  const sign = effectiveRatio >= 0 ? "+" : "";
  return `${sign}${Math.round(effectiveRatio)}%`;
}
