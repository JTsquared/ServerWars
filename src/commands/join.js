// join.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import Exiled from "../models/Exiled.js";
import Config from "../models/Config.js";

export const data = new SlashCommandBuilder()
  .setName("join")
  .setDescription("Join your server's existing nation campaign!");

export async function execute(interaction) {
  // Check if nation exists for this server
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply(
      "❌ This server has not yet created a nation. An admin must use `/createNation` first."
    );
  }

  // 🚫 Check if user is exiled from this server
  const exiled = await Exiled.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (exiled) {
    return interaction.reply("🚫 You have been exiled from this nation and cannot rejoin.");
  }

  // Check if user is already enlisted globally
  const existing = await Player.findOne({ userId: interaction.user.id });
  if (existing) {
    return interaction.reply("⚠️ You are already a citizen of another nation! Use `/retire` first.");
  }

  let config = await Config.findOne({ serverId: interaction.guild.id });
  if (!config) {
    config = new Config({ serverId: interaction.guild.id });
  }

  let playerRole = interaction.guild.roles.cache.find(r => r.name === "Server Wars Player");
  if (!playerRole) {
    playerRole = await interaction.guild.roles.create({
      name: "Server Wars Citizen",
      mentionable: true,
      reason: "Role for pinging all Server Wars players"
    });
  }

  await interaction.member.roles.add(playerRole);

  config.playerRoleId = playerRole.id;
  await config.save();

  // Add player to this server
  const player = new Player({
    userId: interaction.user.id,
    serverId: interaction.guild.id
  });

  await player.save();

  // Increment player count for this nation
  nation.playerCount += 1;
  await nation.save();

  await interaction.reply(`✅ Welcome to the war, ${interaction.user.username}! You are now a citizen of **${nation.name}**.`);
}
