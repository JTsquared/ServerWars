import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import Nation from "../models/Nation.js";
import Truce from "../models/Truce.js";
import { getServerWarsChannel, checkPermissions } from "../utils/gameUtils.js";

export const data = new SlashCommandBuilder()
  .setName("truce")
  .setDescription("Propose or respond to a truce with another nation.")
  .addStringOption(option =>
    option.setName("nation_name")
      .setDescription("The name of the nation to propose or respond to.")
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option.setName("effective_hours")
      .setDescription("Duration of the truce in hours (default 24).")
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName("tribute_type")
      .setDescription("Type of resource to offer as tribute (optional).")
      .setRequired(false)
      .addChoices(
        { name: "Gold", value: "gold" },
        { name: "Steel", value: "steel" },
        { name: "Food", value: "food" },
        { name: "Oil", value: "oil" },
      )
  )
  .addIntegerOption(option =>
    option.setName("tribute_amount")
      .setDescription("Amount of tribute to offer (optional).")
      .setRequired(false)
  );

export async function execute(interaction) {
  const requester = await Nation.findOne({ serverId: interaction.guild.id });
  if (!requester) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const targetName = interaction.options.getString("nation_name");
  const target = await Nation.findOne({ name: targetName });
  if (!target) {
    return interaction.reply(`⚠️ Could not find a nation named **${targetName}**.`);
  }

  const effectiveHours = interaction.options.getInteger("effective_hours") || 24;
  const tributeType = interaction.options.getString("tribute_type");
  const tributeAmount = interaction.options.getInteger("tribute_amount");

  // Validate tribute (if provided)
  if (tributeType && tributeAmount) {
    if ((requester.resources[tributeType] || 0) < tributeAmount) {
      return interaction.reply(`🚫 You do not have enough ${tributeType} to offer as tribute.`);
    }
  }

  if (!checkPermissions(interaction, requester, "Diplomatic")) {
    return interaction.reply("🚫 Only the **Foreign Minister** or someone with the Political Leader role may handle foreign relations.");
  }

  const existing = await Truce.findOne({
    $or: [
      { requesterNationId: requester.serverId, targetNationId: target.serverId },
      { requesterNationId: target.serverId, targetNationId: requester.serverId }
    ],
    status: { $in: ["pending", "accepted", "expired"] } // include expired
  });
  
  if (existing) {
    if (existing.status === "accepted" && new Date() < existing.endTime) {
      return interaction.reply("⚠️ A truce is already in effect between your nations.");
    }
  
    if (existing.status === "pending") {
      if (existing.requesterNationId === requester.serverId) {
        return interaction.reply("⚠️ You already have a pending truce offer to this nation.");
      } else {
        // target nation re-runs command → reshow embed + buttons
        const embed = new EmbedBuilder()
          .setTitle("🤝 Truce Proposal (Pending)")
          .setDescription(`**${requester.name}** has a pending truce with **${target.name}**`)
          .addFields(
            { name: "Duration", value: `${existing.effectiveHours} hours`, inline: true },
            { name: "Tribute", value: existing.tributeType ? `${existing.tributeAmount} ${existing.tributeType}` : "None", inline: true },
            { name: "Offer Expires", value: `<t:${Math.floor(existing.offerExpiresAt.getTime() / 1000)}:R>`, inline: true }
          )
          .setColor("Blue");
  
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`truce_accept_${existing._id}`)
            .setLabel("✅ Accept")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`truce_reject_${existing._id}`)
            .setLabel("❌ Reject")
            .setStyle(ButtonStyle.Danger)
        );
  
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
    }
  
    if (existing.status === "expired" || (existing.status === "accepted" && new Date() >= existing.endTime)) {
      existing.requesterNationId = requester.serverId;
      existing.targetNationId = target.serverId;
      existing.effectiveHours = effectiveHours;
      existing.tributeType = tributeType || null;
      existing.tributeAmount = tributeAmount || 0;
      existing.offerCreatedAt = new Date();
      existing.offerExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
      existing.status = "pending";
      existing.startTime = null;
      existing.endTime = null;
      await existing.save();
    
      const embed = new EmbedBuilder()
        .setTitle("🤝 Truce Proposal (Renewed)")
        .setDescription(`**${requester.name}** is proposing a truce with **${target.name}**`)
        .addFields(
          { name: "Duration", value: `${effectiveHours} hours`, inline: true },
          { name: "Tribute", value: tributeType ? `${tributeAmount} ${tributeType}` : "None", inline: true },
          { name: "Offer Expires", value: `<t:${Math.floor(existing.offerExpiresAt.getTime() / 1000)}:R>`, inline: true }
        )
        .setColor("Blue");
    
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`truce_accept_${existing._id}`)
          .setLabel("✅ Accept")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`truce_reject_${existing._id}`)
          .setLabel("❌ Reject")
          .setStyle(ButtonStyle.Danger)
      );
    
      try {
        const targetGuild = await interaction.client.guilds.fetch(target.serverId);
        if (targetGuild) {
          const channel = getServerWarsChannel(targetGuild);
          if (channel) {
            await channel.send({ embeds: [embed], components: [row] });
          }
        }
      } catch (err) {
        console.error("Failed to notify target nation (renewed):", err);
      }
    
      return interaction.reply(`📨 Truce proposal (renewed) sent to **${target.name}**.`);
    }
  }

  const offerExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now

  // Create Truce record
  const truce = new Truce({
    requesterNationId: requester.serverId,
    targetNationId: target.serverId,
    effectiveHours,
    tributeType: tributeType || null,
    tributeAmount: tributeAmount || 0,
    offerCreatedAt: new Date(),
    offerExpiresAt
  });

  await truce.save();

  // Build embed
  const embed = new EmbedBuilder()
    .setTitle("🤝 Truce Proposal")
    .setDescription(`**${requester.name}** is proposing a truce with **${target.name}**`)
    .addFields(
      { name: "Duration", value: `${effectiveHours} hours`, inline: true },
      { name: "Tribute", value: tributeType ? `${tributeAmount} ${tributeType}` : "None", inline: true },
      { name: "Offer Expires", value: `<t:${Math.floor(offerExpiresAt.getTime() / 1000)}:R>`, inline: true }
    )
    .setColor("Blue");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`truce_accept_${truce._id}`)
      .setLabel("✅ Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`truce_reject_${truce._id}`)
      .setLabel("❌ Reject")
      .setStyle(ButtonStyle.Danger)
  );
  
  try {
    const targetGuild = await interaction.client.guilds.fetch(target.serverId);

    console.log(`Target guild fetched: ${targetGuild?.name}, ID: ${targetGuild?.id}`);
    if (targetGuild) {
      const channel = getServerWarsChannel(targetGuild);
      console.log(`Default channel found: ${channel?.name}, ID: ${channel?.id}`);

      const perms = channel.permissionsFor(targetGuild.members.me);
      
      if (channel) {
        await channel.send({ embeds: [embed], components: [row] });
      };
    };
  } catch (err) {
    console.error("Failed to notify target nation:", err);
  }

  await interaction.reply(`📨 Truce proposal sent to **${target.name}** for ${effectiveHours} hours${tributeType ? ` with tribute of ${tributeAmount} ${tributeType}` : ""}.`);
}
