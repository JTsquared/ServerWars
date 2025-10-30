import mongoose from "mongoose";

/**
 * Snapshot of nation state at end of season
 * Used to calculate player reward shares without being affected by new season gameplay
 */
const seasonSnapshotSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  seasonId: { type: Number, required: true, index: true },

  // Season info
  seasonEndDate: { type: Date, required: true },

  // Player EXP snapshots (frozen at season end)
  players: [{
    userId: { type: String, required: true },
    username: { type: String },
    totalExp: { type: Number, default: 0 }, // Sum of all EXP categories
    expBreakdown: {
      scout: { type: Number, default: 0 },
      military: { type: Number, default: 0 },
      finance: { type: Number, default: 0 }
    }
  }],

  // Total nation EXP (sum of all players)
  totalNationExp: { type: Number, default: 0 },

  // Total rewards earned this season (calculated from NationRewardClaim entries)
  totalRewards: {
    type: Map,
    of: Number,
    default: new Map()
  },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Unique constraint - one snapshot per guild per season
seasonSnapshotSchema.index({ guildId: 1, seasonId: 1 }, { unique: true });

const SeasonSnapshot = mongoose.models.SeasonSnapshot || mongoose.model("SeasonSnapshot", seasonSnapshotSchema);
export default SeasonSnapshot;
