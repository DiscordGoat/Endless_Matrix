import {
  downloadLatestTelemetryRun,
  getLatestTelemetryRun,
  isTelemetryAvailable,
  isTelemetryEnabled,
  toggleTelemetryPrimed
} from "../../game/TelemetryService.js";

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
          <button class="wire-button telemetry-toggle" type="button" data-action="toggle-telemetry">
            <span data-telemetry-label>Telemetry Unprimed</span>
            <span class="button-index" data-telemetry-state>UNPRIMED</span>
          </button>
          <button class="wire-button" type="button" data-action="download-telemetry">
            <span>Download Telemetry</span>
            <span class="button-index" data-telemetry-download-state>EMPTY</span>
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

    screen.querySelector('[data-action="toggle-telemetry"]').addEventListener("click", () => {
      this.#handleTelemetryToggle();
    });

    screen.querySelector('[data-action="download-telemetry"]').addEventListener("click", () => {
      this.#handleTelemetryDownload();
    });

    this.#element = screen;
    this.#syncTelemetryState();
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

  #handleTelemetryToggle() {
    const status = this.#element.querySelector("[data-settings-status]");
    status.dataset.tone = "";

    if (!isTelemetryAvailable()) {
      status.textContent = "Telemetry is only available on the testing server.";
      status.dataset.tone = "error";
      this.#syncTelemetryState();
      return;
    }

    const result = toggleTelemetryPrimed();
    if (result.ok) {
      status.textContent = result.primed
        ? "Primed. The next run will record telemetry."
        : "Unprimed. Runs will not record telemetry.";
      status.dataset.tone = "success";
    } else {
      status.textContent = "Telemetry preference could not be saved.";
      status.dataset.tone = "error";
    }

    this.#syncTelemetryState();
  }

  #handleTelemetryDownload() {
    const status = this.#element.querySelector("[data-settings-status]");
    const downloaded = downloadLatestTelemetryRun();
    status.textContent = downloaded
      ? "Latest playthrough telemetry downloaded."
      : "Complete a telemetry-enabled playthrough first.";
    status.dataset.tone = downloaded ? "success" : "error";
    this.#syncTelemetryState();
  }

  #syncTelemetryState() {
    const button = this.#element?.querySelector('[data-action="toggle-telemetry"]');
    const label = this.#element?.querySelector("[data-telemetry-label]");
    const state = this.#element?.querySelector("[data-telemetry-state]");
    if (!button || !label || !state) return;

    const available = isTelemetryAvailable();
    const primed = isTelemetryEnabled();
    button.disabled = !available;
    button.dataset.primed = String(primed);
    label.textContent = primed ? "Telemetry Primed" : "Telemetry Unprimed";
    state.textContent = primed ? "PRIMED" : "UNPRIMED";

    const downloadButton = this.#element?.querySelector('[data-action="download-telemetry"]');
    const downloadState = this.#element?.querySelector("[data-telemetry-download-state]");
    const hasLatestRun = Boolean(getLatestTelemetryRun());
    if (downloadButton) downloadButton.disabled = !hasLatestRun;
    if (downloadState) downloadState.textContent = hasLatestRun ? "READY" : "EMPTY";
  }
}
