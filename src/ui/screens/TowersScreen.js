import { RARITIES, RARITY_LABELS, TOWER_DEFINITIONS } from "../../game/TowerDefinitions.js";

export class TowersScreen {
  #saveService;
  #element = null;
  #coinAnimation = null;

  constructor({ saveService }) {
    this.#saveService = saveService;
  }

  mount(context) {
    const save = this.#saveService.getSnapshot();
    const screen = document.createElement("main");
    screen.className = "screen towers-screen";
    screen.setAttribute("aria-label", "Towers");

    screen.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-shell level-shell tower-shell" aria-labelledby="towerTitle">
        <header class="tower-header">
          <h1 id="towerTitle" class="screen-title">Towers</h1>
          <div class="coin-readout" data-coin-readout>${save.coins} Coins</div>
        </header>

        <div class="tower-scroll" tabindex="0">
          <div class="tower-grid">
            ${Object.values(TOWER_DEFINITIONS).flatMap((tower) => (
              RARITIES.map((rarity) => {
                const unlocked = this.#saveService.isTowerUnlocked(tower.id, rarity);
                const cost = tower.unlockCosts[rarity];
                return `
                  <button class="tower-card rarity-${rarity}${unlocked ? " unlocked" : ""}" type="button" data-tower="${tower.id}" data-rarity="${rarity}">
                    <img src="${import.meta.env.BASE_URL}assets/${tower.asset}.png" alt="" />
                    <span class="tower-card-title">${RARITY_LABELS[rarity]} ${tower.label}</span>
                    <span class="tower-card-cost">${unlocked ? "Unlocked" : `${cost} Coins`}</span>
                  </button>
                `;
              })
            )).join("")}
          </div>
        </div>

        <footer class="screen-footer">
          <button class="wire-button compact" type="button" data-action="back">Back</button>
        </footer>
      </section>
    `;

    screen.querySelector('[data-action="back"]').addEventListener("click", () => {
      context.navigate("main-screen");
    });

    screen.querySelectorAll(".tower-card").forEach((button) => {
      button.addEventListener("click", () => this.#handlePurchase(button));
    });

    this.#element = screen;
    return screen;
  }

  unmount() {
    if (this.#coinAnimation) {
      cancelAnimationFrame(this.#coinAnimation);
    }

    this.#element = null;
  }

  #handlePurchase(button) {
    if (button.classList.contains("unlocked") || button.disabled) return;

    const towerId = button.dataset.tower;
    const rarity = button.dataset.rarity;
    const cost = TOWER_DEFINITIONS[towerId].unlockCosts[rarity];
    const startCoins = this.#saveService.getSnapshot().coins;

    if (!this.#saveService.canAffordCoins(cost)) {
      this.#flashCoins(false);
      return;
    }

    button.disabled = true;
    this.#runPurchaseAnimation({ button, towerId, rarity, startCoins, cost });
  }

  #runPurchaseAnimation({ button, towerId, rarity, startCoins, cost }) {
    const readout = this.#element.querySelector("[data-coin-readout]");
    const duration = 2000;
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
      readout.textContent = `${this.#saveService.getSnapshot().coins} Coins`;
      readout.style.transform = "";
      button.classList.add("unlocked");
      button.disabled = false;
      button.querySelector(".tower-card-cost").textContent = "Unlocked";
      this.#flashCard(button);
    };

    this.#coinAnimation = requestAnimationFrame(tick);
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

  #flashCard(button) {
    button.animate(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(1.035)", filter: "brightness(1.8)" },
        { transform: "scale(1)", filter: "brightness(1)" }
      ],
      { duration: 420, easing: "ease-out" }
    );
  }
}
