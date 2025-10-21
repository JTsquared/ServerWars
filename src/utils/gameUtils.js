import { economistTiers, militaryTiers, scoutTiers, diplomatTiers } from "../data/tiers.js";
import { COOLDOWN_MS } from "./constants.js";
import Nation from "../models/Nation.js";
import ServerConfig from "../models/ServerConfig.js";
import { BUILDINGS } from "./constants.js";

// export const COOLDOWN_MS = 1000 * 60 * 60; // 1 hour global for resource commands
//export const COOLDOWN_MS = 1000 * 5; // 1 minute global for resource commands

export function getTier(exp, tiers) {
  let role = tiers[0].title;
  for (let t of tiers) {
    if (exp >= t.exp) role = t.title;
    else break;
  }
  return role;
}

export function getTiersForPath(path) {
  switch (path) {
    case "military": return militaryTiers;
    case "economist": return economistTiers;
    case "scout": return scoutTiers;
    case "diplomat": return diplomatTiers;
    default: return [];
  }
}

export function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function getResourceYield(exp, tiers, nation, resource, ownedTiles, baseRate = 1) {

  const isNaturalResource = resource in (nation.resources || {});
  const landBonus = isNaturalResource ? ownedTiles.reduce((sum, t) => sum + (t.resources?.[resource] || 0), 0) : 0;

  let experienceBonus = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (exp >= tiers[i].exp) experienceBonus = i;
  }

  console.log('resource: ', resource);
  const buildingBonus = getBuildingBonus(nation, resource);
  console.log(`getResourceYield: baseRate=${baseRate}, landBonus=${landBonus}, experienceBonus=${experienceBonus}, buildingBonus=${buildingBonus}`);

  return baseRate + landBonus + experienceBonus + buildingBonus;
}

export function getBuildingBonus(nation, resource) {
  if (!nation.buildings) return 0;

  let bonus = 0;

  const BUILDINGS_BY_DBNAME = Object.fromEntries(
    Object.values(BUILDINGS).map(b => [b.dbname, b])
  );

  for (const [buildingKey, count] of Object.entries(nation.buildings)) {
    if (count <= 0) continue;

    // Find the buildingDef whose dbname matches the schema key
    const buildingDef = BUILDINGS_BY_DBNAME[buildingKey];
    if (!buildingDef) continue;

    switch (resource) {
      case "steel":
        if (buildingDef.dbname === "factory") bonus += buildingDef.bonus * count;
        break;
      case "gold":
        if (buildingDef.dbname === "bank") {
          //make sure bank has not been hacked. No bonus while hacked.
          const now = Date.now();
          const hackedUntil = nation.hacks?.bankDisabledUntil ? new Date(nation.hacks.bankDisabledUntil).getTime() : 0;
          const bankIsDisabled = hackedUntil && hackedUntil > now;
          bonus = bankIsDisabled ? 0 : buildingDef.bonus * count;
        }
        break;
      case "food":
        if (buildingDef.dbname === "mickdonalds") bonus += buildingDef.bonus * count;
        break;
      case "oil":
        if (buildingDef.dbname === "oilrig") bonus += buildingDef.bonus * count;
        break;
      case "troops":
        if (buildingDef.dbname === "barracks") bonus += buildingDef.bonus * count;
        break;
      case "tanks":
        if (buildingDef.dbname === "depot") bonus += buildingDef.bonus * count;
        break;
      case "jets":
        if (buildingDef.dbname === "hangar") bonus += buildingDef.bonus * count;
        break;
    }
  }

  return bonus;
}

export function secondsLeftOnResourceCooldown(userDoc) {
    if (!userDoc?.lastResourceAction) return null;
    const expires = userDoc.lastResourceAction.getTime() + COOLDOWN_MS;
    const now = Date.now();
    if (now >= expires) return null;
    return Math.ceil((expires - now) / 1000);
}
  
export function canUseResourceCommand(userData) {
    const now = Date.now();
    if (!userData.lastResourceAction) return true;
    return now - userData.lastResourceAction >= COOLDOWN_MS; 
}
  
export function setResourceCooldown(userData) {
    userData.lastResourceAction = Date.now();
}

