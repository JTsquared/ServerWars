// constants.js

// 🌍 World & Population
export const WORLD_TILES = parseInt(process.env.WORLD_TILES || "1000", 10);
export const POPULATION_PER_CITY = parseInt(process.env.POPULATION_PER_CITY || "500", 10);

export const EXP_GAIN = {
  SCOUT: 15,
  MILITARY: 10,
  ECONOMIST: 2,
  DIPLOMAT: 15,
  // add more if you want specific exp per command
};

// ⏳ Cooldowns (ms)
export const COOLDOWN_MS = 1000 * 5
export const SPY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
export const SPY_SUCCESS_CHANCE = 0.20; // 25%

// 🏗️ Building Costs & Bonuses
export const BUILDINGS = {
  CITY: {
    name: "city",
    dbname: "city",
    cost: { gold: 800, steel: 1000 },       // maybe cities have an upfront cost too?
    bonus: 0, 
    max: 0,
    description: "Settling a new city increases your nation's maximum building capacity."
  },
  BARRACKS: {
    name: "barracks",
    name: "barracks",
    cost: { gold: 150, steel: 100 },
    bonus: 2 , // +2 troops per /train
    max: 10,
    requiresResearch: "MILITARY_TRAINING",
    description: "Barracks increase your troop training capacity."
  },
  FACTORY: {
    name: "factory",
    dbname: "factory",
    cost:  { gold: 150, steel: 100 },
    bonus: 2,
    max: 10,
    requiresResearch: "INDUSTRIALIZATION",
    description: "Factories increase your steel production."
  },
  HANGAR: {
    name: "hangar",
    dbname: "hangar",
    cost:  { gold: 400, steel: 400 },
    bonus: 1,
    max: 10,
    requiresResearch: "FLIGHT",
    description: "Hangars enabled the deployment of jets. Additional hangars increase jet production."
  },
  OIL_RIG: {
    name: "oil rig",
    dbname: "oilrig",
    cost: { gold: 150, steel: 150 },
    bonus: 2,
    max: 10,
    requiresResearch: "OIL_DRILLING",
    description: "Oil rigs increase your oil production."
  },
  MICK_DONALDS: {
    name: "mick donalds",
    dbname: "mickdonalds",
    cost:  { gold: 100, steel: 50 },
    bonus: 2,
    max: 10,
    requiresResearch: "HAPPY_MEALS",
    description: "Mick Donalds increase your food production."
  },
  BANK: {
    name: "bank",
    dbname: "bank",
    cost:  { gold: 150, steel: 50 },
    bonus: 2,
    max: 10,
    requiresResearch: "BANKING",
    description: "Banks increase your gold income."
  },
  DEPOT: {
    name: "depot",
    dbname: "depot",
    cost: { gold: 350, steel: 500 },
    bonus: 1,
    max: 10,
    requiresResearch: "MANUFACTURING",
    description: "Depots enabled the deployment of tanks. Additional depots increase tank production."
  }
};

// ⚔️ Military Defaults
export const MILITARY = {
  TRAIN_UNIT_COUNT: 10, // how many troops per /train baseline
  TRAIN_TANK_COUNT: 1,
  TRAIN_JET_COUNT: 1,
};

export const RESEARCH = {
  MANUFACTURING: {
    name: "manufacturing",
    dbname: "manufacturing",
    cost: { gold: 500, steel: 700 },
    description: "Unlocks the ability to build depots for tank storage and training.",
  },
  FLIGHT: {
    name: "flight",
    dbname: "flight",
    cost: { gold: 600, steel: 900 },
    description: "Unlocks the ability to build hangars for jets.",
  },
  BANKING: {
    name: "banking",
    dbname: "banking",
    cost: { gold: 400, steel: 300 },
    description: "Unlocks the ability to build banks to increase gold income.",
  },
  SHIT_COINS: {
    name: "shit coins",
    dbname: "shit_coins",
    cost: { gold: 400 },
    description: "Unlocks the ability to launch a shitcoin.",
  },
  HAPPY_MEALS: {
    name: "happy meals",
    dbname: "happy_meals",
    cost: { gold: 300, steel: 200 },
    description: "Unlocks the ability to build Mick Donalds to boost food production.",
  },
  MILITARY_TRAINING: {
    name: "military training",
    dbname: "military_training",
    cost: {gold: 350, food: 150 },
    description: "Unlocks the ability to create barracks"
  },
  INDUSTRIALIZATION: {
    name: "industrialization",
    dbname: "industrialization",
    cost: { gold: 350, steel: 400 },
    description: "Unlocks the ability to create a factory"
  },
  OIL_DRILLING: {
    name: "oil drilling",
    dbname: "oil_drilling",
    cost: { gold: 400, steel: 200, oil: 200 },
    description: "Unlocks the ability to create oil rigs"
  }
};

export const SELL_RATES = {
  food: 1, 
  oil: 3,  
  steel: 2,
};

export const DEPLOY_COSTS = {
  TROOPS: { food: 1, steel: 0, oil: 0 },   // 1 steel per troop
  TANKS: { food: 0, steel: 5, oil: 2 },    // 5 steel + 2 oil per tank
  JETS: { food: 0, steel: 10, oil: 5 }     // 10 steel + 5 oil per jet
};
