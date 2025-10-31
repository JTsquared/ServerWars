// utils/cryptoTipApi.js
// Helper functions to interact with CryptoTip's Global Wallet API

const CRYPTOTIP_API_URL = process.env.CRYPTOTIP_API_URL || "http://localhost:3000";

/**
 * Get global wallet info (address, appName, etc.)
 * @param {string} appId - Discord application ID
 * @returns {Promise<Object>}
 */
export async function getGlobalWalletInfo(appId) {
  try {
    const response = await fetch(`${CRYPTOTIP_API_URL}/info?appId=${appId}`, {
      method: "GET"
    });

    return await response.json();
  } catch (error) {
    console.error("Error getting global wallet info:", error);
    return { success: false, error: "NETWORK_ERROR", detail: error.message };
  }
}

/**
 * Get balance for a specific token
 * @param {string} appId - Discord application ID
 * @param {string} ticker - Token ticker (e.g., "AVAX", "USDC")
 * @returns {Promise<Object>}
 */
export async function getGlobalWalletBalance(appId, ticker) {
  try {
    const response = await fetch(`${CRYPTOTIP_API_URL}/balance/${ticker}?appId=${appId}`, {
      method: "GET"
    });

    return await response.json();
  } catch (error) {
    console.error("Error getting balance:", error);
    return { success: false, error: "NETWORK_ERROR", detail: error.message };
  }
}

/**
 * Get all token balances
 * @param {string} appId - Discord application ID
 * @param {boolean} includeZeros - Include tokens with zero balance
 * @returns {Promise<Object>}
 */
export async function getGlobalWalletBalances(appId, includeZeros = false) {
  try {
    const response = await fetch(`${CRYPTOTIP_API_URL}/balances?appId=${appId}&includeZeros=${includeZeros}`, {
      method: "GET"
    });

    return await response.json();
  } catch (error) {
    console.error("Error getting balances:", error);
    return { success: false, error: "NETWORK_ERROR", detail: error.message };
  }
}

/**
 * Transfer tokens from global wallet to a recipient wallet address
 * @param {string} appId - Discord application ID
 * @param {string} toAddress - Recipient wallet address
 * @param {string} ticker - Token ticker
 * @param {string|number} amount - Amount to transfer
 * @returns {Promise<Object>}
 */
export async function transferFromGlobalWallet(appId, toAddress, ticker, amount) {
  try {
    const response = await fetch(`${CRYPTOTIP_API_URL}/transfer?appId=${appId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ toAddress, ticker, amount })
    });

    return await response.json();
  } catch (error) {
    console.error("Error transferring from global wallet:", error);
    return { success: false, error: "NETWORK_ERROR", detail: error.message };
  }
}

/**
 * Transfer tokens from global wallet to a Discord user
 * @param {string} appId - Discord application ID
 * @param {string} discordUserId - Recipient Discord user ID
 * @param {string} ticker - Token ticker
 * @param {string|number} amount - Amount to transfer
 * @returns {Promise<Object>}
 */
export async function transferToDiscordUser(appId, discordUserId, ticker, amount) {
  try {
    const response = await fetch(`${CRYPTOTIP_API_URL}/transfer?appId=${appId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        discordUserId,  // Use Discord ID instead of address
        ticker,
        amount
      })
    });

    return await response.json();
  } catch (error) {
    console.error("Error transferring to Discord user:", error);
    return { success: false, error: "NETWORK_ERROR", detail: error.message };
  }
}

/**
 * Process a developer payment from a guild's prize pool
 * @param {string} appId - Discord application ID (bot ID)
 * @param {string} guildId - Discord guild/server ID
 * @param {string} sender - Discord user ID who initiated the payment
 * @param {string} ticker - Token ticker
 * @param {string|number} amount - Amount to pay
 * @returns {Promise<Object>}
 */
export async function processDeveloperPayment(appId, guildId, sender, ticker, amount) {
  try {
    // Get base URL and construct prizepool developer-payment endpoint
    const baseUrl = CRYPTOTIP_API_URL.replace(/\/api\/globalwallet$/, '');
    const url = `${baseUrl}/api/prizepool/developer-payment/${guildId}?appId=${appId}`;

    console.log(`[DeveloperPayment] Calling: ${url}`);
    console.log(`[DeveloperPayment] Payload:`, { senderDiscordId: sender, ticker, amount });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        senderDiscordId: sender,
        ticker,
        amount
      })
    });

    console.log(`[DeveloperPayment] Response status: ${response.status} ${response.statusText}`);

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(`[DeveloperPayment] Expected JSON but got: ${contentType}`);
      console.error(`[DeveloperPayment] Response body (first 500 chars): ${text.substring(0, 500)}`);
      return {
        success: false,
        error: "INVALID_RESPONSE",
        detail: `Expected JSON but got ${contentType}. Status: ${response.status}`
      };
    }

    const result = await response.json();
    console.log(`[DeveloperPayment] Response body:`, result);
    return result;
  } catch (error) {
    console.error("[DeveloperPayment] Error processing developer payment:", error);
    return { success: false, error: "NETWORK_ERROR", detail: error.message };
  }
}
