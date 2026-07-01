const HUB_ACTIONS = [
  { id: "towers", label: "Towers", tone: "red" },
  { id: "level-select", label: "Level Select", tone: "blue" },
  { id: "gems", label: "Gems", tone: "green" },
  { id: "shop", label: "Shop", tone: "yellow" },
  { id: "abilities", label: "Abilities", tone: "purple" },
  { id: "crates", label: "Crates", tone: "orange" }
];

export class MainScreen {
  #saveService;
  #element = null;

  constructor({ saveService }) {
    this.#saveService = saveService;
  }

  mount(context) {
    const save = this.#saveService.getSnapshot();
    const screen = document.createElement("main");
    screen.className = "screen hub-screen";
    screen.setAttribute("aria-label", "Endless Matrix main screen");

    screen.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-shell hub-shell" aria-labelledby="hubTitle">
        <header class="stat-bar" aria-label="Player stats">
          <div class="stat-cell stat-tier">Tier: ${save.tier}</div>
          <div class="stat-cell stat-coins">Coins: ${save.coins}</div>
          <div class="stat-cell stat-gems">Gems: ${save.gems}</div>
          <div class="stat-cell stat-crates">Crates: ${save.crates}</div>
        </header>

        <div class="hub-title-row">
          <h1 id="hubTitle" class="screen-title">Main</h1>
        </div>

        <nav class="hub-scroll" aria-label="Game menu">
          <div class="hub-action-stack">
            ${HUB_ACTIONS.map((action, index) => `
              <button class="hub-action tone-${action.tone}" type="button" data-action="${action.id}">
                <span>${action.label}</span>
                <span class="button-index">${String(index + 1).padStart(2, "0")}</span>
              </button>
            `).join("")}
          </div>
        </nav>

        <footer class="hub-footer">
          <button class="wire-button compact" type="button" data-action="back">Back</button>
          <button class="wire-button compact" type="button" data-action="resume">Resume</button>
        </footer>
      </section>
    `;

    screen.querySelector('[data-action="level-select"]').addEventListener("click", () => {
      context.navigate("level-select");
    });

    screen.querySelector('[data-action="towers"]').addEventListener("click", () => {
      context.navigate("towers");
    });

    screen.querySelector('[data-action="gems"]').addEventListener("click", () => {
      context.navigate("gems");
    });

    screen.querySelector('[data-action="crates"]').addEventListener("click", () => {
      context.navigate("crates");
    });

    screen.querySelector('[data-action="shop"]').addEventListener("click", () => {
      context.navigate("shop");
    });

    screen.querySelector('[data-action="back"]').addEventListener("click", () => {
      context.navigate("main-menu");
    });

    screen.querySelectorAll(".hub-action:not([data-action='level-select']):not([data-action='towers']):not([data-action='gems']):not([data-action='crates']):not([data-action='shop']), [data-action='resume']").forEach((button) => {
      button.addEventListener("click", () => this.#pulse(button));
    });

    this.#element = screen;
    return screen;
  }

  unmount() {
    this.#element = null;
  }

  #pulse(element) {
    element.animate(
      [
        { opacity: 1 },
        { opacity: 0.48 },
        { opacity: 1 }
      ],
      { duration: 180, easing: "ease-out" }
    );
  }
}
