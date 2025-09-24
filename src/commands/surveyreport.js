// surveyReport.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Tile from "../models/Tile.js";

export const data = new SlashCommandBuilder()
  .setName("surveyreport")
  .setDescription("View all tiles your nation has surveyed.")
  .addStringOption(option =>
    option
      .setName("filter")
      .setDescription("Filter tiles by a specific resource or city")
      .setRequired(true)
      .addChoices(
        { name: "Food", value: "food" },
        { name: "Gold", value: "gold" },
        { name: "Steel", value: "steel" },
        { name: "Oil", value: "oil" },
        { name: "City", value: "city" },
        { name: "All", value: "all" }
      )
  );

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const filter = interaction.options.getString("filter");

  // Find all tiles surveyed by this nation
  let tiles = await Tile.find({ surveyedBy: nation.serverId }).sort({ tileId: 1 });

  if (filter !== "all") {
    tiles = tiles.filter(tile => {
      if (filter === "city") return tile.city && tile.city.exists;
      return tile.resources?.[filter] > 0;
    });
  }

  if (tiles.length === 0) {
    return interaction.reply(`🧭 No surveyed tiles match the filter: **${filter}**.`);
  }

  // Build message
  let message = `🧭 Survey Report for **${nation.name}** (${tiles.length} tiles, filter: ${filter}):\n\n`;

  for (const tile of tiles) {
    const resources = tile.resources
      ? `Food: ${tile.resources.food || 0}, Steel: ${tile.resources.steel || 0}, Gold: ${tile.resources.gold || 0}, Oil: ${tile.resources.oil || 0}`
      : "No resources";

    const cityInfo = tile.city && tile.city.exists
      ? `City: ${tile.city.name} (Nation: ${tile.city.ownerName})`
      : "No city";

    message += `Tile #${tile.tileId} | Fertility: ${tile.fertility || 0} | ${resources} | ${cityInfo}\n`;
  }

  // Discord 2000-character limit
  if (message.length > 1900) {
    const chunks = message.match(/[\s\S]{1,1900}/g);
    for (const chunk of chunks) {
      await interaction.reply(chunk);
    }
  } else {
    await interaction.reply(message);
  }
}
