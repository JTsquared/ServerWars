// utils/victory.js
import GameConfig from "../models/GameConfig.js";
import ServerConfig from "../models/ServerConfig.js";
import Nation from "../models/Nation.js";
import { calcNationPower } from "./gameUtils.js";
import { determineWinner } from "./victory.js";
import { channelMap } from "./gameUtils.js";
import { EmbedBuilder } from "discord.js";
import { getServerWarsChannel } from "./gameUtils.js";

export async function determineWinner(serverId) {
  const config = await GameConfig.findOne();
  if (!config?.gamemode) return null;

  const { gameType, seasonEnd, victoryType } = config.gamemode;

  // Fetch all nations in this server
  const nations = await Nation.find();
  if (!nations.length) return null;

  let ranking = [];

  if (victoryType === "military") {
    ranking = nations
      .map(n => ({
        nation: n,
        score: calcNationPower(n) // your existing method
      }))
      .sort((a, b) => b.score - a.score);

  } else if (victoryType === "cities") {
    ranking = nations
      .map(n => ({
        nation: n,
        score: n.cities,
        tieBreaker: n.population
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.tieBreaker - a.tieBreaker;
      });

  } else if (victoryType === "gold") {
    ranking = nations
      .map(n => ({
        nation: n,
        score: n.gold
      }))
      .sort((a, b) => b.score - a.score);
  }

  const winner = ranking[0]?.nation || null;
  const top3 = ranking.slice(0, 3).map(r => r.nation);

  return { gameType, victoryType, winner, top3, ranking };
}

export async function checkForGameEnd(client, serverId) {
  const config = await GameConfig.findOne();
  if (!config?.gamemode) return;

  const { gameType, seasonEnd } = config.gamemode;

  // Sandbox ends only if 1 nation left
  if (gameType === "sandbox") {
    const nations = await Nation.find();
    if (nations.length === 1) {
      await announceWinner(client, serverId, nations[0], [nations[0]], gameType, "lastNationStanding");
    }
    return;
  }

  // Conquest ends if time is up or 1 nation left
  const now = new Date();
  const nations = await Nation.find();

  if (nations.length === 1 || (seasonEnd && now >= seasonEnd)) {
    const { victoryType, winner, top3 } = await determineWinner(serverId);
    await announceWinner(client, serverId, winner, top3, gameType, victoryType);
  }
}

async function announceWinner(client, serverId, winner, top3, mode, victoryType) {
  const channelId = channelMap.get(serverId);
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId);

  const embed = new EmbedBuilder()
    .setTitle("🏆 Season Concludes!")
    .setDescription(
      `**Game Mode:** ${mode}\n**Victory Type:** ${victoryType}\n\n` +
      `🥇 Winner: **${winner.name}**\n\n` +
      `🥈 2nd: ${top3[1]?.name || "N/A"}\n` +
      `🥉 3rd: ${top3[2]?.name || "N/A"}`
    )
    .setColor("Gold");

  await channel.send({ embeds: [embed] });
}
