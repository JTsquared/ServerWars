// models/Intel.js
import mongoose from "mongoose";

const intelSchema = new mongoose.Schema({
  spyingNationId: { type: String, required: true }, // the attacker/explorer nation
  targetNationId: { type: String, required: true }, // the nation being observed/attacked

  nationName: { type: String, required: true },
  population: { type: Number, default: null },
  playerCount: { type: Number, default: null },

  knownCities: [
    {
      tileId: String,
      name: String
    }
  ],

  resources: {
    food: { type: Number, default: null },
    steel: { type: Number, default: null },
    oil: { type: Number, default: null },
    gold: { type: Number, default: null }
  },

  military: {
    troops: { type: Number, default: null },
    tanks: { type: Number, default: null },
    jets: { type: Number, default: null }
  },

  buildings: {
    city: { type: Number, default: null },
    barracks: { type: Number, default: null },
    factory: { type: Number, default: null },
    hangar: { type: Number, default: null }
  },

  research: {
    manufacturing: { type: Boolean, default: null },
    flight: { type: Boolean, default: null },
    banking: { type: Boolean, default: null },
    shit_coins: { type: Boolean, default: null }
  },

  // separate counters & timestamps for each action type
  failedAttemptsSpy: { type: Number, default: 0 },
  lastAttemptedAtSpy: { type: Date, default: null },

  failedAttemptsSabotage: { type: Number, default: 0 },
  lastAttemptedAtSabotage: { type: Date, default: null },

  failedAttemptsHack: { type: Number, default: 0 },
  lastAttemptedAtHack: { type: Date, default: null },

}, { timestamps: true });

export default mongoose.models.Intel || mongoose.model("Intel", intelSchema);
