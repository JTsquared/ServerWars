// utils/seasonSnapshot.js
import SeasonSnapshot from "../models/SeasonSnapshot.js";
import NationRewardClaim from "../models/NationRewardClaim.js";
import Player from "../models/Player.js";
import Nation from "../models/Nation.js";
import GameConfig from "../models/GameConfig.js";

/**
 * Create season snapshots for all nations when the season ends
 * This freezes player EXP and nation rewards for claiming after season ends
 * @param {number} seasonId - The season that just ended
 * @returns {Promise<Array>} Array of created snapshots
 */
export async function createSeasonSnapshots(seasonId) {
  try {
    console.log(`[SeasonSnapshot] Creating snapshots for season ${seasonId}...`);

    const nations = await Nation.find();
    const snapshots = [];

    for (const nation of nations) {
      try {
        // Check if snapshot already exists
        const existingSnapshot = await SeasonSnapshot.findOne({
          guildId: nation.serverId,
          seasonId
        });

        if (existingSnapshot) {
          console.log(`[SeasonSnapshot] Snapshot already exists for ${nation.name} (${nation.serverId})`);
          continue;
        }

        // Get all players from this nation
        const players = await Player.find({ serverId: nation.serverId });

        // Calculate player EXP snapshots
        const playerSnapshots = players.map(player => {
          const totalExp = (player.exp?.scout || 0) + (player.exp?.military || 0) + (player.exp?.finance || 0);

          return {
            userId: player.userId,
            username: player.username || `User ${player.userId}`,
            totalExp,
            expBreakdown: {
              scout: player.exp?.scout || 0,
              military: player.exp?.military || 0,
              finance: player.exp?.finance || 0
            }
          };
        });

        // Calculate total nation EXP
        const totalNationExp = playerSnapshots.reduce((sum, p) => sum + p.totalExp, 0);

        // Calculate total rewards from ledger
        const rewardsByToken = await NationRewardClaim.aggregate([
          {
            $match: {
              guildId: nation.serverId,
              seasonId: seasonId
            }
          },
          {
            $group: {
              _id: "$ticker",
              total: { $sum: "$amount" }
            }
          }
        ]);

        // Convert to Map format
        const totalRewardsMap = new Map();
        for (const reward of rewardsByToken) {
          totalRewardsMap.set(reward._id, reward.total);
        }

        // Create snapshot
        const snapshot = new SeasonSnapshot({
          guildId: nation.serverId,
          seasonId,
          seasonEndDate: new Date(),
          players: playerSnapshots,
          totalNationExp,
          totalRewards: totalRewardsMap
        });

        await snapshot.save();
        snapshots.push(snapshot);

        console.log(`✅ [SeasonSnapshot] Created snapshot for ${nation.name}: ${playerSnapshots.length} players, ${totalNationExp} total EXP`);

        // Log reward totals
        for (const [ticker, amount] of totalRewardsMap.entries()) {
          console.log(`   ${ticker}: ${amount}`);
        }

      } catch (error) {
        console.error(`❌ [SeasonSnapshot] Failed to create snapshot for nation ${nation.serverId}:`, error);
      }
    }

    console.log(`[SeasonSnapshot] Created ${snapshots.length} snapshots for season ${seasonId}`);
    return snapshots;

  } catch (error) {
    console.error("[SeasonSnapshot] Error creating season snapshots:", error);
    throw error;
  }
}

/**
 * Increment the current season ID in GameConfig
 * Call this after creating snapshots to prepare for the next season
 * @returns {Promise<number>} The new season ID
 */
export async function incrementSeasonId() {
  try {
    const gameConfig = await GameConfig.findOne();

    if (!gameConfig) {
      console.error("[SeasonSnapshot] GameConfig not found, cannot increment season");
      return 1;
    }

    const oldSeasonId = gameConfig.currentSeasonId || 1;
    const newSeasonId = oldSeasonId + 1;

    gameConfig.currentSeasonId = newSeasonId;
    await gameConfig.save();

    console.log(`[SeasonSnapshot] Incremented season: ${oldSeasonId} → ${newSeasonId}`);
    return newSeasonId;

  } catch (error) {
    console.error("[SeasonSnapshot] Error incrementing season ID:", error);
    throw error;
  }
}
