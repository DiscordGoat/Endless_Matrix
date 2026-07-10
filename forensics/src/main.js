import "./styles.css";

const app = document.querySelector("#app");
const state = {
  payload: null,
  tab: "overview",
  sensitivity: "standard",
  chartMode: "power"
};

const samplePayload = {
  RawData: {
    id: "sample-run",
    startedAt: new Date(Date.now() - 760000).toISOString(),
    endedAt: new Date().toISOString(),
    waveCount: 12,
    result: { victory: false, level: 7, finalWave: 10, playerHealth: 28, resources: 144, coins: 92, gems: [], crates: [] },
    waves: [
      { wave: 1, durationSeconds: 31 },
      { wave: 2, durationSeconds: 38 },
      { wave: 3, durationSeconds: 43 },
      { wave: 4, durationSeconds: 51 },
      { wave: 5, durationSeconds: 54 },
      { wave: 6, durationSeconds: 61 },
      { wave: 7, durationSeconds: 72 },
      { wave: 8, durationSeconds: 75 },
      { wave: 9, durationSeconds: 81 },
      { wave: 10, durationSeconds: 94 }
    ],
    towers: [],
    performance: {
      averageFps: 54.7,
      averageFrameMs: 18.3,
      worstFrameMs: 38.7,
      renderSections: [
        { name: "raiders", averageMs: 4.8, worstMs: 12.1, totalMs: 218, rendered: 1042, skipped: 82 },
        { name: "effects", averageMs: 3.4, worstMs: 9.4, totalMs: 154, rendered: 631, skipped: 19 },
        { name: "towers", averageMs: 2.1, worstMs: 5.7, totalMs: 98, rendered: 812, skipped: 0 }
      ],
      samples: Array.from({ length: 30 }, (_, index) => ({
        at: index * 18000,
        wave: Math.min(10, Math.floor(index / 3) + 1),
        fps: 62 - Math.sin(index / 2) * 6 - index * 0.32,
        resources: 140 + index * 10 + Math.sin(index / 3) * 18,
        towerCount: 4 + Math.floor(index / 5),
        activeRaiders: Math.max(0, Math.round(8 + Math.sin(index / 2) * 7 + index / 2)),
        activeEffects: Math.round(5 + Math.cos(index / 3) * 4)
      }))
    },
    events: [
      { type: "raider_leak", data: { type: "wraithcar", damage: 14 } },
      { type: "raider_leak", data: { type: "jet", flying: true, damage: 8 } },
      { type: "raider_leak", data: { type: "wraithcar", damage: 13 } },
      { type: "raider_leak", data: { type: "serpent", cloaked: true, damage: 9 } }
    ]
  },
  ProcessedData: {
    run: { id: "sample-run", level: 7, victory: false, finalWave: 10, waveCount: 12, durationSeconds: 760 },
    baselines: { contributionPerResource: 32.1, ground: 34.4, air: 21.5, cloaked: 19.8 },
    battles: [
      { battle: "ground", spent: 720, contribution: 24100, contributionPerResource: 33.5, leaks: 2, leakDamage: 27 },
      { battle: "air", spent: 310, contribution: 6660, contributionPerResource: 21.5, leaks: 1, leakDamage: 8 },
      { battle: "cloaked", spent: 280, contribution: 5520, contributionPerResource: 19.7, leaks: 1, leakDamage: 9 }
    ],
    towers: [
      { type: "railgun", rarity: "rare", spent: 260, effectiveDamage: 13200, kills: 36, contributionPerResource: 46.4, Value: 139.2, status: "overperforming" },
      { type: "cannon", rarity: "uncommon", spent: 190, effectiveDamage: 5100, kills: 18, contributionPerResource: 26.8, Value: 78.1, status: "underperforming" },
      { type: "antiair", rarity: "rare", spent: 310, effectiveDamage: 6660, kills: 12, contributionPerResource: 21.5, Value: 100, status: "healthy" },
      { type: "radar", rarity: "common", spent: 150, revealAssistDamage: 2710, contributionPerResource: 18.1, Value: 91.4, status: "healthy" },
      { type: "factory", rarity: "uncommon", spent: 220, resourcesGenerated: 198, contributionPerResource: 30.6, Value: 89, status: "healthy" }
    ],
    towerGroups: [
      { type: "railgun", rarity: "rare", count: 1, contributionPerResource: 46.4, Value: 139.2, status: "overperforming" },
      { type: "antiair", rarity: "rare", count: 1, contributionPerResource: 21.5, Value: 100, status: "healthy" },
      { type: "radar", rarity: "common", count: 1, contributionPerResource: 18.1, Value: 91.4, status: "healthy" },
      { type: "factory", rarity: "uncommon", count: 1, contributionPerResource: 30.6, Value: 89, status: "healthy" },
      { type: "cannon", rarity: "uncommon", count: 1, contributionPerResource: 26.8, Value: 78.1, status: "underperforming" }
    ],
    performance: { averageFps: 54.7, averageFrameMs: 18.3, worstFrameMs: 38.7, sampleCount: 30 }
  }
};

