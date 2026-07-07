const TELEMETRY_STORAGE_KEY = "endlessMatrixTelemetryRuns";
const TELEMETRY_OPT_IN_KEY = "endlessMatrixTelemetryOptIn";
const MAX_STORED_RUNS = 20;
const MAX_SECTION_SAMPLES = 24;
const HEALTHY_VALUE = 100;

export function isTelemetryEnabled() {
  if (isTelemetryOptedIn()) return true;
  if (!import.meta.env.DEV) return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

export function isTelemetryOptedIn() {
  try {
    return window.localStorage.getItem(TELEMETRY_OPT_IN_KEY) === "true";
  } catch {
    return false;
  }
}

export function enableTelemetry() {
  try {
    window.localStorage.setItem(TELEMETRY_OPT_IN_KEY, "true");
    return true;
  } catch {
    return false;
  }
}

export class RunTelemetry {
  #enabled = false;
  #run = null;
  #events = [];
  #towers = new Map();
  #waves = [];
  #performance = {
    samples: [],
    renderSections: new Map(),
    frameMsTotal: 0,
    frameMsWorst: 0,
    frameSamples: 0,
    fpsTotal: 0,
    fpsSamples: 0
  };

  constructor(enabled = isTelemetryEnabled()) {
    this.#enabled = enabled;
  }

  get enabled() {
    return this.#enabled;
  }

  startRun({ level, waveCount, startingResources, gameSpeed, perks }) {
    if (!this.#enabled) return;

    this.#run = {
      id: createTelemetryId(),
      schemaVersion: 1,
      startedAt: new Date().toISOString(),
      level,
      waveCount,
      startingResources,
      gameSpeed,
      userAgent: window.navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
      },
      perks: { ...(perks || {}) }
    };
    this.#events = [];
    this.#towers = new Map();
    this.#waves = [];
    this.#performance = {
      samples: [],
      renderSections: new Map(),
      frameMsTotal: 0,
      frameMsWorst: 0,
      frameSamples: 0,
      fpsTotal: 0,
      fpsSamples: 0
    };
    this.#event("run_start", { level, waveCount, startingResources, gameSpeed });
  }

  recordFrame(frameMs) {
    if (!this.#enabled || !this.#run) return;
    const safeFrameMs = Math.max(0, Number(frameMs) || 0);
    this.#performance.frameMsTotal += safeFrameMs;
    this.#performance.frameMsWorst = Math.max(this.#performance.frameMsWorst, safeFrameMs);
    this.#performance.frameSamples += 1;
  }

  recordPerformanceSample({ fps, wave, activeRaiders, activeEffects, towerCount, resources, zoom, visibleRaiders, visibleTowers }) {
    if (!this.#enabled || !this.#run) return;

    const sample = {
      at: roundNumber(performance.now(), 1),
      wave,
      fps,
      activeRaiders,
      visibleRaiders: Math.max(0, Math.round(Number(visibleRaiders) || 0)),
      activeEffects,
      towerCount,
      visibleTowers: Math.max(0, Math.round(Number(visibleTowers) || 0)),
      zoom: roundNumber(Number(zoom) || 0, 2),
      resources: roundNumber(resources, 2)
    };
    this.#performance.samples.push(sample);
    this.#performance.fpsTotal += fps;
    this.#performance.fpsSamples += 1;
    this.#event("performance_sample", sample);
  }

  recordRenderSection(name, durationMs, metadata = {}) {
    if (!this.#enabled || !this.#run) return;
    const duration = Math.max(0, Number(durationMs) || 0);
    const sectionName = String(name || "unknown");
    const zoom = Math.max(0, Number(metadata.zoom) || 0);
    const zoomBucket = getZoomBucket(zoom);
    const section = getSectionStats(this.#performance.renderSections, sectionName);

    updateSectionStats(section, duration, metadata, zoomBucket);
  }

  recordWaveStart({ wave, queue }) {
    if (!this.#enabled || !this.#run) return;
    const summary = summarizeWaveQueue(queue);
    this.#waves.push({
      wave,
      startedAt: roundNumber(performance.now(), 1),
      endedAt: null,
      durationSeconds: 0,
      queue: summary
    });
    this.#event("wave_start", { wave, queue: summary });
  }

  recordWaveEnd({ wave, durationSeconds, resources, playerHealth }) {
    if (!this.#enabled || !this.#run) return;
    const waveRecord = [...this.#waves].reverse().find((item) => item.wave === wave && item.endedAt === null);
    if (waveRecord) {
      waveRecord.endedAt = roundNumber(performance.now(), 1);
      waveRecord.durationSeconds = roundNumber(durationSeconds, 2);
    }
    this.#event("wave_end", {
      wave,
      durationSeconds: roundNumber(durationSeconds, 2),
      resources: roundNumber(resources, 2),
      playerHealth: roundNumber(playerHealth, 2)
    });
  }

  recordTowerPlaced(tower) {
    if (!this.#enabled || !this.#run) return;
    const stats = this.#getTowerStats(tower);
    stats.type = tower.type;
    stats.rarity = tower.rarity;
    stats.research = tower.research || "";
    stats.spent = roundNumber(tower.spent || 0, 2);
    this.#event("tower_placed", towerSnapshot(tower));
  }

  recordTowerUpgraded(tower, cost, previousRarity) {
    if (!this.#enabled || !this.#run) return;
    const stats = this.#getTowerStats(tower);
    stats.rarity = tower.rarity;
    stats.spent = roundNumber((stats.spent || 0) + cost, 2);
    this.#event("tower_upgraded", {
      ...towerSnapshot(tower),
      previousRarity,
      cost
    });
  }

  recordTowerRecycled(tower, refund) {
    if (!this.#enabled || !this.#run) return;
    const stats = this.#getTowerStats(tower);
    stats.recycled = true;
    stats.refund = roundNumber(refund, 2);
    this.#event("tower_recycled", {
      ...towerSnapshot(tower),
      refund: roundNumber(refund, 2)
    });
  }

  recordResearchAssigned(tower, previousResearch) {
    if (!this.#enabled || !this.#run) return;
    const stats = this.#getTowerStats(tower);
    stats.research = tower.research || "";
    this.#event("tower_research_assigned", {
      ...towerSnapshot(tower),
      previousResearch: previousResearch || ""
    });
  }

  recordTowerDamage(tower, { healthDamage, shieldDamage, rawDamage, killed }) {
    if (!this.#enabled || !this.#run || !tower) return;
    const stats = this.#getTowerStats(tower);
    stats.rawDamage += rawDamage;
    stats.healthDamage += healthDamage;
    stats.shieldDamage += shieldDamage;
    stats.effectiveDamage += healthDamage + shieldDamage;
    if (killed) stats.kills += 1;
  }

  recordFactoryYield(tower, amount) {
    if (!this.#enabled || !this.#run || !tower) return;
    const stats = this.#getTowerStats(tower);
    stats.resourcesGenerated += amount;
    stats.factoryActivations += 1;
    this.#event("factory_yield", {
      towerId: tower.id,
      type: tower.type,
      rarity: tower.rarity,
      research: tower.research || "",
      amount: roundNumber(amount, 2)
    });
  }

  recordRadarReveal(tower, raider, durationMs) {
    if (!this.#enabled || !this.#run || !tower) return;
    const stats = this.#getTowerStats(tower);
    stats.reveals += 1;
    stats.revealSeconds += durationMs / 1000;
    this.#event("radar_reveal", {
      towerId: tower.id,
      raiderId: raider.id,
      raiderType: raider.type,
      durationMs
    });
  }

  recordLeak(raider, damage) {
    if (!this.#enabled || !this.#run) return;
    this.#event("raider_leak", {
      raiderId: raider.id,
      type: raider.type,
      rarity: raider.rarity,
      damage
    });
  }

  recordReward({ kind, amount, id, wave }) {
    if (!this.#enabled || !this.#run) return;
    this.#event("reward", { kind, amount, id, wave });
  }

  finishRun({ victory, level, wave, playerHealth, resources, coins, gems, crates }) {
    if (!this.#enabled || !this.#run) return null;

    const rawData = {
      ...this.#run,
      endedAt: new Date().toISOString(),
      result: {
        victory: Boolean(victory),
        level,
        finalWave: wave,
        playerHealth: roundNumber(playerHealth, 2),
        resources: roundNumber(resources, 2),
        coins,
        gems: [...gems],
        crates: [...crates]
      },
      waves: this.#waves,
      towers: [...this.#towers.values()].map(cleanTowerStats),
      performance: this.#rawPerformance(),
      events: this.#events
    };

    const payload = {
      RawData: rawData,
      ProcessedData: processTelemetry(rawData)
    };

    storeTelemetryRun(payload);
    window.__ENDLESS_MATRIX_LAST_TELEMETRY__ = payload;
    this.#event("run_finish", rawData.result);
    return payload;
  }

  #getTowerStats(tower) {
    let stats = this.#towers.get(tower.id);
    if (!stats) {
      stats = {
        towerId: tower.id,
        type: tower.type,
        rarity: tower.rarity,
        research: tower.research || "",
        spent: roundNumber(tower.spent || 0, 2),
        rawDamage: 0,
        healthDamage: 0,
        shieldDamage: 0,
        effectiveDamage: 0,
        kills: 0,
        resourcesGenerated: 0,
        factoryActivations: 0,
        reveals: 0,
        revealSeconds: 0,
        recycled: false,
        refund: 0
      };
      this.#towers.set(tower.id, stats);
    }
    return stats;
  }

  #rawPerformance() {
    const averageFrameMs = this.#performance.frameSamples > 0
      ? this.#performance.frameMsTotal / this.#performance.frameSamples
      : 0;
    const averageFps = this.#performance.fpsSamples > 0
      ? this.#performance.fpsTotal / this.#performance.fpsSamples
      : 0;

    return {
      averageFrameMs: roundNumber(averageFrameMs, 2),
      worstFrameMs: roundNumber(this.#performance.frameMsWorst, 2),
      averageFps: roundNumber(averageFps, 1),
      renderSections: [...this.#performance.renderSections.values()]
        .map(cleanRenderSection)
        .sort((a, b) => b.totalMs - a.totalMs),
      samples: this.#performance.samples
    };
  }

  #event(type, data = {}) {
    this.#events.push({
      at: roundNumber(performance.now(), 1),
      type,
      data
    });
  }
}

