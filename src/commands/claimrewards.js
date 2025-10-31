// claimrewards.js
import { SlashCommandBuilder } from "discord.js";
import SeasonSnapshot from "../models/SeasonSnapshot.js";
import NationRewardClaim from "../models/NationRewardClaim.js";
import PlayerRewardClaim from "../models/PlayerRewardClaim.js";
import GameConfig from "../models/GameConfig.js";
import { transferToDiscordUser } from "../utils/cryptoTipApi.js";

export const data = new SlashCommandBuilder()
  .setName("claimrewards")
  .setDescription("Claim your share of season rewards based on your EXP contribution.")
  .addIntegerOption(option =>
    option.setName("season")
      .setDescription("Season number to claim rewards from")
      .setRequired(true)
  );

export async function execute(interaction) {
  const seasonId = interaction.options.getInteger("season");
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;

  await interaction.deferReply({ ephemeral: true });

  try {
    // 1. Check if season has ended (has a snapshot)
    const snapshot = await SeasonSnapshot.findOne({ guildId, seasonId });

    if (!snapshot) {
      return interaction.editReply(`❌ Season ${seasonId} has not ended yet or no snapshot exists. Rewards can only be claimed after the season ends.`);
    }

    // 2. Find player in snapshot
    const playerSnapshot = snapshot.players.find(p => p.userId === userId);

    if (!playerSnapshot) {
      return interaction.editReply(`❌ You did not participate in Season ${seasonId} for this nation.`);
    }

    if (playerSnapshot.totalExp === 0) {
      return interaction.editReply(`❌ You earned 0 EXP in Season ${seasonId}, so you have no rewards to claim.`);
    }

    // 3. Calculate total nation rewards from ledger
    const rewardsByToken = await NationRewardClaim.aggregate([
      {
        $match: {
          guildId: guildId,
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

    if (rewardsByToken.length === 0) {
      return interaction.editReply(`❌ No rewards were earned by your nation in Season ${seasonId}.`);
    }

    // 4. Calculate player's share
    const playerShare = playerSnapshot.totalExp / snapshot.totalNationExp;
    const sharePercentage = (playerShare * 100).toFixed(2);

    console.log(`[ClaimRewards] Player ${userId} claiming Season ${seasonId}: ${playerSnapshot.totalExp} / ${snapshot.totalNationExp} EXP = ${sharePercentage}%`);

    // 5. Check what they haven't claimed yet and transfer
    const claimedRewards = [];
    const alreadyClaimed = [];
    const failures = [];

    for (const tokenReward of rewardsByToken) {
      const ticker = tokenReward._id;
      const totalNationReward = tokenReward.total;

      // Skip if nation has negative or zero total for this token
      if (totalNationReward <= 0) {
        console.log(`[ClaimRewards] Skipping ${ticker} - nation has ${totalNationReward} total`);
        continue;
      }

      // Calculate player's share amount (round down to 2 decimal places)
      const playerAmount = Math.floor((totalNationReward * playerShare) * 100) / 100;

      if (playerAmount <= 0) {
        continue;
      }

      // Check if already claimed
      const existingClaim = await PlayerRewardClaim.findOne({
        userId,
        guildId,
        seasonId,
        ticker
      });

      if (existingClaim) {
        alreadyClaimed.push(`${existingClaim.amount} ${ticker}`);
        continue;
      }

      // Transfer from global wallet to Discord user
      try {
        const appId = interaction.client.user.id;
        const transferResult = await transferToDiscordUser(
          appId,
          userId,
          ticker,
          playerAmount
        );

        if (transferResult.success) {
          // Record the claim
          const playerClaim = new PlayerRewardClaim({
            userId,
            guildId,
            seasonId,
            ticker,
            amount: playerAmount,
            playerExp: playerSnapshot.totalExp,
            nationExp: snapshot.totalNationExp,
            sharePercentage: parseFloat(sharePercentage),
            txHash: transferResult.txHash,
            walletAddress: transferResult.toAddress,
            status: "completed"
          });

          await playerClaim.save();

          claimedRewards.push(`${playerAmount} ${ticker}`);
          console.log(`✅ Claimed: ${playerAmount} ${ticker} for player ${userId} - TX: ${transferResult.txHash}`);
        } else {
          failures.push(`${playerAmount} ${ticker} (${transferResult.error})`);
          console.error(`❌ Failed to transfer ${playerAmount} ${ticker} to player ${userId}: ${transferResult.error}`);
        }
      } catch (error) {
        failures.push(`${playerAmount} ${ticker} (${error.message})`);
        console.error(`❌ Error transferring ${playerAmount} ${ticker} to player ${userId}:`, error);
      }
    }

    // 6. Build response message
    let reply = `**Season ${seasonId} Reward Claim**\n`;
    reply += `Your EXP: **${playerSnapshot.totalExp.toLocaleString()}** (${sharePercentage}% of nation total)\n\n`;

    if (claimedRewards.length > 0) {
      reply += `✅ **Claimed:**\n`;
      claimedRewards.forEach(reward => reply += `  • ${reward}\n`);
    }

    if (alreadyClaimed.length > 0) {
      reply += `\n⏭️ **Already Claimed:**\n`;
      alreadyClaimed.forEach(reward => reply += `  • ${reward}\n`);
    }

    if (failures.length > 0) {
      reply += `\n❌ **Failed:**\n`;
      failures.forEach(reward => reply += `  • ${reward}\n`);
      reply += `\nPlease contact an admin if you believe this is an error.`;
    }

    if (claimedRewards.length === 0 && alreadyClaimed.length === 0 && failures.length === 0) {
      reply = `❌ No rewards available to claim for Season ${seasonId}. Your nation may not have earned any crypto rewards, or they may have all been lost in conquests.`;
    }

    await interaction.editReply(reply);

  } catch (error) {
    console.error("Error in claimrewards command:", error);
    await interaction.editReply(`❌ An error occurred while processing your claim: ${error.message}`);
  }
}