function render() {
  const analysis = state.payload ? analyzeRun(state.payload) : null;
  app.innerHTML = `
    <main class="forensics-shell ${state.payload ? "has-run" : "is-empty"}">
      <header class="topbar">
        <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div class="title-lockup">
          <div class="eyebrow">Endless Matrix / Telemetry</div>
          <h1>Run Forensics</h1>
        </div>
        <div class="top-actions">
          <label class="file-button">
            <input type="file" accept=".json,application/json,text/json" data-file-input />
            Load export
          </label>
          <button class="ghost-button" type="button" data-sample>Sample run</button>
        </div>
      </header>
      <section class="run-strip">
        ${analysis ? runStrip(analysis) : `<span class="live-dot"></span><strong>No run loaded</strong><span>Drop Endless Matrix telemetry JSON to begin</span>`}
      </section>
      <div class="layout">
        <nav class="sidebar">
          ${navButton("overview", "Overview", "⌁")}
          ${navButton("towers", "Towers", "◇")}
          ${navButton("power", "Power", "↯")}
          ${navButton("performance", "Performance", "∿")}
          <div class="coverage">
            <span>Data coverage</span>
            <strong>${analysis?.coverage ?? "0/4"}</strong>
            <meter min="0" max="4" value="${analysis?.coverageScore ?? 0}"></meter>
            <small>JSON schema auto-mapping</small>
          </div>
        </nav>
        <section class="workspace">
          ${analysis ? renderTab(analysis) : emptyState()}
        </section>
      </div>
    </main>
  `;

  bindEvents();
  if (analysis) drawCharts(analysis);
}

function renderTab(analysis) {
  if (state.tab === "towers") return towerPanel(analysis);
  if (state.tab === "power") return powerPanel(analysis);
  if (state.tab === "performance") return performancePanel(analysis);
  return overviewPanel(analysis);
}

