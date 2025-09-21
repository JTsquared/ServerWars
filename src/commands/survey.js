// survey.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import Tile from "../models/Tile.js";
import { saveUser } from "../data/userData.js";
import { saveNation } from "../data/nationData.js";
import { canUseResourceCommand, setResourceCooldown, grantExp } from "../utils/gameUtils.js";
import { WORLD_TILES, EXP_GAIN } from "../utils/constants.js";

export const data = new SlashCommandBuilder()
  .setName("survey")
  .setDescription("Survey unexplored tiles for your nation.");

export async function execute(interaction) {
  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` your nation before surveying!");
  }

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  // Cooldown check
  if (!(await canUseResourceCommand(player, "survey"))) {
    return interaction.reply("⏳ You’re still recovering from your last expedition. Try again later.");
  }

  // Determine unsurveyed tiles
  const surveyedTileIds = await Tile.find({ surveyedBy: nation.serverId }).distinct("tileId");
  const unsurveyedCount = nation.tilesDiscovered - surveyedTileIds.length;

  if (unsurveyedCount <= 0) {
    return interaction.reply("🚫 Your nation has no land tiles left to survey. use the /explore command to discover more land");
  }

  // Determine available tileIds to survey
  const existingTileIds = await Tile.distinct("tileId");
  const availableIds = [];
  for (let i = 1; i <= WORLD_TILES; i++) {
    if (!existingTileIds.includes(i)) availableIds.push(i);
  }

  if (availableIds.length === 0) {
    return interaction.reply("🚫 All tiles in the world have already been surveyed!");
  }

  // Pick a random tileId from available
  const tileId = availableIds[Math.floor(Math.random() * availableIds.length)];

  // Generate tile properties
  let fertilityBase = Math.random() < 0.25 ? 0 : 1; 
  console.log('fertilityBase: ' + fertilityBase);
  let extraResource = Math.random() < 0.2; // 20% chance for extra resources
  const tile = new Tile({
    tileId,
    resources: {
      fertility: fertilityBase + (extraResource ? Math.floor(Math.random() * 4) : 0),
      steel: extraResource ? Math.floor(Math.random() * 5) : 0,
      gold: extraResource ? Math.floor(Math.random() * 5) : 0,
      oil: extraResource ? Math.floor(Math.random() * 5) : 0,
    },
    surveyedBy: [nation.serverId],
    city: { exists: false },
  });

  await tile.save();

  const rankUpMsg = await grantExp(player, "scout", EXP_GAIN.SCOUT, nation);
  await setResourceCooldown(player, "survey");
  await Promise.all([saveUser(player), saveNation(nation)]);

  const remainingUnsurveyed = unsurveyedCount > 0 ? unsurveyedCount - 1 : 0;

  let reply = `🧭 Your nation surveyed a new tile!` +
  `\nTile ID: **${tileId}**\n` +  
  `Tile resources: Food: ${tile.resources.fertility}, Steel: ${tile.resources.steel}, Gold: ${tile.resources.gold}, Oil: ${tile.resources.oil}` +
  `\nUnsurveyed tiles remaining: **${remainingUnsurveyed}**` +
  `\n+${EXP_GAIN.SCOUT} Scout EXP (Current: ${player.exp.scout})`;
  if (rankUpMsg) reply += `\n${rankUpMsg}`;
  
  await interaction.reply(reply);
}
