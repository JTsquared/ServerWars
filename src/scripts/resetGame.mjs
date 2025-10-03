// scripts/resetGame.js
import mongoose from "mongoose";
import GameConfig from "../models/GameConfig.js";
import dotenv from "dotenv";
dotenv.config();

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

async function resetGame() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "serverWars" });

    //await mongoose.connection.dropDatabase();

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
  } catch (err) {
    console.error("❌ Error resetting game:", err);
  } finally {
    await mongoose.disconnect();
  }
}

resetGame();
