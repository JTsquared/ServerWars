import Player from "../models/Player.js";

/**
 * Find a user by discordId.
 * Returns the user doc or null if not found.
 */
export async function getUserByDiscordId(userId) {
  return Player.findOne({ userId });
}

/**
 * Create a user for a given server (used by /join).
 * If a user already exists, this will throw due to unique index — handle appropriately.
 */
export async function createUserForServer(userId, serverId) {
  const player = new Player({ userId, serverId });
  await Player.save();
  return player;
}

/**
 * Save the user doc (pass the mongoose doc)
 */
export async function saveUser(userDoc) {
  return userDoc.save();
}
