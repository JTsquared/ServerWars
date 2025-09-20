// cooldowns.js
const cooldowns = new Map();

/**
 * Checks if a user is on cooldown for a specific command.
 * @param {string} userId - Discord user ID
 * @param {string} command - Command name
 * @param {number} cooldownMs - Cooldown duration in milliseconds
 * @returns {string|null} - Error message if on cooldown, otherwise null
 */
export function checkCooldown(userId, command, cooldownMs) {
  const key = `${userId}-${command}`;
  const now = Date.now();

  if (cooldowns.has(key)) {
    const expires = cooldowns.get(key);
    if (now < expires) {
      const secondsLeft = Math.ceil((expires - now) / 1000);
      return `⏳ You must wait **${secondsLeft} seconds** before using \`/${command}\` again.`;
    }
  }

  // Not on cooldown → set new expiry
  cooldowns.set(key, now + cooldownMs);
  return null;
}
