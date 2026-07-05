import { getResearchCost, RESEARCH_DEFINITIONS, RESEARCH_ORDER } from "../../game/ResearchDefinitions.js";

const RUNTIME_ASSET_BASE = `${import.meta.env.BASE_URL}assets/runtime`;

export class ResearchScreen {
  #saveService;
  #element = null;
  #purchaseTimer = 0;

  constructor({ saveService }) {
    this.#saveService = saveService;
  }

  mount(context) {
    this.#element = document.createElement("main");
    this.#element.className = "screen research-screen";
    this.#element.setAttribute("aria-label", "Research");
    this.#render(context);
    return this.#element;
  }

  unmount() {
    if (this.#purchaseTimer) window.clearTimeout(this.#purchaseTimer);
    this.#element = null;
  }

  #render(context) {
    const save = this.#saveService.getSnapshot();

    this.#element.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-shell research-shell" aria-labelledby="researchTitle">
        <header class="tower-header">
          <h1 id="researchTitle" class="screen-title">Research</h1>
          <div class="singularity-readout">
            <img src="${RUNTIME_ASSET_BASE}/other/singularity.png" alt="" />
            <span>${save.singularities}</span>
          </div>
        </header>

        <div class="research-scroll" tabindex="0">
          ${RESEARCH_ORDER.map((towerId) => this.#renderTowerResearch(RESEARCH_DEFINITIONS[towerId], save)).join("")}
        </div>

        <footer class="hub-footer">
          <button class="wire-button compact" type="button" data-action="back">Back</button>
          <button class="wire-button compact" type="button" disabled>Rare+ Slot</button>
        </footer>
      </section>
    `;

    this.#element.querySelector('[data-action="back"]').addEventListener("click", () => context.navigate("main-screen"));
    this.#element.querySelectorAll("[data-buy-research]").forEach((button) => {
      button.addEventListener("click", () => {
        const [towerId, researchId] = button.dataset.buyResearch.split(":");
        if (!this.#saveService.upgradeResearch(towerId, researchId)) return;
        this.#playPurchaseAnimation(button, context);
      });
    });
  }

  #playPurchaseAnimation(button, context) {
    if (this.#purchaseTimer) window.clearTimeout(this.#purchaseTimer);

    const readout = this.#element.querySelector(".singularity-readout");
    button.disabled = true;
    button.classList.add("purchased");
    readout?.classList.add("spending");
    button.insertAdjacentHTML("beforeend", `
      <span class="research-purchase-ring" aria-hidden="true"></span>
      <span class="research-purchase-burst" aria-hidden="true">
        ${Array.from({ length: 12 }, (_, index) => `<i style="--spark-index: ${index}"></i>`).join("")}
      </span>
      <span class="research-purchase-label" aria-hidden="true">Capacity +1</span>
    `);

    this.#purchaseTimer = window.setTimeout(() => {
      this.#purchaseTimer = 0;
      this.#render(context);
    }, 780);
  }

  #renderTowerResearch(group, save) {
    return `
      <section class="research-cluster" aria-label="${group.label} research">
        <div class="research-core">
          <img src="${RUNTIME_ASSET_BASE}/towers/${group.towerId}_common.png" alt="" />
          <span>${group.label}</span>
        </div>
        <div class="research-node-grid">
          ${Object.values(group.nodes).map((node) => this.#renderNode(node, save)).join("")}
        </div>
      </section>
    `;
  }

  #renderNode(node, save) {
    const key = `${node.towerId}:${node.id}`;
    const capacity = save.research[key] || 0;
    const cost = getResearchCost(node, capacity);
    const canAfford = save.singularities >= cost;
    const style = `--node-q: ${node.position.q}; --node-r: ${node.position.r};`;

    return `
      <button
        class="research-node ${capacity > 0 ? "unlocked" : "locked"}"
        type="button"
        style="${style}"
        data-buy-research="${key}"
        ${canAfford ? "" : "disabled"}
      >
        <strong>${node.label}</strong>
        <span>${node.summary}</span>
        <small>Cap ${capacity} | ${cost} Singularity</small>
      </button>
    `;
  }
}
