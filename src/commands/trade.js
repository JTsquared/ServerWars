// src/commands/trade.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import Nation from "../models/Nation.js";
import Trade from "../models/Trade.js"; // you'll need a Trade model, similar to Truce
import Player from "../models/Player.js";
import { getServerWarsChannel, checkPermissions, getResourceCategory } from "../utils/gameUtils.js";

export const data = new SlashCommandBuilder()
  .setName("trade")
  .setDescription("Propose a trade with another nation.")
  .addStringOption(opt =>
    opt.setName("nation_name")
      .setDescription("The nation to trade with")
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName("request_resource")
      .setDescription("The resource you want")
      .setRequired(true)
      .addChoices(
        { name: "Gold", value: "gold" },
        { name: "Steel", value: "steel" },
        { name: "Food", value: "food" },
        { name: "Oil", value: "oil" },
        { name: "Troops", value: "troops" },
        { name: "Tanks", value: "tanks" },
        { name: "Jets", value: "jets" }
      )
  )
  .addIntegerOption(opt =>
    opt.setName("request_amount")
      .setDescription("The amount of the resource you want")
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName("offer_resource")
      .setDescription("The resource you are offering (optional)")
      .setRequired(false)
      .addChoices(
        { name: "Gold", value: "gold" },
        { name: "Steel", value: "steel" },
        { name: "Food", value: "food" },
        { name: "Oil", value: "oil" },
        { name: "troops", value: "troops" },
        { name: "tanks", value: "tanks" },
        { name: "jets", value: "jets" }
      )
  )
  .addIntegerOption(opt =>
    opt.setName("offer_amount")
      .setDescription("The amount of the resource you are offering (optional)")
      .setRequired(false)
  );

export async function execute(interaction) {

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` your nation before surveying!");
  }

  const requester = await Nation.findOne({ serverId: interaction.guild.id });
  if (!requester) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const targetName = interaction.options.getString("nation_name");
  const target = await Nation.findOne({ name: targetName });
  if (!target) {
    return interaction.reply(`⚠️ Could not find a nation named **${targetName}**.`);
  }

  const requestResource = interaction.options.getString("request_resource");
  const requestAmount = interaction.options.getInteger("request_amount");
  const offerResource = interaction.options.getString("offer_resource");
  const offerAmount = interaction.options.getInteger("offer_amount");
  console.log(`Offer Resource: ${offerResource}, Offer Amount: ${offerAmount}`);

  if (!checkPermissions(interaction, requester, "Diplomatic")) {
    return interaction.reply("🚫 Only the **Foreign Minister** or someone with the Political Leader role may initiate trades.");
  }

  // Validate offered resources
  if (offerResource && offerAmount) {
    const offerCat = getResourceCategory(requester, offerResource);
    if ((requester[offerCat][offerResource] || 0) < offerAmount) {
      return interaction.reply(`🚫 You do not have enough ${offerResource} to offer.`);
    }
  }

  const offerExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now

  const trade = new Trade({
    requesterNationId: requester.serverId,
    targetNationId: target.serverId,
    requestResource,
    requestAmount,
    offerResource: offerResource || null,
    offerAmount: offerAmount || 0,
    status: "pending",
    createdAt: new Date(),
    expiresAt: offerExpiresAt,
    lastActionBy: requester.serverId // ✅ requester made the last action
  });
  

  await trade.save();

  // Build embed
  const embed = new EmbedBuilder()
    .setTitle("📦 Trade Proposal")
    .setDescription(`**${requester.name}** is proposing a trade with **${target.name}**`)
    .addFields(
      { name: "Requested", value: `${requestAmount} ${requestResource}`, inline: true },
      { name: "Offered", value: offerResource ? `${offerAmount} ${offerResource}` : "None (open request)", inline: true },
      { name: "Offer Expires", value: `<t:${Math.floor(trade.expiresAt.getTime() / 1000)}:R>`, inline: true }
    )
    .setColor("Green");

  const row = new ActionRowBuilder();

  if (offerResource && offerAmount) {
    // direct offer → target can accept/reject
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_accept_${trade._id}`)
        .setLabel("✅ Accept")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`trade_reject_${trade._id}`)
        .setLabel("❌ Reject")
        .setStyle(ButtonStyle.Danger)
    );
  } else {
    // open request → target can propose a counter
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_counter_${trade._id}`)
        .setLabel("✍️ Propose Counter-Offer")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`trade_reject_${trade._id}`)
        .setLabel("❌ Reject")
        .setStyle(ButtonStyle.Danger)
    );
  }

  try {
    const targetGuild = await interaction.client.guilds.fetch(target.serverId);
    if (targetGuild) {
      const channel = getServerWarsChannel(targetGuild);
      if (channel) {
        await channel.send({ embeds: [embed], components: [row] });
      }
    }
  } catch (err) {
    console.error("Failed to notify target nation:", err);
  }

  return interaction.reply(
    `📨 Trade proposal sent to **${target.name}** requesting ${requestAmount} ${requestResource}` +
    (offerResource ? ` in exchange for ${offerAmount} ${offerResource}` : "")
  );
}
