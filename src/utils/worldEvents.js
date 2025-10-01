import Event from "../models/Event.js";
import Nation from "../models/Nation.js";
import { EmbedBuilder } from "discord.js";
import { getServerWarsChannel } from "./gameUtils.js";
import eventBus from "../utils/eventbus.js";

export async function processPendingEvent(client) {
  let doc = await Event.findOne({});
  if (!doc || !doc.pendingEvent) return;

  // Generate event
  console.log("Generating world event...");
  const { type, targets, effects } = await generateRandomEvent();
  console.log("Event generated:", type, targets, effects);
  console.log("Applying event effects...");
  await applyEvent(type.eventType, targets, effects);

  // Send notifications
  console.log("Notifying nations...");
  await notifyNations(client, type, targets, effects);

  // Update DB
  doc.lastEventAt = new Date();
  doc.nextEventAt = new Date(Date.now() + randomDays(4, 9));
  doc.pendingEvent = false;
//   doc.type = type.eventType;
//   doc.targets = targets;
//   doc.effects = effects;
  console.log("Event processed and saved:", doc);
  await doc.save();
}

export async function generateRandomEvent() {
    const eventKeys = Object.keys(eventMap);
    const randomKey = eventKeys[Math.floor(Math.random() * eventKeys.length)];
    const event = eventMap[randomKey]; // { eventType, eventDescription }
  
    const nations = await Nation.find({});
    if (nations.length === 0) return null;
  
    let targets = [];
    if (["rebellion", "alienInvasion"].includes(event.eventType)) {
      // Single nation
      const randomNation = nations[Math.floor(Math.random() * nations.length)];
      console.log(`Selected nation for world event: ${randomNation.name} (${randomNation.serverId})`);
      targets = [randomNation.serverId];
    } else if (["earthquake", "famine", "moonbagEvent", "plague", "goldRush"].includes(event.eventType)) {
      // Multiple nations
      const shuffled = nations.sort(() => 0.5 - Math.random());
      const count = Math.max(1, Math.floor(nations.length * (0.3 + Math.random() * 0.2)));
      targets = shuffled.slice(0, count).map(n => n.serverId);
    }
  
    // 🎲 Roll effects per event type
    let effects = {};
    switch (event.eventType) {
      case "plague":
        effects = { populationLossPct: 0.1 + Math.random() * 0.15 }; // 10–25%
        break;
      case "famine":
        effects = { foodLossPct: 0.2 + Math.random() * 0.2 }; // 20–40%
        break;
      case "rebellion":
        effects = { militaryLossPct: 0.15 + Math.random() * 0.15 }; // 15–30%
        break;
      case "earthquake":
        effects = {}; // removes 1 city
        break;
      case "goldRush":
        effects = { goldGain: 200 + Math.floor(Math.random() * 800) }; // 200–1000
        break;
      case "alienInvasion":
        effects = {
          populationLossPct: 0.1 + Math.random() * 0.1,
          militaryLossPct: 0.1 + Math.random() * 0.1
        };
        break;
      case "moonbagEvent":
        effects = { goldLossPct: 0.1 + Math.random() * 0.25 }; // 10–35%
        break;
    }
  
    return { type: event, targets, effects };
}
  

