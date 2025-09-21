// launchshitcoin.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import { canUseResourceCommand, getNationalCooldownTime, setResourceCooldown, setNationCooldown, grantExp } from "../utils/gameUtils.js";
import { EXP_GAIN, RESEARCH } from "../utils/constants.js";
import { saveUser } from "../data/userData.js";
import { saveNation } from "../data/nationData.js";

export const data = new SlashCommandBuilder()
  .setName("launchshitcoin")
  .setDescription("Attempt to launch your own cryptocurrency.");

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` this nation before attempting this!");
  }

  const financeRole = interaction.guild.roles.cache.find(r => r.name === "Treasury");
  const hasDiscordRole = financeRole && interaction.member.roles.cache.has(financeRole.id);
  
  const isInternalMinister = nation.leadership.financeMinister.userId === interaction.user.id;
  
  if (!hasDiscordRole && !isInternalMinister) {
    return interaction.reply("🚫 Only the **Finance Minister** or someone with the Treasury role may use the Nation's gold.");
  }

  if (!canUseResourceCommand(player)) {
    return interaction.reply({
      content: "⏳ You must wait before using another resource command.",
      ephemeral: true,
    });
  }

  const shitcoin_cooldown = parseInt(process.env.SHITCOIN_COOLDOWN_MS || "14400000", 10);
  const secondsLeft = getNationalCooldownTime(nation, "launchshitcoin", shitcoin_cooldown);
  if (secondsLeft > 0) {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60); // ⬅️ Fix here
    const seconds = secondsLeft % 60;
    return interaction.reply({
      content: `⏳ Your nation must wait ${hours} hours, ${minutes} minutes, and ${seconds} seconds before launching another shitcoin.`,
      ephemeral: true,
    });
  }

  // Research check
  if (!nation.research.shit_coins) {
    return interaction.reply("🚫 Your nation must complete **Shitcoins** research before launching a shitcoin project.");
  }

  // Check gold
  const cost = 30;
  if (nation.resources.gold < cost) {
    return interaction.reply(
      `💰 Not enough gold to launch a shitcoin.\nRequired: ${cost}, Current: ${nation.resources.gold}`
    );
  }

  // Deduct gold
  nation.resources.gold -= cost;

  // Attempt success (10%)
  const success = Math.random() < 0.1;
  let reply = `💸 You attempted to launch shitcoin and spent **${cost} gold**.\n`;

  if (success) {
    nation.resources.gold += 10000; // one-time payout
    reply += "🎉 Success! Your cryptocurrency launch netted **10,000 gold**!";
  } else {
    reply += "❌ The launch failed. I guess it's not meme season. Better luck next time!";
  }

  // Grant economist EXP
  const oldRole = player.role;
  const rankUpMsg = await grantExp(player, "economist", EXP_GAIN.ECONOMIST, nation);

  // Set extended cooldown
  setResourceCooldown(player);
  setNationCooldown(nation, "launchshitcoin");

  await Promise.all([saveUser(player), saveNation(nation)]);

  if (rankUpMsg) reply += `\n${rankUpMsg}`;

  await interaction.reply(reply);
}