function overviewPanel(analysis) {
  return `
    <div class="hero-row">
      <div>
        <div class="section-kicker">Run health</div>
        <h2>What happened in this run?</h2>
        <p>Balance signals and performance risk, ranked by what deserves attention first.</p>
      </div>
      <label class="control">
        <span>Outlier sensitivity</span>
        <select data-sensitivity>
          ${["standard", "strict", "loose"].map((item) => `<option value="${item}" ${item === state.sensitivity ? "selected" : ""}>${titleCase(item)}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="metric-grid">
      ${metricCard("Run length", formatDuration(analysis.durationSeconds), `${analysis.finalWave}/${analysis.waveCount} waves completed`)}
      ${metricCard("Average FPS", formatNumber(analysis.averageFps, 1), `${analysis.sampleCount} samples captured`)}
      ${metricCard("Worst frame", `${formatNumber(analysis.worstFrameMs, 1)} ms`, `${formatNumber(1000 / Math.max(1, analysis.worstFrameMs), 1)} FPS floor`, analysis.worstFrameMs > 33 ? "danger" : "")}
      ${metricCard("Warnings", analysis.warnings.length, `${analysis.highPriorityCount} high-priority`, analysis.highPriorityCount ? "warn" : "")}
    </div>
    <div class="two-column">
      <article class="panel chart-panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">Power curve</div>
            <h3>${state.chartMode === "power" ? "Power over time" : "Frame pacing"}</h3>
          </div>
          <select data-chart-mode>
            <option value="power" ${state.chartMode === "power" ? "selected" : ""}>Power</option>
            <option value="fps" ${state.chartMode === "fps" ? "selected" : ""}>FPS</option>
          </select>
        </div>
        <canvas data-chart="primary" height="260"></canvas>
      </article>
      ${warningsPanel(analysis)}
    </div>
    <div class="two-column lower">
      ${efficiencyPanel(analysis)}
      ${enemyPressurePanel(analysis)}
    </div>
  `;
}

function towerPanel(analysis) {
  return `
    <div class="hero-row compact">
      <div>
        <div class="section-kicker">Role-adjusted value</div>
        <h2>Tower efficiency</h2>
        <p>Contribution per resource, normalized against the lane baseline stored in telemetry.</p>
      </div>
    </div>
    <div class="panel table-panel">
      <div class="tower-table">
        ${analysis.towers.map((tower) => `
          <div class="tower-row status-${tower.status}">
            <div>
              <strong>${towerLabel(tower)}</strong>
              <span>${tower.rarity || "unknown"} · ${tower.lane || "mixed"} · ${formatNumber(tower.effectiveDamage || tower.contribution || 0, 0)} output</span>
            </div>
            <div class="bar-cell"><i style="width:${Math.min(100, Math.max(3, tower.valuePercent))}%"></i></div>
            <b>${formatNumber(tower.Value ?? tower.contributionPerResource ?? 0, 1)}</b>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function powerPanel(analysis) {
  return `
    <div class="hero-row compact">
      <div>
        <div class="section-kicker">Resource pressure</div>
        <h2>Power graph</h2>
        <p>Uses telemetry resource samples as the run power curve; if explicit power is added later, it will map automatically.</p>
      </div>
    </div>
    <article class="panel chart-panel full">
      <div class="panel-head">
        <h3>Power, wave pressure, and recovery</h3>
        <span>${analysis.powerSeries.length} samples</span>
      </div>
      <canvas data-chart="power" height="360"></canvas>
    </article>
    <div class="metric-grid">
      ${metricCard("Peak power", formatNumber(analysis.powerPeak, 0), "highest sample")}
      ${metricCard("Final power", formatNumber(analysis.finalPower, 0), "run-end resources")}
      ${metricCard("Leak damage", formatNumber(analysis.leakDamage, 0), `${analysis.leaks} leaks`)}
      ${metricCard("Power swing", formatNumber(analysis.powerSwing, 0), "peak-to-low range")}
    </div>
  `;
}

function performancePanel(analysis) {
  return `
    <div class="hero-row compact">
      <div>
        <div class="section-kicker">Runtime profile</div>
        <h2>Performance</h2>
        <p>Frame timing, render-section cost, and sample trends from the telemetry export.</p>
      </div>
    </div>
    <div class="two-column">
      <article class="panel chart-panel">
        <div class="panel-head"><h3>FPS over time</h3><span>${analysis.sampleCount} samples</span></div>
        <canvas data-chart="fps" height="280"></canvas>
      </article>
      <article class="panel">
        <div class="panel-head"><h3>Render sections</h3></div>
        <div class="section-list">
          ${analysis.renderSections.map((section) => `
            <div class="section-row">
              <strong>${section.name}</strong>
              <span>${formatNumber(section.averageMs, 2)} ms avg · ${formatNumber(section.worstMs, 2)} ms worst</span>
              <i><span style="width:${Math.min(100, section.weight)}%"></span></i>
            </div>
          `).join("") || `<p class="muted">No render-section telemetry present.</p>`}
        </div>
      </article>
    </div>
  `;
}

function emptyState() {
  return `
    <div class="drop-zone" data-drop-zone>
      <div class="scan-frame"></div>
      <div class="drop-icon">⌬</div>
      <h2>Drop telemetry export</h2>
      <p>Accepts Endless Matrix JSON exports with <code>RawData</code> and <code>ProcessedData</code>. The dashboard will map warnings, power, frame pacing, and tower efficiency.</p>
      <label class="file-button large">
        <input type="file" accept=".json,application/json,text/json" data-file-input />
        Choose JSON
      </label>
    </div>
  `;
}

function warningsPanel(analysis) {
  return `
    <article class="panel warning-panel">
      <div class="panel-head">
        <div>
          <div class="section-kicker">Auto audit</div>
          <h3>Highest-signal findings</h3>
        </div>
        <b class="count-pill">${analysis.warnings.length}</b>
      </div>
      <div class="warning-tabs"><span>All</span><span>Tower</span><span>Enemy</span><span>Performance</span></div>
      <div class="warning-list">
        ${analysis.warnings.map((warning) => `
          <div class="warning-item ${warning.priority}">
            <b>${warning.kind}</b>
            <strong>${warning.title}</strong>
            <span>${warning.detail}</span>
          </div>
        `).join("") || `<p class="muted">No warnings detected at ${state.sensitivity} sensitivity.</p>`}
      </div>
    </article>
  `;
}

function efficiencyPanel(analysis) {
  return `
    <article class="panel">
      <div class="panel-head">
        <div>
          <div class="section-kicker">Role-adjusted value</div>
          <h3>Tower efficiency</h3>
        </div>
        <button class="link-button" type="button" data-tab="towers">Compare all →</button>
      </div>
      <div class="bar-list">
        ${analysis.towers.slice(0, 5).map((tower) => `
          <div class="bar-row">
            <div><strong>${towerLabel(tower)}</strong><span>${tower.statusLabel}</span></div>
            <b>${formatNumber(tower.Value ?? tower.contributionPerResource ?? 0, 1)}</b>
            <i><span style="width:${Math.min(100, Math.max(4, tower.valuePercent))}%"></span></i>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function enemyPressurePanel(analysis) {
  return `
    <article class="panel">
      <div class="panel-head">
        <div>
          <div class="section-kicker">Threat profile</div>
          <h3>Enemy leak pressure</h3>
        </div>
      </div>
      <div class="bar-list">
        ${analysis.enemyPressure.map((enemy) => `
          <div class="bar-row">
            <div><strong>${enemy.type}</strong><span>${enemy.leaks} leaks · ${formatNumber(enemy.damage, 0)} base damage</span></div>
            <b>${formatNumber(enemy.score, 1)}</b>
            <i><span style="width:${Math.min(100, enemy.weight)}%"></span></i>
          </div>
        `).join("") || `<p class="muted">No leak events captured.</p>`}
      </div>
    </article>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-file-input]").forEach((input) => {
    input.addEventListener("change", (event) => loadFile(event.target.files?.[0]));
  });
  document.querySelector("[data-sample]")?.addEventListener("click", () => {
    state.payload = samplePayload;
    render();
  });
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      render();
    });
  });
  document.querySelector("[data-sensitivity]")?.addEventListener("change", (event) => {
    state.sensitivity = event.target.value;
    render();
  });
  document.querySelector("[data-chart-mode]")?.addEventListener("change", (event) => {
    state.chartMode = event.target.value;
    render();
  });
}

