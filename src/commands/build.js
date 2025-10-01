import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import { canUseResourceCommand, setResourceCooldown, grantExp } from "../utils/gameUtils.js";
import { economistTiers } from "../data/tiers.js";
import { EXP_GAIN, BUILDINGS, RESEARCH } from "../utils/constants.js";
import { saveUser } from "../data/userData.js";
import { saveNation } from "../data/nationData.js";
import { checkWorldEvents } from "../utils/worldEvents.js";

export const data = new SlashCommandBuilder()
  .setName("build")
  .setDescription("Construct a building for your nation (costs resources, gives Economist EXP).")
  .addStringOption(option =>
    option
      .setName("type")
      .setDescription("Type of building to construct")
      .setRequired(true)
      .addChoices(
        ...Object.entries(BUILDINGS)
          .filter(([key]) => key !== "CITY") // ❌ filter out CITY
          .map(([key, value]) => ({
            name: value.name,
            value: key, // 👈 use key (e.g. "BANK"), not lowercased
          }))
      )
  );

export async function execute(interaction) {

  await checkWorldEvents();

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` your nation before you can build!");
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

  const buildingType = interaction.options.getString("type");
  const building = BUILDINGS[buildingType];

  if (!building) {
    return interaction.reply("⚠️ Invalid building type selected.");
  }

  if (building.requiresResearch) {
    const required = building.requiresResearch.toUpperCase(); // no need to `.toLowerCase()` + then `.toUpperCase()` again
    console.log("Required research:", required);
    const researchObj = RESEARCH[required];
    console.log(researchObj);
    const dbName = researchObj?.dbname;
    console.log("DB Name:", dbName);
  
    if (!dbName || !nation.research[dbName]) {
      return interaction.reply(`🔬 You must complete **${building.requiresResearch}** research before building a **${building.name}**.`);
    }
  }

  // Resource check (gold + steel)
  // if (
  //   nation.resources.gold < building.cost.gold ||
  //   nation.resources.steel < building.cost.steel
  // ) {
  //   return interaction.reply(
  //     `💰 Not enough resources to build a **${building.name}**.\n` +
  //     `Required: ${building.cost.gold} gold, ${building.cost.steel} steel\n` +
  //     `Current: ${nation.resources.gold} gold, ${nation.resources.steel} steel`
  //   );
  // }

  const currentCount = nation.buildings[building.dbname] || 0;
  const scaledGoldCost  = building.cost.gold  * (currentCount + .5);
  const scaledSteelCost = building.cost.steel * (currentCount + .5);

  if (
    nation.resources.gold < scaledGoldCost ||
    nation.resources.steel < scaledSteelCost
  ) {
    return interaction.reply(
      `💰 Not enough resources to build a **${building.name}**.\n` +
      `Required: ${scaledGoldCost} gold, ${scaledSteelCost} steel\n` +
      `Current: ${nation.resources.gold} gold, ${nation.resources.steel} steel`
    );
  }

  if (building.max && building.max > 0) {
    const currentCount = nation.buildings[building.dbname] || 0;
    const cityCount = nation.buildings["city"] || 1; // fallback: assume 1 if not set
    const maxAllowed = cityCount * building.max;
  
    if (currentCount >= maxAllowed) {
      return interaction.reply(
        `🚫 You’ve reached the maximum number of **${building.name}s** allowed for your nation.\n` +
        `🧱 Limit: **${building.max} per city** × **${cityCount} city(ies)** = **${maxAllowed} total**.`
      );
    }
  }

  // Deduct resources and add building
  // nation.resources.gold -= building.cost.gold;
  // nation.resources.steel -= building.cost.steel;
  nation.resources.gold -= scaledGoldCost;
  nation.resources.steel -= scaledSteelCost;
  nation.buildings[building.dbname] = (nation.buildings[building.dbname] || 0) + 1;

  // Gain economist EXP
  const rankUpMsg = await grantExp(player, "economist", EXP_GAIN.ECONOMIST, nation);

  // Apply cooldown
  setResourceCooldown(player);

  await Promise.all([saveUser(player), saveNation(nation)]);

  let reply = `🏗️ You constructed a new **${building.name}**!\n` +
  `🏛️ ${building.name} total: **${nation.buildings[building.dbname]}**\n` +
  `Gold cost: **${scaledGoldCost}**, Steel cost: **${scaledSteelCost}**\n` +
  `💰 Gold remaining: **${nation.resources.gold}**, Steel remaining: **${nation.resources.steel}**\n` +
  `+${EXP_GAIN.ECONOMIST} Economist EXP (Current: ${player.exp.economist})`;
  if (rankUpMsg) reply += `\n${rankUpMsg}`;

  await interaction.reply(reply);
}
