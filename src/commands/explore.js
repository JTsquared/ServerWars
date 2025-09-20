// explore.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import Tile from "../models/Tile.js"; // <- you forgot to import in your snippet
import {
  canUseResourceCommand,
  setResourceCooldown,
  grantExp
} from "../utils/gameUtils.js";
import { EXP_GAIN, WORLD_TILES } from "../utils/constants.js";

// const WORLD_TILES = parseInt(process.env.WORLD_TILES || "1000", 10);
const SCOUT_EXP_GAIN = 15;

export const data = new SlashCommandBuilder()
  .setName("explore")
  .setDescription("Explore new lands for your nation.");

export async function execute(interaction) {
  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` your server’s campaign before exploring!");
  }

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) return interaction.reply("❌ Your nation does not exist. Use `/join` first.");

  if (!canUseResourceCommand(player)) {
    return interaction.reply({
      content: "⏳ You must wait before using another resource command.",
      ephemeral: true,
    });
  }

  // Increment discovered tiles
  nation.tilesDiscovered = (nation.tilesDiscovered || 0) + 1;
  const percent = ((nation.tilesDiscovered / WORLD_TILES) * 100).toFixed(2);

  // Remaining tiles
  const tilesRemaining = Math.max(0, WORLD_TILES - nation.tilesDiscovered);

  // Find nations not yet discovered by this nation
  const discoveredIds = nation.discoveredNations.map(d => d.serverId);
  const undiscoveredNations = await Nation.find({
    serverId: { $ne: nation.serverId },
    serverId: { $nin: discoveredIds }
  });
  const numUndiscovered = undiscoveredNations.length;

  // Calculate chance to discover a nation
  let baseChance = 0.02; // 2%
  let nationFactor = Math.min(0.15, 0.01 * numUndiscovered); // +1% per undiscovered nation up to 15%
  let tileFactor = (nation.tilesDiscovered / WORLD_TILES) * 0.1; // up to +10%
  let formulaChance = baseChance + nationFactor + tileFactor;

  // Fair chance so discoveries can't "run out of room"
  let fairChance = tilesRemaining > 0 ? numUndiscovered / tilesRemaining : 1;
  let totalChance = Math.min(1, Math.max(formulaChance, fairChance));

  // Event roll
  let eventMsg = "";
  const roll = Math.random();

  if (roll < 0.1) {
    // Treasure (10% flat for now)
    const goldFound = Math.floor(Math.random() * 50) + 10;
    nation.resources.gold = (nation.resources.gold || 0) + goldFound;
    eventMsg = `💰 You discovered treasure and gained **${goldFound} gold**!`;

  } else if (roll < 0.1 + totalChance && numUndiscovered > 0) {
    // Weighted selection among undiscovered nations
    const weighted = [];
    for (const other of undiscoveredNations) {
      const weight = (other.buildings?.city || 1) + (other.playerCount || 1);
      for (let i = 0; i < weight; i++) weighted.push(other);
    }

    const otherNation = weighted[Math.floor(Math.random() * weighted.length)];

    // Pick one of their settled city tiles
    const candidateTiles = await Tile.find({
      "city.owner": otherNation.serverId,
      "city.exists": true
    });

    let cityMsg = "";
    if (candidateTiles.length > 0) {
      const randomTile = candidateTiles[Math.floor(Math.random() * candidateTiles.length)];

      // Ensure this tile is now marked surveyed by your nation
      if (!randomTile.surveyedBy.includes(nation.serverId)) {
        randomTile.surveyedBy.push(nation.serverId);
        await randomTile.save();
      }

      cityMsg = `the city of **${randomTile.city.name}**`;
    }

    nation.discoveredNations.push({
      serverId: otherNation.serverId,
      name: otherNation.name
    });

    eventMsg = `🏴 You have discovered ${cityMsg || "a settlement"} from the nation of **${otherNation.name}**!`;
  }

  const rankUpMsg = await grantExp(player, "scout", EXP_GAIN.SCOUT, nation);
  setResourceCooldown(player);
  console.log("/explore nation.steel", nation.resources.steel);
  await Promise.all([player.save(), nation.save()]);

  // Reply
  let reply = `🧭 You explored a new tile!  
  Discovered: **${nation.tilesDiscovered}/${WORLD_TILES}** (${percent}%)`;
  if (eventMsg) reply += `\n${eventMsg}`;
  reply += `\n+${EXP_GAIN.SCOUT} Scout EXP (Current: ${player.exp.scout})`;
  if (rankUpMsg) reply += `\n${rankUpMsg}`;

  await interaction.reply(reply);
}
