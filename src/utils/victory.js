// utils/victory.js
import GameConfig from "../models/GameConfig.js";
import ServerConfig from "../models/ServerConfig.js";
import Nation from "../models/Nation.js";
import Tile from "../models/Tile.js";
import { calcNationPower } from "./gameUtils.js";
import { channelMap } from "./gameUtils.js";
import { EmbedBuilder } from "discord.js";
import { getServerWarsChannel } from "./gameUtils.js";
import { createSeasonSnapshots, incrementSeasonId } from "./seasonSnapshot.js";

export async function determineWinner(serverId) {
    console.log('Determining winner for server:', serverId);
    const config = await GameConfig.findOne().lean();
  
    const {
      gameType = "sandbox",
      seasonEnd = null,
      victoryType = "military"
    } = config?.gamemode || {};
  
    if (gameType === "sandbox") return null;
  
    console.log('Game config:', { gameType, seasonEnd, victoryType });
    if (seasonEnd && new Date() < new Date(seasonEnd)) return null;
    console.log('Season has ended, proceeding to determine winner.');
  
    // Fetch all nations in this server
    const nations = await Nation.find();
    if (!nations.length) return null;
  
    // safe power calculator (uses calcNationPower if available else fallback)
    function calcNationPowerSafe(n) {
      if (typeof calcNationPower === "function") {
        try { return calcNationPower(n); } catch (e) { /* continue to fallback */ }
      }
      // fallback: simple mapping
      const getUnitPower = unit => {
        switch (unit.toLowerCase()) {
          case "troop": case "troops": return 1;
          case "tank": case "tanks":   return 5;
          case "jet": case "jets":     return 10;
          default: return 1;
        }
      };
      return Object.entries(n.military || {}).reduce((sum, [k, v]) => sum + (getUnitPower(k) * (v || 0)), 0);
    }
  
    let ranking = [];
  
    if (victoryType === "power") {
      ranking = nations
        .map(n => ({
          nation: n,
          score: calcNationPowerSafe(n)
        }))
        .sort((a, b) => b.score - a.score);
  
    } else if (victoryType === "cities") {
      ranking = nations
        .map(n => ({
          nation: n,
          // use the building count for cities (fall back to 0)
          score: (n.buildings?.city || 0),
          tieBreaker: (n.population || 0)
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.tieBreaker - a.tieBreaker;
        });
  
    } else if (victoryType === "gold") {
      ranking = nations
        .map(n => ({
          nation: n,
          score: (n.resources?.gold || 0)
        }))
        .sort((a, b) => b.score - a.score);
    } else {
      // default/fallback: compute by power
      ranking = nations
        .map(n => ({ nation: n, score: calcNationPowerSafe(n) }))
        .sort((a, b) => b.score - a.score);
    }
  
    const winner = ranking[0]?.nation || null;
    console.log('Winner determined:', winner ? winner.name : 'None');
    const top3 = ranking.slice(0, 3);
  
    // return ranking entries (with nation + score etc.) so announce can display exact values
    return { gameType, victoryType, winner, top3, ranking };
  }

export async function checkForGameEnd(client, serverId, intercept = false, interaction = null) {
  const config = await GameConfig.findOne();
  if (!config?.gamemode) return;

  const { gameType, seasonEnd, minNations = 2 } = config.gamemode;
  const nations = await Nation.find();

  if (nations.length < minNations) {
    return;
  }

  // Sandbox ends only if 1 nation has all cities
  if (gameType === "sandbox") {
    const tilesWithCities = await Tile.find({ "city.exists": true });
    const uniqueOwners = new Set(tilesWithCities.map(tile => tile.city.owner).filter(Boolean));

    if (uniqueOwners.size === 1) {
      const winnerServerId = Array.from(uniqueOwners)[0];
      const winner = await Nation.findOne({ serverId: winnerServerId });
      await announceWinner(client, serverId, winner, [winner], gameType, "lastNationStanding");

      if (intercept && interaction) {
        await interaction.reply({ content: "⛔ The season has ended. This command cannot be executed.", ephemeral: true });
      }
      return true;
    }
    return false;
  }

  // Conquest ends if time is up or 1 nation has all cities
  const now = new Date();

  const tilesWithCities = await Tile.find({ "city.exists": true });
  const uniqueOwners = new Set(tilesWithCities.map(tile => tile.city.owner).filter(Boolean));

  console.log('Unique owners with cities:', uniqueOwners.size);
  if (uniqueOwners.size === 1 || (seasonEnd && now >= seasonEnd)) {
    console.log('Game ending conditions met.');
    const { victoryType, winner, top3, ranking } = await determineWinner(serverId);
    console.log('Victory details:', { victoryType, winner: winner ? winner.name : null, top3: top3.map(n => n.name) });
    await announceWinner(client, serverId, winner, top3, gameType, victoryType, ranking);

    if (intercept && interaction) {
        await interaction.reply({ content: "⛔ The season has ended. This command cannot be executed.", ephemeral: true });
      }
      return true;
  }
  return false;
}

async function announceWinner(client, serverId, winner, top3Entries, mode, victoryType, ranking) {
    console.log('Announcing winner for server:', serverId);

    // Create season snapshots FIRST (before announcing)
    try {
      const gameConfig = await GameConfig.findOne();
      const currentSeasonId = gameConfig?.currentSeasonId || 1;

      console.log(`[Victory] Creating season ${currentSeasonId} snapshots...`);
      await createSeasonSnapshots(currentSeasonId);

      // Increment season for next game
      await incrementSeasonId();
      console.log(`[Victory] Season snapshots created and season incremented`);
    } catch (error) {
      console.error("[Victory] Failed to create season snapshots:", error);
      // Continue with announcement even if snapshot fails
    }

    const channelId = channelMap.get(serverId);
    console.log('Announcement channel ID:', channelId);
    if (!channelId) return;

    const victoryDesc = {
      conquest: "Total Conquest",
      power: "Strongest Military",
      cities: "Most Cities",
      gold: "Wealth (Gold)",
      lastNationStanding: "Last Nation Standing"
    }[victoryType] || "by Victory";

    const channel = await client.channels.fetch(channelId);
  
    const fmt = n => (typeof n === "number" ? n.toLocaleString() : (n || "0"));
  
    // Build detail lines using the ranking entries (top3Entries contains objects { nation, score, ... })
    const placeIcons = ["🥇", "🥈", "🥉"];
    const detailLines = top3Entries.map((entry, idx) => {
      if (!entry || !entry.nation) return null;
      const nation = entry.nation;
      const place = placeIcons[idx] || `#${idx + 1}`;
  
      if (victoryType === "power") {
        const powerVal = entry.score ?? 0;
        return `${place} **${nation.name}** — Military Power: ${fmt(powerVal)}`;
      }
  
      if (victoryType === "cities") {
        const cityCount = (nation.buildings?.city ?? entry.score ?? 0);
        const pop = (nation.population ?? entry.tieBreaker ?? 0);
        return `${place} **${nation.name}** — Cities: ${fmt(cityCount)}, Population: ${fmt(pop)}`;
      }
  
      if (victoryType === "gold") {
        const goldVal = entry.score ?? (nation.resources?.gold ?? 0);
        return `${place} **${nation.name}** — Gold: ${fmt(goldVal)}`;
      }
  
      // default: show score if exists, else basic info
      if (typeof entry.score !== "undefined") {
        return `${place} **${nation.name}** — Score: ${fmt(entry.score)}`;
      }
      return `${place} **${nation.name}**`;
    }).filter(Boolean).join("\n");
  
    const embed = new EmbedBuilder()
      .setTitle("🏆 Season Concludes!")
      .setDescription(
        `**Game Mode:** ${mode}\n**Victory Type:** ${victoryDesc}\n\n${detailLines}`
      )
      .setColor("Gold");

    if (winner) {
      embed.addFields({ name: "Champion", value: `🥇 **${winner.name}**`, inline: true });
    }

    // Add claim rewards message
    const gameConfig = await GameConfig.findOne();
    const seasonId = (gameConfig?.currentSeasonId || 1) - 1; // Previous season (we already incremented)

    embed.addFields({
      name: "💎 Claim Your Rewards",
      value: `Players can now claim their share of season rewards!\nUse \`/claimrewards season:${seasonId}\` to claim your portion based on your EXP contribution.`,
      inline: false
    });

    await channel.send({ embeds: [embed] });
  }


// const targetGuild = await interaction.client.guilds.fetch(targetNation.serverId);
// if (targetGuild) {
//   const channel = getServerWarsChannel(targetGuild);
//   if (channel) {
//     await channel.send(
//       `📜 **Envoy from ${nation.name}:**\n> ${message}`
//     );
//   }
// }