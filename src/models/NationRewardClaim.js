import mongoose from "mongoose";

/**
 * Ledger of crypto rewards earned by nations during gameplay
 * Each entry represents a reward event (treasure found, city conquered, etc.)
 */
const nationRewardClaimSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  seasonId: { type: Number, required: true, index: true },

  // Reward details
  ticker: { type: String, required: true }, // Token ticker (e.g., "SQRD", "AVAX")
  amount: { type: Number, required: true }, // Amount earned

  // Event metadata
  eventType: {
    type: String,
    enum: ["treasure", "conquest", "manual_adjustment"],
    required: true
  },
  description: { type: String }, // e.g., "Treasure found during exploration", "Conquered city from Nation X"

  // Reference data
  relatedGuildId: { type: String }, // For conquest: the guild that lost
  playerId: { type: String }, // Player who triggered the event (optional)

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index for efficient season queries
nationRewardClaimSchema.index({ guildId: 1, seasonId: 1 });

const NationRewardClaim = mongoose.models.NationRewardClaim || mongoose.model("NationRewardClaim", nationRewardClaimSchema);
export default NationRewardClaim;
