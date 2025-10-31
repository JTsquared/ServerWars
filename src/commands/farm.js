import { SlashCommandBuilder } from "discord.js";
import { getUserByDiscordId, saveUser } from "../data/userData.js";
import { getOrCreateNation, saveNation } from "../data/nationData.js";
import ServerConfig from "../models/ServerConfig.js";
import Tile from "../models/Tile.js";
import {
  canUseResourceCommand,
  setResourceCooldown,
  getTier,
  getResourceYield,
  grantExp
} from "../utils/gameUtils.js";
import { economistTiers, militaryTiers, scoutTiers, diplomatTiers } from "../data/tiers.js";
import { EXP_GAIN, NATION_TRAITS } from "../utils/constants.js";
import { checkWorldEvents } from "../utils/worldEvents.js";
import { getBoostMultiplier } from "../utils/boostUtils.js";

const ECONOMIST_EXP_GAIN = 15;

export const data = new SlashCommandBuilder()
  .setName("farm")
  .setDescription("Harvest food for your nation (+economist exp, 1h global cooldown).");

export async function execute(interaction) {

  await checkWorldEvents();

  // 1) user & cooldown checks
  const player = await getUserByDiscordId(interaction.user.id);
  if (!player) {
    return interaction.reply({
      content: "⚠️ You must `/join` your server’s campaign before taking actions!",
      ephemeral: true,
    });
  }

  if (!canUseResourceCommand(player)) {
    return interaction.reply({
      content: "⏳ You must wait before using another resource command.",
      ephemeral: true,
    });
  }

  // 2) load nation
  const nation = await getOrCreateNation(interaction.guild.id);
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  // 3) compute total fertility across *owned* tiles (city.owner === nation.serverId)
  const ownedTiles = await Tile.find({
    "city.exists": true,
    "city.owner": nation.serverId
  });

  const rankUpMsg = await grantExp(player, "economist", EXP_GAIN.ECONOMIST, nation);
  let foodYield = getResourceYield(player.exp.economist, economistTiers, nation, "food", ownedTiles);

  // AGRICULTURAL trait: food production bonus
  if (nation.trait === "AGRICULTURAL") {
    foodYield = Math.floor(foodYield * (1 + NATION_TRAITS.AGRICULTURAL.foodProductionBonus));
  }

  // Apply production boost if active
  const boostMultiplier = getBoostMultiplier(nation, "food");
  if (boostMultiplier > 1) {
    foodYield = Math.floor(foodYield * boostMultiplier);
  }

  let popIncrease = Math.ceil(foodYield);

  // GREGARIOUS trait: population growth bonus when farming
  if (nation.trait === "GREGARIOUS") {
    popIncrease = Math.floor(popIncrease * (1 + NATION_TRAITS.GREGARIOUS.populationGrowthBonus));
  }

  nation.resources.food = (nation.resources.food || 0) + foodYield;
  nation.population = (nation.population || 0) + popIncrease;

  // 8) set cooldown and persist
  setResourceCooldown(player);
  console.log("/farm nation.steel", nation.resources.steel);
  await Promise.all([saveUser(player), saveNation(nation)]);

  // 9) reply — always show totals, only show rank-up when changed
  let reply =
    `🌾 You harvested **${foodYield} food** for your nation! (Total: ${nation.resources.food})\n` +
    `👥 Population +${popIncrease} → **${nation.population}**\n` +
    `+${EXP_GAIN.ECONOMIST} Economist EXP (Current: ${player.exp.economist})`;

    if (boostMultiplier > 1) {
      reply += `\n⚡ **${boostMultiplier}x Production Boost Active!**`;
    }

    if (rankUpMsg) reply += `\n${rankUpMsg}`;

  await interaction.reply(reply);
}
