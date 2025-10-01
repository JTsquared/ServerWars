// intelreport.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import Nation from "../models/Nation.js";
import Intel from "../models/Intel.js";
import { checkWorldEvents } from "../utils/worldEvents.js";

export const data = new SlashCommandBuilder()
  .setName("intelreport")
  .setDescription("View your nation’s gathered intel on rivals.");

export async function execute(interaction) {

  await checkWorldEvents();

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const dossiers = await Intel.find({ spyingNationId: nation.serverId });
  if (dossiers.length === 0) {
    return interaction.reply("📭 You have no intel reports yet. Explore or spy to gather intel on other nations.");
  }

  // Helper to render an embed for a given index
  const renderEmbed = (dossier, index) => {
    const cityList = dossier.knownCities?.length
      ? dossier.knownCities.map(c => `- ${c.name} [Tile ID: ${c.tileId}]`).join("\n")
      : "- UNKNOWN";

    const embed = new EmbedBuilder()
      .setTitle(`📓 Intel Report: ${dossier.nationName}`)
      .setDescription(`Foreign intel gathered on **${dossier.nationName}**\nReport ${index + 1}/${dossiers.length}`)
      .addFields(
        {
          name: "👥 Population / Players",
          value: `Population: ${dossier.population ?? "UNKNOWN"}\nPlayers: ${dossier.playerCount ?? "UNKNOWN"}`,
          inline: true,
        },
        { name: "🏙️ Cities", value: cityList, inline: false },
        {
          name: "📦 Resources",
          value: `🍞 Food: ${dossier.resources.food ?? "UNKNOWN"}\n💰 Gold: ${dossier.resources.gold ?? "UNKNOWN"}\n🔩 Steel: ${dossier.resources.steel ?? "UNKNOWN"}\n🛢️ Oil: ${dossier.resources.oil ?? "UNKNOWN"}`,
          inline: true,
        },
        {
          name: "⚔️ Military",
          value: `👣 Troops: ${dossier.military.troops ?? "UNKNOWN"}\n🛡️ Tanks: ${dossier.military.tanks ?? "UNKNOWN"}\n✈️ Jets: ${dossier.military.jets ?? "UNKNOWN"}`,
          inline: true,
        },
        {
          name: "🏗️ Buildings",
          value: `🏙️ Cities: ${dossier.buildings.city ?? "UNKNOWN"}\n🏰 Barracks: ${dossier.buildings.barracks ?? "UNKNOWN"}\n🏭 Factories: ${dossier.buildings.factory ?? "UNKNOWN"}\n🛫 Hangars: ${dossier.buildings.hangar ?? "UNKNOWN"}`,
          inline: true,
        },
        {
          name: "🔬 Research",
          value: `⚙️ Manufacturing: ${dossier.research.manufacturing ?? "UNKNOWN"}\n✈️ Flight: ${dossier.research.flight ?? "UNKNOWN"}\n🏦 Banking: ${dossier.research.banking ?? "UNKNOWN"}\n💩 ShitCoins: ${dossier.research.shit_coins ?? "UNKNOWN"}`,
          inline: true,
        }
      )
      .setColor("DarkBlue");

    if (dossier.createdAt) {
      embed.setFooter({ text: "Intel gathered" }).setTimestamp(dossier.createdAt);
    }

    return embed;
  };

  let index = 0;

  // Create navigation buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("prev").setLabel("⬅️ Prev").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("next").setLabel("Next ➡️").setStyle(ButtonStyle.Primary)
  );

  const message = await interaction.reply({
    embeds: [renderEmbed(dossiers[index], index)],
    components: [row],
    fetchReply: true,
  });

  // Collector for button interactions
  const collector = message.createMessageComponentCollector({
    time: 1000 * 60 * 5, // 5 min timeout
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({ content: "❌ This menu isn’t for you.", ephemeral: true });
    }

    if (i.customId === "prev") {
      index = (index - 1 + dossiers.length) % dossiers.length;
    } else if (i.customId === "next") {
      index = (index + 1) % dossiers.length;
    }

    await i.update({
      embeds: [renderEmbed(dossiers[index], index)],
      components: [row],
    });
  });

  collector.on("end", async () => {
    // Disable buttons when collector ends
    const disabledRow = new ActionRowBuilder().addComponents(
      row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
    );
    await message.edit({ components: [disabledRow] });
  });
}
