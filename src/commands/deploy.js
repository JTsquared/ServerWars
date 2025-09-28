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
        { name: "troops", value: "troops" },
        { name: "tanks", value: "tanks" },
        { name: "jets", value: "jets" }
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
  if (unitType === "tanks" && !nation.buildings.depot > 0) {
    return interaction.reply("🚫 You must build at least 1 **Depot** before deploying tanks.");
  }
  if (unitType === "jets" && !nation.research.flight) {
    return interaction.reply("🚫 You must research **Flight** before deploying jets.");
  }
  if (unitType === "jets" && !nation.buildings.hangar > 0) {
    return interaction.reply("🚫 You must build at least 1 **Hangar** before deploying jets.");
  }

  // let cost = {};
  // if (unitType === "troops") cost = DEPLOY_COSTS.TROOPS;
  // if (unitType === "tanks")  cost = DEPLOY_COSTS.TANKS;
  // if (unitType === "jets")   cost = DEPLOY_COSTS.JETS;

  // const totalSteelCost = cost.steel
  // const totalOilCost   = cost.oil
  // const totalFoodCost  = cost.food

  // // Check if nation has enough resources
  // if (nation.resources.steel < totalSteelCost || nation.resources.oil < totalOilCost || nation.resources.food < totalFoodCost) {
  //   return interaction.reply(
  //     `🚫 Not enough resources to deploy **${totalDeployed} ${unitType}**.\n` +
  //     `Required: ${totalSteelCost} steel, ${totalOilCost} oil, ${totalFoodCost} food\n` +
  //     `Current: ${nation.resources.steel} steel, ${nation.resources.oil} oil, ${nation.resources.food} food`
  //   );
  // }

  // // Deduct resources
  // nation.resources.steel -= totalSteelCost;
  // nation.resources.oil   -= totalOilCost;
  // nation.resources.food  -= totalFoodCost;

  // let costMsg = "";
  // if (totalSteelCost > 0) costMsg += `🔩 -${totalSteelCost} Steel `;
  // if (totalOilCost > 0)   costMsg += `🛢️ -${totalOilCost} Oil `;
  // if (totalFoodCost > 0)  costMsg += `🍞 -${totalFoodCost} Food `;

  let costMsg = "";
  let totalDeployed = 0;
  console.log(`Base deployed ${unitType}: ${totalDeployed}`);

  // Special cap for troops based on population
  if (unitType === "troops") {
    totalDeployed = getResourceYield(player.exp.military, militaryTiers, nation, unitType, []);
    // Population bonus: +2 support for every POPULATION_PER_CITY in the nation
    const populationBonus = Math.floor(nation.population / POPULATION_PER_CITY) * 2;

    totalDeployed = totalDeployed + populationBonus;
    
    if (nation.military.troops + totalDeployed > nation.population) {
      totalDeployed = nation.population - nation.military.troops;
    }
    if (totalDeployed <= 0) {
      return interaction.reply(`🚫 The number of troops cannot exceed your population (**${nation.population}**). You need more food to increase your population`);
    }

    const res = deductResourcesForDeployment(nation, unitType, totalDeployed);
    if (!res.success) {
      return interaction.reply(res.message);
    }

    nation.military.troops += totalDeployed;
    costMsg = res.costMsg;
  }

  if (unitType === "tanks") {
    totalDeployed = getResourceYield(player.exp.military, militaryTiers, nation, unitType, [], 0);
    const res = deductResourcesForDeployment(nation, unitType, totalDeployed);
    if (!res.success) {
      return interaction.reply(res.message);
    }
  
    nation.military.tanks += totalDeployed;
    costMsg = res.costMsg;
    console.log("Deployed tanks, total now:", nation.military.tanks);
  }

  if (unitType === "jets") {
    totalDeployed = getResourceYield(player.exp.military, militaryTiers, nation, unitType, [], 0);
    const res = deductResourcesForDeployment(nation, unitType, totalDeployed);
    if (!res.success) {
      return interaction.reply(res.message);
    }
  
    nation.military.jets += totalDeployed;
    costMsg = res.costMsg;
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

function deductResourcesForDeployment(nation, unitType, totalDeployed) {
  const cost = DEPLOY_COSTS[unitType.toUpperCase()];
  const totalSteelCost = cost.steel * totalDeployed;
  const totalOilCost   = cost.oil * totalDeployed;
  const totalFoodCost  = cost.food * totalDeployed;

  // Check if nation has enough resources
  if (nation.resources.steel < totalSteelCost ||
      nation.resources.oil   < totalOilCost   ||
      nation.resources.food  < totalFoodCost) {
    return { success: false, message:
      `🚫 Not enough resources to deploy **${totalDeployed} ${unitType}**.\n` +
      `Required: ${totalSteelCost} steel, ${totalOilCost} oil, ${totalFoodCost} food\n` +
      `Current: ${nation.resources.steel} steel, ${nation.resources.oil} oil, ${nation.resources.food} food`
    };
  }

  // Deduct resources
  nation.resources.steel -= totalSteelCost;
  nation.resources.oil   -= totalOilCost;
  nation.resources.food  -= totalFoodCost;

  let costMsg = "";
  if (totalSteelCost > 0) costMsg += `🔩 -${totalSteelCost} Steel `;
  if (totalOilCost > 0)   costMsg += `🛢️ -${totalOilCost} Oil `;
  if (totalFoodCost > 0)  costMsg += `🍞 -${totalFoodCost} Food `;

  return { success: true, costMsg };
}