export function getNationalCooldownTime(nation, action, cooldownMs) {
  const now = Date.now();
  const lastUsed = nation.cooldowns?.[action] || 0;
  const expiresAt = lastUsed + cooldownMs;
  const timeLeft = expiresAt - now;

  return timeLeft > 0 ? Math.ceil(timeLeft / 1000) : 0;
}

export function setNationCooldown(nation, action) {
  if (!nation.cooldowns) nation.cooldowns = {};
  nation.cooldowns[action] = Date.now();
}

/**
 * Grants EXP to a player and recalculates their role.
 * 
 * @param {Object} player - Player object (with exp + role fields).
 * @param {string} path - Which exp path to apply ("military" | "economist" | "scout" | "diplomat").
 * @param {number} amount - How much EXP to grant.
 * @returns {string|null} A rank-up message if the role changed, otherwise null.
 */

export async function grantExp(player, path, amount, nation) {
  const messages = [];

  // Get tiers and old tier title
  const tiers = getTiersForPath(path);
  const oldTier = getTier(player.exp[path] || 0, tiers);

  // Apply EXP
  player.exp[path] = (player.exp[path] || 0) + amount;

  // Get new tier title
  const newTier = getTier(player.exp[path], tiers);

  // Announce personal rank up (only in this EXP path)
  if (newTier !== oldTier) {
    messages.push(`🎖️ You ranked up to **${newTier}** in the **${capitalize(path)}** path!`);
  }

  // Leadership Role Check (based on the path used)
  switch (path) {
    case "military": {
      const current = nation.leadership.commanderInChief;
      if (!current?.userId) {
        // No current holder
        nation.leadership.commanderInChief = {
          userId: player.userId,
          exp: player.exp.military,
        };
        messages.push(`🪖 <@${player.userId}> is now the **Commander in Chief** of ${nation.name}!`);
      } else if (player.userId === current.userId) {
        // Current holder gaining EXP - update their stored value
        nation.leadership.commanderInChief.exp = player.exp.military;
      } else if (player.exp.military > current.exp) {
        // Someone else overtook them
        nation.leadership.commanderInChief = {
          userId: player.userId,
          exp: player.exp.military,
        };
        messages.push(`🪖 <@${player.userId}> is now the **Commander in Chief** of ${nation.name}!`);
      }
      break;
    }

    case "economist": {
      const current = nation.leadership.financeMinister;
      if (!current?.userId) {
        // No current holder
        nation.leadership.financeMinister = {
          userId: player.userId,
          exp: player.exp.economist,
        };
        messages.push(`💰 <@${player.userId}> is now the **Finance Minister** of ${nation.name}!`);
      } else if (player.userId === current.userId) {
        // Current holder gaining EXP - update their stored value
        nation.leadership.financeMinister.exp = player.exp.economist;
      } else if (player.exp.economist > current.exp) {
        // Someone else overtook them
        nation.leadership.financeMinister = {
          userId: player.userId,
          exp: player.exp.economist,
        };
        messages.push(`💰 <@${player.userId}> is now the **Finance Minister** of ${nation.name}!`);
      }
      break;
    }

    case "scout": {
      const current = nation.leadership.chiefScout;
      if (!current?.userId) {
        // No current holder
        nation.leadership.chiefScout = {
          userId: player.userId,
          exp: player.exp.scout,
        };
        messages.push(`🧭 <@${player.userId}> is now the **Chief Scout** of ${nation.name}!`);
      } else if (player.userId === current.userId) {
        // Current holder gaining EXP - update their stored value
        nation.leadership.chiefScout.exp = player.exp.scout;
      } else if (player.exp.scout > current.exp) {
        // Someone else overtook them
        nation.leadership.chiefScout = {
          userId: player.userId,
          exp: player.exp.scout,
        };
        messages.push(`🧭 <@${player.userId}> is now the **Chief Scout** of ${nation.name}!`);
      }
      break;
    }

    case "diplomat": {
      const current = nation.leadership.foreignMinister;
      if (!current?.userId) {
        // No current holder
        nation.leadership.foreignMinister = {
          userId: player.userId,
          exp: player.exp.diplomat,
        };
        messages.push(`🕊️ <@${player.userId}> is now the **Foreign Minister** of ${nation.name}!`);
      } else if (player.userId === current.userId) {
        // Current holder gaining EXP - update their stored value
        nation.leadership.foreignMinister.exp = player.exp.diplomat;
      } else if (player.exp.diplomat > current.exp) {
        // Someone else overtook them
        nation.leadership.foreignMinister = {
          userId: player.userId,
          exp: player.exp.diplomat,
        };
        messages.push(`🕊️ <@${player.userId}> is now the **Foreign Minister** of ${nation.name}!`);
      }
      break;
    }
  }

  return messages.length ? messages.join("\n") : null;
}

