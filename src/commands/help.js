// commands/help.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { helpInfo } from "../utils/helpInfo.js";
import { BUILDINGS, RESEARCH } from "../utils/constants.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show information about commands.")
  .addStringOption(option =>
    option
      .setName("command")
      .setDescription("The command to get detailed help for (e.g., 'buildings', 'train')")
      .setRequired(false)
  );

export async function execute(interaction) {
  const commandName = interaction.options.getString("command");

  // 📌 Handle /help buildings
  if (commandName?.toLowerCase() === "buildings") {
    const embed = new EmbedBuilder()
      .setTitle("🏗️ Building Types")
      .setColor(0xf1c40f)
      .setDescription("Details about each building, their costs, requirements, and benefits.");

    const buildingEntries = Object.entries(BUILDINGS)
      .sort((a, b) => a[1].name.localeCompare(b[1].name));

    for (const [key, building] of buildingEntries) {
      const costStr = Object.entries(building.cost)
        .map(([resource, amount]) => `${resource}: ${amount}`)
        .join(", ");

      const researchStr = building.requiresResearch
        ? building.requiresResearch.replace(/_/g, " ").toLowerCase()
        : "None";

      embed.addFields({
        name: `🏛️ ${building.name.charAt(0).toUpperCase() + building.name.slice(1)}`,
        value:
          `**Cost:** ${costStr}\n` +
          `**Research Required:** ${researchStr}\n` +
          `**Max per City:** ${building.max || "∞"}\n` +
          `**Effect:** ${building.description || "No description provided."}`,
        inline: false
      });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

// Inside your execute() function:
if (commandName?.toLowerCase() === "research") {
  const embed = new EmbedBuilder()
    .setTitle("🔬 Research Topics")
    .setColor(0x3498db)
    .setDescription("Here's a list of all available research topics, their costs, and what they unlock.");

  const researchEntries = Object.values(RESEARCH).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const research of researchEntries) {
    const costStr = Object.entries(research.cost)
      .map(([resource, amount]) => `${resource}: ${amount}`)
      .join(", ");

    embed.addFields({
      name: `🔹 ${research.name.charAt(0).toUpperCase() + research.name.slice(1)}`,
      value:
        `**Cost:** ${costStr}\n` +
        `**Effect:** ${research.description}`,
      inline: false
    });
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
}


  // 🧾 If no command specified, show full list
  if (!commandName) {
    let summary = "";
    for (const [cmd, entry] of Object.entries(helpInfo)) {
      summary += `**/${cmd}** → ${entry.short}\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle("📖 Server Wars Commands")
      .setDescription(summary)
      .setColor(0x00ae86);

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // 📌 Show help for individual commands
  const entry = helpInfo[commandName.toLowerCase()];
  if (!entry) {
    return interaction.reply({
      content: `❌ Unknown command: \`${commandName}\`. Use \`/help\` to see all commands.`,
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`ℹ️ /${commandName}`)
    .setDescription(entry.long)
    .setColor(0x00ae86);

  return interaction.reply({ embeds: [embed], ephemeral: true });
}
