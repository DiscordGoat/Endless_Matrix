import { GEM_DEFINITIONS, GEM_ORDER } from "../../game/GemDefinitions.js";

export class GemsScreen {
  #saveService;
  #element = null;
  #lastSale = null;
  #sellAnimation = null;
  #selling = false;

  constructor({ saveService }) {
    this.#saveService = saveService;
  }

  mount(context) {
    const screen = document.createElement("main");
    screen.className = "screen gems-screen";
    screen.setAttribute("aria-label", "Gems");
    this.#element = screen;
    this.#render(context);
    return screen;
  }

  unmount() {
    if (this.#sellAnimation) {
      cancelAnimationFrame(this.#sellAnimation);
    }

    this.#element = null;
  }

  #render(context) {
    const save = this.#saveService.getSnapshot();
    const sortedGems = save.gemInventory
      .map((gemId, index) => ({ gemId, index, definition: GEM_DEFINITIONS[gemId] }))
      .sort((a, b) => GEM_ORDER.indexOf(a.gemId) - GEM_ORDER.indexOf(b.gemId));

    this.#element.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-shell level-shell tower-shell" aria-labelledby="gemsTitle">
        <header class="tower-header">
          <h1 id="gemsTitle" class="screen-title">Gems</h1>
          <div class="coin-readout" data-coin-readout>${save.coins} Coins</div>
        </header>

        <div class="tower-scroll" tabindex="0">
          <div class="gem-grid">
            ${sortedGems.map((gem) => `
              <button class="gem-card rarity-${gem.definition.rarity}" type="button" data-index="${gem.index}" ${this.#selling ? "disabled" : ""}>
                <img src="${import.meta.env.BASE_URL}assets/gems/${gem.definition.asset}.png" alt="" />
                <span>${gem.definition.label}</span>
                <small>Sell ${gem.definition.sellValue}</small>
              </button>
            `).join("")}
          </div>
        </div>

        <footer class="hub-footer">
          <button class="wire-button compact" type="button" data-action="back" ${this.#selling ? "disabled" : ""}>Back</button>
          <button class="wire-button compact" type="button" data-action="undo" ${this.#lastSale && !this.#selling ? "" : "disabled"}>Undo</button>
        </footer>
      </section>
    `;

    this.#element.querySelector('[data-action="back"]').addEventListener("click", () => {
      context.navigate("main-screen");
    });

    this.#element.querySelector('[data-action="undo"]').addEventListener("click", () => {
      this.#saveService.undoSellGem(this.#lastSale);
      this.#lastSale = null;
      this.#render(context);
    });

    this.#element.querySelectorAll(".gem-card").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.#selling) return;
        const index = Number(button.dataset.index);
        const gemId = this.#saveService.getSnapshot().gemInventory[index];
        const value = GEM_DEFINITIONS[gemId].sellValue;
        this.#runSellAnimation({ context, button, index, value });
      });
    });
  }

  #runSellAnimation({ context, button, index, value }) {
    const readout = this.#element.querySelector("[data-coin-readout]");
    const startCoins = this.#saveService.getSnapshot().coins;
    const duration = 500;
    const startedAt = performance.now();
    this.#selling = true;
    this.#lastSale = null;

    this.#element.querySelectorAll("button").forEach((item) => {
      if (item !== button) item.disabled = true;
    });

    button.classList.add("selling");
    readout.classList.add("selling");

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const displayCoins = Math.round(startCoins + value * eased);
      const pulse = 1 + Math.sin(progress * Math.PI * 20) * 0.035;

      readout.textContent = `${displayCoins} Coins`;
      readout.style.transform = `scale(${pulse})`;
      button.style.transform = `scale(${1 - eased * 0.12}) rotate(${eased * 2.5}deg)`;
      button.style.opacity = String(1 - eased * 0.72);
      button.style.filter = `brightness(${1 + Math.sin(progress * Math.PI * 12) * 0.45})`;

      if (progress < 1) {
        this.#sellAnimation = requestAnimationFrame(tick);
        return;
      }

      this.#lastSale = this.#saveService.sellGem(index, value);
      this.#selling = false;
      this.#sellAnimation = null;
      this.#render(context);
    };

    this.#sellAnimation = requestAnimationFrame(tick);
  }
}
