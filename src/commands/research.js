// commands/research.js
import Nation from "../models/Nation.js";
import Player from "../models/Player.js";
import { RESEARCH } from "../utils/constants.js";
import { SlashCommandBuilder } from "discord.js";
import { checkWorldEvents } from "../utils/worldEvents.js";

export const data = new SlashCommandBuilder()
  .setName("research")
  .setDescription("Conduct research to unlock new technologies.")
  .addStringOption(option =>
    option
      .setName("field")
      .setDescription("The research field you want to unlock.")
      .setRequired(true)
      .addChoices(
        ...Object.keys(RESEARCH).map(key => ({
          name: RESEARCH[key].name,
          value: key,
        }))
      )
  );

  export async function execute(interaction) {

    await checkWorldEvents();

    const userId = interaction.user.id;
    const field = interaction.options.getString("field");
  
    const nation = await Nation.findOne({ serverId: interaction.guild.id });
    if (!nation) {
      return interaction.reply("❌ Your nation does not exist. Use `/createNation` first.");
    }
  
    const player = await Player.findOne({ userId: interaction.user.id, serverId: interaction.guild.id });
    if (!player) {
      return interaction.reply("⚠️ You must `/join` this nation before you can send spies.");
    }
  
    // Map RESEARCH key to schema field
    const schemaField = RESEARCH[field]?.dbname;
    console.log("Schema Field:", schemaField);
  
    if (nation.research[schemaField]) {
      return interaction.reply(`You have already completed **${RESEARCH[field].name}** research.`);
    }
  
    const cost = RESEARCH[field].cost;
  
    const { gold = 0, steel = 0 } = cost;

    // Check resources
    if (nation.resources.gold < gold || nation.resources.steel < steel) {
        let reply = `You don't have enough resources. You need ${gold} gold `;
        if (steel > 0) reply += `and ${steel} steel `;
        reply += `to research ${RESEARCH[field].name}.`
        await interaction.reply(reply);
        return;
    }
  
    // Deduct resources
    nation.resources.gold -= gold;
    nation.resources.steel -= steel;
    nation.research[schemaField] = true;
    await nation.save();
  
    return interaction.reply(
      `✅ Research completed: **${RESEARCH[field].name}** research\n` +
      `- Cost: ${gold} gold${steel > 0 ? `, ${steel} steel` : ''}\n` +
      `- Remaining Resources: ${nation.resources.gold} gold, ${nation.resources.steel} steel`
    );
  }
