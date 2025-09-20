// models/Intel.js
import mongoose from "mongoose";

const intelSchema = new mongoose.Schema({
  spyingNationId: { type: String, required: true },
  targetNationId: { type: String, required: true },
  report: {
    nationName: String,
    population: Number,
    cities: Number,
    resources: {
      food: Number,
      steel: Number,
      gold: Number,
      oil: Number,
    },
    military: {
      troops: Number,
      tanks: Number,
      jets: Number,
    },
    buildings: {
      city: Number,
      barracks: Number,
      factory: Number,
      airbase: Number,
    },
  },
  failedAttempts: { type: Number, default: 0 },
  lastAttemptAt: { type: Date, default: null },
}, { timestamps: true });

intelSchema.index({ spyingNationId: 1, targetNationId: 1 }, { unique: true });

export default mongoose.model("Intel", intelSchema);
