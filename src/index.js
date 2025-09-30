import { Client, GatewayIntentBits, Collection, REST, Routes } from "discord.js";
import { config } from "dotenv";
import fs from "fs";
import { connectDB } from "./db.js";
import { handleTruceButton } from "./handlers/truceHandler.js";
import { handleTradeButton } from "./handlers/tradeHandler.js";
import { handleTradeCounterModal } from "./handlers/tradeCounterHandler.js";
import Config from "./models/Config.js";
import { channelMap } from "./utils/gameUtils.js";

config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Load commands
const commands = [];
const commandFiles = fs.readdirSync("./src/commands").filter(file => file.endsWith(".js"));
for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

async function loadChannelMap() {
  const configs = await Config.find();
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
  console.log("🔄 Registering slash commands...");

  // if (process.env.GUILD_ID) {
  //   await rest.put(
  //     Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
  //     { body: commands }
  //   );
  //   console.log("✅ Guild commands registered (instant).");
  // }

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log("✅ Global commands registered (may take up to 1h).");
}

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
  
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "⚠️ Error executing command.", ephemeral: true });
    }
  } else if (interaction.isButton()) {
    if (interaction.customId.startsWith("truce_")) {
      return handleTruceButton(interaction); // imported from truce.js
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

client.login(process.env.DISCORD_TOKEN);
