import { SlashCommandBuilder } from "discord.js";
import Player from "../models/Player.js";

export const data = new SlashCommandBuilder()
  .setName("playerstats")
  .setDescription("Check your personal stats");

export async function execute(interaction) {
  const player = await Player.findOne({ userId: interaction.user.id });
  if (!player) return interaction.reply("❌ You are not enlisted. Use `/join` first.");

  const { role, exp } = player;

  const statsMessage =
    `📜 **Stats for ${interaction.user.username}**\n\n` +
    `Role: ${role}\n` +
    `🪖 Military XP: ${exp.military}\n` +
    `🌾 Economist XP: ${exp.economist}\n` +
    `🧭 Scout XP: ${exp.scout}\n` +
    `🤝 Diplomat XP: ${exp.diplomat}`;

    await interaction.reply(statsMessage);
}
