import mongoose from "mongoose";

const nationSchema = new mongoose.Schema({
  serverId: { type: String, required: true, unique: true },
  name: { type: String, default: "Unnamed Nation" },

  population: { type: Number, default: 1 },

  resources: {
    food: { type: Number, default: 0 },
    steel: { type: Number, default: 0 },
    oil: { type: Number, default: 0 },
    gold: { type: Number, default: 0 }
  },

  military: {
    troops: { type: Number, default: 0 },
    tanks: { type: Number, default: 0 },
    jets: { type: Number, default: 0 }
  },

  buildings: {
    farm: { type: Number, default: 0 },
    mine: { type: Number, default: 0 },
    barracks: { type: Number, default: 0 },
    oilrig: { type: Number, default: 0 },
    city: { type: Number, default: 1 }
  },

  research: {
    manufacturing: { type: Boolean, default: false },
    flight: { type: Boolean, default: false },
    happy_meals: { type: Boolean, default: false },
    banking: { type: Boolean, default: false },
    shit_coins: { type: Boolean, default: false }
  },

  leadership: {
    commanderInChief: { userId: String, exp: { type: Number, default: 0 } },
    financeMinister: { userId: String, exp: { type: Number, default: 0 } },
    chiefScout: { userId: String, exp: { type: Number, default: 0 } },
    foreignMinister: { userId: String, exp: { type: Number, default: 0 } },
  },

  tilesDiscovered: { type: Number, default: 0 },
  discoveredNations: [
    {
      serverId: String,
      name: String
    }
  ],

  playerCount: { type: Number, default: 0 }
}, { timestamps: true });


const Nation = mongoose.models.Nation || mongoose.model("Nation", nationSchema);
export default Nation;
