// utils/cryptoTipApi.js
// Helper functions to interact with CryptoTip's Global Wallet API

const CRYPTOTIP_API_URL = process.env.CRYPTOTIP_API_URL || "http://localhost:3000/api/globalwallet";

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
 * Transfer tokens from global wallet to a recipient
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
