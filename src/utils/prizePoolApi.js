// utils/prizePoolapi.js
// Helper functions to interact with CryptoTip's Prize Pool API

// Get base API URL (strip any endpoint paths)
const getBaseUrl = () => {
  const url = process.env.CRYPTOTIP_API_URL || "http://localhost:3000/api/globalwallet";
  // Remove /api/globalwallet or /api/prizepool if present
  return url.replace(/\/api\/(globalwallet|prizepool)$/, '');
};

const BASE_URL = getBaseUrl();
const CRYPTOTIP_PRIZEPOOL_API_URL = `${BASE_URL}/api/prizepool`;
const CRYPTOTIP_GLOBALWALLET_API_URL = `${BASE_URL}/api/globalwallet`;

console.log('[prizePoolApi] BASE_URL:', BASE_URL);
console.log('[prizePoolApi] PRIZEPOOL URL:', CRYPTOTIP_PRIZEPOOL_API_URL);
console.log('[prizePoolApi] GLOBALWALLET URL:', CRYPTOTIP_GLOBALWALLET_API_URL);

/**
 * Create a prize pool wallet for a guild/server
 * @param {string} guildId - Discord guild/server ID
 * @param {string} appId - Discord application ID (ServerWars bot ID)
 * @returns {Promise<Object>}
 */
export async function createPrizePoolWallet(guildId, appId) {
  try {
    const response = await fetch(`${CRYPTOTIP_PRIZEPOOL_API_URL}/create/${guildId}?appId=${appId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    return await response.json();
  } catch (error) {
    console.error("Error creating prize pool wallet:", error);
    return { success: false, error: "NETWORK_ERROR", detail: error.message };
  }
}

/**
 * Get prize pool wallet address for a guild
 * @param {string} guildId - Discord guild/server ID
 * @param {string} appId - Discord application ID
 * @returns {Promise<Object>}
 */
export async function getPrizePoolWallet(guildId, appId) {
  try {
    const url = `${CRYPTOTIP_PRIZEPOOL_API_URL}/balances/${guildId}?appId=${appId}`;
    console.log('[getPrizePoolWallet] Fetching:', url);

    const response = await fetch(url, {
      method: "GET"
    });

    console.log('[getPrizePoolWallet] Response status:', response.status);

    // Check if response is actually JSON
    const contentType = response.headers.get("content-type");
    console.log('[getPrizePoolWallet] Content-Type:', contentType);

    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error('[getPrizePoolWallet] Non-JSON response:', text.substring(0, 200));
      return { success: false, error: "INVALID_RESPONSE", detail: "Server returned HTML instead of JSON" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting prize pool wallet:", error);
    return { success: false, error: "NETWORK_ERROR", detail: error.message };
  }
}

/**
 * Transfer tokens from global wallet to a guild's prize pool wallet
 * @param {string} appId - Discord application ID (ServerWars bot ID)
 * @param {string} guildId - Target guild ID
 * @param {string} ticker - Token ticker (e.g., "AVAX")
 * @param {string|number} amount - Amount to transfer
 * @returns {Promise<Object>}
 */
export async function transferTreasureReward(appId, guildId, ticker, amount) {
  try {
    // First, get the prize pool wallet address for this guild
    const prizePoolResult = await getPrizePoolWallet(guildId, appId);

    if (!prizePoolResult.success || !prizePoolResult.address) {
      console.error("Failed to get prize pool wallet address:", prizePoolResult.error);
      return { success: false, error: "NO_PRIZE_POOL_WALLET" };
    }

    const toAddress = prizePoolResult.address;

    // Transfer from global wallet to prize pool
    const response = await fetch(`${CRYPTOTIP_GLOBALWALLET_API_URL}/transfer?appId=${appId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ toAddress, ticker, amount })
    });

    return await response.json();
  } catch (error) {
    console.error("Error transferring treasure reward:", error);
    return { success: false, error: "NETWORK_ERROR", detail: error.message };
  }
}

/**
 * Transfer tokens from one prize pool to another (e.g., when a city falls)
 * SECURITY: This function includes a shared secret for internal bot-to-bot transfers only
 * @param {string} appId - Discord application ID (ServerWars bot ID)
 * @param {string} fromGuildId - Source guild ID (losing nation)
 * @param {string} toGuildId - Destination guild ID (winning nation)
 * @param {string} ticker - Token ticker (e.g., "SQRD")
 * @param {string|number} amount - Amount to transfer
 * @returns {Promise<Object>}
 */
export async function transferBetweenPrizePools(appId, fromGuildId, toGuildId, ticker, amount) {
  try {
    const transferSecret = process.env.PRIZE_POOL_TRANSFER_SECRET;

    if (!transferSecret) {
      console.error('🚨 SECURITY ERROR: PRIZE_POOL_TRANSFER_SECRET not configured in ServerWars');
      return { success: false, error: "MISSING_TRANSFER_SECRET" };
    }

    const url = `${CRYPTOTIP_PRIZEPOOL_API_URL}/transfer?appId=${appId}`;
    console.log('[transferBetweenPrizePools] Transferring:', { fromGuildId, toGuildId, ticker, amount });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fromGuildId,
        toGuildId,
        ticker,
        amount,
        appId,
        transferSecret  // Security: shared secret for internal transfers
      })
    });

    console.log('[transferBetweenPrizePools] Response status:', response.status);

    // Check if response is actually JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error('[transferBetweenPrizePools] Non-JSON response:', text.substring(0, 200));
      return { success: false, error: "INVALID_RESPONSE", detail: "Server returned non-JSON response" };
    }

    const result = await response.json();

    // Log security rejections
    if (!result.success && (result.error === "FORBIDDEN_EXTERNAL_ACCESS" || result.error === "INVALID_SECRET")) {
      console.error(`🚨 SECURITY ERROR: ${result.error} - Prize pool transfer rejected`);
    }

    return result;
  } catch (error) {
    console.error("Error transferring between prize pools:", error);
    return { success: false, error: "NETWORK_ERROR", detail: error.message };
  }
}
