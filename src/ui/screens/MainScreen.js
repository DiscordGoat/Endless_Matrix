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
    const activeRun = this.#saveService.getActiveRun();
    const screen = document.createElement("main");
    screen.className = "screen hub-screen";
    screen.setAttribute("aria-label", "Endless Matrix main screen");

    screen.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-shell hub-shell" aria-labelledby="hubTitle">
        <header class="stat-bar" aria-label="Player stats">
          <div class="stat-cell stat-tier">Tier: ${save.tier}</div>
          <div class="stat-cell stat-coins" data-stat="coins">Coins: ${save.coins}</div>
          <div class="stat-cell stat-gems" data-stat="gems">Gems: ${save.gems}</div>
          <div class="stat-cell stat-crates" data-stat="crates">Crates: ${save.crates}</div>
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
          <button class="wire-button compact" type="button" data-action="resume" ${activeRun ? "" : "disabled"}>
            ${activeRun ? `Resume L${activeRun.level}` : "Resume"}
          </button>
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

    screen.querySelector('[data-action="resume"]').addEventListener("click", (event) => {
      if (!activeRun) {
        this.#pulse(event.currentTarget);
        return;
      }

      context.navigate("game-frame", {
        level: activeRun.level,
        resume: true
      });
    });

    screen.querySelectorAll(".hub-action:not([data-action='level-select']):not([data-action='towers']):not([data-action='gems']):not([data-action='crates']):not([data-action='shop'])").forEach((button) => {
      button.addEventListener("click", () => this.#pulse(button));
    });

    this.#element = screen;
    this.#animateDepositStats(context.params.deposit, save);
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

  #animateDepositStats(deposit, save) {
    if (!deposit) return;

    this.#animateStat("coins", save.coins - (deposit.coins || 0), save.coins);
    this.#animateStat("gems", save.gems - (deposit.gems || 0), save.gems);
    this.#animateStat("crates", save.crates - (deposit.crates || 0), save.crates);
  }

  #animateStat(key, from, to) {
    const node = this.#element?.querySelector(`[data-stat="${key}"]`);
    if (!node) return;

    const label = key[0].toUpperCase() + key.slice(1);
    const start = Math.max(0, Math.round(from));
    const end = Math.max(0, Math.round(to));
    const startedAt = performance.now();
    const duration = 900;

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = `${label}: ${Math.round(start + (end - start) * eased)}`;
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    node.classList.add("stat-cell-counting");
    requestAnimationFrame(tick);
    setTimeout(() => node.classList.remove("stat-cell-counting"), duration + 120);
  }
}
