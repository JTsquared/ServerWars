/**
 * seedAndTestMockWorld.mjs
 *
 * Usage:
 *  - put in your project (src/scripts/)
 *  - ensure MONGO_URI in env or set it before running:
 *      MONGO_URI="mongodb://localhost:27017/serverWars" node src/scripts/seedAndTestMockWorld.mjs
 *
 * This script will:
 *  - seed Nations and Tiles (DESTRUCTIVE: clears those collections)
 *  - run a simulation of the explore selection logic to test
 *    weighted nation discovery and ensure no self-discovery.
 *
 * Adapt paths/imports if your project layout differs.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Nation from "../models/Nation.js";
import Tile from "../models/Tile.js";

// ---- Settings you can change ----
const WORLD_TILES = parseInt(process.env.WORLD_TILES || "500", 10);
const NUM_MOCK_NATIONS = 10; // number of nations to seed (excluding "you")
const TILES_PER_NATION = 3; // number of owned tiles created per nation (with city)
const EXTRA_FREE_TILES = 20; // unowned tiles
// ---------------------------------

// Helper random utilities
function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/serverWars";
  await mongoose.connect(uri, { });
  console.log("✅ MongoDB connected (seed/test)");
}

async function clearCollections() {
  await Nation.deleteMany({});
  await Tile.deleteMany({});
  console.log("🧹 Cleared Nation and Tile collections (dev only).");
}

async function createMockNations() {
  const nations = [];
  for (let i = 0; i < NUM_MOCK_NATIONS; i++) {
    const serverId = `mock-${i+1}`;
    const name = `Mockland-${i+1}`;
    const cities = randint(1, 6);
    const playerCount = randint(1, 50);
    const tilesDiscovered = randint(1, Math.max(1, Math.floor(WORLD_TILES / 4)));
    const nation = new Nation({
      serverId,
      name,
      population: randint(10, 2000),
      resources: {
        food: randint(0, 500),
        steel: randint(0, 300),
        oil: randint(0, 200),
        gold: randint(0, 1000)
      },
      military: {
        troops: randint(0, 100),
        tanks: randint(0, 20),
        jets: randint(0, 10)
      },
      buildings: {
        farm: randint(0, 5),
        mine: randint(0, 5),
        barracks: randint(0, cities),
        oilrig: randint(0, 3),
        city: cities,
        hangar: randint(0, 2),
      },
      research: {
        manufacturing: Math.random() < 0.4,
        flight: Math.random() < 0.3,
        happy_meals: Math.random() < 0.2,
        banking: Math.random() < 0.2,
        shit_coins: Math.random() < 0.05
      },
      tilesDiscovered,
      discoveredNations: [],
      playerCount
    });

    await nation.save();
    nations.push(nation);
  }

  // Also create a "you" nation to simulate explorer
  const you = new Nation({
    serverId: "you",
    name: "YouTopia",
    population: 100,
    resources: { food: 10, steel: 5, oil: 2, gold: 20 },
    military: { troops: 0, tanks: 0, jets: 0 },
    buildings: { city: 1, barracks: 0, mine: 0, farm: 0, oilrig: 0, hangar: 0 },
    research: { manufacturing: false, flight: false, happy_meals: false, banking: false, shit_coins: false },
    tilesDiscovered: 1,
    discoveredNations: [],
    playerCount: 4
  });
  await you.save();
  nations.unshift(you); // ensure 'you' is index 0

  console.log(`🏳️ Created ${nations.length} mock nations (including 'you')`);
  return nations;
}

async function createMockTiles(nations) {
  // create tiles for each nation (TILES_PER_NATION each)
  let tileIndex = 1;
  for (const nation of nations) {
    for (let t = 0; t < TILES_PER_NATION; t++) {
      if (tileIndex > WORLD_TILES) break;
      const fertility = randint(0, 1);
      const extra = Math.random() < 0.2;
      const resources = {
        fertility: fertility + (extra ? randint(0, 4) : 0),
        steel: extra ? randint(0, 4) : 0,
        gold: extra ? randint(0, 4) : 0,
        oil: extra ? randint(0, 4) : 0
      };

      const tile = new Tile({
        tileId: tileIndex.toString(),
        resources,
        surveyedBy: [nation.serverId],
        city: {
          exists: true,
          name: `${nation.name} City ${t+1}`,
          owner: nation.serverId,
          foundedAt: new Date()
        }
      });
      await tile.save();
      tileIndex++;
    }
  }

  // create some free unsurveyed tiles
  for (let i = 0; i < EXTRA_FREE_TILES && tileIndex <= WORLD_TILES; i++, tileIndex++) {
    const fertility = randint(0, 1);
    const extra = Math.random() < 0.2;
    const resources = {
      fertility: fertility + (extra ? randint(0, 4) : 0),
      steel: extra ? randint(0, 4) : 0,
      gold: extra ? randint(0, 4) : 0,
      oil: extra ? randint(0, 4) : 0
    };

    const tile = new Tile({
      tileId: tileIndex.toString(),
      resources,
      surveyedBy: [],
      city: { exists: false }
    });
    await tile.save();
  }

  console.log("🗺️ Created tiles for nations + some free tiles");
}

function buildWeightedArray(others) {
  const weighted = [];
  for (const other of others) {
    const weight = (other.buildings?.city || 1) + (other.playerCount || 1);
    for (let i = 0; i < weight; i++) weighted.push(other);
  }
  return weighted;
}

/**
 * Simulate many explore attempts from the perspective of 'you' nation (serverId: "you")
 * Uses the same selection logic as your /explore command (with "fair" fallback)
 */
