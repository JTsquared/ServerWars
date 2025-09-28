import mongoose from "mongoose";

const truceSchema = new mongoose.Schema({
  requesterNationId: { type: String, required: true },   // Nation A
  targetNationId: { type: String, required: true },      // Nation B

  // Lifecycle
  status: { 
    type: String, 
    enum: ["pending", "accepted", "rejected", "expired"], 
    default: "pending" 
  },

  // Truce terms
  effectiveHours: { type: Number, default: 24 }, // default duration
  startTime: { type: Date, default: null },
  endTime: { type: Date, default: null },

  // Tribute (offered by requester to targetNation)
  tributeType: { 
    type: String, 
    enum: ["gold", "steel", "food", "oil"], 
    required: false 
  },
  tributeAmount: { type: Number, required: false },

  // Offer metadata
  offerCreatedAt: { type: Date, default: Date.now },
  offerExpiresAt: { type: Date, required: true }, // auto-expire after 4h

  // Audit/logging
  lastUpdatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Truce", truceSchema);
