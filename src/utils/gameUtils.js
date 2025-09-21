import { economistTiers, militaryTiers, scoutTiers, diplomatTiers } from "../data/tiers.js";
import { COOLDOWN_MS } from "./constants.js";
import Nation from "../models/Nation.js";
import Config from "../models/Config.js";
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
    // const buildingDef = Object.values(BUILDINGS).find(
    //   b => b.dbname === buildingKey
    // );
    if (!buildingDef) continue;

    switch (resource) {
      case "steel":
        if (buildingDef.dbname === "factory") bonus += buildingDef.bonus * count;
        break;
      case "gold":
        if (buildingDef.dbname === "bank") bonus += buildingDef.bonus * count;
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
      if (!current?.userId || (player.userId !== current.userId && player.exp.military > current.exp)) {
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
      if (!current?.userId || (player.userId !== current.userId && player.exp.economist > current.exp)) {
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
      if (!current?.userId || (player.userId !== current.userId && player.exp.scout > current.exp)) {
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
      if (!current?.userId || (player.userId !== current.userId && player.exp.diplomat > current.exp)) {
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


