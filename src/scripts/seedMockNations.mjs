/**
 * seedMockNations.mjs
 *
 * Usage:
 *   MONGO_URI="mongodb://127.0.0.1:27017/serverWars" node src/scripts/seedMockNations.mjs
 *
 * Creates 10 new Nations with fun names and unique cities.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Nation from "../models/Nation.js";
import Tile from "../models/Tile.js";
import { WORLD_TILES } from "../utils/constants.js";

async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/serverWars";
  await mongoose.connect(uri, { dbName: "serverWars" });
  console.log("✅ Connected to MongoDB");
}

// Random helper
function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Some fun names
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

async function createNations() {
  const nations = [];

  for (let i = 0; i < nationNames.length; i++) {
    const name = nationNames[i];
    const serverId = `mock-${i + 1}`;
    const population = randint(50, 500);
    const playerCount = randint(3, 40);
    const cityList = cityNameSets[name] || [`${name} City 1`];

    const nation = new Nation({
      serverId,
      name,
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
        hangar: randint(0, 2)
      },
      research: {
        manufacturing: Math.random() < 0.4,
        flight: Math.random() < 0.3,
        happy_meals: Math.random() < 0.2,
        banking: Math.random() < 0.2,
        shit_coins: Math.random() < 0.05
      },
      tilesDiscovered: randint(1, 20),
      discoveredCities: [],
      playerCount
    });

    await nation.save();
    nations.push(nation);

    // Optionally create tiles with cities
    for (let j = 0; j < cityList.length; j++) {
      const tile = new Tile({
        tileId: randint(1, WORLD_TILES),
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

  console.log(`🏳️ Created ${nations.length} new mock nations with cities.`);
}

async function main() {
  try {
    await connectDB();
    await createNations();
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
