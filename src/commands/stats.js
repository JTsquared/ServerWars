import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import { WORLD_TILES, BUILDINGS } from "../utils/constants.js";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Check your nation's collective stats");

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation is not yet established. Use `/join` first.");
  }

  const { resources, military, buildings, discoveredNations, research, leadership, name, population, tilesDiscovered } = nation;

  // 🏛️ Format Buildings
  const buildingList = Object.entries(buildings)
    .filter(([key]) => key !== "city") // exclude city from this list, handled separately
    .map(([key, count]) => {
      const label = BUILDINGS[key.toUpperCase()]?.name || key;
      return `🏗️ ${label}: ${count}`;
    }).join("\n") || "None";

  // 📜 Format Research
  const researchList = Object.entries(research)
    .filter(([_, unlocked]) => unlocked)
    .map(([key]) => key.replace(/_/g, " "))
    .join(", ") || "None";

  // 🧑‍✈️ Format Leadership
  const leaders = [
    `👑 Commander in Chief: ${leadership.commanderInChief?.userId ? `<@${leadership.commanderInChief.userId}> (XP: ${leadership.commanderInChief.exp})` : "Unclaimed"}`,
    `💰 Finance Minister: ${leadership.financeMinister?.userId ? `<@${leadership.financeMinister.userId}> (XP: ${leadership.financeMinister.exp})` : "Unclaimed"}`,
    `🕵️ Chief Scout: ${leadership.chiefScout?.userId ? `<@${leadership.chiefScout.userId}> (XP: ${leadership.chiefScout.exp})` : "Unclaimed"}`,
    `🌐 Foreign Minister: ${leadership.foreignMinister?.userId ? `<@${leadership.foreignMinister.userId}> (XP: ${leadership.foreignMinister.exp})` : "Unclaimed"}`
  ].join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`🌍 Nation Stats: ${name}`)
    .setColor(0x2ecc71)
    .addFields(
      { name: "👥 Population", value: `${population}`, inline: true },
      { name: "🏙️ Cities", value: `${buildings.city || 0}`, inline: true },
      { name: "🗺️ Map Progress", value: `${tilesDiscovered}/${WORLD_TILES} tiles discovered`, inline: true },

      { name: "📦 Resources", value: `🍞 Food: ${resources.food} | ⛏️ Steel: ${resources.steel} | 💰 Gold: ${resources.gold} | 🛢 Oil: ${resources.oil}` },

      { name: "🪖 Military", value: `👥 Troops: ${military.troops} | 🛡️ Tanks: ${military.tanks} | ✈️ Jets: ${military.jets}` },

      { name: "🏗️ Buildings", value: buildingList },

      { name: "📜 Research Unlocked", value: researchList },

      { name: "🧑‍💼 Leadership", value: leaders },

      { name: "🌐 Other Nations Discovered", value: `${discoveredNations.length}`, inline: true }
    )
    .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
