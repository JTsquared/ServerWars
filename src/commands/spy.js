// spy.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import Tile from "../models/Tile.js";
import Intel from "../models/Intel.js";
import {
  SPY_COOLDOWN_MS,
  SPY_SUCCESS_CHANCE,
  EXP_GAIN
} from "../utils/constants.js";
import { grantExp, setResourceCooldown, getNationalCooldownTime, setNationCooldown } from "../utils/gameUtils.js";

export const data = new SlashCommandBuilder()
  .setName("spy")
  .setDescription("Send spies to gather intel on a rival city.")
  .addStringOption(option =>
    option.setName("tile_id")
      .setDescription("The ID of the tile containing the target city.")
      .setRequired(true)
  );

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` this nation before you can send spies.");
  }

  const tileId = interaction.options.getString("tile_id");
  const tile = await Tile.findOne({ tileId });
  if (!tile || !tile.city.exists) {
    return interaction.reply("🚫 That tile has no city to spy on.");
  }
  if (!tile.surveyedBy.includes(nation.serverId)) {
    return interaction.reply("🚫 You cannot spy on a city your nation has not discovered.");
  }

  const targetNation = await Nation.findOne({ serverId: tile.city.owner });
  if (!targetNation) {
    return interaction.reply("❌ Target nation not found.");
  }

  // Look up intel record for this pair
  let intel = await Intel.findOne({
    spyingNationId: nation.serverId,
    targetNationId: targetNation.serverId
  });

  const spy_cooldown = parseInt(process.env.SPY_COOLDOWN_MS || "14400000", 10);
  const secondsLeft = getNationalCooldownTime(nation, "spy", spy_cooldown);
  if (secondsLeft > 0) {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60); // ⬅️ Fix here
    const seconds = secondsLeft % 60;
    return interaction.reply({
      content: `⏳ Your nation must wait ${hours} hours, ${minutes} minutes, and ${seconds} seconds before attempting another spy mission.`,
      ephemeral: true,
    });
  }

  // Roll success/failure
  const success = Math.random() < SPY_SUCCESS_CHANCE;

  // Give EXP + cooldown
  const rankUpMsg = await grantExp(player, "diplomat", EXP_GAIN.DIPLOMAT, nation);
  setResourceCooldown(player);
  setNationCooldown(nation, "spy");

  if (success) {
    // Ensure Intel record exists
    if (!intel) {
      intel = new Intel({
        spyingNationId: nation.serverId,
        targetNationId: targetNation.serverId,
        nationName: targetNation.name,
        knownCities: [] // exploration may have populated this earlier
      });
    }

    // Update with full spy info
    intel.nationName = targetNation.name;
    intel.population = targetNation.population;
    intel.playerCount = targetNation.playerCount;
    intel.resources = targetNation.resources;
    intel.military = targetNation.military;
    intel.buildings = targetNation.buildings;
    intel.research = targetNation.research || {};
    intel.failedAttempts = 0;
    intel.lastAttemptedAt = new Date();

    await intel.save();
    await player.save();

    let reply = `🕵️ Your spies successfully infiltrated **${targetNation.name}** and gathered intel!\n` +
                `Use \`/intelreport\` to view the latest reports.\n` +
                `+${EXP_GAIN.DIPLOMAT} Diplomat EXP (Current: ${player.exp.diplomat})`;
    if (rankUpMsg) reply += `\n${rankUpMsg}`;

    return interaction.reply(reply);
  } else {
    // Fail — increment attempts or create record
    if (!intel) {
      intel = new Intel({
        spyingNationId: nation.serverId,
        targetNationId: targetNation.serverId,
        nationName: targetNation.name,
        knownCities: [],
        failedAttempts: 0
      });
    }

    intel.failedAttempts = (intel.failedAttempts || 0) + 1;
    intel.lastAttemptedAt = new Date();
    await intel.save();

    // If 4 fails, notify target & reset
    if (intel.failedAttempts >= 4) {
      const targetGuild = interaction.client.guilds.cache.get(targetNation.serverId);
      if (targetGuild) {
        const notifyChannel = targetGuild.channels.cache.find(
          ch => ch.isTextBased() && ch.permissionsFor(targetGuild.members.me).has("SendMessages")
        );
        if (notifyChannel) {
          notifyChannel.send(`🚨 Our defenses have detected repeated spy attempts from **${nation.name}**!`);
        }
      }

      intel.failedAttempts = 0;
      await intel.save();
    }

    await Promise.all([player.save(), nation.save()]);

    let reply = `🕵️ Your spies failed to gather any useful information. Be careful, too many failed attempts will alert **${targetNation.name}**.\n` +
                `+${EXP_GAIN.DIPLOMAT} Diplomat EXP (Current: ${player.exp.diplomat})`;
    if (rankUpMsg) reply += `\n${rankUpMsg}`;

    return interaction.reply(reply);
  }
}
