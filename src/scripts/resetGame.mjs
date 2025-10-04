// scripts/resetGame.js
import mongoose from "mongoose";
import GameConfig from "../models/GameConfig.js";
import Nation from "../models/Nation.js";
import Tile from "../models/Tile.js";
import { WORLD_TILES } from "../utils/constants.js";
import "dotenv/config";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/serverwars";
console.log("mongo uri:", MONGO_URI);

// Get CLI args
const args = process.argv.slice(2); // everything after `node resetGame.js ...`
const mode = args[0]; // e.g. "sandbox" or "seasonal"
const victoryType = args[1] || "conquest"; // optional, defaults to military

if (!mode || !["sandbox", "seasonal"].includes(mode)) {
  console.error("❌ You must provide a valid game mode: sandbox | seasonal");
  process.exit(1);
}

// Random helper
function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Some fun names for mock nations
const nationNames = [
  "Auroria",
  "Zephyros",
  "Crimson Vale",
  "Ironhaven",
  "Stormpeak",
  "Verdantia",
  "Obsidian Reach",
  "Sunspire",
  "Frosthold",
  "Eboncrest"
];

// Each nation gets some themed city names
const cityNameSets = {
  "Auroria": ["Goldhaven", "Radiant Bay", "Lumenport"],
  "Zephyros": ["Windspire", "Cloudrest", "Breezeton"],
  "Crimson Vale": ["Bloodrose", "Ashfield", "Scarlet Hollow"],
  "Ironhaven": ["Forgeholm", "Hammerfall", "Steelgate"],
  "Stormpeak": ["Thunderrock", "Lightning Spire", "Gale Ridge"],
  "Verdantia": ["Greenmarch", "Leafshade", "Bloomvale"],
  "Obsidian Reach": ["Darkspire", "Stoneveil", "Shadowfort"],
  "Sunspire": ["Solport", "Brightcliff", "Dawnspire"],
  "Frosthold": ["Snowrest", "Glacier Bay", "Icecrown"],
  "Eboncrest": ["Nightfall", "Crowmoor", "Blackstone"]
};

const nationTraits = ["STEALTHY", "AGRICULTURAL", "INDUSTRIOUS", "MILITARISTIC", "GREGARIOUS", "NOMADIC", "NEGOTIATOR"];

async function createMockNations() {
  const nations = [];

  for (let i = 0; i < nationNames.length; i++) {
    const name = nationNames[i];
    const serverId = `mock-${i + 1}`;
    const population = randint(50, 500);
    const playerCount = randint(3, 40);
    const cityList = cityNameSets[name] || [`${name} City 1`];
    const trait = nationTraits[Math.floor(Math.random() * nationTraits.length)];

    const nation = new Nation({
      serverId,
      name,
      trait,
      population,
      resources: {
        food: randint(100, 500),
        steel: randint(50, 300),
        oil: randint(20, 200),
        gold: randint(50, 500)
      },
      military: {
        troops: randint(10, 200),
        tanks: randint(0, 30),
        jets: randint(0, 15)
      },
      buildings: {
        city: cityList.length,
        farm: randint(0, 5),
        mine: randint(0, 5),
        barracks: randint(0, 3),
        oilrig: randint(0, 2),
        hangar: randint(0, 2),
        factory: randint(0, 2),
        depot: randint(0, 2),
        mickdonalds: randint(0, 3),
        bank: randint(0, 2)
      },
      research: {
        manufacturing: Math.random() < 0.4,
        flight: Math.random() < 0.3,
        happy_meals: Math.random() < 0.2,
        banking: Math.random() < 0.2,
        shit_coins: Math.random() < 0.05,
        industrialization: Math.random() < 0.4,
        military_training: Math.random() < 0.5,
        oil_drilling: Math.random() < 0.3
      },
      tilesDiscovered: randint(1, 20),
      discoveredCities: [],
      playerCount
    });

    await nation.save();
    nations.push(nation);

    // Create tiles with cities
    for (let j = 0; j < cityList.length; j++) {
      const tile = new Tile({
        tileId: String(randint(1, WORLD_TILES)),
        resources: {
          fertility: randint(0, 3),
          steel: randint(0, 3),
          oil: randint(0, 3),
          gold: randint(0, 3)
        },
        surveyedBy: [serverId],
        city: {
          exists: true,
          name: cityList[j],
          owner: serverId,
          ownerName: name,
          foundedAt: new Date()
        }
      });
      await tile.save();
    }
  }

  console.log(`🏳️ Created ${nations.length} mock nations with cities for sandbox mode.`);
}

async function resetGame() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "serverWars" });

    await mongoose.connection.dropDatabase();

    // Build new config
    const newConfig = {
      gamemode: {
        gameType: mode,
        seasonEnd: mode === "seasonal" 
          ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 90) // 90 days
          : null,
        victoryType
      }
    };

    let config = await GameConfig.findOne();
    if (!config) {
      config = new GameConfig(newConfig);
    } else {
      Object.assign(config, newConfig);
    }
    await config.save();

    console.log(`✅ Game reset with mode=${mode}, victoryType=${victoryType}`);

    // Seed mock nations for sandbox mode
    if (mode === "sandbox") {
      await createMockNations();
    }
  } catch (err) {
    console.error("❌ Error resetting game:", err);
  } finally {
    await mongoose.disconnect();
  }
}

resetGame();
