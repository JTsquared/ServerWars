// commands/help.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { helpInfo } from "../utils/helpInfo.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show information about commands.")
  .addStringOption(option =>
    option
      .setName("command")
      .setDescription("The command to get detailed help for")
      .setRequired(false)
  );

export async function execute(interaction) {
  const commandName = interaction.options.getString("command");

  if (!commandName) {
    // Show all commands (short form)
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

  // Show detailed help for a single command
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
