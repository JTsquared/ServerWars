// createNation.js
import { SlashCommandBuilder, PermissionFlagsBits, Colors } from "discord.js";
import Nation from "../models/Nation.js";
import Tile from "../models/Tile.js";
import { NATION_TRAITS, WORLD_TILES } from "../utils/constants.js";
import ServerConfig from "../models/ServerConfig.js";
import GameConfig from "../models/GameConfig.js";
import { channelMap } from "../utils/gameUtils.js";
import { createPrizePoolWallet } from "../utils/prizePoolApi.js";

export const data = new SlashCommandBuilder()
  .setName("createnation")
  .setDescription("Create a nation for this server.")
  .addStringOption(option =>
    option.setName("name")
      .setDescription("The name of your nation")
      .setRequired(true))
  .addStringOption(option =>
    option.setName("trait")
      .setDescription("Pick your nation’s trait")
      .setRequired(true)
      .addChoices(
        ...Object.entries(NATION_TRAITS)
          .map(([key, value]) => ({
            name: value.trait,
            value: key, // 👈 use key (e.g. "BANK"), not lowercased
          }))
      ))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const existing = await Nation.findOne({ serverId: interaction.guild.id });
  if (existing) {
    return interaction.reply("⚠️ A nation already exists for this server!");
  }

  const name = interaction.options.getString("name");
  const trait = interaction.options.getString("trait");

  // --- Create the initial tile for the nation ---
  // Determine next available tileId (1..WORLD_TILES)
  // const WORLD_TILES = parseInt(process.env.WORLD_TILES || "1000", 10);

  // Fetch all used tileIds
  const existingTileIds = (await Tile.distinct("tileId")).map(String);
  
  // Find the first free one
  let tileId = null;
  for (let i = 1; i <= WORLD_TILES; i++) {
    if (!existingTileIds.includes(String(i))) {  // ensure string comparison
      tileId = String(i); // also store as string
      break;
    }
  }
  
  if (!tileId) {
    return interaction.reply("❌ All world tiles have been allocated. Cannot create a nation.");
  }

  const nation = new Nation({
    serverId: interaction.guild.id,
    name,
    trait,
    playerCount: 0,
    tilesDiscovered: 1, // first tile discovered
    // tilesSurveyed could be dynamic or added here if you want
  });

  await nation.save();

  // Generate tile resources (guaranteed)
  const fertility = Math.floor(Math.random() * 3); // 0-2
  const resources = {
    food: Math.floor(Math.random() * 20) + 5,
    steel: Math.floor(Math.random() * 10) + 2,
    oil: Math.floor(Math.random() * 10) + 2,
    fertility
  };

  const tile = new Tile({
    tileId,
    resources,
    city: {
      exists: true,
      owner: nation.serverId,
      ownerName: nation.name,
      foundedAt: new Date(),
      name: `${name} Capital`
    },
    surveyedBy: [nation.serverId] // surveyed immediately
  });

  await tile.save();

  // Ensure "Political Leader" role exists
  let leaderRole = interaction.guild.roles.cache.find(r => r.name === "Political Leader");
  if (!leaderRole) {
    leaderRole = await interaction.guild.roles.create({
      name: "Political Leader",
      color: Colors.Gold,
      reason: "Nation leader role"
    });
  }

  // Assign role to the command invoker
  await interaction.member.roles.add(leaderRole);

    // Ensure "Treasury" role exists
  let financeRole = interaction.guild.roles.cache.find(r => r.name === "Treasury");
  if (!financeRole) {
    financeRole = await interaction.guild.roles.create({
      name: "Treasury",
      color: Colors.Green,
      reason: "Perform financial actions for the nation"
    });
  }

  // Assign Treasury role to the command invoker (default until reassigned)
  await interaction.member.roles.add(financeRole);

  const channel = interaction.guild.channels.cache.find(
    c =>
      c.isTextBased() &&
      !c.isThread() &&
      c.permissionsFor(interaction.guild.members.me)?.has("SendMessages")
  );
  
  if (channel) {
    await ServerConfig.findOneAndUpdate(
      { serverId: interaction.guild.id },
      { defaultChannelId: channel.id },
      { upsert: true }
    );
    channelMap.set(interaction.guild.id, channel.id);
  }

  // Check if crypto is enabled for this game
  const gameConfig = await GameConfig.findOne();
  const cryptoEnabled = gameConfig?.enableCrypto || false;

  // Create prize pool wallet if crypto is enabled
  if (cryptoEnabled) {
    const appId = interaction.client.user.id;
    try {
      const walletResult = await createPrizePoolWallet(interaction.guild.id, appId);

      if (walletResult.success) {
        console.log(`✅ Prize pool wallet created for ${name}: ${walletResult.wallet.address}`);
      } else if (walletResult.error === "WALLET_ALREADY_EXISTS") {
        console.log(`ℹ️ Prize pool wallet already exists for ${name}`);
      } else {
        // HARD STOP: Wallet creation is required when crypto is enabled
        console.error(`❌ Failed to create prize pool wallet for ${name}: ${walletResult.error}`);

        // Roll back nation and tile creation
        await Nation.deleteOne({ serverId: interaction.guild.id });
        await Tile.deleteOne({ tileId });

        return interaction.reply({
          content: `❌ Failed to create crypto wallet for your nation: ${walletResult.error}\n\nPlease try again or contact an administrator if the problem persists.`,
          ephemeral: true
        });
      }
    } catch (error) {
      console.error("Error creating prize pool wallet:", error);

      // Roll back nation and tile creation
      await Nation.deleteOne({ serverId: interaction.guild.id });
      await Tile.deleteOne({ tileId });

      return interaction.reply({
        content: `❌ An error occurred while creating the crypto wallet for your nation.\n\nPlease try again or contact an administrator.`,
        ephemeral: true
      });
    }
  } else {
    console.log(`ℹ️ Crypto disabled - skipping prize pool wallet creation for ${name}`);
  }

  const traitName = NATION_TRAITS[trait].trait;
  await interaction.reply(
    `🏰 The nation of **${name}** has been founded! ${interaction.user.username} has been assigned the Political Leader role.\nYour nation has chosen the **${traitName}** trait.`
  );
}
