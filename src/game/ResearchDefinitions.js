import RESEARCH_REGISTRY from "./ResearchRegistry.json";

export const RESEARCH_ORDER = RESEARCH_REGISTRY.order;

export const RESEARCH_DEFINITIONS = RESEARCH_REGISTRY.definitions;

export const RESEARCH_NODE_LOOKUP = Object.fromEntries(
  Object.values(RESEARCH_DEFINITIONS).flatMap((group) => (
    Object.values(group.nodes).map((node) => [getResearchKey(node.towerId, node.id), node])
  ))
);

export function getResearchKey(towerId, researchId) {
  return `${towerId}:${researchId}`;
}

export function createDefaultResearch() {
  return Object.fromEntries(
    Object.values(RESEARCH_DEFINITIONS).flatMap((group) => (
      Object.values(group.nodes).map((node) => [getResearchKey(node.towerId, node.id), 0])
    ))
  );
}

export function getTowerResearchNodes(towerId) {
  return Object.values(RESEARCH_DEFINITIONS[towerId]?.nodes || {});
}

export function getResearchNode(towerId, researchId) {
  return RESEARCH_DEFINITIONS[towerId]?.nodes?.[researchId] || null;
}

export function getResearchCost(node, currentCapacity = 0) {
  return node.cost + Math.max(0, Math.round(Number(currentCapacity) || 0)) * node.cost;
}
