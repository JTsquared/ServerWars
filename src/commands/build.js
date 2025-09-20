import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import { canUseResourceCommand, setResourceCooldown, grantExp } from "../utils/gameUtils.js";
import { economistTiers } from "../data/tiers.js";
import { EXP_GAIN, BUILDINGS } from "../utils/constants.js";
import { saveUser } from "../data/userData.js";
import { saveNation } from "../data/nationData.js";

export const data = new SlashCommandBuilder()
  .setName("build")
  .setDescription("Construct a building for your nation (costs resources, gives Economist EXP).")
  .addStringOption(option =>
    option
      .setName("type")
      .setDescription("Type of building to construct")
      .setRequired(true)
      .addChoices(
        ...Object.keys(BUILDINGS).map(key => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value: key,
        }))
      )
  );

export async function execute(interaction) {
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

  // Research requirement check
  if (building.requiresResearch) {
    const required = building.requiresResearch.toLowerCase();
    if (!nation.research[required]) {
      return interaction.reply(`🔬 You must complete **${building.requiresResearch}** research before building a **${buildingType}**.`);
    }
  }

  // Resource check (gold + steel)
  if (
    nation.resources.gold < building.cost.gold ||
    nation.resources.steel < building.cost.steel
  ) {
    return interaction.reply(
      `💰 Not enough resources to build a **${buildingType}**.\n` +
      `Required: ${building.cost.gold} gold, ${building.cost.steel} steel\n` +
      `Current: ${nation.resources.gold} gold, ${nation.resources.steel} steel`
    );
  }

  // Deduct resources and add building
  nation.resources.gold -= building.cost.gold;
  nation.resources.steel -= building.cost.steel;
  nation.buildings[buildingType] = (nation.buildings[buildingType] || 0) + 1;

  // Gain economist EXP
  const rankUpMsg = await grantExp(player, "economist", EXP_GAIN.ECONOMIST, nation);

  // Apply cooldown
  setResourceCooldown(player);

  console.log("/build nation.steel", nation.resources.steel);
  await Promise.all([saveUser(player), saveNation(nation)]);

  // Reply
  let reply = `🏗️ You constructed a new **${buildingType}**!\n` +
              `🏛️ Total ${buildingType}s: **${nation.buildings[buildingType]}**\n` +
              `💰 Gold remaining: **${nation.resources.gold}**, Steel remaining: **${nation.resources.steel}**\n` +
              `+${EXP_GAIN.ECONOMIST} Economist EXP (Current: ${player.exp.economist})`;

  if (rankUpMsg) reply += `\n${rankUpMsg}`;

  await interaction.reply(reply);
}
