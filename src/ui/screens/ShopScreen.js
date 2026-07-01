import {
  BASE_GEM_DROP_CHANCE,
  formatPercent,
  getCoinYieldMultiplier,
  getGemDropChance,
  getPerkRarity,
  getPerkRarityForProgress,
  getRaiderResourceMultiplier,
  PERK_DEFINITIONS,
  SHOP_CELL_COUNT,
  toRoman
} from "../../game/PerkDefinitions.js";
import { RARITY_LABELS } from "../../game/TowerDefinitions.js";
import { queuePerkReward } from "../RewardPopup.js";

export class ShopScreen {
  #saveService;
  #element = null;
  #selectedPerk = null;

  constructor({ saveService }) {
    this.#saveService = saveService;
  }

  mount(context) {
    const screen = document.createElement("main");
    screen.className = "screen shop-screen";
    screen.setAttribute("aria-label", "Shop");
    this.#element = screen;
    this.#render(context);
    return screen;
  }

  unmount() {
    this.#element = null;
    this.#selectedPerk = null;
  }

  #render(context) {
    const save = this.#saveService.getSnapshot();

    this.#element.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-shell shop-shell" aria-labelledby="shopTitle">
        <header class="tower-header">
          <h1 id="shopTitle" class="screen-title">Shop</h1>
          <div class="coin-readout" data-coin-readout>${save.coins} Coins</div>
        </header>

