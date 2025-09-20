
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import { WORLD_TILES } from "../utils/constants.js";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Check your nation's collective stats");

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation is not yet established. Use `/join` first.");
  }

  const { resources, military, buildings, discoveredNations, research, leadership } = nation;

  // Research discoveries
  const researchList = Object.entries(research)
    .filter(([_, unlocked]) => unlocked)
    .map(([key]) => key.replace("_", " "))
    .join(", ") || "None";

  // Leadership roles
  const leaders = [
    `👑 Commander in Chief: ${leadership.commanderInChief?.userId ? `<@${leadership.commanderInChief.userId}> XP: ${leadership.commanderInChief.exp}` : "Unclaimed"}`,
    `💰 Finance Minister: ${leadership.financeMinister?.userId ? `<@${leadership.financeMinister.userId}> XP: ${leadership.financeMinister.exp}` : "Unclaimed"}`,
    `🕵️ Chief Scout: ${leadership.chiefScout?.userId ? `<@${leadership.chiefScout.userId}> XP: ${leadership.chiefScout.exp}` : "Unclaimed"}`,
    `🌐 Foreign Minister: ${leadership.foreignMinister?.userId ? `<@${leadership.foreignMinister.userId}> XP: ${leadership.foreignMinister.exp}` : "Unclaimed"}`
  ].join("\n");

  await interaction.reply(
    `🌍 **${nation.name} Stats**\n` +
    `👥 Population: ${nation.population}\n` +
    `🏙️ Cities: ${buildings.city}\n\n` +

    `📦 Resources:\n` +
    `🍞 Food: ${resources.food} | ⛏️ Steel: ${resources.steel} | 💰 Gold: ${resources.gold} | 🛢 Oil: ${resources.oil}\n\n` +

    `🪖 Military:\n` +
    `Troops: ${military.troops} | 🛡️ Tanks: ${military.tanks} | ✈️ Jets: ${military.jets}\n\n` +

    `📜 Research Discovered: ${researchList}\n\n` +

    `🌐 Nations Encountered: ${discoveredNations.length}\n` +
    `🗺️ Tiles Discovered: ${nation.tilesDiscovered} out of ${WORLD_TILES}\n\n` +

    `⚔️ Leadership:\n${leaders}`
  );
}