export function getStoredTelemetryRuns() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TELEMETRY_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getLatestTelemetryRun() {
  return getStoredTelemetryRuns()[0] || window.__ENDLESS_MATRIX_LAST_TELEMETRY__ || null;
}

export function downloadLatestTelemetryRun() {
  const payload = getLatestTelemetryRun();
  if (!payload) return false;

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const runId = payload.RawData?.id || "run";
  anchor.href = url;
  anchor.download = `endless-matrix-telemetry-${runId}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

export async function copyLatestTelemetryRun() {
  const payload = getLatestTelemetryRun();
  if (!payload || !window.navigator.clipboard) return false;
  await window.navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  return true;
}

export async function shareLatestTelemetryRun() {
  enableTelemetry();
  const payload = getLatestTelemetryRun();
  if (!payload) {
    return { ok: false, reason: "No completed telemetry run found. Telemetry is enabled for your next run." };
  }

  const runId = payload.RawData?.id || "run";
  const fileName = `endless-matrix-telemetry-${runId}.json`;
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const file = typeof File !== "undefined" ? new File([blob], fileName, { type: "application/json" }) : null;

  if (file && window.navigator.canShare?.({ files: [file] }) && window.navigator.share) {
    try {
      await window.navigator.share({
        title: "Endless Matrix Telemetry",
        text: "Endless Matrix frame-time telemetry report",
        files: [file]
      });
      return { ok: true, method: "share" };
    } catch (error) {
      if (error?.name === "AbortError") return { ok: false, reason: "Share cancelled." };
    }
  }

  if (window.navigator.clipboard) {
    try {
      await window.navigator.clipboard.writeText(json);
      return { ok: true, method: "clipboard" };
    } catch {
      // Fall through to download.
    }
  }

  downloadLatestTelemetryRun();
  return { ok: true, method: "download" };
}

function processTelemetry(rawData) {
  const towers = rawData.towers || [];
  const combatSpent = sum(towers, (tower) => tower.effectiveDamage > 0 ? tower.spent : 0);
  const combatDamage = sum(towers, (tower) => tower.effectiveDamage);
  const damagePerResourceBaseline = combatSpent > 0 ? combatDamage / combatSpent : 1;
  const scoredTowers = towers.map((tower) => {
    const contribution = tower.effectiveDamage + tower.resourcesGenerated * damagePerResourceBaseline;
    return {
      ...tower,
      contribution: roundNumber(contribution, 2),
      contributionPerResource: tower.spent > 0 ? contribution / tower.spent : 0
    };
  });
  const scoredSpent = sum(scoredTowers, (tower) => tower.contribution > 0 ? tower.spent : 0);
  const scoredContribution = sum(scoredTowers, (tower) => tower.contribution);
  const runBaseline = scoredSpent > 0 ? scoredContribution / scoredSpent : 0;

  return {
    Value: {
      healthy: HEALTHY_VALUE,
      baseline: "Run average contribution per resource spent",
      notes: [
        "Combat contribution is actual health plus shield removed.",
        "Factory resource output is converted through the run's combat damage-per-resource baseline.",
        "Radar/support utility is tracked as raw reveal data until a support-value baseline exists."
      ]
    },
    run: {
      id: rawData.id,
      level: rawData.result.level,
      victory: rawData.result.victory,
      finalWave: rawData.result.finalWave,
      waveCount: rawData.waveCount,
      durationSeconds: roundNumber((Date.parse(rawData.endedAt) - Date.parse(rawData.startedAt)) / 1000, 2),
      rewards: {
        coins: rawData.result.coins,
        gems: rawData.result.gems.length,
        crates: rawData.result.crates.length
      }
    },
    baselines: {
      damagePerResource: roundNumber(damagePerResourceBaseline, 2),
      contributionPerResource: roundNumber(runBaseline, 2)
    },
    towers: scoredTowers.map((tower) => {
      const value = runBaseline > 0 && tower.contribution > 0
        ? (tower.contributionPerResource / runBaseline) * HEALTHY_VALUE
        : null;
      return {
        towerId: tower.towerId,
        type: tower.type,
        rarity: tower.rarity,
        research: tower.research,
        spent: tower.spent,
        effectiveDamage: roundNumber(tower.effectiveDamage, 2),
        kills: tower.kills,
        resourcesGenerated: roundNumber(tower.resourcesGenerated, 2),
        reveals: tower.reveals,
        revealSeconds: roundNumber(tower.revealSeconds, 2),
        contribution: tower.contribution,
        contributionPerResource: roundNumber(tower.contributionPerResource, 2),
        Value: value === null ? null : roundNumber(value, 1),
        status: getValueStatus(value, tower)
      };
    }),
    towerGroups: groupTowerValues(scoredTowers, runBaseline),
    performance: {
      averageFps: rawData.performance.averageFps,
      averageFrameMs: rawData.performance.averageFrameMs,
      worstFrameMs: rawData.performance.worstFrameMs,
      renderSections: rawData.performance.renderSections || [],
      sampleCount: rawData.performance.samples.length
    }
  };
}

function groupTowerValues(towers, runBaseline) {
  const groups = new Map();
  for (const tower of towers) {
    const key = `${tower.type}:${tower.rarity}:${tower.research || "none"}`;
    const group = groups.get(key) || {
      type: tower.type,
      rarity: tower.rarity,
      research: tower.research || "",
      count: 0,
      spent: 0,
      contribution: 0
    };
    group.count += 1;
    group.spent += tower.spent;
    group.contribution += tower.contribution;
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const contributionPerResource = group.spent > 0 ? group.contribution / group.spent : 0;
    const value = runBaseline > 0 && group.contribution > 0
      ? (contributionPerResource / runBaseline) * HEALTHY_VALUE
      : null;
    return {
      ...group,
      spent: roundNumber(group.spent, 2),
      contribution: roundNumber(group.contribution, 2),
      contributionPerResource: roundNumber(contributionPerResource, 2),
      Value: value === null ? null : roundNumber(value, 1),
      status: getValueStatus(value, group)
    };
  }).sort((a, b) => (b.Value ?? -1) - (a.Value ?? -1));
}

function getValueStatus(value, tower) {
  if (value === null && tower.reveals > 0) return "support_raw_only";
  if (value === null) return "no_contribution";
  if (value < 80) return "underperforming";
  if (value > 125) return "overperforming";
  return "healthy";
}

function summarizeWaveQueue(queue) {
  const counts = new Map();
  for (const entry of queue || []) {
    const key = `${entry.type}:${entry.rarity}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => {
    const [type, rarity] = key.split(":");
    return { type, rarity, count };
  });
}

