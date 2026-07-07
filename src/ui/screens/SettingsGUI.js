import { shareLatestTelemetryRun } from "../../game/TelemetryService.js";

export class SettingsGUI {
  #saveService;
  #element = null;
  #confirmingReset = false;

  constructor({ saveService }) {
    this.#saveService = saveService;
  }

  mount(context) {
    const screen = document.createElement("main");
    screen.className = "screen settings-screen";
    screen.setAttribute("aria-label", "Settings");

    screen.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="game-shell settings-shell" aria-labelledby="settingsTitle">
        <header class="screen-header">
          <h1 id="settingsTitle" class="screen-title">Settings</h1>
        </header>

        <div class="settings-actions">
          <button class="wire-button" type="button" data-action="send-telemetry">
            <span data-telemetry-label>Send Telemetry</span>
            <span class="button-index">TEL</span>
          </button>
          <button class="wire-button danger" type="button" data-action="reset">
            <span data-reset-label>Reset Account</span>
            <span class="button-index">!</span>
          </button>
          <div class="settings-status" data-settings-status></div>
        </div>

        <footer class="screen-footer">
          <button class="wire-button compact" type="button" data-action="back">Back</button>
        </footer>
      </section>
    `;

    screen.querySelector('[data-action="back"]').addEventListener("click", () => {
      context.navigate("main-menu");
    });

    screen.querySelector('[data-action="reset"]').addEventListener("click", () => {
      this.#handleReset(context);
    });

    screen.querySelector('[data-action="send-telemetry"]').addEventListener("click", () => {
      this.#handleSendTelemetry();
    });

    this.#element = screen;
    return screen;
  }

  unmount() {
    this.#element = null;
    this.#confirmingReset = false;
  }

  #handleReset(context) {
    const resetButton = this.#element.querySelector('[data-action="reset"]');
    const label = this.#element.querySelector("[data-reset-label]");

    if (!this.#confirmingReset) {
      this.#confirmingReset = true;
      label.textContent = "Confirm Reset";
      resetButton.classList.add("armed");
      return;
    }

    this.#saveService.resetAccount();
    context.navigate("main-menu");
  }

  async #handleSendTelemetry() {
    const button = this.#element.querySelector('[data-action="send-telemetry"]');
    const status = this.#element.querySelector("[data-settings-status]");
    button.disabled = true;
    status.textContent = "Preparing telemetry...";
    status.dataset.tone = "";

    const result = await shareLatestTelemetryRun();
    if (result.ok) {
      status.textContent = result.method === "share"
        ? "Telemetry shared."
        : result.method === "clipboard"
          ? "Telemetry copied."
          : "Telemetry downloaded.";
      status.dataset.tone = "success";
    } else {
      status.textContent = result.reason || "Telemetry unavailable.";
      status.dataset.tone = "error";
    }

    button.disabled = false;
  }
}
