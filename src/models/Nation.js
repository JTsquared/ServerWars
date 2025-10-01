import mongoose from "mongoose";

const nationSchema = new mongoose.Schema({
  serverId: { type: String, required: true, unique: true },
  name: { type: String, default: "Unnamed Nation" },
  trait: { type: String, enum: ["Stealthy", "Agricultural", "Industrious", "Militaristic", "Gregarious", "Nomadic", "Negotiator"], default: null },

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
    city: { type: Number, default: 1 },
    bank: { type: Number, default: 0 },
    hangar: { type: Number, default: 0 },
    factory: { type: Number, default: 0 },
    depot: { type: Number, default: 0 },
    mickdonalds: { type: Number, default: 0 }
  },

  research: {
    manufacturing: { type: Boolean, default: false },
    flight: { type: Boolean, default: false },
    happy_meals: { type: Boolean, default: false },
    banking: { type: Boolean, default: false },
    shit_coins: { type: Boolean, default: false },
    industrialization: { type: Boolean, default: false },
    military_training: { type: Boolean, default: false },
    oil_drilling: { type: Boolean, default: false }
  },

  leadership: {
    commanderInChief: { userId: String, exp: { type: Number, default: 0 } },
    financeMinister: { userId: String, exp: { type: Number, default: 0 } },
    chiefScout: { userId: String, exp: { type: Number, default: 0 } },
    foreignMinister: { userId: String, exp: { type: Number, default: 0 } },
  },

  tilesDiscovered: { type: Number, default: 0 },
  discoveredCities: [
    {
      serverId: String,   // nation owner
      name: String,       // nation name
      cityName: String,   // city name
      tileId: String      // tile reference
    }
  ],

  cooldowns: {
    launchshitcoin: { type: Number, default: 0 },
    spy: { type: Number, default: 0 },
    sabotage: { type: Number, default: 0 },
    hack: { type: Number, default: 0 },
    envoy: { type: Number, default: 0 },
  },

  hacks: {
    bankDisabledUntil: { type: Date, default: null }
  },

  playerCount: { type: Number, default: 0 }
}, { timestamps: true });


const Nation = mongoose.models.Nation || mongoose.model("Nation", nationSchema);
export default Nation;
