// returnExiled.js
import { SlashCommandBuilder } from "discord.js";
import Exiled from "../models/Exiled.js";

export const data = new SlashCommandBuilder()
  .setName("returnexiled")
  .setDescription("Allow an exiled player to return")
  .addUserOption(option =>
    option.setName("target")
      .setDescription("The player to allow back")
      .setRequired(true)
  );

export async function execute(interaction) {
  const leaderRole = interaction.guild.roles.cache.find(r => r.name === "Political Leader");
  if (!leaderRole || !interaction.member.roles.cache.has(leaderRole.id)) {
    return interaction.reply("❌ Only a Political Leader can use this command.");
  }

  const target = interaction.options.getUser("target");
  const exiled = await Exiled.findOne({ userId: target.id, serverId: interaction.guild.id });

  if (!exiled) {
    return interaction.reply("⚠️ That user is not currently exiled.");
  }

  await Exiled.deleteOne({ userId: target.id });
  await interaction.reply(`✅ ${target.username} has been allowed to return.`);
}
