// createNation.js
import { SlashCommandBuilder, PermissionFlagsBits, Colors } from "discord.js";
import Nation from "../models/Nation.js";
import Tile from "../models/Tile.js";
import { WORLD_TILES } from "../utils/constants.js";

export const data = new SlashCommandBuilder()
  .setName("createnation")
  .setDescription("Create a nation for this server.")
  .addStringOption(option =>
    option.setName("name")
      .setDescription("The name of your nation")
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const existing = await Nation.findOne({ serverId: interaction.guild.id });
  if (existing) {
    return interaction.reply("⚠️ A nation already exists for this server!");
  }

  const name = interaction.options.getString("name");

  const nation = new Nation({
    serverId: interaction.guild.id,
    name,
    playerCount: 0,
    tilesDiscovered: 1, // first tile discovered
    // tilesSurveyed could be dynamic or added here if you want
  });

  await nation.save();

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

  await interaction.reply(
    `🏰 The nation of **${name}** has been founded! ${interaction.user.username} has been assigned the Political Leader role.\n`
  );
}
