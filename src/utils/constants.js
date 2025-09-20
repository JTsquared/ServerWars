// constants.js

// 🌍 World & Population
export const WORLD_TILES = parseInt(process.env.WORLD_TILES || "1000", 10);
export const POPULATION_PER_CITY = parseInt(process.env.POPULATION_PER_CITY || "1000", 10);

export const EXP_GAIN = {
  SCOUT: 15,
  EXPLORER: 5,
  MILITARY: 10,
  ECONOMIST: 2,
  DIPLOMAT: 15,
  // add more if you want specific exp per command
};

// ⏳ Cooldowns (ms)
export const COOLDOWN_MS = 1000 * 5
export const SPY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
export const SPY_SUCCESS_CHANCE = 0.25; // 25%

// 🏗️ Building Costs & Bonuses
export const BUILDINGS = {
  CITY: {
    cost: { gold: 800, steel: 1000 },       // maybe cities have an upfront cost too?
    bonus: 0, 
    max: 0
  },
  BARRACKS: {
    cost: { gold: 150, steel: 100 },
    bonus: 2 , // +2 troops per /train
    max: 20
  },
  FACTORY: {
    cost:  { gold: 150, steel: 100 },
    bonus: 2,
    max: 20
  },
  HANGAR: {
    cost:  { gold: 400, steel: 400 },
    bonus: 2,
    max: 20
  },
  OIL_RIG: {
    cost: { gold: 150, steel: 150 },
    bonus: 2,
    max: 20
  },
  MICK_DONALDS: {
    cost:  { gold: 100, steel: 50 },
    bonus: 2,
    max: 50
  },
  BANK: {
    cost:  { gold: 150, steel: 50 },
    bonus: 2,
    max: 20
  },
  DEPOT: {
    cost: { gold: 350, steel: 500 },
    bonus: 2,
    max: 20
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
    cost: { gold: 500, steel: 700 },
    description: "Unlocks the ability to build depots for tank storage and training.",
  },
  FLIGHT: {
    name: "flight",
    cost: { gold: 600, steel: 900 },
    description: "Unlocks the ability to build hangars for jets.",
  },
  BANKING: {
    name: "banking",
    cost: { gold: 400, steel: 300 },
    description: "Unlocks the ability to build banks to increase gold income.",
  },
  SHIT_COINS: {
    name: "shit coins",
    cost: { gold: 400 },
    description: "Unlocks the ability to launch a shitcoin.",
  },
  HAPPY_MEALS: {
    name: "happy meals",
    cost: { gold: 300, steel: 200 },
    description: "Unlocks the ability to build Mick Donalds to boost food production.",
  }
  // Add more as you expand: e.g. nuclear research, advanced farming, etc.
};

const BUILDING_REQUIREMENTS = {
  DEPOT: "manufacturing",
  HANGAR: "flight",
  BANK: "banking",
  MICK_DONALDS: "happy_meals"
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
