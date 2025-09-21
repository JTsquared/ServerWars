import { SlashCommandBuilder } from "discord.js";
import { getUserByDiscordId, saveUser } from "../data/userData.js";
import { getOrCreateNation, saveNation } from "../data/nationData.js";
import Player from "../models/Player.js";
import Nation from "../models/Nation.js";
import Tile from "../models/Tile.js";
import { EXP_GAIN } from "../utils/constants.js";
import {
  canUseResourceCommand,
  setResourceCooldown,
  getTier,
  getResourceYield,
  grantExp
} from "../utils/gameUtils.js";
import { economistTiers, militaryTiers, scoutTiers, diplomatTiers } from "../data/tiers.js";

export const data = new SlashCommandBuilder()
  .setName("drill")
  .setDescription("Drill oil for your nation (+economist exp, cooldown applies).");

export async function execute(interaction) {
  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) return interaction.reply("⚠️ You must `/join` your server’s campaign before exploring!");

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) return interaction.reply("❌ Your nation does not exist. Use `/join` first.");
  
  if (!canUseResourceCommand(player)) {
    return interaction.reply({ content: "⏳ You must wait before using another resource command.", ephemeral: true });
  }

  const rankUpMsg = await grantExp(player, "economist", EXP_GAIN.ECONOMIST, nation);
  const ownedTiles = await Tile.find({ "city.exists": true, "city.owner": nation.serverId });
  const oilYield = getResourceYield(player.exp.economist, economistTiers, nation, "oil", ownedTiles);
  nation.resources.oil = (nation.resources.oil || 0) + oilYield;

  setResourceCooldown(player);
  console.log("/drill nation.steel", nation.resources.steel);
  await Promise.all([saveUser(player), saveNation(nation)]);

  let reply = `⛏️ You drilled **${oilYield} oil** for your nation! (Total: ${nation.resources.oil})\n` +
              `+${EXP_GAIN.ECONOMIST} Economist EXP (Current: ${player.exp.economist})`;
              if (rankUpMsg) reply += `\n${rankUpMsg}`;

  await interaction.reply(reply);
}