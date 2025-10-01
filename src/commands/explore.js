// explore.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import Tile from "../models/Tile.js";
import {
  canUseResourceCommand,
  setResourceCooldown,
  grantExp
} from "../utils/gameUtils.js";
import { EXP_GAIN, WORLD_TILES } from "../utils/constants.js";
import Intel from "../models/Intel.js";
import { checkWorldEvents } from "../utils/worldEvents.js";

const SCOUT_EXP_GAIN = 15;

export const data = new SlashCommandBuilder()
  .setName("explore")
  .setDescription("Explore new lands for your nation.");

export async function execute(interaction) {

  await checkWorldEvents();

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

  const tilesRemaining = Math.max(0, WORLD_TILES - nation.tilesDiscovered);

  // Track already discovered cities
  const discoveredCityKeys = new Set(
    (nation.discoveredCities || []).map(dc => `${dc.serverId}:${dc.cityName}`)
  );

  // All cities in the world (excluding your own)
  const allCities = await Tile.find({ "city.exists": true, "city.owner": { $ne: nation.serverId } });

  // Filter out cities already discovered
  const undiscoveredCities = allCities.filter(tile => {
    const key = `${tile.city.owner}:${tile.city.name}`;
    return !discoveredCityKeys.has(key);
  });

  const totalCitiesRemaining = undiscoveredCities.length;

  // Calculate discovery chance
  let discoveryChance = 0;
  if (tilesRemaining > 0 && totalCitiesRemaining > 0) {
    discoveryChance = totalCitiesRemaining / tilesRemaining;
  } else if (totalCitiesRemaining > 0 && tilesRemaining === 0) {
    discoveryChance = 1; // edge case safety
  }

  // Event roll
  let eventMsg = "";
  const roll = Math.random();

  if (roll < 0.1) {
    // Treasure event
    const goldFound = Math.floor(Math.random() * 50) + 10;
    nation.resources.gold = (nation.resources.gold || 0) + goldFound;
    eventMsg = `💰 You discovered treasure and gained **${goldFound} gold**!`;

  } else if (roll < 0.1 + discoveryChance && totalCitiesRemaining > 0) {
    // Weighted selection of nation
    const nations = await Nation.find({ serverId: { $ne: nation.serverId } });
    const weighted = [];
    for (const other of nations) {
      const weight = (other.population || 1) + (other.playerCount || 1);
      for (let i = 0; i < weight; i++) weighted.push(other);
    }
    const otherNation = weighted[Math.floor(Math.random() * weighted.length)];

    // Pick one undiscovered city from this nation
    const candidateCities = undiscoveredCities.filter(
      t => t.city.owner === otherNation.serverId
    );
    if (candidateCities.length > 0) {
      const randomTile = candidateCities[Math.floor(Math.random() * candidateCities.length)];

      // Mark tile surveyed
      if (!randomTile.surveyedBy.includes(nation.serverId)) {
        randomTile.surveyedBy.push(nation.serverId);
        await randomTile.save();
      }

      // Record discovery
      nation.discoveredCities = nation.discoveredCities || [];
      nation.discoveredCities.push({
        serverId: otherNation.serverId,
        name: otherNation.name,
        cityName: randomTile.city.name,
        tileId: randomTile.tileId
      });

      let intel = await Intel.findOne({
        spyingNationId: nation.serverId,
        targetNationId: otherNation.serverId
      });
  
      if (!intel) {
        intel = new Intel({
          spyingNationId: nation.serverId,
          targetNationId: otherNation.serverId,
          nationName: otherNation.name,
          knownCities: [{ tileId: randomTile.tileId, name: randomTile.city.name }]
        });
      } else {
        // Only add if city not already known
        if (!intel.knownCities.some(c => c.tileId === randomTile.tileId)) {
          intel.knownCities.push({
            tileId: randomTile.tileId,
            name: randomTile.city.name
          });
        }
      }
  
      await intel.save();

      eventMsg = `🏳️ You discovered the city of **${randomTile.city.name}** from the nation of **${otherNation.name}**!`;
    }
  }

  const rankUpMsg = await grantExp(player, "scout", EXP_GAIN.SCOUT, nation);
  setResourceCooldown(player);
  await Promise.all([player.save(), nation.save()]);

  // Reply
  let reply = `🧭 You explored a new tile!  
  Discovered: **${nation.tilesDiscovered}/${WORLD_TILES}** (${percent}%)`;
  if (eventMsg) reply += `\n${eventMsg}`;
  reply += `\n+${EXP_GAIN.SCOUT} Scout EXP (Current: ${player.exp.scout})`;
  if (rankUpMsg) reply += `\n${rankUpMsg}`;

  await interaction.reply(reply);
}
