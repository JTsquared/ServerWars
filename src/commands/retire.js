// retire.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";

export const data = new SlashCommandBuilder()
  .setName("retire")
  .setDescription("Leave your current server's campaign");

export async function execute(interaction) {
  const player = await Player.findOne({ userId: interaction.user.id });
  if (!player) {
    return interaction.reply("⚠️ You are not enlisted.");
  }

  const nation = await Nation.findOne({ serverId: player.serverId });
  if (nation) {
    nation.playerCount = Math.max(0, nation.playerCount - 1); // avoid negatives
    await nation.save();
  }

  await Player.deleteOne({ userId: interaction.user.id });
  await interaction.reply("🏳️ You have retired from this server's war.");
}
