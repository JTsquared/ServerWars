// hack.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import Tile from "../models/Tile.js";
import Intel from "../models/Intel.js";
import {
  grantExp,
  setResourceCooldown,
  getNationalCooldownTime,
  setNationCooldown,
  canUseResourceCommand
} from "../utils/gameUtils.js";
import { EXP_GAIN } from "../utils/constants.js";
import { HACK_DURATION_MS, HACK_SUCCESS_CHANCE, HACK_ALERT_THRESHOLD } from "../utils/constants.js";

export const data = new SlashCommandBuilder()
  .setName("hack")
  .setDescription("Attempt to disable the bank gold bonus of a rival nation for 24 hours.")
  .addStringOption(option =>
    option
      .setName("tile_id")
      .setDescription("ID of the tile that contains the target city's tile (must be surveyed).")
      .setRequired(true)
  );

export async function execute(interaction) {
  // basic lookups
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) return interaction.reply("⚠️ You must `/join` this nation before attempting hacks.");

  const tileId = interaction.options.getString("tile_id");
  const tile = await Tile.findOne({ tileId });
  if (!tile || !tile.city.exists) {
    return interaction.reply("🚫 That tile has no city to hack.");
  }
  if (!tile.surveyedBy.includes(nation.serverId)) {
    return interaction.reply("🚫 You cannot hack a city your nation hasn't surveyed.");
  }
  if (tile.city.owner === nation.serverId) {
    return interaction.reply("❌ You cannot hack your own city.");
  }

  const targetNation = await Nation.findOne({ serverId: tile.city.owner });
  if (!targetNation) return interaction.reply("❌ Target nation not found.");

  // intel record for this pair (create/lookup)
  let intel = await Intel.findOne({
    spyingNationId: nation.serverId,
    targetNationId: targetNation.serverId
  });

if (!canUseResourceCommand(player)) {
    return interaction.reply({
    content: "⏳ You must wait before using another resource command.",
    ephemeral: true,
    });
}

  // cooldown config
  const hackCooldownMs = parseInt(process.env.HACK_COOLDOWN_MS || "14400000", 10);
  const secondsLeft = getNationalCooldownTime(nation, "hack", hackCooldownMs);
  if (secondsLeft > 0) {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    return interaction.reply({
      content: `⏳ Your nation must wait ${hours}h ${minutes}m ${seconds}s before attempting another hack.`,
      ephemeral: true
    });
  }

  // success chance & hack duration
  const successChance = parseFloat(HACK_SUCCESS_CHANCE || .20);
  console.log("HACK_SUCCESS_CHANCE", successChance);
  const hackDurationMs = parseInt(HACK_DURATION_MS || "14400000", 10);

  // roll
  const success = Math.random() < successChance;

  // give player XP, set player cooldown and nation cooldown
  const rankUpMsg = await grantExp(player, "diplomat", EXP_GAIN.DIPLOMAT, nation);
  await setResourceCooldown(player);
  setNationCooldown(nation, "hack");

  if (success) {
    // ensure intel exists (preserve knownCities)
    if (!intel) {
      intel = new Intel({
        spyingNationId: nation.serverId,
        targetNationId: targetNation.serverId,
        nationName: targetNation.name,
        knownCities: []
      });
    }

    // reset hack counter/timestamp
    intel.failedAttemptsHack = 0;
    intel.lastAttemptedAtHack = new Date();

    // Persist hack state on the target nation:
    // create a 'hacks' object if not present and set bankDisabledUntil
    targetNation.hacks = targetNation.hacks || {};
    targetNation.hacks.bankDisabledUntil = new Date(Date.now() + hackDurationMs);

    await Promise.all([player.save(), nation.save(), intel.save(), targetNation.save()]);

    // Build response embed
    const embed = new EmbedBuilder()
      .setTitle(`💻 Hack Success — ${tile.city.name} (${targetNation.name})`)
      .setDescription(`Your operatives successfully disabled **bank gold boosts** for **${targetNation.name}** for **${Math.round(hackDurationMs/3600000)} hours**.`)
      .addFields(
        { name: "🎯 Chance", value: `${Math.round(successChance * 100)}%`, inline: true },
        { name: "⏱️ Expires at", value: targetNation.hacks.bankDisabledUntil.toISOString(), inline: true },
        { name: "⏱️ Timestamp", value: (intel.lastAttemptedAtHack || new Date()).toISOString(), inline: true }
      )
      .setColor("Green");

    if (rankUpMsg) embed.addFields({ name: "XP", value: `${rankUpMsg}`, inline: false });

    await interaction.reply({ embeds: [embed] });

    const targetGuild = interaction.client.guilds.cache.get(targetNation.serverId);
    if (targetGuild) {
      const notifyChannel = targetGuild.channels.cache.find(
        ch => ch.isTextBased() && ch.permissionsFor(targetGuild.members.me).has("SendMessages")
      );
      if (notifyChannel) {
        notifyChannel.send(`🚨 An unknown nation has hacked your banking system. Gold boosts from banks have been disabled for ${HACK_DURATION_MS} hours`);
      }
    }

    return;
  } else {
    // failure: increment hack-specific attempts and save
    if (!intel) {
      intel = new Intel({
        spyingNationId: nation.serverId,
        targetNationId: targetNation.serverId,
        nationName: targetNation.name,
        knownCities: [],
        failedAttemptsHack: 0,
        lastAttemptedAtHack: null
      });
    }

    intel.failedAttemptsHack = (intel.failedAttemptsHack || 0) + 1;
    intel.lastAttemptedAtHack = new Date();

    // notify target if threshold reached (4)
    if ((intel.failedAttemptsHack || 0) >= HACK_ALERT_THRESHOLD) {
      const targetGuild = interaction.client.guilds.cache.get(targetNation.serverId);
      if (targetGuild) {
        const notifyChannel = targetGuild.channels.cache.find(
          ch => ch.isTextBased() && ch.permissionsFor(targetGuild.members.me).has("SendMessages")
        );
        if (notifyChannel) {
          notifyChannel.send(`🚨 Our defenses have detected repeated hack attempts from **${nation.name}**!`);
        }
      }

      intel.failedAttemptsHack = 0;
    }

    await Promise.all([player.save(), nation.save(), intel.save(), targetNation.save()]);

    const embed = new EmbedBuilder()
      .setTitle(`💻 Hack Failed — ${tile.city.name} (${targetNation.name})`)
      .setDescription(`Your operatives failed to disable bank boosts on **${targetNation.name}**.`)
      .addFields(
        { name: "Attempts", value: `${intel.failedAttemptsHack || 0} / ${HACK_ALERT_THRESHOLD}`, inline: true },
        { name: "🎯 Chance", value: `${Math.round(successChance * 100)}%`, inline: true },
        { name: "⏱️ Last Attempt", value: intel.lastAttemptedAtHack ? intel.lastAttemptedAtHack.toISOString() : "N/A", inline: true }
      )
      .setColor("Red");

    await interaction.reply({ embeds: [embed] });
    return;
  }
}
