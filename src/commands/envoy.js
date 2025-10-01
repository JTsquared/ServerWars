// src/commands/envoy.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import { checkPermissions, getServerWarsChannel, getNationalCooldownTime, setNationCooldown, grantExp } from "../utils/gameUtils.js";
import { ENVOY_COOLDOWN_MS, EXP_GAIN } from "../utils/constants.js";
import { checkWorldEvents } from "../utils/worldEvents.js";

export const data = new SlashCommandBuilder()
  .setName("envoy")
  .setDescription("Send a diplomatic message to another nation.")
  .addStringOption(option =>
    option.setName("nation_name")
      .setDescription("The name of the nation to send the envoy to.")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("message")
      .setDescription("The message to send.")
      .setRequired(true)
  );

export async function execute(interaction) {

  await checkWorldEvents();

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` your server’s campaign before exploring!");
  }

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) return interaction.reply("❌ Your nation does not exist. Use `/join` first.");

  if (!checkPermissions(interaction, nation, "Diplomatic")) {
    return interaction.reply("🚫 Only the **Foreign Minister** or someone with the Political Leader role may send envoys.");
  }

  const targetNationName = interaction.options.getString("nation_name");
  const targetNation = await Nation.findOne({ name: targetNationName });
  if (!targetNation) {
    return interaction.reply(`⚠️ Could not find a nation named **${targetNationName}**.`);
  }

  const envoyCooldown = parseInt(ENVOY_COOLDOWN_MS || "900000", 10);
  const secondsLeft = getNationalCooldownTime(nation, "envoy", envoyCooldown);
  if (secondsLeft > 0) {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    return interaction.reply({
    content: `⏳ Your nation must wait ${hours}h ${minutes}m ${seconds}s before sending another envoy.`,
    ephemeral: true,
    });
  }

  const message = interaction.options.getString("message");

  // Update cooldown + XP
  setNationCooldown(nation, "envoy");
  const rankUpMsg = await grantExp(player, "diplomat", EXP_GAIN.DIPLOMAT, nation);
  await nation.save();

  // Try to notify target nation
  try {
    const targetGuild = await interaction.client.guilds.fetch(targetNation.serverId);
    if (targetGuild) {
      const channel = getServerWarsChannel(targetGuild);
      if (channel) {
        await channel.send(
          `📜 **Envoy from ${nation.name}:**\n> ${message}`
        );
      }
    }
  } catch (err) {
    console.error("Failed to deliver envoy:", err);
  }

  return interaction.reply(
    `📨 Envoy dispatched to **${targetNation.name}**.\n🕊️ Your message: "${message}"\n${rankUpMsg}`
  );
}
