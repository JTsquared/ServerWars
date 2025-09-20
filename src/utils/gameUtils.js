import { economistTiers, militaryTiers, scoutTiers, diplomatTiers } from "../data/tiers.js";
import { COOLDOWN_MS } from "./constants.js";
import Nation from "../models/Nation.js";
import Config from "../models/Config.js";

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

export function getResourceYield(exp, tiers) {
  let level = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (exp >= tiers[i].exp) level = i;
  }
  return 1 + level; // base 1 + 1 per rank
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
  const oldRole = player.role;

  // Apply EXP
  player.exp[path] = (player.exp[path] || 0) + amount;

  // Determine dominant path
  const paths = [
    { key: "military", exp: player.exp.military || 0, tiers: militaryTiers },
    { key: "economist", exp: player.exp.economist || 0, tiers: economistTiers },
    { key: "scout", exp: player.exp.scout || 0, tiers: scoutTiers },
    { key: "diplomat", exp: player.exp.diplomat || 0, tiers: diplomatTiers },
  ];
  const topPath = paths.reduce((max, curr) => (curr.exp > max.exp ? curr : max));
  player.role = getTier(topPath.exp, topPath.tiers);

  // Check for rank-up
  if (player.role !== oldRole) {
    messages.push(`🎖️ You ranked up to **${player.role}**!`);
  }

  // Load config for role ping
  const config = await Config.findOne({ serverId: nation.serverId });

  // Leadership checks
  const ping = config?.playerRoleId ? `<@&${config.playerRoleId}> ` : "";

  switch (path) {
    case "military": {
      const current = nation.leadership.commanderInChief;
      if (!current?.userId || (player.userId !== current.userId && player.exp.military > current.exp)) {
        nation.leadership.commanderInChief = {
          userId: player.userId,
          exp: player.exp.military,
        };
        messages.push(`${ping}<@${player.userId}> is now the **Commander in Chief** of ${nation.name}!`);
      }
      break;
    }

    case "economist": {
      const current = nation.leadership.financeMinister;
      // Only assign if no one holds it OR a different player has less exp
      if (!current?.userId || (player.userId !== current.userId && player.exp.economist > current.exp)) {
        nation.leadership.financeMinister = {
          userId: player.userId,
          exp: player.exp.economist,
        };
        messages.push(`${ping}<@${player.userId}> is now the **Finance Minister** of ${nation.name}!`);
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
        messages.push(`${ping}<@${player.userId}> is now the **Chief Scout** of ${nation.name}!`);
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
        messages.push(`${ping}<@${player.userId}> is now the **Foreign Minister** of ${nation.name}!`);
      }
      break;
    }
  }

  return messages.length ? messages.join("\n") : null;
}

