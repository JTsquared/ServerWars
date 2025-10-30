import mongoose from "mongoose";

/**
 * Track when players claim their season rewards
 */
const playerRewardClaimSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  guildId: { type: String, required: true, index: true },
  seasonId: { type: Number, required: true, index: true },

  // Claim details
  ticker: { type: String, required: true },
  amount: { type: String, required: true }, // Amount claimed (as string for precision)

  // Player's share calculation
  playerExp: { type: Number, required: true }, // Player's total EXP at season end
  nationExp: { type: Number, required: true }, // Nation's total EXP at season end
  sharePercentage: { type: Number, required: true }, // playerExp / nationExp * 100

  // Transaction details
  txHash: { type: String }, // Blockchain transaction hash
  walletAddress: { type: String }, // Player's wallet address

  // Status
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending"
  },
  error: { type: String }, // Error message if failed

  claimedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index for efficient queries
playerRewardClaimSchema.index({ userId: 1, seasonId: 1, ticker: 1 });
playerRewardClaimSchema.index({ guildId: 1, seasonId: 1 });

// Unique constraint - player can only claim once per season per token
playerRewardClaimSchema.index({ userId: 1, guildId: 1, seasonId: 1, ticker: 1 }, { unique: true });

const PlayerRewardClaim = mongoose.models.PlayerRewardClaim || mongoose.model("PlayerRewardClaim", playerRewardClaimSchema);
export default PlayerRewardClaim;
