// intelreport.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Intel from "../models/Intel.js";

export const data = new SlashCommandBuilder()
  .setName("intelreport")
  .setDescription("View your nation’s most recent spy reports on rivals.");

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const reports = await Intel.find({ spyingNationId: nation.serverId });
  if (reports.length === 0) {
    return interaction.reply("📭 You have no intel reports yet. Use `/spy` to gather intel on rivals.");
  }

  let output = `📓 **Intel Reports for ${nation.name}**\n\n`;
  for (const intel of reports) {
    const r = intel.report;
    if (!r) continue;
    output += `**${r.nationName}**\n`;
    output += `👥 Pop: ${r.population} | 🏙️ Cities: ${r.cities}\n`;
    output += `📦 Resources → Food: ${r.resources.food}, Gold: ${r.resources.gold}, Steel: ${r.resources.steel}, Oil: ${r.resources.oil}\n`;
    output += `⚔️ Military → Troops: ${r.military.troops}, Tanks: ${r.military.tanks}, Jets: ${r.military.jets}\n`;
    output += `🏗️ Buildings → Cities: ${r.buildings.city}, Barracks: ${r.buildings.barracks}, Factories: ${r.buildings.factory}, Airbases: ${r.buildings.airbase}\n\n`;
  }

  if (output.length > 2000) {
    output = output.slice(0, 1990) + "...";
  }

  await interaction.reply(output);
}
