import Nation from "../models/Nation.js";

/**
 * Get or create a nation for a server
 */
export async function getOrCreateNation(serverId) {
  let nation = await Nation.findOne({ serverId });
  if (!nation) {
    nation = new Nation({ serverId });
    await nation.save();
  }
  return nation;
}

/**
 * Save nation doc
 */
export async function saveNation(nationDoc) {
  return nationDoc.save();
}