window.addEventListener("dragover", (event) => {
  event.preventDefault();
  document.body.classList.add("dragging");
});

window.addEventListener("dragleave", (event) => {
  if (event.clientX === 0 && event.clientY === 0) document.body.classList.remove("dragging");
});

window.addEventListener("drop", (event) => {
  event.preventDefault();
  document.body.classList.remove("dragging");
  loadFile(event.dataTransfer?.files?.[0]);
});

async function loadFile(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    state.payload = normalizePayload(payload);
    state.tab = "overview";
    render();
  } catch (error) {
    alert(`Telemetry file could not be parsed: ${error.message}`);
  }
}

function normalizePayload(payload) {
  if (payload.RawData || payload.ProcessedData) return payload;
  return { RawData: payload.rawData || payload.raw || payload, ProcessedData: payload.ProcessedData || payload.processedData || payload.processed || {} };
}

function analyzeRun(payload) {
  const raw = payload.RawData || {};
  const processed = payload.ProcessedData || {};
  const perf = raw.performance || processed.performance || {};
  const samples = Array.isArray(perf.samples) ? perf.samples : [];
  const processedRun = processed.run || {};
  const result = raw.result || {};
  const towers = normalizeTowers(processed.towerGroups || processed.towers || raw.towers || []);
  const warnings = buildWarnings({ raw, processed, perf, towers, samples });
  const durationSeconds = processedRun.durationSeconds || secondsBetween(raw.startedAt, raw.endedAt);
  const powerSeries = samples.map((sample, index) => ({
    x: sample.at ?? index,
    value: sample.power ?? sample.resources ?? sample.playerHealth ?? 0,
    wave: sample.wave ?? 0
  }));
  const finalPower = result.resources ?? powerSeries.at(-1)?.value ?? 0;
  const powerValues = powerSeries.map((point) => point.value);
  const leaks = (raw.events || []).filter((event) => event.type === "raider_leak");
  const enemyPressure = buildEnemyPressure(leaks);
  const renderSections = (perf.renderSections || []).map((section) => ({ ...section }));
  const worstSection = Math.max(1, ...renderSections.map((section) => section.totalMs || section.averageMs || 0));
  renderSections.forEach((section) => {
    section.weight = ((section.totalMs || section.averageMs || 0) / worstSection) * 100;
  });

  const coverageScore = [
    Boolean(raw.id || processedRun.id),
    samples.length > 0,
    towers.length > 0,
    Boolean(processed.battles?.length || leaks.length)
  ].filter(Boolean).length;

  return {
    raw,
    processed,
    runId: raw.id || processedRun.id || "unknown",
    level: processedRun.level ?? result.level ?? raw.level ?? "unknown",
    victory: processedRun.victory ?? result.victory,
    finalWave: processedRun.finalWave ?? result.finalWave ?? 0,
    waveCount: processedRun.waveCount ?? raw.waveCount ?? 0,
    durationSeconds,
    averageFps: perf.averageFps ?? processed.performance?.averageFps ?? average(samples.map((sample) => sample.fps)),
    averageFrameMs: perf.averageFrameMs ?? processed.performance?.averageFrameMs ?? 0,
    worstFrameMs: perf.worstFrameMs ?? processed.performance?.worstFrameMs ?? 0,
    sampleCount: samples.length || processed.performance?.sampleCount || 0,
    warnings,
    highPriorityCount: warnings.filter((warning) => warning.priority === "high").length,
    towers,
    powerSeries,
    powerPeak: Math.max(0, ...powerValues),
    finalPower,
    powerSwing: Math.max(0, ...powerValues) - Math.min(0, ...powerValues),
    leaks: leaks.length,
    leakDamage: leaks.reduce((total, event) => total + (Number(event.data?.damage) || 0), 0),
    enemyPressure,
    renderSections,
    coverage: `${coverageScore}/4`,
    coverageScore
  };
}

