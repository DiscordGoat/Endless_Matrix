import { CRATE_DEFINITIONS, CRATE_ORDER } from "../../game/CrateDefinitions.js";
import { GEM_DEFINITIONS, GEM_ORDER } from "../../game/GemDefinitions.js";

const SLOT_COUNT = 4;
const RUNTIME_ASSET_BASE = `${import.meta.env.BASE_URL}assets/runtime`;

export class CratesScreen {
  #saveService;
  #element = null;
  #selectedCrate = "gold";
  #inlayIndices = [];
  #lastInlaySlot = null;
  #opening = false;
  #animation = null;

  constructor({ saveService }) {
    this.#saveService = saveService;
  }

  mount(context) {
    this.#element = document.createElement("main");
    this.#element.className = "screen crates-screen";
    this.#element.setAttribute("aria-label", "Crates");
    this.#render(context);
    return this.#element;
  }

  unmount() {
    if (this.#animation) cancelAnimationFrame(this.#animation);
    this.#element = null;
  }

  #render(context) {
    const save = this.#saveService.getSnapshot();
    const selected = CRATE_DEFINITIONS[this.#selectedCrate];
    const inlayGems = this.#inlayIndices.map((index) => save.gemInventory[index]).filter(Boolean);
    const inlayValue = inlayGems.reduce((sum, gemId) => sum + GEM_DEFINITIONS[gemId].sellValue, 0);
    const lootValue = selected.baseValue + inlayValue;
    const sortedGems = save.gemInventory
      .map((gemId, index) => ({ gemId, index, definition: GEM_DEFINITIONS[gemId] }))
      .filter((gem) => !this.#inlayIndices.includes(gem.index))
      .sort((a, b) => GEM_ORDER.indexOf(a.gemId) - GEM_ORDER.indexOf(b.gemId));

    this.#element.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-shell level-shell tower-shell" aria-labelledby="cratesTitle">
        <header class="tower-header">
          <h1 id="cratesTitle" class="screen-title">Crates</h1>
          <div class="coin-readout" data-coin-readout>${save.coins} Coins</div>
        </header>

        <div class="crate-open-layer" data-crate-open-layer></div>

        <div class="tower-scroll" tabindex="0">
          <div class="crate-grid">
            ${CRATE_ORDER.map((crateId) => {
              const crate = CRATE_DEFINITIONS[crateId];
              const count = save.crateInventory[crateId] || 0;
              return `
                <button class="crate-card crate-${crateId}${this.#selectedCrate === crateId ? " selected" : ""}" type="button" data-crate="${crateId}" ${this.#opening ? "disabled" : ""}>
                  <img src="${RUNTIME_ASSET_BASE}/crates/${crate.asset}.png" alt="" />
                  <span>${crate.label}</span>
                  <small class="${count > 0 ? "has-count" : ""}">${count} Owned</small>
                </button>
              `;
            }).join("")}
          </div>

          <div class="crate-workbench${this.#lastInlaySlot !== null ? " inlay-active" : ""}">
            <div class="crate-slots left">
              ${this.#renderSlot(0, inlayGems[0])}
              ${this.#renderSlot(1, inlayGems[1])}
            </div>
            <div class="crate-focus">
              <img src="${RUNTIME_ASSET_BASE}/crates/${selected.asset}.png" alt="" />
              <strong>${selected.label}</strong>
              <span>Loot ${lootValue}-${lootValue * 2}</span>
              <div class="crate-actions">
                <button class="wire-button compact" type="button" data-open="one" ${(save.crateInventory[this.#selectedCrate] || 0) <= 0 || this.#opening ? "disabled" : ""}>Open 1</button>
                <button class="wire-button compact" type="button" data-open="all" ${(save.crateInventory[this.#selectedCrate] || 0) <= 0 || this.#opening ? "disabled" : ""}>Open All</button>
              </div>
            </div>
            <div class="crate-slots right">
              ${this.#renderSlot(2, inlayGems[2])}
              ${this.#renderSlot(3, inlayGems[3])}
            </div>
          </div>

          <div class="gem-grid compact-gem-grid">
            ${sortedGems.map((gem) => `
              <button class="gem-card rarity-${gem.definition.rarity}" type="button" data-gem-index="${gem.index}" ${this.#opening || this.#inlayIndices.length >= SLOT_COUNT ? "disabled" : ""}>
                <img src="${RUNTIME_ASSET_BASE}/gems/${gem.definition.asset}.png" alt="" />
                <span>${gem.definition.label}</span>
                <small>+${gem.definition.sellValue}</small>
              </button>
            `).join("")}
          </div>
        </div>

        <footer class="hub-footer">
          <button class="wire-button compact" type="button" data-action="back" ${this.#opening ? "disabled" : ""}>Back</button>
          <button class="wire-button compact" type="button" data-action="clear" ${this.#opening || this.#inlayIndices.length === 0 ? "disabled" : ""}>Clear Inlays</button>
        </footer>
      </section>
    `;

    this.#bind(context);

    if (this.#lastInlaySlot !== null) {
      window.setTimeout(() => {
        this.#lastInlaySlot = null;
      }, 720);
    }
  }

  #renderSlot(slot, gemId) {
    if (!gemId) return `<button class="crate-slot" type="button" data-slot="${slot}">Empty</button>`;
    const gem = GEM_DEFINITIONS[gemId];
    return `
      <button class="crate-slot filled rarity-${gem.rarity}${this.#lastInlaySlot === slot ? " just-inlaid" : ""}" type="button" data-slot="${slot}">
        <img src="${RUNTIME_ASSET_BASE}/gems/${gem.asset}.png" alt="" />
      </button>
    `;
  }

  #bind(context) {
    this.#element.querySelector('[data-action="back"]').addEventListener("click", () => context.navigate("main-screen"));
    this.#element.querySelector('[data-action="clear"]').addEventListener("click", () => {
      this.#lastInlaySlot = null;
      this.#inlayIndices = [];
      this.#render(context);
    });
    this.#element.querySelectorAll("[data-crate]").forEach((button) => {
      button.addEventListener("click", () => {
        this.#lastInlaySlot = null;
        this.#selectedCrate = button.dataset.crate;
        this.#render(context);
      });
    });
    this.#element.querySelectorAll("[data-gem-index]").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.#inlayIndices.length >= SLOT_COUNT) return;
        this.#lastInlaySlot = this.#inlayIndices.length;
        this.#inlayIndices.push(Number(button.dataset.gemIndex));
        this.#render(context);
      });
    });
    this.#element.querySelectorAll("[data-slot]").forEach((button) => {
      button.addEventListener("click", () => {
        this.#lastInlaySlot = null;
        this.#inlayIndices.splice(Number(button.dataset.slot), 1);
        this.#render(context);
      });
    });
    this.#element.querySelectorAll("[data-open]").forEach((button) => {
      button.addEventListener("click", () => this.#openCrates({ context, all: button.dataset.open === "all" }));
    });
  }

  #openCrates({ context, all }) {
    const save = this.#saveService.getSnapshot();
    const countOwned = save.crateInventory[this.#selectedCrate] || 0;
    const count = all ? countOwned : 1;
    if (count <= 0) return;

    const crate = CRATE_DEFINITIONS[this.#selectedCrate];
    const inlayValue = this.#inlayIndices
      .map((index) => save.gemInventory[index])
      .filter(Boolean)
      .reduce((sum, gemId) => sum + GEM_DEFINITIONS[gemId].sellValue, 0);
    const lootValue = crate.baseValue + inlayValue;
    const reward = Array.from({ length: count }, () => randomInt(lootValue, lootValue * 2))
      .reduce((sum, value) => sum + value, 0);

    this.#opening = true;
    this.#saveService.removeGemsByIndices(this.#inlayIndices);
    this.#saveService.spendCrates(this.#selectedCrate, count);
    this.#inlayIndices = [];
    this.#runOpenAnimation({ context, reward });
  }

  #runOpenAnimation({ context, reward }) {
    const layer = this.#element.querySelector("[data-crate-open-layer]");
    const readout = this.#element.querySelector("[data-coin-readout]");
    const startCoins = this.#saveService.getSnapshot().coins;
    layer.innerHTML = `<div class="crate-roll" data-crate-roll>0 Coins</div>`;
    const roll = layer.querySelector("[data-crate-roll]");
    const rollDuration = 1700;
    const holdDuration = 2000;
    const startedAt = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / rollDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      roll.textContent = `${Math.round(reward * eased)} Coins`;

      if (progress < 1) {
        this.#animation = requestAnimationFrame(tick);
        return;
      }

      roll.textContent = `${reward} Coins`;
      setTimeout(() => this.#finishCoinDeposit({ context, reward, startCoins, readout, roll }), holdDuration);
    };

    this.#animation = requestAnimationFrame(tick);
  }

  #finishCoinDeposit({ context, reward, startCoins, readout, roll }) {
    const startedAt = performance.now();
    const duration = 1200;

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const displayCoins = Math.round(startCoins + reward * progress);
      readout.textContent = `${displayCoins} Coins`;
      readout.classList.add("selling");

      if (progress < 1) {
        this.#animation = requestAnimationFrame(tick);
        return;
      }

      this.#saveService.addCoins(reward);
      readout.classList.remove("selling");
      roll.remove();
      this.#opening = false;
      this.#render(context);
    };

    this.#animation = requestAnimationFrame(tick);
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
