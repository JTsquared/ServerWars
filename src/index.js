import { Client, GatewayIntentBits, Collection, REST, Routes } from "discord.js";
import { config } from "dotenv";
import fs from "fs";
import { connectDB } from "./db.js";
import { handleTruceButton } from "./handlers/truceHandler.js";
import { handleTradeButton } from "./handlers/tradeHandler.js";
import { handleTradeCounterModal } from "./handlers/tradeCounterHandler.js";
import ServerConfig from "./models/ServerConfig.js";
import Nation from "./models/Nation.js";
import Tile from "./models/Tile.js";
import { channelMap } from "./utils/gameUtils.js";
import eventBus from "./utils/eventbus.js";
import { processPendingEvent } from "./utils/worldEvents.js";
import { checkForGameEnd } from "./utils/victory.js";

config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Load commands
const commands = [];
const hiddenCommands = [];
const commandFiles = fs.readdirSync("./src/commands").filter(file => file.endsWith(".js"));
for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);

  // Skip hidden commands from regular registration
  if (command.hidden) {
    console.log(`Found hidden command: ${command.data.name}`);
    client.commands.set(command.data.name, command);
    hiddenCommands.push(command.data.toJSON());
    continue;
  }

  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

async function loadChannelMap() {
  const configs = await ServerConfig.find();
  configs.forEach(cfg => {
    if (cfg.defaultChannelId) {
      channelMap.set(cfg.serverId, cfg.defaultChannelId);
    }
  });
  console.log("✅ Channel map loaded into memory.");
}

// Register commands (guild + global)
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  console.log(`🔄 Registering slash commands... (Environment: ${process.env.NODE_ENV || 'production'})`);

  // In development: Register all commands (regular + hidden) in the test guild
  if (isDevelopment && process.env.GUILD_ID) {
    const allCommands = [...commands, ...hiddenCommands];
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: allCommands }
    );
    console.log(`✅ Registered ${allCommands.length} commands in test guild (${commands.length} regular + ${hiddenCommands.length} hidden)`);
  } else {
    // In production: Only register regular commands globally
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log(`✅ Registered ${commands.length} global commands (hidden commands not registered)`);
  }
}

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      // Skip game-specific checks for hidden/dev commands
      const isHiddenCommand = command.hidden === true;

      if (!isHiddenCommand) {
        const gameEnded = await checkForGameEnd(client, interaction.guildId, true, interaction);
        if (gameEnded) return;

        // Define read-only commands that can be used even when eliminated
        const readOnlyCommands = ['stats', 'playerstats', 'intelreport', 'surveyreport', 'help'];

        // Check if nation is eliminated (for action commands only)
        if (!readOnlyCommands.includes(interaction.commandName)) {
          const nation = await Nation.findOne({ serverId: interaction.guildId });

          if (nation) {
            const citiesOwned = await Tile.countDocuments({
              "city.exists": true,
              "city.owner": nation.serverId
            });

            if (citiesOwned === 0) {
              await interaction.reply({
                content: "💀 Your nation has been eliminated (no cities remaining). You cannot execute this command.",
                ephemeral: true
              });
              return;
            }
          }
        }
      } else {
        console.log(`[Hidden Command] Executing: ${interaction.commandName}`);
      }

      await command.execute(interaction);

    } catch (err) {
      console.error('[Command Error]', interaction.commandName, err);

      // Try to respond or edit reply depending on interaction state
      const errorMsg = { content: `⚠️ Error executing command: ${err.message}`, ephemeral: true };
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(errorMsg);
        } else {
          await interaction.reply(errorMsg);
        }
      } catch (replyError) {
        console.error('[Reply Error]', replyError);
      }
    }
  } else if (interaction.isButton()) {
    if (interaction.customId.startsWith("truce_")) {
      return handleTruceButton(interaction);
    } else if (interaction.customId.startsWith("trade_")) {
      return handleTradeButton(interaction);
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("tradeCounter_")) {
      return handleTradeCounterModal(interaction);
    }
  }
});

client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  await connectDB();
  await registerCommands();
  await loadChannelMap();
});

let eventScheduled = false;
eventBus.on("worldEventDue", async event => {
  if (eventScheduled) return; // prevent duplicate timers

  eventScheduled = true;

  console.log("⚡ World event scheduled, triggering in 30s...");
  setTimeout(async () => {
    try {
      await processPendingEvent(client);
    } catch (err) {
      console.error("Error processing event:", err);
    } finally {
      eventScheduled = false; // reset for future events
    }
  }, 30 * 1000);
});

client.login(process.env.DISCORD_TOKEN);

