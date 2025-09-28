// sabotage.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import Tile from "../models/Tile.js";
import Intel from "../models/Intel.js";
import {
  SABOTAGE_SUCCESS_CHANCE,
  EXP_GAIN
} from "../utils/constants.js";
import {
  grantExp,
  setResourceCooldown,
  getNationalCooldownTime,
  setNationCooldown
} from "../utils/gameUtils.js";

/**
 * Helper: remove military power from a nation using greedy "change" approach.
 * Returns an object describing losses { troops, tanks, jets }.
 * Mutates nation.military to subtract lost units.
 */
function applyMilitaryLossesGreedy(nation, lossPower) {
  const unitValues = { jets: 10, tanks: 5, troops: 1 };
  const losses = { jets: 0, tanks: 0, troops: 0 };
  let remaining = Math.max(0, Math.floor(lossPower));

  // debug
  console.log(`[sabotage] applyMilitaryLossesGreedy lossPower: ${lossPower}`);

  for (const unitKey of ["jets", "tanks", "troops"]) {
    const available = nation.military[unitKey] || 0;
    if (available <= 0) continue;
    const value = unitValues[unitKey];
    const needed = Math.floor(remaining / value);
    if (needed <= 0) continue;
    const remove = Math.min(available, needed);
    nation.military[unitKey] = Math.max(0, (nation.military[unitKey] || 0) - remove);
    losses[unitKey] += remove;
    remaining -= remove * value;
    if (remaining <= 0) break;
  }

  // If remainder still > 0, consume cheapest units (troops) if available
  if (remaining > 0 && (nation.military.troops || 0) > 0) {
    const remove = Math.min(nation.military.troops, remaining);
    nation.military.troops -= remove;
    losses.troops += remove;
    remaining -= remove;
  }

  console.log(`[sabotage] applied losses:`, losses, `unmetPower: ${remaining}`);
  return losses;
}

