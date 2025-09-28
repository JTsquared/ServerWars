// src/handlers/truceHandler.js
import Truce from "../models/Truce.js";
import Nation from "../models/Nation.js";
import { checkPermissions, getServerWarsChannel } from "../utils/gameUtils.js";

export async function handleTruceButton(interaction) {
  const [action, truceId] = interaction.customId.split("_").slice(1); // "accept" / "reject", truceId
  const truce = await Truce.findById(truceId);

  if (!truce || truce.status !== "pending") {
    return interaction.reply({ content: "⚠️ This truce offer is no longer valid.", ephemeral: true });
  }

  const requester = await Nation.findOne({ serverId: truce.requesterNationId });
  const target = await Nation.findOne({ serverId: truce.targetNationId });

  if (!checkPermissions(interaction, target, "Diplomatic")) {
    return interaction.reply("🚫 Only the **Foreign Minister** or someone with the Political Leader role may handle foreign relations.");
  }

  // Check if offer expired (4h window from createdAt)
  const expiry = new Date(truce.offerCreatedAt.getTime() + 4 * 60 * 60 * 1000);
  if (new Date() > expiry) {
    truce.status = "expired";
    await truce.save();
    return interaction.reply({ content: "⌛ This truce offer has expired.", ephemeral: true });
  }

  if (!requester || !target) {
    return interaction.reply({ content: "⚠️ One of the nations no longer exists.", ephemeral: true });
  }

  // Ensure only the target nation can reply
  if (interaction.guild.id !== target.serverId) {
    return interaction.reply({ content: "🚫 Only the target nation can respond to this truce.", ephemeral: true });
  }

  if (action === "accept") {
    // If tribute was offered, check and transfer
    if (truce.tributeType && truce.tributeAmount > 0) {
      if ((requester.resources[truce.tributeType] || 0) < truce.tributeAmount) {
        truce.status = "expired";
        await truce.save();
        return interaction.reply("⚠️ The requester no longer has enough resources to pay the tribute. The truce expired.");
      }

      requester.resources[truce.tributeType] -= truce.tributeAmount;
      target.resources[truce.tributeType] += truce.tributeAmount;
    }
  
    truce.status = "accepted";
    truce.startTime = new Date();
    truce.endTime = new Date(Date.now() + (truce.effectiveHours || 24) * 60 * 60 * 1000);
    await Promise.all([requester.save(), target.save(), truce.save()]);
  
    // Notify requester guild with a NEW message
    const requesterGuild = interaction.client.guilds.cache.get(requester.serverId);
    if (requesterGuild) {
      const channel = getServerWarsChannel(requesterGuild);
      if (channel) {
        channel.send(
          `🤝 Your truce offer to **${target.name}** was accepted${
            truce.tributeAmount > 0
              ? `, and ${truce.tributeAmount} ${truce.tributeType} was transferred as tribute.`
              : "!"
          }`
        );
      }
    }
  
    // Still update target guild’s button message to remove components
    return interaction.update({
      content: `✅ Truce accepted${
        truce.tributeAmount > 0
          ? `! Tribute of ${truce.tributeAmount} ${truce.tributeType} transferred.`
          : "!"
      }`,
      components: []
    });
  }
  
  if (action === "reject") {
    truce.status = "rejected";
    await truce.save();
  
    // Notify requester guild with a NEW message
    const requesterGuild = interaction.client.guilds.cache.get(requester.serverId);
    if (requesterGuild) {
      const channel = getServerWarsChannel(requesterGuild);
      if (channel) {
        channel.send(
          `❌ Your truce offer to **${target.name}** was rejected.`
        );
      }
    }
  
    // Update target guild’s message just to disable buttons
    return interaction.update({
      content: "❌ Truce rejected.",
      components: []
    });
  }
  
}
