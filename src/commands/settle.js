// settle.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import Tile from "../models/Tile.js";
import { canUseResourceCommand, setResourceCooldown, grantExp } from "../utils/gameUtils.js";
import { POPULATION_PER_CITY, EXP_GAIN, BUILDINGS } from "../utils/constants.js";

export const data = new SlashCommandBuilder()
  .setName("settle")
  .setDescription("Settle a new city in your nation.")
  .addStringOption(option =>
    option
      .setName("tile")
      .setDescription("The ID of the tile to settle")
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName("name")
      .setDescription("The name of your new city")
      .setRequired(true)
  );

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` this nation before you can settle new land.");
  }

  if (!(await canUseResourceCommand(player, "settle"))) {
    return interaction.reply("⏳ You’re still recovering from your last expedition. Try again later.");
  }

  const politicalRole = interaction.guild.roles.cache.find(r => r.name === "Political Leader");
  const hasDiscordRole = politicalRole && interaction.member.roles.cache.has(politicalRole.id);
  
  const isInternalChiefScout = nation.leadership.chiefScout.userId === interaction.user.id;
  
  if (!hasDiscordRole && !isInternalChiefScout) {
    return interaction.reply("🚫 Only the **Chief Scout** or someone with the Political Leader role may settle a new city.");
  }

  const tileId = interaction.options.getString("tile");
  const cityName = interaction.options.getString("name");
  const cityCost = BUILDINGS.CITY.cost;

  // Resource check
  if (nation.resources.gold < cityCost.gold || nation.resources.steel < cityCost.steel) {
    return interaction.reply(
      `🚫 Your nation does not have enough resources to settle a new city.\n` +
      `Required: **${cityCost.gold} gold, ${cityCost.steel} steel**\n` +
      `Current: **${nation.resources.gold} gold, ${nation.resources.steel} steel**`
    );
  }

  const tile = await Tile.findOne({ tileId });
  if (!tile) {
    return interaction.reply("❌ That tile does not exist. Please provide a valid tile ID.");
  }

  if (!tile.surveyedBy.includes(nation.serverId)) {
    return interaction.reply("🚫 Your nation has not surveyed this land yet. You can only settle land that has been surveyed.");
  }
  
  if (tile.city.exists) {
    return interaction.reply("🚫 This tile already has a city on it.");
  }

  const requiredPop = (nation.buildings.city + 1) * POPULATION_PER_CITY;
  if (nation.population < requiredPop) {
    return interaction.reply(
      `🚫 Your nation’s population is too small to settle a new city.\n` +
      `👥 Current population: **${nation.population}**, required: **${requiredPop}**.`
    );
  }

  // --- Settle the city ---
  tile.city.exists = true;
  tile.city.name = cityName;
  tile.city.owner = nation.serverId;
  tile.city.foundedAt = new Date();
  await tile.save();

  nation.buildings.city += 1;
  nation.resources.gold -= cityCost.gold;
  nation.resources.steel -= cityCost.steel;
  await nation.save();
  await setResourceCooldown(player, "settle");
  await player.save();

  // --- Notify surveyed nations ---
  if (tile.surveyedBy.length > 0) {
    for (const surveyedServerId of tile.surveyedBy) {
      if (surveyedServerId === nation.serverId) continue; // skip self

      try {
        const guild = await interaction.client.guilds.fetch(surveyedServerId);
        const channel = guild.channels.cache
          .filter(c => c.isTextBased() && c.permissionsFor(guild.members.me).has("SendMessages"))
          .first();

        if (channel) {
          await channel.send(
            `📰 Breaking News!: A new city **${cityName}** has been settled on a tile you previously surveyed!`
          );
        }
      } catch (err) {
        console.warn(`Could not notify guild ${surveyedServerId}:`, err.message);
      }
    }
  }
           
  const rankUpMsg = await grantExp(player, "scout", EXP_GAIN.SCOUT, nation);

  let reply = `🏙️ You have successfully settled the city of **${cityName}** on tile **${tileId}**!\n` +
  `🌆 Total cities: **${nation.buildings.city}**\n` +
  `👥 Population: **${nation.population}**` +
  `+${EXP_GAIN.SCOUT} Scout EXP (Current: ${player.exp.scout})`;
  if (rankUpMsg) reply += `\n${rankUpMsg}`;

  await interaction.reply(reply);
}
