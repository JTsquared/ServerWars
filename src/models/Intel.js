// // models/Intel.js
// import mongoose from "mongoose";

// const intelSchema = new mongoose.Schema({
//   spyingNationId: { type: String, required: true },
//   targetNationId: { type: String, required: true },
//   report: {
//     nationName: String,
//     population: Number,
//     cities: Number,
//     resources: {
//       food: Number,
//       steel: Number,
//       gold: Number,
//       oil: Number,
//     },
//     military: {
//       troops: Number,
//       tanks: Number,
//       jets: Number,
//     },
//     buildings: {
//       city: Number,
//       barracks: Number,
//       factory: Number,
//       airbase: Number,
//     },
//   },
//   failedAttempts: { type: Number, default: 0 },
//   lastAttemptAt: { type: Date, default: null },
// }, { timestamps: true });

// intelSchema.index({ spyingNationId: 1, targetNationId: 1 }, { unique: true });

// export default mongoose.model("Intel", intelSchema);


import mongoose from "mongoose";

const intelSchema = new mongoose.Schema({
  spyingNationId: { type: String, required: true }, // "you"
  targetNationId: { type: String, required: true }, // "omg"
  
  nationName: { type: String, required: true }, // OMG
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
  failedAttempts: { type: Number, default: 0 },
  lastAttemptAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.Intel || mongoose.model("Intel", intelSchema);
