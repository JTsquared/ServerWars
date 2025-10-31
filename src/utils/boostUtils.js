// utils/boostUtils.js
// Helper functions for production boost system

/**
 * Check if a nation has an active boost for a specific resource type
 * @param {Object} nation - Nation document
 * @param {string} resourceType - "food", "steel", "oil", or "gold"
 * @returns {number} Multiplier (1 = no boost, 2 = 2x boost, etc.)
 */
export function getBoostMultiplier(nation, resourceType) {
  if (!nation.boosts || !nation.boosts[resourceType]) {
    return 1;
  }

  const boost = nation.boosts[resourceType];

  // Check if boost is still active
  if (boost.endTime && new Date() < new Date(boost.endTime)) {
    return boost.multiplier || 1;
  }

  return 1;
}

/**
 * Apply a boost to a nation
 * @param {Object} nation - Nation document
 * @param {string} resourceType - "food", "steel", "oil", or "gold"
 * @param {number} hours - Duration in hours
 * @param {number} multiplier - Boost multiplier (default 2)
 * @returns {Date} New end time
 */
export function applyBoost(nation, resourceType, hours, multiplier = 2) {
  const now = new Date();
  const existingBoost = nation.boosts?.[resourceType];

  // If there's an existing active boost, extend it
  let startTime = now;
  if (existingBoost?.endTime && new Date(existingBoost.endTime) > now) {
    startTime = new Date(existingBoost.endTime);
  }

  const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

  // Initialize boosts if it doesn't exist
  if (!nation.boosts) {
    nation.boosts = {
      food: { endTime: null, multiplier: 1 },
      steel: { endTime: null, multiplier: 1 },
      oil: { endTime: null, multiplier: 1 },
      gold: { endTime: null, multiplier: 1 }
    };
  }

  nation.boosts[resourceType] = {
    endTime: endTime,
    multiplier: multiplier
  };

  return endTime;
}

/**
 * Get remaining boost time in seconds
 * @param {Object} nation - Nation document
 * @param {string} resourceType - "food", "steel", "oil", or "gold"
 * @returns {number} Seconds remaining (0 if no active boost)
 */
export function getBoostTimeRemaining(nation, resourceType) {
  if (!nation.boosts || !nation.boosts[resourceType]) {
    return 0;
  }

  const boost = nation.boosts[resourceType];
  if (!boost.endTime) {
    return 0;
  }

  const now = new Date();
  const endTime = new Date(boost.endTime);

  if (endTime <= now) {
    return 0;
  }

  return Math.floor((endTime - now) / 1000);
}

/**
 * Format boost time remaining as human-readable string
 * @param {number} seconds - Seconds remaining
 * @returns {string} Formatted string (e.g., "2h 30m")
 */
export function formatBoostTime(seconds) {
  if (seconds <= 0) {
    return "No active boost";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Map production type names to resource keys
 * @param {string} productionType - User-friendly name (e.g., "food production")
 * @returns {string|null} Resource key ("food", "steel", "oil", "gold") or null if invalid
 */
export function mapProductionTypeToResource(productionType) {
  const mapping = {
    "food production": "food",
    "steel production": "steel",
    "mining production": "oil",  // oil drilling/mining
    "gold production": "gold"
  };

  return mapping[productionType.toLowerCase()] || null;
}
