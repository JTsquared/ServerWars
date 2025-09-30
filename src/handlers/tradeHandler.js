// src/handlers/tradeHandler.js
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
  } from "discord.js";
  import Trade from "../models/Trade.js";
  import Nation from "../models/Nation.js";
  import { checkPermissions, getServerWarsChannel, getResourceCategory } from "../utils/gameUtils.js";
  
  export async function handleTradeButton(interaction) {
    const [action, tradeId] = interaction.customId.split("_").slice(1); // "accept" / "reject" / "counter", tradeId
    const trade = await Trade.findById(tradeId);
  
    if (!trade || trade.status === "expired" || trade.status === "accepted" || trade.status === "rejected") {
      return interaction.reply({ content: "⚠️ This trade offer is no longer valid.", ephemeral: true });
    }
  
    const requester = await Nation.findOne({ serverId: trade.requesterNationId });
    const target = await Nation.findOne({ serverId: trade.targetNationId });
  
    if (!requester || !target) {
      return interaction.reply({ content: "⚠️ One of the nations no longer exists.", ephemeral: true });
    }
  
    const allowedResponderId =
    trade.lastActionBy === trade.requesterNationId
    ? trade.targetNationId
    : trade.requesterNationId;

    if (interaction.guild.id !== allowedResponderId) {
        return interaction.reply({ content: "🚫 You are not authorized to respond to this trade.", ephemeral: true });
    }
  
    if (!checkPermissions(interaction, target, "Diplomatic")) {
      return interaction.reply("🚫 Only the **Foreign Minister** or someone with the Political Leader role may handle trade deals.");
    }
  
    // Expiry check
    if (new Date() > trade.expiresAt) {
      trade.status = "expired";
      await trade.save();
      return interaction.reply({ content: "⌛ This trade offer has expired.", ephemeral: true });
    }
  
    if (action === "accept") {

      const offerResource = trade.counterResource || trade.offerResource;
      const offerAmount = trade.counterAmount || trade.offerAmount;
      // ✅ Validate that both sides have enough of what they’re trading
      const offerCat = getResourceCategory(requester, offerResource);
      const requestCat = getResourceCategory(target, trade.requestResource);
  
      if (!offerCat || !requestCat) {
        return interaction.reply("⚠️ Invalid trade items detected.", { ephemeral: true });
      }
  
      if ((requester[offerCat][offerResource] || 0) < offerAmount) {
        trade.status = "expired";
        await trade.save();
        return interaction.reply("⚠️ The requester no longer has enough to complete this trade.");
      }
      if ((target[requestCat][trade.requestResource] || 0) < trade.requestAmount) {
        trade.status = "expired";
        await trade.save();
        return interaction.reply("⚠️ The target nation no longer has enough to complete this trade.");
      }
  
      // ✅ Execute trade
      requester[offerCat][offerResource] -= offerAmount;
      requester[requestCat][trade.requestResource] += trade.requestAmount;

      target[requestCat][trade.requestResource] -= trade.requestAmount;
      target[offerCat][offerResource] += offerAmount;
  
      trade.status = "accepted";
      trade.resolvedAt = new Date();
  
      await Promise.all([requester.save(), target.save(), trade.save()]);
  
      // Notify both nations
      const requesterGuild = interaction.client.guilds.cache.get(requester.serverId);
      const targetGuild = interaction.client.guilds.cache.get(target.serverId);
  
      if (requesterGuild) {
        const channel = getServerWarsChannel(requesterGuild);
        channel?.send(`✅ Your trade with **${target.name}** was accepted! Resources have been exchanged.`);
      }
      if (targetGuild) {
        const channel = getServerWarsChannel(targetGuild);
        channel?.send(`✅ Trade with **${requester.name}** completed successfully!`);
      }
  
      return interaction.reply({ content: "✅ Trade accepted and executed!", ephemeral: true });
    }
  
    if (action === "reject") {
      trade.status = "rejected";
      trade.resolvedAt = new Date();
      await trade.save();
  
      return interaction.update({ content: "❌ Trade rejected.", components: [] });
    }
  
    if (action === "counter") {
      // Build a modal for counter-offer
      const modal = new ModalBuilder()
        .setCustomId(`tradeCounter_${trade._id}`)
        .setTitle(`Specify what you want for ${trade.requestAmount} ${trade.requestResource}.`);
  
      const resourceInput = new TextInputBuilder()
        .setCustomId("counterResource")
        .setLabel("Resource (gold, food, tanks, jets, etc.)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
  
      const amountInput = new TextInputBuilder()
        .setCustomId("counterAmount")
        .setLabel("Amount")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
  
      modal.addComponents(
        new ActionRowBuilder().addComponents(resourceInput),
        new ActionRowBuilder().addComponents(amountInput)
      );
  
      return interaction.showModal(modal);
    }
  }

  // function getCategory(nation, item) {
  //   if (nation.resources[item] !== undefined) return "resources";
  //   if (nation.military[item] !== undefined) return "military";
  //   return null; // unknown item
  // }
  