async function simulateExploreRounds(rounds = 10000) {
  const you = await Nation.findOne({ serverId: "you" });
  if (!you) throw new Error("you nation missing");

  // compute starting set of other nations (excluding you)
  const allOthers = await Nation.find({ serverId: { $ne: you.serverId } });

  // We'll track counts for how often each other nation gets discovered
  const counts = {};
  for (const o of allOthers) counts[o.serverId] = 0;
  let treasureCount = 0;
  let selfDiscoverCount = 0;

  for (let r = 0; r < rounds; r++) {
    // emulate per-round state changes minimally:
    // increment discoveredTiles (we'll use a local copy to avoid persistent DB write for speed)
    you.tilesDiscovered = (you.tilesDiscovered || 0) + 1;
    const tilesRemaining = Math.max(0, WORLD_TILES - you.tilesDiscovered);

    // recompute undiscovered list (simulate you.discoveredNations)
    const discoveredIds = you.discoveredNations.map(d => d.serverId);
    const undiscoveredNations = allOthers.filter(n => n.serverId !== you.serverId && !discoveredIds.includes(n.serverId));
    const numUndiscovered = undiscoveredNations.length;

    // formula chance
    let baseChance = 0.02;
    let nationFactor = Math.min(0.15, 0.01 * numUndiscovered);
    let tileFactor = (you.tilesDiscovered / WORLD_TILES) * 0.1;
    let formulaChance = baseChance + nationFactor + tileFactor;
    let fairChance = tilesRemaining > 0 ? numUndiscovered / tilesRemaining : 1;
    let totalChance = Math.min(1, Math.max(formulaChance, fairChance));

    const roll = Math.random();

    if (roll < 0.1) {
      treasureCount++;
      continue;
    } else if (roll < 0.1 + totalChance && numUndiscovered > 0) {
      // weighted selection among undiscovered nations
      const weighted = buildWeightedArray(undiscoveredNations);
      if (weighted.length === 0) {
        continue;
      }
      const other = weighted[Math.floor(Math.random() * weighted.length)];

      // safety: ensure not selecting self
      if (other.serverId === you.serverId) {
        selfDiscoverCount++;
        continue;
      }

      counts[other.serverId] = (counts[other.serverId] || 0) + 1;

      // mark discovered (so subsequent rounds don't re-discover)
      you.discoveredNations.push({ serverId: other.serverId, name: other.name });
    }
  }

  // print summary
  console.log("--- Explore simulation summary ---");
  console.log(`Rounds: ${rounds}`);
  console.log(`Treasure events: ${treasureCount}`);
  console.log(`Self-discover attempts (should be 0): ${selfDiscoverCount}`);
  console.log("Discover counts (top nations):");
  const sortable = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  console.table(sortable.slice(0, 20));
  console.log("----------------------------------");
}

async function main() {
  try {
    await connectDB();
    await clearCollections();
    const nations = await createMockNations();
    await createMockTiles(nations);

    // run a simulation to validate the explore logic
    await simulateExploreRounds(5000);

    console.log("✅ Seeding + simulation complete. DB left populated for manual testing.");
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

main();