function cleanTowerStats(stats) {
  return {
    ...stats,
    rawDamage: roundNumber(stats.rawDamage, 2),
    healthDamage: roundNumber(stats.healthDamage, 2),
    shieldDamage: roundNumber(stats.shieldDamage, 2),
    effectiveDamage: roundNumber(stats.effectiveDamage, 2),
    resourcesGenerated: roundNumber(stats.resourcesGenerated, 2),
    revealSeconds: roundNumber(stats.revealSeconds, 2)
  };
}

function getSectionStats(sections, name) {
  let stats = sections.get(name);
  if (!stats) {
    stats = {
      name,
      count: 0,
      totalMs: 0,
      worstMs: 0,
      rendered: 0,
      skipped: 0,
      byZoom: {},
      worstSamples: []
    };
    sections.set(name, stats);
  }
  return stats;
}

function updateSectionStats(section, duration, metadata, zoomBucket) {
  const rendered = Math.max(0, Math.round(Number(metadata.rendered) || 0));
  const skipped = Math.max(0, Math.round(Number(metadata.skipped) || 0));

  section.count += 1;
  section.totalMs += duration;
  section.worstMs = Math.max(section.worstMs, duration);
  section.rendered += rendered;
  section.skipped += skipped;

  const bucket = section.byZoom[zoomBucket] || {
    count: 0,
    totalMs: 0,
    worstMs: 0,
    rendered: 0,
    skipped: 0
  };
  bucket.count += 1;
  bucket.totalMs += duration;
  bucket.worstMs = Math.max(bucket.worstMs, duration);
  bucket.rendered += rendered;
  bucket.skipped += skipped;
  section.byZoom[zoomBucket] = bucket;

  section.worstSamples.push({
    at: roundNumber(performance.now(), 1),
    ms: roundNumber(duration, 3),
    zoom: roundNumber(Number(metadata.zoom) || 0, 2),
    rendered,
    skipped
  });
  section.worstSamples.sort((a, b) => b.ms - a.ms);
  section.worstSamples.length = Math.min(section.worstSamples.length, MAX_SECTION_SAMPLES);
}

