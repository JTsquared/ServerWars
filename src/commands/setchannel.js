
import { SlashCommandBuilder } from "discord.js";
import Config from "../models/Config.js";
import { channelMap } from "../utils/gameUtils.js";

// /setchannel
export const data = new SlashCommandBuilder()
  .setName("setchannel")
  .setDescription("Set the default channel for Server Wars notifications.")
  .addChannelOption(opt =>
    opt
      .setName("channel")
      .setDescription("The channel to set as default")
      .setRequired(true)
  );

export async function execute(interaction) {
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({ content: "🚫 Admins only.", ephemeral: true });
  }

  const channel = interaction.options.getChannel("channel");
  await Config.findOneAndUpdate(
    { serverId: interaction.guild.id },
    { defaultChannelId: channel.id },
    { upsert: true }
  );
  channelMap.set(interaction.guild.id, channel.id);

  return interaction.reply(`✅ Default channel set to ${channel.toString()}`);
}
