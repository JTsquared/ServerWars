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

  // const politicalLeaderRole = interaction.guild.roles.cache.find(r => r.name === "Political Leader");
  // const hasDiscordRole = politicalLeaderRole && interaction.member.roles.cache.has(politicalLeaderRole.id);
  // const hasForeignMinisterTitle = requester.leadership.financeMinister.userId === interaction.user.id;
  // if (!hasDiscordRole && !hasForeignMinisterTitle) {
  //   return interaction.reply("🚫 Only the **Foreign Minister** or someone with the Political Leader role may handle foreign relations.");
  // }

  if (!checkPermissions(interaction, requester, "Diplomatic")) {
    return interaction.reply("🚫 Only the **Foreign Minister** or someone with the Political Leader role may handle foreign relations.");
  }

  const offerExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4h

  // Create Truce record
  const truce = new Truce({
    requesterNationId: requester.serverId,
    targetNationId: target.serverId,
    effectiveHours,
    tributeType: tributeType || null,
    tributeAmount: tributeAmount || 0,
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
