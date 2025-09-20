// spy.js
import { SlashCommandBuilder } from "discord.js";
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import Tile from "../models/Tile.js";
import Intel from "../models/Intel.js";
import { SPY_COOLDOWN_MS, SPY_SUCCESS_CHANCE, EXP_GAIN } from "../utils/constants.js";

export const data = new SlashCommandBuilder()
  .setName("spy")
  .setDescription("Send spies to gather intel on a rival city.")
  .addStringOption(option =>
    option.setName("tile")
      .setDescription("The ID of the tile containing the target city.")
      .setRequired(true)
  );

export async function execute(interaction) {
  const nation = await Nation.findOne({ serverId: interaction.guild.id });
  if (!nation) return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");

  const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
  if (!player) return interaction.reply("⚠️ You must `/join` this nation before you can send spies.");

  const tileId = interaction.options.getString("tile");
  const tile = await Tile.findOne({ tileId });
  if (!tile || !tile.city.exists) {
    return interaction.reply("🚫 That tile has no city to spy on.");
  }
  if (!tile.surveyedBy.includes(nation.serverId)) {
    return interaction.reply("🚫 You cannot spy on a city your nation hasn’t surveyed.");
  }

  const targetNation = await Nation.findOne({ serverId: tile.city.owner });
  if (!targetNation) return interaction.reply("❌ Target nation not found.");

  // Look up intel record for this pair
  let intel = await Intel.findOne({
    spyingNationId: nation.serverId,
    targetNationId: targetNation.serverId,
  });

  // Cooldown check
  if (intel?.lastAttemptAt) {
    const elapsed = Date.now() - intel.lastAttemptAt.getTime();
    if (elapsed < SPY_COOLDOWN_MS) {
      const mins = Math.ceil((SPY_COOLDOWN_MS - elapsed) / 60000);
      return interaction.reply(`⏳ You must wait ${mins} more minutes before attempting another spy mission on this nation.`);
    }
  }

  const rankUpMsg = await grantExp(player, "diplomat", EXP_GAIN.DIPLOMAT, nation);
  await setResourceCooldown(player);

  // Attempt spy roll
  const success = Math.random() < SPY_SUCCESS_CHANCE;
  if (success) {
    // Overwrite / upsert intel report
    intel = await Intel.findOneAndUpdate(
      { spyingNationId: nation.serverId, targetNationId: targetNation.serverId },
      {
        spyingNationId: nation.serverId,
        targetNationId: targetNation.serverId,
        report: {
          nationName: targetNation.name,
          population: targetNation.population,
          cities: targetNation.buildings.city,
          resources: targetNation.resources,
          military: {
            troops: targetNation.military.troops,
            tanks: targetNation.military.tanks,
            jets: targetNation.military.jets,
          },
          buildings: targetNation.buildings,
        },
        failedAttempts: 0,
        lastAttemptAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await player.save();

    let reply = `🕵️ Your spies successfully infiltrated **${targetNation.name}** and gathered intel!\n` +
    `Use \`/intelreport\` to view the latest reports.` +
    `+${EXP_GAIN.DIPLOMAT} Economist EXP (Current: ${player.exp.diplomat})`;
    if (rankUpMsg) reply += `\n${rankUpMsg}`;

    await interaction.reply(reply);

  } else {
    // Fail — increment attempts
    intel = await Intel.findOneAndUpdate(
      { spyingNationId: nation.serverId, targetNationId: targetNation.serverId },
      {
        spyingNationId: nation.serverId,
        targetNationId: targetNation.serverId,
        $inc: { failedAttempts: 1 },
        lastAttemptAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // If 4 fails, notify target & reset
    if (intel.failedAttempts >= 4) {
      const targetGuild = interaction.client.guilds.cache.get(targetNation.serverId);
      if (targetGuild) {
        const notifyChannel = targetGuild.channels.cache.find(
          ch => ch.isTextBased() && ch.permissionsFor(targetGuild.members.me).has("SendMessages")
        );
        if (notifyChannel) {
          notifyChannel.send(`🚨 Our defenses have detected repeated spy attempts from **${nation.name}**!`);
        }
      }

      intel.failedAttempts = 0;
      await intel.save();
    }

    await setResourceCooldown(player, "settle");
    await Promise.all([saveUser(player), saveNation(nation)]);

    let reply = `🕵️ Your spies failed to gather any useful information. Be careful, too many failed attempts will alert ${nation.name}.` +
    `+${EXP_GAIN.DIPLOMAT} Economist EXP (Current: ${player.exp.diplomat})`;
    if (rankUpMsg) reply += `\n${rankUpMsg}`;

    await interaction.reply(reply);
  }
}
