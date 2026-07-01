import { GEM_DEFINITIONS } from "../game/GemDefinitions.js";

let rewardSequence = 0;
const rewardQueue = [];
let rewardPlaying = false;

export function queueCoinReward(amount) {
  queueReward(() => showCoinReward(amount));
}

export function queueGemReward(gemId) {
  queueReward(() => showGemReward(gemId));
}

export function queueTextReward({ kicker, value, tone = "default" }) {
  queueReward(() => showTextReward({ kicker, value, tone }));
}

export function queuePerkReward({ label, level, icon, rarity }) {
  queueReward(() => showPerkReward({ label, level, icon, rarity }));
}

function showCoinReward(amount) {
  const popup = document.createElement("div");
  popup.className = "test-reward-popup test-reward-coin";
  popup.dataset.rewardId = String(++rewardSequence);
  popup.innerHTML = `
    <div class="test-reward-burst" aria-hidden="true"></div>
    <div class="test-reward-kicker">Coins Found</div>
    <div class="test-reward-coin-value" data-coin-value>+0</div>
  `;

  appendRewardPopup(popup);

  const value = popup.querySelector("[data-coin-value]");
  const startedAt = performance.now();
  const duration = 700;

  const tick = (now) => {
    if (!popup.isConnected) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 4);
    value.textContent = `+${Math.round(amount * eased)}`;

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}

function showGemReward(gemId) {
  const gem = GEM_DEFINITIONS[gemId];
  if (!gem) return;

  const popup = document.createElement("div");
  popup.className = `test-reward-popup test-reward-gem rarity-${gem.rarity}`;
  popup.dataset.rewardId = String(++rewardSequence);
  popup.innerHTML = `
    <div class="test-reward-burst" aria-hidden="true"></div>
    <img src="${import.meta.env.BASE_URL}assets/gems/${gem.asset}.png" alt="" />
    <div class="test-reward-kicker">Found Gem</div>
    <div class="test-reward-name">${gem.label}</div>
  `;

  appendRewardPopup(popup);
}

function showTextReward({ kicker, value, tone }) {
  const popup = document.createElement("div");
  popup.className = `test-reward-popup test-reward-text test-reward-${tone}`;
  popup.dataset.rewardId = String(++rewardSequence);
  popup.innerHTML = `
    <div class="test-reward-burst" aria-hidden="true"></div>
    <div class="test-reward-kicker">${kicker}</div>
    <div class="test-reward-name">${value}</div>
  `;

  appendRewardPopup(popup);
}

function showPerkReward({ label, level, icon, rarity }) {
  const popup = document.createElement("div");
  popup.className = `test-reward-popup test-reward-perk rarity-${rarity}`;
  popup.dataset.rewardId = String(++rewardSequence);
  popup.innerHTML = `
    <div class="test-reward-burst" aria-hidden="true"></div>
    <img src="${import.meta.env.BASE_URL}assets/perk_icons/${icon}.png" alt="" />
    <div class="test-reward-kicker">Perk Upgraded</div>
    <div class="test-reward-name">${label} ${level}</div>
  `;

  appendRewardPopup(popup);
}

function queueReward(createPopup) {
  rewardQueue.push(createPopup);
  playNextReward();
}

function playNextReward() {
  if (rewardPlaying) return;

  const createPopup = rewardQueue.shift();
  if (!createPopup) return;

  rewardPlaying = true;
  createPopup();
}

function appendRewardPopup(popup) {
  popup.style.setProperty("--reward-offset", "0px");
  document.body.append(popup);

  window.setTimeout(() => {
    popup.classList.add("is-leaving");
  }, 1350);

  window.setTimeout(() => {
    popup.remove();
    rewardPlaying = false;
    playNextReward();
  }, 2200);
}
