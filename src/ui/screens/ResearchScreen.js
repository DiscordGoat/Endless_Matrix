import { getResearchCost, RESEARCH_DEFINITIONS, RESEARCH_ORDER } from "../../game/ResearchDefinitions.js";
import { TOWER_DEFINITIONS } from "../../game/TowerDefinitions.js";

const RUNTIME_ASSET_BASE = `${import.meta.env.BASE_URL}assets/runtime`;

export class ResearchScreen {
  #saveService;
  #element = null;
  #purchaseTimer = 0;
  #pan = { x: 0, y: 0 };
  #zoom = 1;
  #pointers = new Map();
  #dragStart = null;
  #lastPinchDistance = 0;
  #lastTap = { x: 0, y: 0, at: 0 };

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
    this.#pointers.clear();
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

        <div class="research-viewport" tabindex="0" data-research-viewport>
          <div class="research-map" data-research-map>
            ${RESEARCH_ORDER.map((towerId, index) => this.#renderTowerResearch(RESEARCH_DEFINITIONS[towerId], save, index)).join("")}
          </div>
        </div>

        <footer class="hub-footer">
          <button class="wire-button compact" type="button" data-action="back">Back</button>
          <button class="wire-button compact" type="button" disabled>Rare+ Slot</button>
        </footer>
      </section>
    `;

    this.#element.querySelector('[data-action="back"]').addEventListener("click", () => context.navigate("main-screen"));
    this.#bindViewport();
    this.#syncViewportTransform();
    this.#element.querySelectorAll("[data-buy-research]").forEach((button) => {
      button.addEventListener("click", (event) => {
        if (this.#isSuppressingClick()) {
          event.preventDefault();
          return;
        }
        const [towerId, researchId] = button.dataset.buyResearch.split(":");
        if (!this.#saveService.upgradeResearch(towerId, researchId)) return;
        this.#playPurchaseAnimation(button, context);
      });
    });
  }

  #bindViewport() {
    const viewport = this.#element.querySelector("[data-research-viewport]");
    if (!viewport) return;

    viewport.addEventListener("pointerdown", this.#handlePointerDown);
    viewport.addEventListener("pointermove", this.#handlePointerMove);
    viewport.addEventListener("pointerup", this.#handlePointerEnd);
    viewport.addEventListener("pointercancel", this.#handlePointerEnd);
    viewport.addEventListener("wheel", this.#handleWheel, { passive: false });
  }

  #handlePointerDown = (event) => {
    const viewport = this.#element?.querySelector("[data-research-viewport]");
    if (!viewport) return;
    if (event.target.closest("[data-buy-research]")) {
      this.#dragStart = null;
      this.#lastPinchDistance = 0;
      return;
    }

    viewport.setPointerCapture?.(event.pointerId);
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.#dragStart = {
      x: event.clientX,
      y: event.clientY,
      panX: this.#pan.x,
      panY: this.#pan.y
    };
    this.#lastPinchDistance = this.#getPinchDistance();
  };

  #handlePointerMove = (event) => {
    if (!this.#pointers.has(event.pointerId)) return;
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.#pointers.size >= 2) {
      const distance = this.#getPinchDistance();
      if (this.#lastPinchDistance > 0 && distance > 0) {
        this.#zoomAt(this.#getPinchCenter(), distance / this.#lastPinchDistance);
      }
      this.#lastPinchDistance = distance;
      return;
    }

    if (!this.#dragStart) return;
    this.#pan.x = this.#dragStart.panX + event.clientX - this.#dragStart.x;
    this.#pan.y = this.#dragStart.panY + event.clientY - this.#dragStart.y;
    this.#syncViewportTransform();
  };

  #handlePointerEnd = (event) => {
    const pointer = this.#pointers.get(event.pointerId);
    const moved = this.#dragStart ? Math.hypot(event.clientX - this.#dragStart.x, event.clientY - this.#dragStart.y) : 0;

    this.#pointers.delete(event.pointerId);
    this.#lastPinchDistance = this.#pointers.size === 2 ? this.#getPinchDistance() : 0;
    this.#dragStart = null;

    if (pointer && moved > 8 && event.target.closest("[data-research-viewport]")) {
      this.#lastTap = { x: event.clientX, y: event.clientY, at: performance.now() };
    }
  };

  #handleWheel = (event) => {
    event.preventDefault();
    this.#zoomAt({ x: event.clientX, y: event.clientY }, event.deltaY < 0 ? 1.12 : 0.9);
  };

  #zoomAt(point, factor) {
    const viewport = this.#element?.querySelector("[data-research-viewport]");
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const previousZoom = this.#zoom;
    const nextZoom = clamp(this.#zoom * factor, 0.58, 1.9);
    const localX = point.x - rect.left;
    const localY = point.y - rect.top;
    const worldX = (localX - this.#pan.x) / previousZoom;
    const worldY = (localY - this.#pan.y) / previousZoom;

    this.#zoom = nextZoom;
    this.#pan.x = localX - worldX * nextZoom;
    this.#pan.y = localY - worldY * nextZoom;
    this.#syncViewportTransform();
  }

  #syncViewportTransform() {
    const map = this.#element?.querySelector("[data-research-map]");
    if (!map) return;
    map.style.transform = `translate(${this.#pan.x}px, ${this.#pan.y}px) scale(${this.#zoom})`;
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

  #isSuppressingClick() {
    return performance.now() - this.#lastTap.at < 180;
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

  #renderTowerResearch(group, save, index) {
    const tower = TOWER_DEFINITIONS[group.towerId];
    const asset = tower?.usesRarityAssets === false ? tower.asset : `${tower?.asset || group.towerId}_common`;

    return `
      <section class="research-cluster" style="--cluster-index: ${index}" aria-label="${group.label} research">
        <div class="research-core">
          <img src="${RUNTIME_ASSET_BASE}/towers/${asset}.png" alt="" />
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
