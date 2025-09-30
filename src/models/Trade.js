// src/models/Trade.js
import mongoose from "mongoose";

const tradeSchema = new mongoose.Schema({
  requesterNationId: { type: String, required: true }, // guildId of requester
  targetNationId: { type: String, required: true },    // guildId of target

  // What requester wants
  requestResource: { type: String, enum: ["gold", "steel", "food", "oil", "troops", "tanks", "jets"], required: true },
  requestAmount: { type: Number, required: true, min: 1 },

  // What requester is offering (optional)
  offerResource: { type: String, enum: ["gold", "steel", "food", "oil", "troops", "tanks", "jets"], default: null },
  offerAmount: { type: Number, default: 0 },

  // For counters
  counterResource: { type: String, enum: ["gold", "steel", "food", "oil", "troops", "tanks", "jets"], default: null },
  counterAmount: { type: Number, default: 0 },
  counterByNationId: { type: String, default: null }, // guildId of who proposed counter

  status: {
    type: String,
    enum: ["pending", "pendingCounter", "accepted", "rejected", "expired"],
    default: "pending"
  },

  lastActionBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  resolvedAt: { type: Date, default: null }
});

export default mongoose.model("Trade", tradeSchema);