function normalizeTowers(towers) {
  const maxValue = Math.max(1, ...towers.map((tower) => Number(tower.Value ?? tower.contributionPerResource ?? 0)));
  return towers
    .map((tower) => {
      const value = Number(tower.Value ?? tower.contributionPerResource ?? 0);
      return {
        ...tower,
        Value: Number.isFinite(Number(tower.Value)) ? Number(tower.Value) : null,
        valuePercent: (value / maxValue) * 100,
        statusLabel: statusLabel(tower)
      };
    })
    .sort((a, b) => Number(b.Value ?? b.contributionPerResource ?? 0) - Number(a.Value ?? a.contributionPerResource ?? 0));
}

function buildWarnings({ raw, processed, perf, towers, samples }) {
  const warnings = [];
  const strictness = state.sensitivity === "strict" ? 1.15 : state.sensitivity === "loose" ? 0.82 : 1;
  for (const tower of towers) {
    const value = Number(tower.Value);
    if (Number.isFinite(value) && value < 80 * strictness) {
      warnings.push({
        kind: "Tower",
        priority: value < 60 * strictness ? "high" : "medium",
        title: `${towerLabel(tower)} is underperforming`,
        detail: `Role-adjusted value reached ${formatNumber(value, 1)} against a healthy target of 100.`
      });
    }
    if (Number.isFinite(value) && value > 125 / strictness) {
      warnings.push({
        kind: "Tower",
        priority: value > 155 / strictness ? "high" : "medium",
        title: `${towerLabel(tower)} is carrying too much value`,
        detail: `Output is ${formatNumber(value, 1)} on the normalized scale, which may crowd out alternatives.`
      });
    }
  }

  const leaks = (raw.events || []).filter((event) => event.type === "raider_leak");
  if (leaks.length >= Math.max(1, 3 * strictness)) {
    warnings.push({
      kind: "Enemy",
      priority: leaks.length >= 6 * strictness ? "high" : "medium",
      title: "Raiders broke through repeatedly",
      detail: `${leaks.length} leaks caused ${formatNumber(leaks.reduce((total, event) => total + (Number(event.data?.damage) || 0), 0), 0)} base damage.`
    });
  }

  if (Number(perf.worstFrameMs) > 33 / strictness) {
    warnings.push({
      kind: "Performance",
      priority: Number(perf.worstFrameMs) > 50 / strictness ? "high" : "medium",
      title: "Frame pacing dropped below target",
      detail: `Worst frame was ${formatNumber(perf.worstFrameMs, 1)} ms. Inspect render sections for spikes.`
    });
  }

  const fpsValues = samples.map((sample) => Number(sample.fps)).filter(Number.isFinite);
  if (fpsValues.length && average(fpsValues) < 55 * strictness) {
    warnings.push({
      kind: "Performance",
      priority: average(fpsValues) < 45 * strictness ? "high" : "medium",
      title: "Average FPS needs attention",
      detail: `${formatNumber(average(fpsValues), 1)} FPS average across ${fpsValues.length} samples.`
    });
  }

  if (!processed.towers?.length && !processed.towerGroups?.length) {
    warnings.push({
      kind: "Data",
      priority: "low",
      title: "Tower scoring data is incomplete",
      detail: "The file loaded, but no processed tower efficiency table was found."
    });
  }

  return warnings.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
}

