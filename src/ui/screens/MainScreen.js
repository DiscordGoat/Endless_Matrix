const HUB_ACTIONS = [
  { id: "towers", label: "Towers", tone: "red" },
  { id: "level-select", label: "Level Select", tone: "blue" },
  { id: "gems", label: "Gems", tone: "green" },
  { id: "shop", label: "Shop", tone: "yellow" },
  { id: "research", label: "Research", tone: "aqua" },
  { id: "crates", label: "Crates", tone: "orange" }
];

const RUNTIME_ASSET_BASE = `${import.meta.env.BASE_URL}assets/runtime`;
const DEVELOPER_COMMANDS = ["giveitem", "setcoins"];
const GIVE_ITEM_SUGGESTIONS = ["singularity", "copper", "bronze", "silver", "gold"];

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
          <div class="stat-cell stat-singularities" data-stat="singularities">
            <img src="${RUNTIME_ASSET_BASE}/other/singularity.png" alt="" />
            <span>${save.singularities}</span>
          </div>
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
      <section class="developer-console hub-developer-console" data-developer-console>
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

    screen.querySelector('[data-action="research"]').addEventListener("click", () => {
      context.navigate("research");
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

    screen.querySelectorAll(".hub-action:not([data-action='level-select']):not([data-action='towers']):not([data-action='gems']):not([data-action='crates']):not([data-action='shop']):not([data-action='research'])").forEach((button) => {
      button.addEventListener("click", () => this.#pulse(button));
    });
    screen.querySelector("[data-developer-console-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      this.#submitDeveloperCommand();
    });
    screen.querySelector("[data-developer-console-input]").addEventListener("input", () => {
      this.#refreshDeveloperSuggestions();
    });

    this.#element = screen;
    window.addEventListener("keydown", this.#handleKeyDown);
    this.#animateDepositStats(context.params.deposit, save);
    return screen;
  }

  unmount() {
    window.removeEventListener("keydown", this.#handleKeyDown);
    this.#element = null;
  }

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

    if (normalizedName === "giveitem") {
      this.#runGiveItemCommand(args);
    } else if (normalizedName === "setcoins") {
      this.#runSetCoinsCommand(args);
    } else {
      this.#setDeveloperConsoleStatus(`Unknown command: ${name}`, false);
      return;
    }

    input.value = "";
    this.#refreshDeveloperSuggestions();
    this.#refreshStatBar();
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

  #runSetCoinsCommand(args) {
    const amount = Number(args[0]);
    if (!Number.isInteger(amount) || amount < 0) {
      this.#setDeveloperConsoleStatus("Use: setcoins <int>", false);
      return;
    }

    const save = this.#saveService.getSnapshot();
    const delta = amount - save.coins;
    if (delta >= 0) {
      this.#saveService.addCoins(delta);
    } else {
      this.#saveService.spendCoins(Math.abs(delta));
    }
    this.#setDeveloperConsoleStatus(`Coins set to ${amount}`, true);
  }

  #refreshDeveloperSuggestions() {
    const input = this.#element?.querySelector("[data-developer-console-input]");
    const datalist = this.#element?.querySelector("[data-developer-console-suggestions]");
    if (!input || !datalist) return;

    const value = input.value.trim().toLowerCase();
    const [name] = value.split(/\s+/);
    const suggestions = name === "giveitem" || value.startsWith("giveitem ")
      ? GIVE_ITEM_SUGGESTIONS.map((item) => `giveitem ${item}`)
      : [
        ...DEVELOPER_COMMANDS,
        "setcoins 1000",
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

  #refreshStatBar() {
    const save = this.#saveService.getSnapshot();
    const coinNode = this.#element?.querySelector('[data-stat="coins"]');
    const gemNode = this.#element?.querySelector('[data-stat="gems"]');
    const crateNode = this.#element?.querySelector('[data-stat="crates"]');
    const singularityNode = this.#element?.querySelector('[data-stat="singularities"] span');

    if (coinNode) coinNode.textContent = `Coins: ${save.coins}`;
    if (gemNode) gemNode.textContent = `Gems: ${save.gems}`;
    if (crateNode) crateNode.textContent = `Crates: ${save.crates}`;
    if (singularityNode) singularityNode.textContent = save.singularities;
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
    this.#animateStat("singularities", save.singularities - (deposit.singularities || 0), save.singularities);
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
      if (key === "singularities") {
        node.querySelector("span").textContent = Math.round(start + (end - start) * eased);
      } else {
        node.textContent = `${label}: ${Math.round(start + (end - start) * eased)}`;
      }
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    node.classList.add("stat-cell-counting");
    requestAnimationFrame(tick);
    setTimeout(() => node.classList.remove("stat-cell-counting"), duration + 120);
  }
}
