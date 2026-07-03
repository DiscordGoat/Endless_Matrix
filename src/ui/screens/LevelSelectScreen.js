const TOTAL_LEVELS = 100;

export class LevelSelectScreen {
  #saveService;
  #element = null;

  constructor({ saveService }) {
    this.#saveService = saveService;
  }

  mount(context) {
    const save = this.#saveService.getSnapshot();
    const screen = document.createElement("main");
    screen.className = "screen level-select-screen";
    screen.setAttribute("aria-label", "Level select");

    screen.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-shell level-shell" aria-labelledby="levelSelectTitle">
        <header class="screen-header">
          <h1 id="levelSelectTitle" class="screen-title">Level Select</h1>
        </header>

        <div class="level-scroll" tabindex="0">
          <div class="level-grid">
            ${Array.from({ length: TOTAL_LEVELS }, (_, index) => {
              const level = index + 1;
              const locked = level > save.highestUnlockedLevel;
              const completed = save.completedLevels?.includes(level);
              return `
                <button
                  class="level-button ${getLevelTone(level)}${locked ? " locked" : ""}${completed ? " completed" : ""}"
                  type="button"
                  data-level="${level}"
                  ${locked ? "aria-disabled=\"true\"" : ""}
                >
                  <span>${level}</span>
                  ${completed ? `<span class="level-check" aria-hidden="true">✓</span>` : ""}
                </button>
              `;
            }).join("")}
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

    screen.querySelectorAll(".level-button").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.classList.contains("locked")) {
          this.#shake(button);
          return;
        }

        context.navigate("game-frame", {
          level: Number(button.dataset.level)
        });
      });
    });

    this.#element = screen;
    return screen;
  }

  unmount() {
    this.#element = null;
  }

  #shake(element) {
    element.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-2px)" },
        { transform: "translateY(0)" }
      ],
      { duration: 160, easing: "ease-out" }
    );
  }
}

function getLevelTone(level) {
  if (level <= 20) return "tone-white";
  if (level <= 40) return "tone-green";
  if (level <= 60) return "tone-blue";
  if (level <= 80) return "tone-purple";
  return "tone-gold";
}
