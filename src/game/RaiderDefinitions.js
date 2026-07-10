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
  vertext: {
    id: "vertext",
    label: "Vertext",
    frames: ["vertex"],
    frameDuration: 1,
    assetScale: 1.75,
    cloaked: true,
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
  },
  nestor: {
    id: "nestor",
    label: "Nestor",
    frames: ["nestor"],
    frameDuration: 1,
    assetScale: 1.9,
    splitOnDeath: {
      type: "fastcar",
      count: 3
    },
    rarities: {
      common: createNestorStats("common", "Common"),
      uncommon: createNestorStats("uncommon", "Uncommon"),
      rare: createNestorStats("rare", "Rare"),
      epic: createNestorStats("epic", "Epic"),
      legendary: createNestorStats("legendary", "Legendary")
    }
  },
  serpent: {
    id: "serpent",
    label: "Serpent",
    frames: ["serpent"],
    frameDuration: 1,
    assetScale: 1.75,
    damageTakenCap: 1,
    rarities: {
      common: createSerpentStats("common", "Common", 100),
      uncommon: createSerpentStats("uncommon", "Uncommon", 200),
      rare: createSerpentStats("rare", "Rare", 400),
      epic: createSerpentStats("epic", "Epic", 800),
      legendary: createSerpentStats("legendary", "Legendary", 1600)
    }
  },
  wraith: {
    id: "wraith",
    label: "Wraith",
    frames: ["wraith"],
    frameDuration: 1,
    assetScale: 1.55,
    cloaked: true,
    rarities: {
      common: createWraithStats("common", "Common", 100),
      uncommon: createWraithStats("uncommon", "Uncommon", 200),
      rare: createWraithStats("rare", "Rare", 300),
      epic: createWraithStats("epic", "Epic", 400),
      legendary: createWraithStats("legendary", "Legendary", 500)
    }
  }
};

export function createRaider({ type, rarity, id, progress = 0 }) {
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
    progress,
    alive: true
  };

  if (definition.flying) {
    raider.flightPhase = "entry";
    raider.flightTime = 0;
  }

  return raider;
}

function createNestorStats(id, label) {
  return {
    id,
    label,
    tint: "none",
    health: 2000,
    shield: 0,
    speed: 200,
    resources: 5,
    damage: 50
  };
}

function createSerpentStats(id, label, health) {
  return {
    id,
    label,
    tint: "none",
    health,
    shield: 0,
    speed: 100,
    resources: 20,
    damage: 50
  };
}

function createWraithStats(id, label, health) {
  return {
    id,
    label,
    tint: "none",
    health,
    shield: 0,
    speed: 200,
    resources: 4,
    damage: 10
  };
}
