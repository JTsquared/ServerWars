// attack.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import Tile from "../models/Tile.js";
import Intel from "../models/Intel.js";
import GameConfig from "../models/GameConfig.js";
import Truce from "../models/Truce.js";
import {
  getNationalCooldownTime,
  setNationCooldown,
  setResourceCooldown,
  canUseResourceCommand,
  calcNationPower,
  grantExp,
} from "../utils/gameUtils.js";
import { POPULATION_PER_CITY, EXP_GAIN } from "../utils/constants.js";
import { checkWorldEvents } from "../utils/worldEvents.js";
import { getPrizePoolWallet, transferBetweenPrizePools } from "../utils/prizePoolApi.js";

const MIN_MILITARY_POWER_PER_CITY = parseInt(process.env.MIN_MILITARY_POWER_PER_CITY || "100", 10);

function getNationMilitaryThreshold(nation) {
  // note: keep using nation.cities.length as you previously used
  return (nation.buildings.city || 1) * MIN_MILITARY_POWER_PER_CITY;
}

export const data = new SlashCommandBuilder()
  .setName("attack")
  .setDescription("Attack a rival city.")
  .addStringOption(option =>
    option.setName("tile_id")
      .setDescription("The ID of the tile containing the target city.")
      .setRequired(true)
  );

export async function execute(interaction) {

  await checkWorldEvents();

  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) {
    return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
  }

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) {
    return interaction.reply("⚠️ You must `/join` this nation before you can attack.");
  }

  const tileId = interaction.options.getString("tile_id");
  const tile = await Tile.findOne({ tileId });
  if (!tile || !tile.city.exists) {
    return interaction.reply("🚫 That tile has no city to attack.");
  }
  if (!tile.surveyedBy.includes(nation.serverId)) {
    return interaction.reply("🚫 You cannot attack a city your nation hasn’t discovered.");
  }
  if (tile.city.owner === nation.serverId) {
    return interaction.reply("❌ You cannot attack your own city.");
  }

  const targetNation = await Nation.findOne({ serverId: tile.city.owner });
  if (!targetNation) {
    return interaction.reply("❌ Target nation not found.");
  }

  const activeTruce = await Truce.findOne({
    $or: [
      { requesterNationId: nation.serverId, targetNationId: targetNation.serverId },
      { requesterNationId: targetNation.serverId, targetNationId: nation.serverId }
    ],
    status: "accepted",
    endTime: { $gt: new Date() }
  });
  
  if (activeTruce) {
    const remainingMs = activeTruce.endTime.getTime() - Date.now();
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  
    return interaction.reply({
      content: `🚫 You cannot attack **${targetNation.name}** while a truce is in effect. Time remaining: ${hours}h ${minutes}m.`,
      ephemeral: true
    });
  }

  // Nation-level cooldown
  const attackCooldown = parseInt(process.env.ATTACK_COOLDOWN_MS || "86400000", 10);
  const secondsLeft = getNationalCooldownTime(nation, "attack", attackCooldown);
  if (secondsLeft > 0) {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    return interaction.reply({
      content: `⏳ Your nation must wait ${hours}h ${minutes}m ${seconds}s before launching another attack.`,
      ephemeral: true,
    });
  }

  if (!canUseResourceCommand(player)) {
    return interaction.reply({
      content: "⏳ You must wait before using another resource command.",
      ephemeral: true,
    });
  }

  // Ensure attacker above threshold
  const attackerPower = calcNationPower(nation);
  if (attackerPower <= 0 || attackerPower < getNationMilitaryThreshold(nation)) {
    return interaction.reply("⚔️ Your military is too weakened to launch an attack.");
  }

  const rankUpMsg = await grantExp(player, "military", EXP_GAIN.MILITARY, nation);
  const defenderPower = calcNationPower(targetNation);

  // Outcome roll
  const roll = Math.random();
  let outcome = "fail";
  if (roll < 0.45) outcome = "success";
  else if (roll < 0.55) outcome = "neutral";

  // Loss pool (as you defined it)
  const lossPool = Math.floor((Math.floor(Math.random() * 3) + 1) * 0.045 * (attackerPower + defenderPower));
  let attackerLossPower = 0, defenderLossPower = 0;

  if (outcome === "success") {
    attackerLossPower = Math.floor(lossPool * 0.3);
    defenderLossPower = Math.floor(lossPool * 0.7);
  } else if (outcome === "fail") {
    attackerLossPower = Math.floor(lossPool * 0.7); // harsher for attacker
    defenderLossPower = Math.floor(lossPool * 0.3); // lighter for defender
  } else {
    attackerLossPower = defenderLossPower = Math.floor(lossPool * 0.5);
  }

  // Apply unit-based losses (expensive-first) — returns breakdown { troops, tanks, jets }
  const attackerLosses = applyMilitaryLosses(nation, attackerLossPower);
  const defenderLosses = applyMilitaryLosses(targetNation, defenderLossPower);

  // Update peak population for morale tracking (if population has grown)
  if (!targetNation.peakPopulation || targetNation.population > targetNation.peakPopulation) {
    targetNation.peakPopulation = targetNation.population;
  }

  // Collateral damage (success only)
  let popLoss = 0, foodLoss = 0, goldLooted = 0, cityFallen = false;
  if (outcome === "success") {
    const perCityPop = Math.floor(targetNation.population / Math.max(1, (targetNation.buildings.city || 1)));
    const base = (Math.floor(Math.random() * 3) + 1) * 0.025 * perCityPop;

    popLoss = Math.floor(base);
    foodLoss = Math.floor(base);

    targetNation.population = Math.max(0, targetNation.population - popLoss);
    targetNation.resources.food = Math.max(0, (targetNation.resources.food || 0) - foodLoss);
  }

  // Check city fall
