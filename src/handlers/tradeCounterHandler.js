// src/handlers/tradeCounterHandler.js
import Trade from "../models/Trade.js";
import Nation from "../models/Nation.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getServerWarsChannel, getResourceCategory } from "../utils/gameUtils.js";

export async function handleTradeCounterModal(interaction) {

  const rawResource = interaction.fields.getTextInputValue("counterResource");
  console.log(`Raw counter resource input: ${rawResource}`);
  const resource = normalizeResource(rawResource);
  console.log(`Normalized counter resource: ${resource}`);
  const amount = parseInt(interaction.fields.getTextInputValue("counterAmount"), 10);

  // validate resource type
  if (!resource) {
    return interaction.reply({
      content: `🚫 Invalid resource type. Valid options: ${VALID_RESOURCES.join(", ")}`,
      ephemeral: true
    });
  }

  // validate amount
  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({
      content: "🚫 Amount must be a positive number.",
      ephemeral: true
    });
  }

  if (!interaction.customId.startsWith("tradeCounter_")) return;
  const tradeId = interaction.customId.split("_")[1];
  const trade = await Trade.findById(tradeId);

  console.log(`Handling trade counter modal for trade ID: ${tradeId}`);
  console.log('Trade details:', trade);

  if (!trade || trade.status !== "pending") {
    return interaction.reply({ content: "⚠️ This trade is no longer valid.", ephemeral: true });
  }

  const counterResource = resource;
  const counterAmount = parseInt(interaction.fields.getTextInputValue("counterAmount"), 10);

  if (!["gold", "steel", "food", "oil", "troops", "tanks", "jets"].includes(counterResource)) {
    return interaction.reply({ content: "🚫 Invalid resource type. Must be one of: gold, steel, food, oil, troops, tanks, jets.", ephemeral: true });
  }
  if (isNaN(counterAmount) || counterAmount <= 0) {
    return interaction.reply({ content: "🚫 Counter amount must be a positive number.", ephemeral: true });
  }

  const target = await Nation.findOne({ serverId: trade.targetNationId });
  const requester = await Nation.findOne({ serverId: trade.requesterNationId });

  if (!target || !requester) {
    return interaction.reply({ content: "⚠️ One of the nations no longer exists.", ephemeral: true });
  }

  const resourceCat = getResourceCategory(target, trade.requestResource);
  console.log(`Counter resource category: ${resourceCat}`);
  console.log(`Target's name: ${target.name}`);
  console.log(`Counter Resource: ${trade.requestResource}, Counter Amount: ${trade.requestAmount}`);

  // Ensure target has enough of counter resource
  if ((target[resourceCat][trade.requestResource] || 0) < trade.requestAmount) {
    return interaction.reply({ content: `🚫 Your nation does not have enough ${trade.requestResource} to make this counter-offer.`, ephemeral: true });
  }

  // Update trade record
  trade.counterResource = counterResource;
  trade.counterAmount = counterAmount;
  trade.status = "pendingCounter";
  trade.lastActionBy = target.serverId; // ✅ target just made the last action
  await trade.save();

  // Build counter-offer embed
  const embed = new EmbedBuilder()
    .setTitle("🔄 Trade Counter-Offer")
    .setDescription(`**${target.name}** has made a counter-offer to **${requester.name}**`)
    .addFields(
      { name: `${requester.name} gets:`, value: `${trade.requestAmount} ${trade.requestResource}`, inline: true },
      { name: `${target.name} gets:`, value: `${counterAmount} ${counterResource}`, inline: true }
    )
    .setColor("Orange");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`trade_accept_${trade._id}`)
      .setLabel("✅ Accept Counter")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`trade_reject_${trade._id}`) 
      .setLabel("❌ Reject Counter")
      .setStyle(ButtonStyle.Danger)
  );

  // Send to requester nation
  try {
    const requesterGuild = interaction.client.guilds.cache.get(requester.serverId);
    if (requesterGuild) {
      const channel = getServerWarsChannel(requesterGuild);
      if (channel) {
        await channel.send({ embeds: [embed], components: [row] });
      }
    }
  } catch (err) {
    console.error("Failed to notify requester nation of counter-offer:", err);
  }

  return interaction.reply({ content: "📨 Counter-offer sent to requester nation!", ephemeral: true });
}

export function normalizeResource(input) {
  if (!input) return null;

  const normalized = input.trim().toLowerCase();

  // mapping of acceptable variants → canonical key
  const resourceMap = {
    gold: "gold",
    foods: "food",
    food: "food",
    oils: "oil",
    oil: "oil",
    steels: "steel",
    steel: "steel",
    troop: "troops",
    troops: "troops",
    tank: "tanks",
    tanks: "tanks",
    jet: "jets",
    jets: "jets"
  };

  return resourceMap[normalized] || null;
}

export const VALID_RESOURCES = ["gold", "food", "oil", "steel", "troops", "tanks", "jets"];