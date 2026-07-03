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
        speed: 100,
        resources: 5,
        damage: 40
      },
      legendary: {
        id: "legendary",
        label: "Legendary",
        tint: "gold",
        health: 8000,
        shield: 8000,
        speed: 100,
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
  },
  heavy_transport: {
    id: "heavy_transport",
    label: "Heavy Transport",
    frames: ["heavy_transport"],
    frameDuration: 1,
    assetScale: 2,
    rarities: {
      common: {
        id: "common",
        label: "Common",
        tint: "none",
        health: 500,
        shield: 2000,
        speed: 200,
        resources: 8,
        damage: 10
      },
      uncommon: {
        id: "uncommon",
        label: "Uncommon",
        tint: "green",
        health: 500,
        shield: 4000,
        speed: 200,
        resources: 8,
        damage: 20
      },
      rare: {
        id: "rare",
        label: "Rare",
        tint: "blue",
        health: 500,
        shield: 8000,
        speed: 200,
        resources: 8,
        damage: 30
      },
      epic: {
        id: "epic",
        label: "Epic",
        tint: "purple",
        health: 500,
        shield: 16000,
        speed: 200,
        resources: 8,
        damage: 40
      },
      legendary: {
        id: "legendary",
        label: "Legendary",
        tint: "gold",
        health: 500,
        shield: 32000,
        speed: 200,
        resources: 8,
        damage: 50
      }
    }
  },
  jet: {
    id: "jet",
    label: "Jet Raider",
    frames: ["jet"],
    frameDuration: 1,
    assetScale: 1.55,
    flying: true,
    rarities: {
      common: {
        id: "common",
        label: "Common",
        tint: "none",
        health: 100,
        shield: 0,
        speed: 600,
        resources: 10,
        damage: 30
      },
      uncommon: {
        id: "uncommon",
        label: "Uncommon",
        tint: "green",
        health: 200,
        shield: 0,
        speed: 600,
        resources: 10,
        damage: 30
      },
      rare: {
        id: "rare",
        label: "Rare",
        tint: "blue",
        health: 300,
        shield: 0,
        speed: 600,
        resources: 10,
        damage: 30
      },
      epic: {
        id: "epic",
        label: "Epic",
        tint: "purple",
        health: 400,
        shield: 0,
        speed: 600,
        resources: 10,
        damage: 30
      },
      legendary: {
        id: "legendary",
        label: "Legendary",
        tint: "gold",
        health: 500,
        shield: 0,
        speed: 600,
        resources: 10,
        damage: 30
      }
    }
  }
};

export function createRaider({ type, rarity, id }) {
  const definition = RAIDER_TYPES[type];
  const stats = definition.rarities[rarity];

  const raider = {
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

  if (definition.flying) {
    raider.flightPhase = "circling";
    raider.flightTime = 0;
  }

  return raider;
}