export const data = new SlashCommandBuilder()
  .setName("sabotage")
  .setDescription("Attempt to sabotage (steal resources and weaken) a rival city.")
  .addStringOption(option =>
    option
      .setName("tile_id")
      .setDescription("ID of the tile that contains the target city (must be surveyed).")
      .setRequired(true)
  );

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) return interaction.reply("⚠️ You must `/join` this nation before using sabotage.");

  const tileId = interaction.options.getString("tile_id");
  const tile = await Tile.findOne({ tileId });
  if (!tile || !tile.city.exists) {
    return interaction.reply("🚫 That tile has no city to sabotage.");
  }
  if (!tile.surveyedBy.includes(nation.serverId)) {
    return interaction.reply("🚫 You cannot sabotage a city your nation hasn't surveyed.");
  }
  if (tile.city.owner === nation.serverId) {
    return interaction.reply("❌ You cannot sabotage your own city.");
  }

  const targetNation = await Nation.findOne({ serverId: tile.city.owner });
  if (!targetNation) return interaction.reply("❌ Target nation not found.");

  // intel record for this scouting/sabotage pair
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

  // Cooldown check (use SABOTAGE_COOLDOWN_MS if set, otherwise fallback to SPY_COOLDOWN_MS)
  const sabotageCooldownMs = parseInt(process.env.SABOTAGE_COOLDOWN_MS || 1000 * 60 * 60);
  const secondsLeft = getNationalCooldownTime(nation, "sabotage", sabotageCooldownMs);
  if (secondsLeft > 0) {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    return interaction.reply({
      content: `⏳ Your nation must wait ${hours}h ${minutes}m ${seconds}s before attempting sabotage again.`,
      ephemeral: true
    });
  }

  // Roll success/failure (reuse SPY_SUCCESS_CHANCE; change if you want a separate constant)
  const successChance = parseFloat(SABOTAGE_SUCCESS_CHANCE || .25 );
  const success = Math.random() < successChance;

  // Give EXP and set player cooldown (same pattern as spy)
  const rankUpMsg = await grantExp(player, "diplomat", EXP_GAIN.DIPLOMAT, nation);
  await setResourceCooldown(player);
  setNationCooldown(nation, "sabotage");

  if (success) {
    if (!intel) {
      intel = new Intel({
        spyingNationId: nation.serverId,
        targetNationId: targetNation.serverId,
        nationName: targetNation.name,
        knownCities: [],
        failedAttemptsSabotage: 0,
        lastAttemptedAtSabotage: null
      });
    }

    // reset failed attempts & stamp attempt time
    intel.failedAttemptsSabotage = 0;
    intel.lastAttemptedAtSabotage = new Date();

    // Determine number of cities (avoid zero)
    const cityCount = Math.max(1, (targetNation.buildings.city || 1));

    // Resource theft: for each resource, steal 10% of (resource / cities)
    const resourceKeys = ["gold", "steel", "food", "oil"];
    const resourceLosses = {};
    for (const k of resourceKeys) {
      const total = targetNation.resources?.[k] || 0;
      const loss = Math.floor((total / cityCount) * 0.10);
      resourceLosses[k] = loss;
      // subtract from target, add to attacker (if you prefer to not give to attacker, remove the addition)
      targetNation.resources[k] = Math.max(0, total - loss);
      nation.resources[k] = (nation.resources[k] || 0) + loss;
    }

    // Military losses: remove ~10% of military power
    const targetPower = (Object.entries(targetNation.military || {}).reduce((s, [u,c]) => s + getUnitPower(u) * (c||0), 0));
    const militaryLossPower = Math.max(0, Math.floor(targetPower * 0.10));
    const militaryLosses = applyMilitaryLossesGreedy(targetNation, militaryLossPower);

    // save intel + nations + player + tile (tile unchanged)
    await intel.save();
    await Promise.all([player.save(), nation.save(), targetNation.save()]);

    // Build response embed
    const embed = new EmbedBuilder()
      .setTitle(`🛠️ Sabotage Success — ${tile.city.name} (${targetNation.name})`)
      .setDescription(`Your operatives successfully sabotaged **${tile.city.name}** from **${targetNation.name}**.`)
      .addFields(
        { name: "📦 Resources stolen (per nation)", value:
          `💰 Gold: ${resourceLosses.gold}\n🔩 Steel: ${resourceLosses.steel}\n🍞 Food: ${resourceLosses.food}\n🛢️ Oil: ${resourceLosses.oil}`, inline: true
        },
        { name: "⚔️ Military losses (target)", value: formatUnitLosses(militaryLosses), inline: true },
      )
      .setColor("DarkGreen");

    if (rankUpMsg) embed.addFields({ name: "XP", value: rankUpMsg });

    await interaction.reply({ embeds: [embed] });

    // done success path
    return;
  } else {
    // Failure path: create/update intel and increment failed attempts
    if (!intel) {
      intel = new Intel({
        spyingNationId: nation.serverId,
        targetNationId: targetNation.serverId,
        nationName: targetNation.name,
        knownCities: [],
        failedAttemptsSabotage: 0,
        lastAttemptedAtSabotage: null
      });
    }

    // Failure path: increment sabotage-specific attempts
    intel.failedAttemptsSabotage = (intel.failedAttemptsSabotage || 0) + 1;
    console.log(`[sabotage] failedAttemptsSabotage for ${nation.name} vs ${targetNation.name}: ${intel.failedAttemptsSabotage}`);
    intel.lastAttemptedAtSabotage = new Date();
    await Promise.all([player.save(), nation.save(), intel.save(), targetNation.save()]);

    // If 5 or more failed attempts for sabotage, notify target & reset sabotage counter
    if (intel.failedAttemptsSabotage >= 5) {
      const targetGuild = interaction.client.guilds.cache.get(targetNation.serverId);
      if (targetGuild) {
          const notifyChannel = targetGuild.channels.cache.find(
          ch => ch.isTextBased() && ch.permissionsFor(targetGuild.members.me).has("SendMessages")
          );
          if (notifyChannel) {
          notifyChannel.send(`🚨 Our defenses have detected repeated sabotage attempts from **${nation.name}**!`);
          }
      }

      intel.failedAttemptsSabotage = 0;
      await intel.save();

      const failureNotifyEmbed = new EmbedBuilder()
        .setTitle(`🚨 Oh no! your saboteur has been caught!`)
        .setDescription(`${targetNation.name} has detected your repeated sabotage attempts! Lay low for a while...`)
        .setColor("Red")
        .setTimestamp(new Date());

        await interaction.reply({ embeds: [failureNotifyEmbed] });
      return;
    }


    // reply embed for failure
    const embed = new EmbedBuilder()
      .setTitle(`🛠️ Sabotage Failed — ${tile.city.name} (${targetNation.name})`)
      .setDescription(`Your operatives failed to sabotage **${tile.city.name}**. Be careful, too many failed attempts will alert **${targetNation.name}**.`)
      .addFields(
        { name: "Attempts", value: `${intel.failedAttemptsSabotage} / 5`, inline: true },
        { name: "🎯 Chance", value: `${Math.round(successChance * 100)}%`, inline: true }
      )
      .setColor("DarkRed");

    await interaction.reply({ embeds: [embed] });
    return;
  }
}

/** small helpers for military unit power & formatting (copied to avoid cross-file deps) */
function getUnitPower(unit) {
  switch (unit.toLowerCase()) {
    case "troop":
    case "troops":
      return 1;
    case "tank":
    case "tanks":
      return 5;
    case "jet":
    case "jets":
      return 10;
    default:
      return 1;
  }
}

function formatUnitLosses(losses) {
  const parts = [];
  if ((losses.jets || 0) > 0) parts.push(`${losses.jets} jet${losses.jets > 1 ? "s" : ""}`);
  if ((losses.tanks || 0) > 0) parts.push(`${losses.tanks} tank${losses.tanks > 1 ? "s" : ""}`);
  if ((losses.troops || 0) > 0) parts.push(`${losses.troops} troop${losses.troops > 1 ? "s" : ""}`);
  return parts.length ? parts.join(", ") : "None";
}
