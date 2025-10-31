import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import { processDeveloperPayment } from "../utils/cryptoTipApi.js";
import { applyBoost, mapProductionTypeToResource, formatBoostTime, getBoostTimeRemaining } from "../utils/boostUtils.js";

export const data = new SlashCommandBuilder()
  .setName("boost")
  .setDescription("Purchase a production boost for your nation using crypto")
  .addStringOption(option =>
    option.setName("type")
      .setDescription("Type of production to boost")
      .setRequired(true)
      .addChoices(
        { name: "Food Production", value: "food production" },
        { name: "Steel Production", value: "steel production" },
        { name: "Oil Production", value: "mining production" },
        { name: "Gold Production", value: "gold production" }
      ))
  .addIntegerOption(option =>
    option.setName("hours")
      .setDescription("Duration of boost in hours (minimum 1)")
      .setRequired(true)
      .setMinValue(1));

export async function execute(interaction) {
  // Get basic info first (synchronous operations)
  const productionType = interaction.options.getString("type");
  const hours = interaction.options.getInteger("hours");
  const guildId = interaction.guild.id;

  // Defer reply immediately after getting options
  try {
    await interaction.deferReply();
  } catch (error) {
    console.error("[Boost] Failed to defer reply:", error);
    // If defer fails, try to reply immediately with an error
    try {
      return await interaction.reply({
        content: "⚠️ This command is still registering with Discord. Please wait 10 seconds and try again.",
        ephemeral: true
      });
    } catch (replyError) {
      console.error("[Boost] Failed to reply after defer failed:", replyError);
      return;
    }
  }

  // Get environment variables
  const BOOST_PRICE = parseFloat(process.env.BOOST_PRICE || "0.1");
  const BOOST_TICKER = process.env.BOOST_TYPE || "AVAX";

  // Calculate total cost
  const totalCost = BOOST_PRICE * hours;

  // Get nation
  const nation = await Nation.findOne({ serverId: guildId });
  if (!nation) {
    return interaction.editReply("❌ This server does not have a nation yet. Use `/start` to create one.");
  }

  // Map production type to resource key
  const resourceType = mapProductionTypeToResource(productionType);
  if (!resourceType) {
    return interaction.editReply("❌ Invalid production type.");
  }

  // Process payment from guild's prize pool to developer wallet
  try {
    const appId = interaction.client.user.id;
    const sender = interaction.user.id;
    const paymentResult = await processDeveloperPayment(appId, guildId, sender, BOOST_TICKER, totalCost);

    if (!paymentResult.success) {
      console.error("Developer payment failed:", paymentResult);

      let errorMessage = "❌ Payment failed. ";
      if (paymentResult.error === "INSUFFICIENT_BALANCE") {
        errorMessage += "Your nation's prize pool does not have enough funds.";
      } else if (paymentResult.error === "INSUFFICIENT_GAS") {
        errorMessage += "Your nation's wallet does not have enough gas.";
      } else {
        errorMessage += `Error: ${paymentResult.error || "Unknown error"}`;
      }

      return interaction.editReply(errorMessage);
    }

    // Payment successful, apply boost
    const endTime = applyBoost(nation, resourceType, hours, 2);
    await nation.save();

    // Get remaining time for display
    const secondsRemaining = getBoostTimeRemaining(nation, resourceType);
    const timeRemaining = formatBoostTime(secondsRemaining);

    const productionName = productionType.replace(" production", "");

    await interaction.editReply(
      `✅ **${productionName.toUpperCase()} Production Boost Activated!**\n\n` +
      `💰 **Cost:** ${totalCost} ${BOOST_TICKER}\n` +
      `⚡ **Multiplier:** 2x\n` +
      `⏰ **Duration:** ${hours} hour${hours > 1 ? "s" : ""}\n` +
      `🕐 **Time Remaining:** ${timeRemaining}\n` +
      `📅 **Expires:** <t:${Math.floor(endTime.getTime() / 1000)}:F>\n\n` +
      `All ${productionName} production commands will now yield double resources!`
    );

  } catch (error) {
    console.error("Error processing boost purchase:", error);
    return interaction.editReply("❌ An error occurred while processing your boost purchase. Please try again later.");
  }
}
