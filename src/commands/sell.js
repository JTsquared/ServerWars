import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import { canUseResourceCommand, setResourceCooldown, grantExp } from "../utils/gameUtils.js";
import { SELL_RATES, EXP_GAIN } from "../utils/constants.js";
import { saveUser } from "../data/userData.js";
import { saveNation } from "../data/nationData.js";
import { economistTiers } from "../data/tiers.js";
import { checkWorldEvents } from "../utils/worldEvents.js";

export const data = new SlashCommandBuilder()
  .setName("sell")
  .setDescription("Sell your nation's resources for gold.")
  .addStringOption(option =>
    option
      .setName("resource")
      .setDescription("Type of resource to sell")
      .setRequired(true)
      .addChoices(
        { name: "Food", value: "food" },
        { name: "Oil", value: "oil" },
        { name: "Steel", value: "steel" },
      )
  )
  .addIntegerOption(option =>
    option
      .setName("amount")
      .setDescription("Amount of resource to sell")
      .setRequired(true)
      .setMinValue(1)
  );

export async function execute(interaction) {

  await checkWorldEvents();

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` your nation before trading!");
  }

  const financeRole = interaction.guild.roles.cache.find(r => r.name === "Treasury");
  const hasDiscordRole = financeRole && interaction.member.roles.cache.has(financeRole.id);
  
  const isInternalMinister = nation.leadership.financeMinister.userId === interaction.user.id;
  
  if (!hasDiscordRole && !isInternalMinister) {
    return interaction.reply("🚫 Only the **Finance Minister** or someone with the Treasury role may sell the nation's resources.");
  }

  // Cooldown check
  if (!canUseResourceCommand(player)) {
    return interaction.reply({
      content: "⏳ You must wait before using another resource command.",
      ephemeral: true,
    });
  }

  const resource = interaction.options.getString("resource");
  const amount = interaction.options.getInteger("amount");

  // Validate resource
  if (!SELL_RATES[resource]) {
    return interaction.reply("⚠️ Invalid resource type.");
  }

  // Check nation inventory
  if (nation.resources[resource] < amount) {
    return interaction.reply(
      `🚫 Your nation does not have enough **${resource}** to sell.\n` +
      `Current: **${nation.resources[resource]}**, Required: **${amount}**`
    );
  }

  // Calculate gold received
  const goldGained = amount * SELL_RATES[resource];

  // Deduct resource and add gold
  nation.resources[resource] -= amount;
  nation.resources.gold += goldGained;

  // Apply cooldown
  setResourceCooldown(player);

  await Promise.all([saveUser(player), saveNation(nation)]);

  // Reply
  let reply = `💱 You sold **${amount} ${resource}** for **${goldGained} gold**!\n` +
              `💰 Gold balance: **${nation.resources.gold}**\n`

  await interaction.reply(reply);
}