export const eventMap = {
    plague: {
      eventType: "plague",
      eventDescription: "A deadly plague sweeps through your nation, reducing population and troop strength.",
      eventName: "Plague",
      eventEffectDesc: "Reduces population by 10-25%"
    },
    earthquake: {
      eventType: "earthquake",
      eventDescription: "A massive earthquake devastates infrastructure, damaging steel production and cities.",
      eventName: "Earthquake",
      eventEffectDesc: "Destroys one or more buildings"
    },
    famine: {
      eventType: "famine",
      eventDescription: "A severe famine strikes, drastically lowering food supplies and morale.",
      eventName: "Famine",
      eventEffectDesc: "Reduces food supplies by 20-40%"
    },
    rebellion: {
      eventType: "rebellion",
      eventDescription: "Civilians rise up against leadership — you lose control of some resources.",
      eventName: "Rebellion",
      eventEffectDesc: "Reduces military strength by 15-30%"
    },
    goldRush: {
      eventType: "goldRush",
      eventDescription: "A massive discovery of gold boosts your nation’s wealth overnight!",
      eventName: "Gold Rush",
      eventEffectDesc: "Gain 200-1000 gold"
    },
    alienInvasion: {
      eventType: "alienInvasion",
      eventDescription: "Extraterrestrial invaders land! Your military scrambles to defend your planet.",
      eventName: "Alien Invasion",
      eventEffectDesc: "Reduces population by 10-20% and military strength by 10-20%"
    },
    moonbagEvent: {
      eventType: "moonbagEvent",
      eventDescription: "A crypto project dumped it's tokens into loan offers which wreckt your portfolio!",
      eventName: "Moonbag Event",
      eventEffectDesc: "Lose 10-35% of your gold reserves"
    }
};
  

async function applyEvent(type, targets, effects) {
  for (const nationId of targets) {
    const nation = await Nation.findOne({ serverId: nationId });
    if (!nation) continue;

    switch (type) {
      case "plague":
        nation.population = Math.max(0, nation.population - Math.floor(nation.population * effects.populationLossPct));
        break;
      case "famine":
        nation.resources.food = Math.max(0, nation.resources.food - Math.floor(nation.resources.food * effects.foodLossPct));
        break;
      case "rebellion":
        // remove 20% of troops, tanks, jets
        for (const [unit, count] of Object.entries(nation.military)) {
          nation.military[unit] = Math.max(0, count - Math.floor(count * effects.militaryLossPct));
        }
        break;
      case "earthquake":
        if (nation.cities.length > 0) nation.cities.pop(); // destroy last city
        break;
      case "goldRush":
        nation.resources.gold = (nation.resources.gold || 0) + effects.goldGain;
        break;
      case "alienInvasion":
        nation.population = Math.max(0, nation.population - Math.floor(nation.population * effects.populationLossPct));
        for (const [unit, count] of Object.entries(nation.military)) {
          nation.military[unit] = Math.max(0, count - Math.floor(count * effects.militaryLossPct));
        }
        break;
      case "moonbagEvent":
        nation.resources.gold = Math.max(0, nation.resources.gold - Math.floor(nation.resources.gold * effects.goldLossPct));
        break;
    }

    await nation.save();
  }
}

export async function checkWorldEvents() {
    let doc = await Event.findOne({});
    if (!doc) {
      doc = new Event({});
    }
  
    const now = Date.now();
  
    if (!doc.nextEventAt) {
      // schedule first
      doc.nextEventAt = new Date(now + randomDays(4, 9));
      await doc.save();
      return;
    }
  
    console.log(`Next event at: ${doc.nextEventAt}, now: ${new Date(now)}`);
    if (now >= doc.nextEventAt.getTime() && !doc.pendingEvent) {
      console.log("Scheduling world event...");
      doc.pendingEvent = true; // mark for background processing
      await doc.save();

      eventBus.emit("worldEventDue");
    }
}

async function notifyNations(client, type, targets, effects) {
    for (const nationId of targets) {
      const guild = client.guilds.cache.get(nationId);
      if (!guild) continue;
  
      const channel = getServerWarsChannel(guild);
      if (!channel) continue;
  
      const embed = new EmbedBuilder()
        .setTitle("🌍 A World Event Has Occurred!")
        .setDescription(`**${type.eventDescription}**`)
        .setColor("Red")
        .addFields({ name: "Event Type", value: type.eventName, inline: true })
        .addFields({ name: "Effects", value: type.eventEffectDesc, inline: false })
        .setTimestamp();
  
      await channel.send({ embeds: [embed] });
    }
}
  

function formatEffects(effects) {
  return Object.entries(effects)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function randomDays(min, max) {
  const days = min + Math.floor(Math.random() * (max - min + 1));
  return days * 24 * 60 * 60 * 1000;
}
