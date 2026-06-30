export const RAIDER_TYPES = {
  walker: {
    id: "walker",
    label: "Walker",
    frames: ["walker_frame1", "walker_frame2"],
    frameDuration: 0.2,
    rarities: {
      common: {
        id: "common",
        label: "Common",
        tint: "none",
        health: 100,
        shield: 0,
        speed: 100,
        resources: 1,
        damage: 1
      },
      uncommon: {
        id: "uncommon",
        label: "Uncommon",
        tint: "green",
        health: 200,
        shield: 0,
        speed: 100,
        resources: 1,
        damage: 3
      },
      rare: {
        id: "rare",
        label: "Rare",
        tint: "blue",
        health: 350,
        shield: 0,
        speed: 100,
        resources: 1,
        damage: 6
      },
      epic: {
        id: "epic",
        label: "Epic",
        tint: "purple",
        health: 650,
        shield: 0,
        speed: 100,
        resources: 1,
        damage: 10
      },
      legendary: {
        id: "legendary",
        label: "Legendary",
        tint: "gold",
        health: 1000,
        shield: 0,
        speed: 100,
        resources: 1,
        damage: 16
      }
    }
  },
  car: {
    id: "car",
    label: "Car",
    frames: ["car"],
    frameDuration: 1,
    assetScale: 1.75,
    rarities: {
      common: {
        id: "common",
        label: "Common",
        tint: "none",
        health: 500,
        shield: 500,
        speed: 200,
        resources: 5,
        damage: 5
      },
      uncommon: {
        id: "uncommon",
        label: "Uncommon",
        tint: "green",
        health: 1000,
        shield: 1000,
        speed: 200,
        resources: 5,
        damage: 10
      },
      rare: {
        id: "rare",
        label: "Rare",
        tint: "blue",
        health: 2000,
        shield: 2000,
        speed: 200,
        resources: 5,
        damage: 20
      },
      epic: {
        id: "epic",
        label: "Epic",
        tint: "purple",
        health: 4000,
        shield: 4000,
        speed: 200,
        resources: 5,
        damage: 40
      },
      legendary: {
        id: "legendary",
        label: "Legendary",
        tint: "gold",
        health: 8000,
        shield: 8000,
        speed: 200,
        resources: 5,
        damage: 80
      }
    }
  },
  fastcar: {
    id: "fastcar",
    label: "Fast Car",
    frames: ["fastcar"],
    frameDuration: 1,
    assetScale: 1.75,
    rarities: {
      common: {
        id: "common",
        label: "Common",
        tint: "none",
        health: 500,
        shield: 0,
        speed: 400,
        resources: 3,
        damage: 4
      },
      uncommon: {
        id: "uncommon",
        label: "Uncommon",
        tint: "green",
        health: 1000,
        shield: 0,
        speed: 400,
        resources: 3,
        damage: 8
      },
      rare: {
        id: "rare",
        label: "Rare",
        tint: "blue",
        health: 2000,
        shield: 0,
        speed: 400,
        resources: 3,
        damage: 16
      },
      epic: {
        id: "epic",
        label: "Epic",
        tint: "purple",
        health: 4000,
        shield: 0,
        speed: 400,
        resources: 3,
        damage: 32
      },
      legendary: {
        id: "legendary",
        label: "Legendary",
        tint: "gold",
        health: 8000,
        shield: 0,
        speed: 400,
        resources: 3,
        damage: 64
      }
    }
  }
};

export function createRaider({ type, rarity, id }) {
  const definition = RAIDER_TYPES[type];
  const stats = definition.rarities[rarity];

  return {
    id,
    type,
    rarity,
    health: stats.health,
    maxHealth: stats.health,
    shield: stats.shield,
    maxShield: stats.shield,
    speed: stats.speed,
    resources: stats.resources,
    damage: stats.damage,
    progress: 0,
    alive: true
  };
}