function buildEnemyPressure(leaks) {
  const map = new Map();
  for (const event of leaks) {
    const type = titleCase(event.data?.type || "unknown");
    const entry = map.get(type) || { type, leaks: 0, damage: 0, score: 0, weight: 0 };
    entry.leaks += 1;
    entry.damage += Number(event.data?.damage) || 0;
    entry.score = entry.leaks * 4 + entry.damage * 0.5;
    map.set(type, entry);
  }
  const list = [...map.values()].sort((a, b) => b.score - a.score);
  const peak = Math.max(1, ...list.map((entry) => entry.score));
  list.forEach((entry) => { entry.weight = (entry.score / peak) * 100; });
  return list;
}

function drawCharts(analysis) {
  drawLineChart("primary", state.chartMode === "power" ? analysis.powerSeries.map((point) => point.value) : analysis.raw.performance?.samples?.map((sample) => sample.fps) || [], state.chartMode);
  drawLineChart("power", analysis.powerSeries.map((point) => point.value), "power");
  drawLineChart("fps", analysis.raw.performance?.samples?.map((sample) => sample.fps) || [], "fps");
}

function drawLineChart(name, values, label) {
  const canvas = document.querySelector(`[data-chart="${name}"]`);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);
  const pad = 42;
  const numeric = values.map(Number).filter(Number.isFinite);
  if (!numeric.length) {
    ctx.fillStyle = "rgba(215, 244, 255, .58)";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText(`No ${label} samples in export`, pad, height / 2);
    return;
  }
  const min = Math.min(...numeric, label === "fps" ? 30 : 0);
  const max = Math.max(...numeric, min + 1);
  ctx.strokeStyle = "rgba(154, 238, 244, .1)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = pad + ((height - pad * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }
  const points = numeric.map((value, index) => ({
    x: pad + (index / Math.max(1, numeric.length - 1)) * (width - pad * 2),
    y: height - pad - ((value - min) / (max - min)) * (height - pad * 2)
  }));
  const fill = ctx.createLinearGradient(0, pad, 0, height - pad);
  fill.addColorStop(0, "rgba(75, 239, 229, .38)");
  fill.addColorStop(1, "rgba(75, 239, 229, 0)");
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.lineTo(points.at(-1).x, height - pad);
  ctx.lineTo(points[0].x, height - pad);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.strokeStyle = "#4befe5";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "rgba(224, 252, 255, .72)";
  ctx.font = "800 11px ui-monospace, monospace";
  ctx.fillText(formatNumber(max, 1), 10, pad + 4);
  ctx.fillText(formatNumber(min, 1), 10, height - pad + 4);
}

