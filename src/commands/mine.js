// mine.js
import { SlashCommandBuilder } from "discord.js";
import { getUserByDiscordId, saveUser } from "../data/userData.js";
import { getOrCreateNation, saveNation } from "../data/nationData.js";
import Player from "../models/Player.js";
import Nation from "../models/Nation.js";
import { EXP_GAIN, NATION_TRAITS } from "../utils/constants.js";
import Tile from "../models/Tile.js";
import {
  canUseResourceCommand,
  setResourceCooldown,
  getTier,
  getResourceYield,
  grantExp,
} from "../utils/gameUtils.js";
import { economistTiers, militaryTiers, scoutTiers, diplomatTiers } from "../data/tiers.js";
import { checkWorldEvents } from "../utils/worldEvents.js";
import { getBoostMultiplier } from "../utils/boostUtils.js";

export const data = new SlashCommandBuilder()
  .setName("mine")
  .setDescription("Mine steel and gold for your nation (+economist exp, cooldown applies).");

export async function execute(interaction) {

  await checkWorldEvents();

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) return interaction.reply("⚠️ You must `/join` your server’s campaign before exploring!");

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) return interaction.reply("❌ Your nation does not exist. Use `/join` first.");

  if (!canUseResourceCommand(player)) {
    return interaction.reply({
      content: "⏳ You must wait before using another resource command.",
      ephemeral: true,
    });
  }

  const rankUpMsg = await grantExp(player, "economist", EXP_GAIN.ECONOMIST, nation);

  const ownedTiles = await Tile.find({ "city.exists": true, "city.owner": nation.serverId });
  let steelYield = getResourceYield(player.exp.economist, economistTiers, nation, "steel", ownedTiles);
  let goldYield = getResourceYield(player.exp.economist, economistTiers, nation, "gold", ownedTiles);

  // INDUSTRIOUS trait: steel production bonus
  if (nation.trait === "INDUSTRIOUS") {
    steelYield = Math.floor(steelYield * (1 + NATION_TRAITS.INDUSTRIOUS.steelProductionBonus));
  }

  // Apply production boosts if active
  const steelBoostMultiplier = getBoostMultiplier(nation, "steel");
  if (steelBoostMultiplier > 1) {
    steelYield = Math.floor(steelYield * steelBoostMultiplier);
  }

  const goldBoostMultiplier = getBoostMultiplier(nation, "gold");
  if (goldBoostMultiplier > 1) {
    goldYield = Math.floor(goldYield * goldBoostMultiplier);
  }

  nation.resources.steel = (nation.resources.steel ?? 0) + steelYield;
  nation.resources.gold = (nation.resources.gold ?? 0) + goldYield;

  setResourceCooldown(player);
  console.log("/mine nation.steel", nation.resources.steel);
  await Promise.all([saveUser(player), saveNation(nation)]);

  // Reply
  let reply =
    `⛏️ You mined **${steelYield} steel** and **${goldYield} gold** for your nation!` +
    `\n📦 Totals → Steel: ${nation.resources.steel}, Gold: ${nation.resources.gold}` +
    `\n+${EXP_GAIN.ECONOMIST} Economist EXP (Current: ${player.exp.economist})`;

    if (steelBoostMultiplier > 1) {
      reply += `\n⚡ **${steelBoostMultiplier}x Steel Production Boost Active!**`;
    }

    if (goldBoostMultiplier > 1) {
      reply += `\n⚡ **${goldBoostMultiplier}x Gold Production Boost Active!**`;
    }

    if (rankUpMsg) reply += `\n${rankUpMsg}`;

  await interaction.reply(reply);
}