//   const perCityPop = Math.floor(targetNation.population / Math.max(1, (targetNation.buildings.city || 1)));
//   if (targetNation.population <= perCityPop * 0.1 || calcNationPower(targetNation) <= 0) {

  //(i.e. 1500 - (500 * .7))
  const targetCityName = tile.city.name;
  const baselinePopRaw = (POPULATION_PER_CITY * (targetNation.buildings.city || 1)) - (POPULATION_PER_CITY * 0.7);
  if (targetNation.population <= baselinePopRaw || calcNationPower(targetNation) <= 0) {
    cityFallen = true;

    // Remove city from tile
    tile.city = { exists: false };
    await tile.save();

    // Loot gold (40% of target gold divided by their remaining cities)
    const share = Math.floor((targetNation.resources.gold || 0) / Math.max(1, (targetNation.buildings.city || 1)));
    goldLooted = share;
    nation.resources.gold = (nation.resources.gold || 0) + share;
    targetNation.resources.gold = Math.max(0, (targetNation.resources.gold || 0) - share);

    // Decrement target nation's city count
    targetNation.buildings.city = Math.max(0, (targetNation.buildings.city || 1) - 1);

    // Reset peak population when city falls so remaining cities start at 100% morale
    targetNation.peakPopulation = targetNation.population;
    console.log(`[City Fall] Resetting peak population to ${targetNation.population} for fresh morale on remaining cities`);

    // Crypto transfer when city falls (if enabled)
    const gameConfig = await GameConfig.findOne();
    const cryptoEnabled = gameConfig?.enableCrypto || false;

    if (cryptoEnabled) {
      try {
        const appId = interaction.client.user.id;
        const ticker = process.env.TREASURE_TOKEN || "AVAX";

        // Get defender's prize pool balance
        const defenderPoolResult = await getPrizePoolWallet(targetNation.serverId, appId);

        if (defenderPoolResult.success && defenderPoolResult.balances) {
          // Find the balance for the treasure token
          const tokenBalance = defenderPoolResult.balances.find(b => b.ticker === ticker);

          if (tokenBalance && parseFloat(tokenBalance.available) > 0) {
            // Calculate amount to transfer: total balance / number of cities they had BEFORE losing this one
            const numCitiesBeforeAttack = targetNation.buildings.city || 1;
            const totalBalance = parseFloat(tokenBalance.available);
            const cryptoToTransfer = (totalBalance / numCitiesBeforeAttack).toFixed(6);

            console.log(`[Attack] City fallen - transferring ${cryptoToTransfer} ${ticker} from ${targetNation.name} to ${nation.name}`);
            console.log(`[Attack] Calculation: ${totalBalance} / ${numCitiesBeforeAttack} = ${cryptoToTransfer}`);

            if (parseFloat(cryptoToTransfer) > 0) {
              const transferResult = await transferBetweenPrizePools(
                appId,
                targetNation.serverId, // from (losing nation)
                nation.serverId,        // to (winning nation)
                ticker,
                cryptoToTransfer
              );

              if (transferResult.success) {
                console.log(`✅ Crypto transfer successful: ${cryptoToTransfer} ${ticker} - TX: ${transferResult.txHash}`);
              } else {
                console.warn(`⚠️ Failed to transfer crypto: ${transferResult.error}`);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error transferring crypto on city fall:", error);
        // Don't fail the attack if crypto transfer fails
      }
    }

    // Put attacker nation on cooldown
    setNationCooldown(nation, "attack");

    // Intel cleanup (remove fallen city from records)
    await Intel.updateMany(
      { targetNationId: targetNation.serverId },
      { $pull: { knownCities: tileId } }
    );
  }

  // Player cooldown (store on player - reusing the same helper for simplicity; if your helper expects `lastResourceAction` for user that's OK)
  setResourceCooldown(player); // keep your earlier behavior — if you prefer a separate function for player cooldowns we can switch

  await Promise.all([
    player.save(),
    nation.save(),
    targetNation.save(),
    tile.save()
  ]);

//   const defenseThreshold = getNationMilitaryThreshold(targetNation);
//   const defensePercent = Math.max(
//     0,
//     Math.min(100, Math.floor(((calcNationPower(targetNation) + targetNation.population) / (defenseThreshold + targetNation.population)) * 100))
//     );

// // Public morale = current pop vs baseline
// const moralePercent = Math.max(0, Math.min(100,
//   Math.floor((targetNation.population / baselinePop) * 100)
// ));

// // Military strength = current vs threshold
// const powerPercent = Math.max(0, Math.min(100,
//   Math.floor((calcNationPower(targetNation) / getNationMilitaryThreshold(targetNation)) * 100)
// ));

// // Overall defense = whichever is lowest
// const defensePercent = Math.min(moralePercent, powerPercent);

// compute baseline population threshold (you already set this earlier)
const baselinePop = Math.max(1, Math.floor(baselinePopRaw)); // avoid division by zero and make an integer

// Public Morale % = current population as percentage of peak population
// This makes morale decrease cumulatively across multiple attacks
// peakPopulation is persisted and tracks the highest population this nation has reached
let moralePercent = 0;
if (targetNation.peakPopulation > 0) {
  moralePercent = Math.floor((targetNation.population / targetNation.peakPopulation) * 100);
}
moralePercent = Math.max(0, Math.min(100, moralePercent));

console.log(`[Morale Debug] currentPop: ${targetNation.population}, peakPop: ${targetNation.peakPopulation}, morale: ${moralePercent}%`);

// Military Strength % = current military power vs threshold
const defenseThreshold = Math.max(1, getNationMilitaryThreshold(targetNation));
let powerPercent = Math.floor((calcNationPower(targetNation) / defenseThreshold) * 100);
powerPercent = Math.max(0, Math.min(100, powerPercent));

// Overall defense is the weakest link
const defensePercent = Math.min(moralePercent, powerPercent);

  // Build attacker embed
  const attackerEmbed = {
    color: cityFallen ? 0xff0000 : 0x0099ff,
    title: `⚔️${nation.name} attacked the city of ${targetCityName} of the ${targetNation.name} nation!\nAttack Outcome:`,
    fields: [
      { name: "Outcome", value: outcome.toUpperCase(), inline: true },
      { name: "Your losses", value: formatUnitLosses(attackerLosses), inline: true },
      { name: "Enemy losses", value: formatUnitLosses(defenderLosses), inline: true },
      { name: "Overall City Defense", value: `${defensePercent}%`, inline: true },
      { name: "Public Morale", value: `${moralePercent}%`, inline: true },
      { name: "Military Strength", value: `${powerPercent}%`, inline: true },
    ],
  };

  if (popLoss || foodLoss) {
    attackerEmbed.fields.push({ name: "Collateral damage", value: `${popLoss} population, ${foodLoss} food` });
  }
  if (goldLooted > 0) {
    attackerEmbed.fields.push({ name: "Looted gold", value: `💰 ${goldLooted}` });
  }
  if (cityFallen) {
    attackerEmbed.fields.push({ name: "City fallen", value: `🏙️ The city has been captured` });
  }

  if (rankUpMsg) attackerEmbed.addFields({ name: "XP", value: rankUpMsg });
  await interaction.reply({ embeds: [attackerEmbed] });

  // Defender notification (always send)
  const targetGuild = interaction.client.guilds.cache.get(targetNation.serverId);
  if (targetGuild) {
    const notifyChannel = targetGuild.channels.cache.find(
      ch => ch.isTextBased() && ch.permissionsFor(targetGuild.members.me).has("SendMessages")
    );
    if (notifyChannel) {
      const defenderEmbed = {
        color: 0xff0000,
        title: `🚨 Your city of ${tile.city.name} was attacked by ${nation.name}!`,
        fields: [
          { name: "Attacker", value: nation.name, inline: true },
          { name: "Outcome", value: outcome.toUpperCase(), inline: true },
          { name: "Your losses", value: formatUnitLosses(defenderLosses), inline: true },
          { name: "Enemy losses", value: formatUnitLosses(attackerLosses), inline: true },
          { name: "City Defenses", value: `${defensePercent}% remaining`, inline: true },
        ],
      };

      if (popLoss || foodLoss) {
        defenderEmbed.fields.push({ name: "Collateral damage", value: `${popLoss} population, ${foodLoss} food` });
      }
      if (goldLooted > 0) {
        defenderEmbed.fields.push({ name: "Looted gold", value: `💰 ${goldLooted}` });
      }

      if (cityFallen) {
        defenderEmbed.fields.push({ name: "City fallen", value: `❗ The city of **${tile.city.name || tileId}** has fallen.` });
      }
      await notifyChannel.send({ embeds: [defenderEmbed] });
    }
  }

  // done
}

// /** Helper: calc total power (accepts plural keys) */
// function calcNationPower(nation) {
//   // nation.military keys are plural: troops, tanks, jets
//   return (Object.entries(nation.military || {}).reduce((sum, [unit, count]) => {
//     return sum + getUnitPower(unit) * (count || 0);
//   }, 0));
// }

// /** Helper: unit power mapping (accepts plural or singular keys) */
// function getUnitPower(unit) {
//   switch (unit.toLowerCase()) {
//     case "troop":
//     case "troops":
//       return 1;
//     case "tank":
//     case "tanks":
//       return 5;
//     case "jet":
//     case "jets":
//       return 10;
//     default:
//       return 1;
//   }
// }

/**
 * Apply losses expensive-first and return breakdown (plural keys).
 * We remove the minimum number of expensive units needed to meet/exceed the requested power loss.
 * Returns an object: { troops: X, tanks: Y, jets: Z }
 */
function applyMilitaryLosses(nation, lossPower) {
    console.log(`[applyMilitaryLosses] lossPower requested: ${lossPower}`);
  
    const unitValues = {
      jets: 10,
      tanks: 5,
      troops: 1
    };
  
    const losses = { troops: 0, tanks: 0, jets: 0 };
    let remaining = lossPower;

    console.log(`\n[applyMilitaryLosses] Requested lossPower: ${lossPower}`);
    console.log(`[applyMilitaryLosses] Nation before losses:`, JSON.stringify(nation.military));
  
    // Try to "make change" starting with expensive units
    for (const unitKey of ["jets", "tanks", "troops"]) {
      const unitCount = nation.military[unitKey] || 0;
      const unitPower = unitValues[unitKey];
  
      if (remaining <= 0 || unitCount <= 0) continue;
  
      // How many of this unit are ideally needed?
      const needed = Math.floor(remaining / unitPower);
  
      if (needed > 0) {
        const remove = Math.min(unitCount, needed);
        nation.military[unitKey] -= remove;
        losses[unitKey] += remove;
        remaining -= remove * unitPower;
      }
    }
  
    // If there's still some remainder (e.g. remaining=2 but no tanks left), fill with cheapest unit available
    if (remaining > 0) {
      const troopsAvailable = nation.military.troops || 0;
      const remove = Math.min(troopsAvailable, remaining); // 1 troop = 1 power
      nation.military.troops -= remove;
      losses.troops += remove;
      remaining -= remove;
    }

    console.log(`[applyMilitaryLosses] Losses applied:`, losses, `Remaining unmet power: ${remaining}`);
    console.log(`[applyMilitaryLosses] Nation after losses:`, JSON.stringify(nation.military));
  
    return losses;
  }
  
/** Helper: format unit loss breakdown for embed / messages */
function formatUnitLosses(losses) {
  // losses keys are plural: troops, tanks, jets
  const parts = [];
  if ((losses.jets || 0) > 0) parts.push(`${losses.jets} jet${losses.jets > 1 ? "s" : ""}`);
  if ((losses.tanks || 0) > 0) parts.push(`${losses.tanks} tank${losses.tanks > 1 ? "s" : ""}`);
  if ((losses.troops || 0) > 0) parts.push(`${losses.troops} troop${losses.troops > 1 ? "s" : ""}`);
  return parts.length ? parts.join(", ") : "None";
}
