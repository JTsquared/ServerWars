import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import { canUseResourceCommand, setResourceCooldown, getResourceYield, grantExp } from "../utils/gameUtils.js";
import { EXP_GAIN, BUILDINGS, POPULATION_PER_CITY, DEPLOY_COSTS } from "../utils/constants.js";
import { militaryTiers } from "../data/tiers.js";
import { saveUser } from "../data/userData.js";
import { saveNation } from "../data/nationData.js";

export const data = new SlashCommandBuilder()
  .setName("deploy")
  .setDescription("Deploy military units (troops, tanks, or jets).")
  .addStringOption(option =>
    option
      .setName("unit")
      .setDescription("Type of unit to deploy")
      .setRequired(true)
      .addChoices(
        { name: "Troops", value: "troops" },
        { name: "Tanks", value: "tanks" },
        { name: "Jets", value: "jets" }
      )
  );

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` your nation before deploying units!");
  }

  if (!canUseResourceCommand(player)) {
    return interaction.reply({
      content: "⏳ You must wait before using another resource command.",
      ephemeral: true,
    });
  }

  const unitType = interaction.options.getString("unit");

  // Research prechecks
  if (unitType === "tanks" && !nation.research.manufacturing) {
    return interaction.reply("🚫 You must research **Manufacturing** before deploying tanks.");
  }
  if (unitType === "jets" && !nation.research.flight) {
    return interaction.reply("🚫 You must research **Flight** before deploying jets.");
  }

  let cost = {};
  if (unitType === "troops") cost = DEPLOY_COSTS.TROOPS;
  if (unitType === "tanks")  cost = DEPLOY_COSTS.TANKS;
  if (unitType === "jets")   cost = DEPLOY_COSTS.JETS;

  const totalSteelCost = cost.steel
  const totalOilCost   = cost.oil
  const totalFoodCost  = cost.food

  // Check if nation has enough resources
  if (nation.resources.steel < totalSteelCost || nation.resources.oil < totalOilCost || nation.resources.food < totalFoodCost) {
    return interaction.reply(
      `🚫 Not enough resources to deploy **${totalDeployed} ${unitType}**.\n` +
      `Required: ${totalSteelCost} steel, ${totalOilCost} oil, ${totalFoodCost} food\n` +
      `Current: ${nation.resources.steel} steel, ${nation.resources.oil} oil, ${nation.resources.food} food`
    );
  }

  // Deduct resources
  nation.resources.steel -= totalSteelCost;
  nation.resources.oil   -= totalOilCost;
  nation.resources.food  -= totalFoodCost;

  let costMsg = "";
  if (totalSteelCost > 0) costMsg += `🔩 -${totalSteelCost} Steel `;
  if (totalOilCost > 0)   costMsg += `🛢️ -${totalOilCost} Oil `;
  if (totalFoodCost > 0)  costMsg += `🍞 -${totalFoodCost} Food `;

  // // Base yield from EXP + tier
  // const baseUnits = getResourceYield(player.exp.military, militaryTiers);

  // // Building bonuses
  // let bonus = 0;
  // if (unitType === "troops") {
  //   bonus = nation.buildings.barracks * BUILDINGS.BARRACKS.bonus;
  // } else if (unitType === "tanks") {
  //   bonus = nation.buildings.depot * BUILDINGS.DEPOT.bonus;
  // } else if (unitType === "jets") {
  //   bonus = nation.buildings.hangar * BUILDINGS.HANGAR.bonus;
  // }

  // let totalDeployed = baseUnits + bonus;

  let totalDeployed = getResourceYield(player.exp.military, militaryTiers, nation, unitType, []);

  // Special cap for troops based on population
  if (unitType === "troops") {

    // Population bonus: +2 support for every POPULATION_PER_CITY in the nation
    const populationBonus = Math.floor(nation.population / POPULATION_PER_CITY) * 2;
    console.log(`Population bonus troops: ${populationBonus}`);

    totalDeployed = totalDeployed + populationBonus;
    
    if (nation.military.troops + totalDeployed > nation.population) {
      totalDeployed = nation.population - nation.military.troops;
    }
    if (totalDeployed <= 0) {
      return interaction.reply(`🚫 The number of troops cannot exceed your population (**${nation.population}**). You need more food to increase your population`);
    }
    nation.military.troops += totalDeployed;
  }

  if (unitType === "tanks") {
    nation.military.tanks = (nation.military.tanks || 0) + totalDeployed;
  }

  if (unitType === "jets") {
    nation.military.jets = (nation.military.jets || 0) + totalDeployed;
  }

  // Grant EXP
  const rankUpMsg = await grantExp(player, "military", EXP_GAIN.MILITARY, nation);

  // Apply cooldown
  setResourceCooldown(player);

  console.log("/deploy nation.steel", nation.resources.steel);
  await Promise.all([saveUser(player), saveNation(nation)]);

  // Reply
  let reply = `🚀 You deployed **${totalDeployed} ${unitType}**!\n` +
              `+${EXP_GAIN.MILITARY} Military EXP (Current: ${player.exp.military})`;
              if (costMsg) reply += `\n**Resources used:**${costMsg}`;
              if (rankUpMsg) reply += `\n${rankUpMsg}`;

  await interaction.reply(reply);
}