        <div class="shop-scroll" tabindex="0">
          <div class="shop-grid">
            ${Array.from({ length: SHOP_CELL_COUNT }, (_, index) => this.#renderShopCell(index, save)).join("")}
          </div>
        </div>

        <footer class="screen-footer">
          <button class="wire-button compact" type="button" data-action="back">Back</button>
        </footer>
      </section>
      ${this.#selectedPerk ? this.#renderPerkDetail(save) : ""}
    `;

    this.#element.querySelector('[data-action="back"]').addEventListener("click", () => {
      context.navigate("main-screen");
    });

    this.#element.querySelectorAll("[data-perk]").forEach((button) => {
      button.addEventListener("click", () => {
        this.#selectedPerk = button.dataset.perk;
        this.#render(context);
      });
    });

    this.#element.querySelector("[data-close-perk]")?.addEventListener("click", () => {
      this.#selectedPerk = null;
      this.#render(context);
    });

    this.#element.querySelector("[data-buy-perk]")?.addEventListener("click", () => {
      if (!this.#selectedPerk) return;
      const perk = PERK_DEFINITIONS[this.#selectedPerk];
      const nextLevel = (this.#saveService.getSnapshot().perks[this.#selectedPerk] || 0) + 1;
      if (!this.#saveService.upgradePerk(this.#selectedPerk)) {
        this.#flashCoins();
        return;
      }

      if (perk) {
        queuePerkReward({
          label: perk.label,
          level: toRoman(nextLevel),
          icon: perk.icon,
          rarity: getPerkRarity(nextLevel)
        });
      }

      this.#render(context);
    });
  }

  #renderShopCell(index, save) {
    const perk = Object.values(PERK_DEFINITIONS).find((definition) => definition.cell === index);
    if (!perk) {
      return `<div class="shop-cell shop-cell-empty" aria-hidden="true"></div>`;
    }

    if (perk.locked) {
      return `
        <div class="shop-perk-slot">
          <button class="shop-cell shop-perk-cell shop-perk-locked" type="button" disabled></button>
          <span class="shop-perk-name rarity-common">${perk.label}</span>
        </div>
      `;
    }

    const currentLevel = save.perks[perk.id] || 0;
    const nextLevel = Math.min(currentLevel + 1, perk.maxLevel);
    const rarity = getPerkRarityForProgress(currentLevel, perk.maxLevel);
    const maxed = currentLevel >= perk.maxLevel;
    const displayLevel = maxed ? currentLevel : nextLevel;

    return `
      <div class="shop-perk-slot">
        <button class="shop-cell shop-perk-cell rarity-${rarity}" type="button" data-perk="${perk.id}" aria-label="${perk.label}">
          <img src="${import.meta.env.BASE_URL}assets/perk_icons/${perk.icon}.png" alt="" />
        </button>
        <span class="shop-perk-name rarity-${rarity}">${perk.label} ${toRoman(displayLevel)}</span>
      </div>
    `;
  }

  #renderPerkDetail(save) {
    const perk = PERK_DEFINITIONS[this.#selectedPerk];
    if (!perk || perk.locked) return "";

    const currentLevel = save.perks[perk.id] || 0;
    const nextLevel = Math.min(currentLevel + 1, perk.maxLevel);
    const currentRarity = getPerkRarityForProgress(currentLevel, perk.maxLevel);
    const nextRarity = getPerkRarityForProgress(nextLevel, perk.maxLevel);
    const maxed = currentLevel >= perk.maxLevel;
    const cost = maxed ? null : perk.costForLevel(nextLevel);
    const canAfford = maxed || save.coins >= cost;
    const currentBonus = currentLevel > 0 ? perk.getShortBonus(currentLevel) : this.#getEmptyBonus(perk.id);
    const nextBonus = perk.getShortBonus(nextLevel);
    const totals = this.#getPerkTotals(perk.id, save.perks);
    const nextPerks = {
      ...save.perks,
      [perk.id]: nextLevel
    };

    return `
      <section class="perk-detail-layer" aria-labelledby="perkDetailTitle">
        <div class="perk-detail-panel rarity-${nextRarity}">
          <header class="perk-detail-header">
            <h2 id="perkDetailTitle">${perk.label} ${toRoman(nextLevel)}</h2>
            <button class="perk-detail-exit" type="button" data-close-perk>Exit</button>
          </header>

          <div class="perk-detail-icon" aria-hidden="true">
            <img src="${import.meta.env.BASE_URL}assets/perk_icons/${perk.icon}.png" alt="" />
          </div>

          <div class="perk-comparison">
            <div class="perk-state rarity-${currentRarity}">
              <span>Current</span>
              <strong>${currentLevel > 0 ? `${RARITY_LABELS[currentRarity]} (${currentBonus})` : `None (${this.#getEmptyBonus(perk.id)})`}</strong>
            </div>
            <div class="perk-arrow" aria-hidden="true">-&gt;</div>
            <div class="perk-state rarity-${nextRarity}">
              <span>${maxed ? "Max" : "Next"}</span>
              <strong>${RARITY_LABELS[nextRarity]} (${nextBonus})</strong>
            </div>
          </div>

          <div class="perk-detail-copy">
            <p>${perk.getDescription(nextLevel)}.</p>
            ${totals.base ? `<p>${totals.base}</p>` : ""}
            <p>${totals.label}: ${totals.format(totals.current)}${maxed ? "" : ` -> ${totals.format(totals.next(nextPerks))}`}</p>
          </div>

          <button class="wire-button compact" type="button" data-buy-perk ${maxed || !canAfford ? "disabled" : ""}>
            ${maxed ? "Max Level" : `Upgrade - ${cost} Coins`}
          </button>
        </div>
      </section>
    `;
  }

  #getEmptyBonus(perkId) {
    if (perkId === "looting") return "+0% Raider Resources";
    if (perkId === "gilded") return "+0% Coin Yield";
    return "+0% Gem Chance";
  }

  #getPerkTotals(perkId, perks) {
    if (perkId === "looting") {
      return {
        label: "Total Raider Resources",
        base: "Base Raider Resources: 100%",
        current: getRaiderResourceMultiplier(perks),
        next: (nextPerks) => getRaiderResourceMultiplier(nextPerks),
        format: (value) => formatPercent(value)
      };
    }

    if (perkId === "gilded") {
      return {
        label: "Total Coin Yield",
        base: "Base Coin Yield: 100%",
        current: getCoinYieldMultiplier(perks),
        next: (nextPerks) => getCoinYieldMultiplier(nextPerks),
        format: (value) => formatPercent(value)
      };
    }

    return {
      label: "Total Gem Chance",
      base: `Base Gem Chance: ${formatPercent(BASE_GEM_DROP_CHANCE)}`,
      current: getGemDropChance(perks),
      next: (nextPerks) => getGemDropChance(nextPerks),
      format: (value) => formatPercent(value)
    };
  }

  #flashCoins() {
    const readout = this.#element.querySelector("[data-coin-readout]");
    if (!readout) return;

    readout.animate(
      [
        { color: "rgba(255, 101, 116, 0.96)", boxShadow: "0 0 0 rgba(255, 101, 116, 0)" },
        { color: "rgba(255, 101, 116, 1)", boxShadow: "0 0 28px rgba(255, 101, 116, 0.3)" },
        { color: "", boxShadow: "" }
      ],
      { duration: 420, easing: "ease-out" }
    );
  }
}
