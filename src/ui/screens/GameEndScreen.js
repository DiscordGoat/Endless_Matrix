import { CRATE_DEFINITIONS, getRandomCrate } from "../../game/CrateDefinitions.js";
import { GEM_DEFINITIONS, getRandomGem } from "../../game/GemDefinitions.js";
import { shareLatestTelemetryRun } from "../../game/TelemetryService.js";

const RUNTIME_ASSET_BASE = `${import.meta.env.BASE_URL}assets/runtime`;
const STEP_DELAY_MS = 420;
const COUNT_FAST_MS = 760;
const COUNT_SLOW_MS = 2000;
const ITEM_POP_MS = 210;

export class GameEndScreen {
  #saveService;
  #element = null;
  #timers = [];
  #frames = [];
  #settled = false;

  constructor({ saveService }) {
    this.#saveService = saveService;
  }

  mount(context) {
    this.#settled = false;
    const rewards = normalizeRewards(context.params.rewards || createTestRewards());
    const deposit = this.#settleRewards(rewards);
    const screen = document.createElement("main");
    screen.className = "screen game-end-screen";
    screen.setAttribute("aria-label", "Game end rewards");
    this.#element = screen;

    screen.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-end-shell" aria-labelledby="gameEndTitle">
        <div id="gameEndTitle" class="game-end-stamp ${rewards.victory ? "victory" : "defeat"}" data-end-stamp>
          ${rewards.victory ? "Victory" : "Defeat"}
        </div>

        <div class="game-end-ledger">
          <div class="game-end-row is-hidden" data-reward-row="coins">
            <span>Coins</span>
            <strong data-count="coins">0</strong>
          </div>
          <div class="game-end-row is-hidden" data-reward-row="gems">
            <span>Gems</span>
            <strong data-count="gems">0</strong>
          </div>
          <div class="game-end-row is-hidden" data-reward-row="crates">
            <span>Crates</span>
            <strong data-count="crates">0</strong>
          </div>
        </div>

        <div class="game-end-items" data-item-strip></div>

        <div class="game-end-actions is-hidden" data-end-actions>
          <button class="wire-button compact game-end-continue" type="button" data-continue>
            Continue
          </button>
          ${rewards.telemetryAvailable ? `
            <button class="wire-button compact telemetry-export" type="button" data-telemetry-export>
              Download/Share Telemetry
            </button>
          ` : ""}
        </div>
      </section>
    `;

    screen.querySelector("[data-continue]").addEventListener("click", () => {
      context.navigate("main-screen", {
        deposit
      });
    });
    screen.querySelector("[data-telemetry-export]")?.addEventListener("click", (event) => {
      this.#handleTelemetryExport(event.currentTarget);
    });

    this.#playSequence(rewards);
    return screen;
  }

  unmount() {
    for (const timer of this.#timers) clearTimeout(timer);
    for (const frame of this.#frames) cancelAnimationFrame(frame);
    this.#timers = [];
    this.#frames = [];
    this.#element = null;
  }

  #playSequence(rewards) {
    this.#wait(STEP_DELAY_MS, () => {
      this.#revealRow("coins");
      this.#animateCount("coins", rewards.coins, COUNT_FAST_MS, () => {
        this.#wait(180, () => {
          this.#revealRow("gems");
          this.#animateCount("gems", rewards.gems.length, COUNT_SLOW_MS);
          this.#playItems({
            type: "gem",
            ids: rewards.gems,
            duration: COUNT_SLOW_MS,
            done: () => {
              this.#clearItems();
              this.#wait(180, () => {
                this.#revealRow("crates");
                this.#animateCount("crates", rewards.crates.length, COUNT_SLOW_MS);
                this.#playItems({
                  type: "crate",
                  ids: rewards.crates,
                  duration: COUNT_SLOW_MS,
                  done: () => {
                    this.#clearItems();
                    this.#wait(220, () => this.#showContinue());
                  }
                });
              });
            }
          });
        });
      });
    });
  }

  #revealRow(key) {
    const row = this.#element?.querySelector(`[data-reward-row="${key}"]`);
    row?.classList.remove("is-hidden");
  }

  #animateCount(key, target, duration, done) {
    const node = this.#element?.querySelector(`[data-count="${key}"]`);
    if (!node) return;

    const startedAt = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(target * eased));
      if (progress < 1) {
        this.#frames.push(requestAnimationFrame(tick));
        return;
      }

      node.textContent = String(target);
      done?.();
    };

    this.#frames.push(requestAnimationFrame(tick));
  }

  #playItems({ type, ids, duration, done }) {
    const strip = this.#element?.querySelector("[data-item-strip]");
    if (!strip || ids.length <= 0) {
      this.#wait(duration, done);
      return;
    }

    const step = duration / ids.length;
    ids.forEach((id, index) => {
      this.#wait(index * step, () => {
        const item = type === "gem" ? GEM_DEFINITIONS[id] : CRATE_DEFINITIONS[id];
        if (!item) return;

        strip.replaceChildren(this.#createItemNode({ type, item }));
      });
    });

    this.#wait(duration + ITEM_POP_MS, done);
  }

  #createItemNode({ type, item }) {
    const node = document.createElement("div");
    node.className = `game-end-item ${type === "gem" ? `rarity-${item.rarity}` : `crate-${item.id}`}`;
    const assetPath = type === "gem" ? `gems/${item.asset}.png` : `crates/${item.asset}.png`;
    node.innerHTML = `
      <img src="${RUNTIME_ASSET_BASE}/${assetPath}" alt="" />
      <span>${item.label}</span>
    `;
    return node;
  }

  #clearItems() {
    const strip = this.#element?.querySelector("[data-item-strip]");
    if (!strip) return;
    strip.classList.add("is-clearing");
    this.#wait(180, () => {
      strip.replaceChildren();
      strip.classList.remove("is-clearing");
    });
  }

  #showContinue() {
    this.#element?.querySelector("[data-end-actions]")?.classList.remove("is-hidden");
  }

  async #handleTelemetryExport(button) {
    if (!button) return;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "Preparing Telemetry";

    const result = await shareLatestTelemetryRun();
    button.textContent = result.ok
      ? result.method === "share"
        ? "Telemetry Shared"
        : result.method === "clipboard"
          ? "Telemetry Copied"
          : "Telemetry Downloaded"
      : result.reason || "Telemetry Unavailable";

    window.setTimeout(() => {
      if (!this.#element?.contains(button)) return;
      button.disabled = false;
      button.textContent = originalText;
    }, 1800);
  }

  #settleRewards(rewards) {
    if (this.#settled) {
      return {
        coins: rewards.coins,
        gems: rewards.gems.length,
        crates: rewards.crates.length
      };
    }

    this.#settled = true;
    this.#saveService.addCoins(rewards.coins);
    this.#saveService.addGems(rewards.gems);
    this.#saveService.addCrates(rewards.crates);
    if (rewards.victory) {
      this.#saveService.completeLevel(rewards.level);
    }

    return {
      coins: rewards.coins,
      gems: rewards.gems.length,
      crates: rewards.crates.length
    };
  }

  #wait(delay, callback) {
    const timer = setTimeout(callback, delay);
    this.#timers.push(timer);
  }
}

export function createTestRewards(random = Math.random) {
  const gemCount = randomInt(0, 8, random);
  const crateCount = randomInt(0, 5, random);
  return {
    victory: random() >= 0.28,
    coins: randomInt(30, 220, random),
    gems: Array.from({ length: gemCount }, () => getRandomGem(random)),
    crates: Array.from({ length: crateCount }, () => getRandomCrate(random))
  };
}

function normalizeRewards(rewards) {
  return {
    victory: rewards.victory !== false,
    level: Math.max(1, Math.round(Number(rewards.level) || 1)),
    coins: Math.max(0, Math.round(Number(rewards.coins) || 0)),
    gems: Array.isArray(rewards.gems) ? rewards.gems.filter((id) => GEM_DEFINITIONS[id]) : [],
    crates: Array.isArray(rewards.crates) ? rewards.crates.filter((id) => CRATE_DEFINITIONS[id]) : [],
    telemetryAvailable: Boolean(rewards.telemetryAvailable)
  };
}

function randomInt(min, max, random) {
  return Math.floor(random() * (max - min + 1)) + min;
}
