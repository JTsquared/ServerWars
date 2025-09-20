// models/Player.js
import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // Discord user ID
  serverId: { type: String, required: true }, // Nation they joined

  exp: {
    military: { type: Number, default: 0 },
    economist: { type: Number, default: 0 },
    scout: { type: Number, default: 0 },
    diplomat: { type: Number, default: 0 }
  },

  role: {
    type: String,
    default: "Civilian"
  },

  lastResourceAction: { type: Date, default: null }
}, { timestamps: true });

const Player = mongoose.models.Player || mongoose.model("Player", playerSchema);
export default Player;