function navButton(tab, label, icon) {
  return `<button class="${state.tab === tab ? "active" : ""}" type="button" data-tab="${tab}"><span>${icon}</span>${label}</button>`;
}

function runStrip(analysis) {
  return `
    <span class="live-dot"></span><strong>${analysis.victory ? "Victory" : "Forensics loaded"}</strong>
    <span>Run ${analysis.runId}</span>
    <span>Level ${analysis.level}</span>
    <span>Wave ${analysis.finalWave}/${analysis.waveCount}</span>
  `;
}

function metricCard(label, value, detail, tone = "") {
  return `<article class="metric-card ${tone}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function titleCase(value) {
  return String(value).replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function towerLabel(tower) {
  return titleCase(tower.type || tower.name || "tower");
}

function statusLabel(tower) {
  const pieces = [];
  if (tower.effectiveDamage) pieces.push(`${formatNumber(tower.effectiveDamage, 0)} dmg`);
  if (tower.resourcesGenerated) pieces.push(`${formatNumber(tower.resourcesGenerated, 0)} power generated`);
  if (tower.revealAssistDamage) pieces.push(`${formatNumber(tower.revealAssistDamage, 0)} reveal assist`);
  if (tower.slowAssistDamage) pieces.push(`${formatNumber(tower.slowAssistDamage, 0)} slow assist`);
  return pieces.join(" · ") || tower.status || "tracked output";
}

function priorityRank(priority) {
  return { low: 1, medium: 2, high: 3 }[priority] || 0;
}

function average(values) {
  const numeric = values.map(Number).filter(Number.isFinite);
  return numeric.length ? numeric.reduce((total, value) => total + value, 0) / numeric.length : 0;
}

function secondsBetween(start, end) {
  const value = (Date.parse(end) - Date.parse(start)) / 1000;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}m ${Math.round(safe % 60)}s`;
}

function formatNumber(value, places = 0) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: places,
    minimumFractionDigits: places
  });
}

render();