function cleanRenderSection(section) {
  const byZoom = Object.fromEntries(
    Object.entries(section.byZoom).map(([bucket, stats]) => [bucket, {
      count: stats.count,
      totalMs: roundNumber(stats.totalMs, 3),
      averageMs: stats.count > 0 ? roundNumber(stats.totalMs / stats.count, 3) : 0,
      worstMs: roundNumber(stats.worstMs, 3),
      rendered: stats.rendered,
      skipped: stats.skipped
    }])
  );

  return {
    name: section.name,
    count: section.count,
    totalMs: roundNumber(section.totalMs, 3),
    averageMs: section.count > 0 ? roundNumber(section.totalMs / section.count, 3) : 0,
    worstMs: roundNumber(section.worstMs, 3),
    rendered: section.rendered,
    skipped: section.skipped,
    byZoom,
    worstSamples: section.worstSamples
  };
}

function getZoomBucket(zoom) {
  if (zoom < 0.75) return "zoom_far";
  if (zoom <= 1.4) return "zoom_mid";
  return "zoom_near";
}

function towerSnapshot(tower) {
  return {
    towerId: tower.id,
    type: tower.type,
    rarity: tower.rarity,
    research: tower.research || "",
    spent: roundNumber(tower.spent || 0, 2),
    x: tower.x,
    y: tower.y,
    surface: tower.surface || "ground"
  };
}

function storeTelemetryRun(payload) {
  const runs = getStoredTelemetryRuns();
  runs.unshift(payload);
  window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(runs.slice(0, MAX_STORED_RUNS)));
}

function sum(items, selector) {
  return items.reduce((total, item) => total + selector(item), 0);
}

function roundNumber(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function createTelemetryId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