export function getServerWarsChannel(guild) {
  const channelId = channelMap.get(guild.id);
  if (channelId) {
    const channel = guild.channels.cache.get(channelId);
    if (
      channel &&
      channel.isTextBased() &&
      channel.permissionsFor(guild.members.me)?.has("SendMessages")
    ) {
      return channel;
    }
  }
  return null; // fallback handling if needed
}

// src/utils/checkPermissions.js
export function checkPermissions(interaction, nation, roleType) {
  console.log("🔎 Checking permissions for user:", interaction.user.tag, "RoleType:", roleType);

  // Map role types → leadership fields + discord roles
  const roleMap = {
    Diplomatic: { discordRole: "Political Leader", ministerKey: "Foreign Minister" },
    Military:   { discordRole: "Political Leader", ministerKey: "Commander in Chief" },
    Economic:   { discordRole: "Treasurer",        ministerKey: "Finance Minister" },
    Explorer:   { discordRole: "Political Leader", ministerKey: "Chief Scout" }
  };

  const mapping = roleMap[roleType];
  if (!mapping) {
    console.warn(`⚠️ Unknown roleType "${roleType}" passed to checkPermissions.`);
    return false;
  }

  // Check Discord role
  const discordRole = interaction.guild.roles.cache.find(r => r.name === mapping.discordRole);
  const hasDiscordRole = discordRole && interaction.member.roles.cache.has(discordRole.id);

  console.log(`   - Discord role required: ${mapping.discordRole}, found: ${!!discordRole}, memberHas: ${hasDiscordRole}`);

  // Check leadership assignment
  const minister = nation.leadership?.[mapping.ministerKey];
  const isMinister = minister?.userId === interaction.user.id;

  console.log(`   - Nation ministerKey: ${mapping.ministerKey}, ministerUserId: ${minister?.userId}, userIsMinister: ${isMinister}`);

  // Final result
  const allowed = hasDiscordRole || isMinister;
  console.log(`✅ Permission check result: ${allowed}`);
  return allowed;
}

export function getResourceCategory(nation, item) {
  console.log("Determining category for item:", item);
  if (nation.resources[item] !== undefined) return "resources";
  console.log("Not a resource.");
  if (nation.military[item] !== undefined) return "military";
  console.log("Not military.");
  return null; // unknown item
}

/** Helper: calc total power (accepts plural keys) */
export function calcNationPower(nation) {
  // nation.military keys are plural: troops, tanks, jets
  return (Object.entries(nation.military || {}).reduce((sum, [unit, count]) => {
    return sum + getUnitPower(unit) * (count || 0);
  }, 0));
}

/** Helper: unit power mapping (accepts plural or singular keys) */
export function getUnitPower(unit) {
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

/**
 * Calculates a safe per-reward fraction of the prize pool.
 *
 * @param {number} gridSize - Number of explore attempts (n)
 * @param {number} chance - Probability of success per attempt (p, e.g. 0.1 for 10%)
 * @param {number} sigmaMultiplier - Safety factor (3 = ~99.7% safe)
 * @returns {number} Fraction of the prize pool to give per success (e.g. 0.0078 = 0.78%)
 */
export function getSafeRewardFraction(gridSize, chance, sigmaMultiplier = 3) {
  const n = gridSize;
  const p = chance;

  const mean = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  const safeMax = mean + sigmaMultiplier * sd;

  return 1 / safeMax;
}

// simple shared registry
export const channelMap = new Map();



