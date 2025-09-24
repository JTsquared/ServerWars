// intelreport.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Intel from "../models/Intel.js";

export const data = new SlashCommandBuilder()
  .setName("intelreport")
  .setDescription("View your nation’s gathered intel on rivals.");

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const dossiers = await Intel.find({ spyingNationId: nation.serverId });
  if (dossiers.length === 0) {
    return interaction.reply("📭 You have no intel reports yet. Explore or spy to gather intel on other nations.");
  }

  let output = `📓 **Intel Report for ${nation.name}**\n\nForeign Nations:\n`;

  for (const d of dossiers) {
    output += `**Nation: ${d.nationName}**\n`;
    output += `👥 Population: ${d.population ?? "UNKNOWN"} | 👤 Players: ${d.playerCount ?? "UNKNOWN"}\n`;

    output += `🏙️ Known Cities:\n`;
    if (d.knownCities.length > 0) {
      for (const c of d.knownCities) {
        output += `   - [Tile ${c.tileId}] ${c.name}\n`;
      }
    }

    output += `📦 Resources → Food: ${d.resources.food ?? "UNKNOWN"}, Gold: ${d.resources.gold ?? "UNKNOWN"}, Steel: ${d.resources.steel ?? "UNKNOWN"}, Oil: ${d.resources.oil ?? "UNKNOWN"}\n`;
    output += `⚔️ Military → Troops: ${d.military.troops ?? "UNKNOWN"}, Tanks: ${d.military.tanks ?? "UNKNOWN"}, Jets: ${d.military.jets ?? "UNKNOWN"}\n`;
    output += `🏗️ Buildings → Cities: ${d.buildings.city ?? "UNKNOWN"}, Barracks: ${d.buildings.barracks ?? "UNKNOWN"}, Factories: ${d.buildings.factory ?? "UNKNOWN"}, Hangars: ${d.buildings.hangar ?? "UNKNOWN"}\n`;
    output += `🔬 Research → Manufacturing: ${d.research.manufacturing ?? "UNKNOWN"}, Flight: ${d.research.flight ?? "UNKNOWN"}, Banking: ${d.research.banking ?? "UNKNOWN"}, ShitCoins: ${d.research.shit_coins ?? "UNKNOWN"}\n\n`;
  }

  if (output.length > 2000) {
    output = output.slice(0, 1990) + "...";
  }

  await interaction.reply(output);
}
