// exile.js
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import Player from "../models/Player.js";
import Nation from "../models/Nation.js";
import Exiled from "../models/Exiled.js";

export const data = new SlashCommandBuilder()
  .setName("exile")
  .setDescription("Exile a player from your nation")
  .addUserOption(option =>
    option.setName("target")
      .setDescription("The player to exile")
      .setRequired(true)
  );

export async function execute(interaction) {
  const leaderRole = interaction.guild.roles.cache.find(r => r.name === "Political Leader");
  if (!leaderRole || !interaction.member.roles.cache.has(leaderRole.id)) {
    return interaction.reply("❌ Only a Political Leader can use this command.");
  }

  const target = interaction.options.getUser("target");
  const player = await Player.findOne({ userId: target.id, serverId: interaction.guild.id });

  if (!player) {
    return interaction.reply("⚠️ That user is not a member of your nation.");
  }

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (nation) {
    nation.playerCount = Math.max(0, nation.playerCount - 1);
    await nation.save();
  }

  await Player.deleteOne({ userId: target.id });
  const exiled = new Exiled({ userId: target.id, serverId: interaction.guild.id });
  await exiled.save();

  await interaction.reply(`🚫 ${target.username} has been exiled and cannot rejoin this nation.`);
}
