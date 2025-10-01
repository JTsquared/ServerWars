// surveyReport.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import Nation from "../models/Nation.js";
import Tile from "../models/Tile.js";
import { checkWorldEvents } from "../utils/worldEvents.js";

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
  await checkWorldEvents();

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const filter = interaction.options.getString("filter");

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

  // Pagination setup
  const pageSize = 5;
  const totalPages = Math.ceil(tiles.length / pageSize);

  const buildEmbed = (page) => {
    const start = page * pageSize;
    const end = start + pageSize;
    const pageTiles = tiles.slice(start, end);

    const embed = new EmbedBuilder()
      .setTitle(`🧭 Survey Report for ${nation.name}`)
      .setDescription(`Filter: **${filter}** | Page ${page + 1}/${totalPages}`)
      .setColor("Blue")
      .setFooter({ text: `${tiles.length} tiles surveyed` });

    for (const tile of pageTiles) {
      const resources = tile.resources
        ? `Food: ${tile.resources.food || 0}, Steel: ${tile.resources.steel || 0}, Gold: ${tile.resources.gold || 0}, Oil: ${tile.resources.oil || 0}`
        : "No resources";

      const cityInfo = tile.city && tile.city.exists
        ? `City: ${tile.city.name} (Nation: ${tile.city.ownerName})`
        : "No city";

      embed.addFields({
        name: `Tile #${tile.tileId} | Fertility: ${tile.fertility || 0}`,
        value: `${resources}\n${cityInfo}`,
      });
    }

    return embed;
  };

  let currentPage = 0;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("⬅️ Prev")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("➡️ Next")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(totalPages === 1)
  );

  const message = await interaction.reply({
    embeds: [buildEmbed(currentPage)],
    components: [row],
    fetchReply: true,
  });

  const collector = message.createMessageComponentCollector({
    time: 5 * 60 * 1000, // 5 minutes
  });

  collector.on("collect", async (btnInt) => {
    if (btnInt.user.id !== interaction.user.id) {
      return btnInt.reply({ content: "🚫 Only the command user can control pagination.", ephemeral: true });
    }

    if (btnInt.customId === "prev") currentPage--;
    if (btnInt.customId === "next") currentPage++;

    // Update buttons
    const newRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("⬅️ Prev")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("➡️ Next")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages - 1)
    );

    await btnInt.update({
      embeds: [buildEmbed(currentPage)],
      components: [newRow],
    });
  });

  collector.on("end", async () => {
    // Disable buttons when collector ends
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("⬅️ Prev")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("➡️ Next")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    await message.edit({
      components: [disabledRow],
    });
  });
}
