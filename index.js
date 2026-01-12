import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";

const CLIENT_ID = process.env.CLIENT_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const HIVE_MAPS_API = process.env.HIVE_MAPS_API_URL;     // maps Apps Script
const HIVE_MODELS_API = process.env.HIVE_MODELS_API_URL; // models Apps Script
const GUILD_ID = "1197113840899461140"; // your server

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* -------------------- */
/* Slash Command Setup  */
/* -------------------- */

const commands = [

  new SlashCommandBuilder()
    .setName("map")
    .setDescription("Fetch a Hive Resources map download")
    .addStringOption(option =>
      option.setName("gamemode")
        .setDescription("Gamemode")
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName("map")
        .setDescription("Map name")
        .setRequired(true)
        .setAutocomplete(true)),

  new SlashCommandBuilder()
    .setName("model")
    .setDescription("Fetch a Hive Resources model (entity / item)")
    .addStringOption(option =>
      option.setName("gamemode")
        .setDescription("Gamemode")
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName("model")
        .setDescription("Model name")
        .setRequired(true)
        .setAutocomplete(true))

].map(cmd => cmd.toJSON());


/* Register commands ONLY to guild (prevents duplicates while developing) */
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands registered.");
  } catch (err) {
    console.error(err);
  }
})();


/* -------------------- */
/* Helper functions     */
/* -------------------- */

function normalizeGamemode(label) {
  return label
    .toLowerCase()
    .replace(/\s*[-—]\s*/g, ": ")
    .replace(/\s+/g, " ")
    .trim();
}


/* -------------------- */
/* Bot ready            */
/* -------------------- */

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});


/* -------------------- */
/* Autocomplete         */
/* -------------------- */

client.on("interactionCreate", async interaction => {
  if (!interaction.isAutocomplete()) return;

  const focused = interaction.options.getFocused(true);
  const command = interaction.commandName;

  try {

    /* ---- MAP AUTOCOMPLETE ---- */
    if (command === "map") {

      // gamemode autocomplete
      if (focused.name === "gamemode") {
        const res = await fetch(`${HIVE_MAPS_API}?mode=gamemodes`);
        const data = await res.json();

        return interaction.respond(
          data.map(g => ({
            name: normalizeGamemode(g),
            value: normalizeGamemode(g)
          }))
        );
      }

      // map name autocomplete
      if (focused.name === "map") {
        const gm = interaction.options.getString("gamemode");
        if (!gm) return interaction.respond([]);

        const res = await fetch(`${HIVE_MAPS_API}?mode=list&game=${encodeURIComponent(gm)}`);
        const data = await res.json();

        return interaction.respond(
          data.map(m => ({
            name: m.name,
            value: m.name
          }))
        );
      }
    }


    /* ---- MODEL AUTOCOMPLETE ---- */
    if (command === "model") {

      if (focused.name === "gamemode") {
        const res = await fetch(`${HIVE_MODELS_API}?mode=gamemodes`);
        const data = await res.json();

        return interaction.respond(
          data.map(g => ({
            name: normalizeGamemode(g),
            value: normalizeGamemode(g)
          }))
        );
      }

      if (focused.name === "model") {
        const gm = interaction.options.getString("gamemode");
        if (!gm) return interaction.respond([]);

        const res = await fetch(`${HIVE_MODELS_API}?mode=list&game=${encodeURIComponent(gm)}`);
        const data = await res.json();

        return interaction.respond(
          data.map(m => ({
            name: m.name,
            value: m.name
          }))
        );
      }
    }

  } catch (err) {
    console.error("Autocomplete error:", err);
    return interaction.respond([]);
  }
});


/* -------------------- */
/* Command Execution    */
/* -------------------- */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  await interaction.deferReply();

  try {

    /* ---- /map ---- */
    if (commandName === "map") {

      const gamemode = interaction.options.getString("gamemode");
      const map = interaction.options.getString("map");

      const res = await fetch(`${HIVE_MAPS_API}?mode=fetch&game=${encodeURIComponent(gamemode)}&map=${encodeURIComponent(map)}`);
      const data = await res.json();

      if (!data || !data.downloadUrl) {
        return interaction.editReply("❌ Map not found.");
      }

      const embed = new EmbedBuilder()
        .setColor("#00afff")
        .setImage(data.imageUrl)
        .setFooter({ text: "Hive Resources" })
        .setDescription(
          `**Gamemode:** \`${gamemode}\`\n` +
          `**Map:** \`${map}\`\n` +
          `**Download:** [Click here](${data.downloadUrl})`
        );

      return interaction.editReply({ embeds: [embed] });
    }


    /* ---- /model ---- */
    if (commandName === "model") {

      const gamemode = interaction.options.getString("gamemode");
      const model = interaction.options.getString("model");

      const res = await fetch(`${HIVE_MODELS_API}?mode=fetch&game=${encodeURIComponent(gamemode)}&model=${encodeURIComponent(model)}`);
      const data = await res.json();

      if (!data || !data.downloadUrl) {
        return interaction.editReply("❌ Model not found.");
      }

      const embed = new EmbedBuilder()
        .setColor("#00afff")
        .setImage(data.previewImage || null)
        .setFooter({ text: "Hive Resources" })
        .setDescription(
          `**Gamemode:** \`${gamemode}\`\n` +
          `**Model:** \`${model}\`\n` +
          `**Download:** [Click here](${data.downloadUrl})`
        );

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (err) {
    console.error("Command error:", err);
    return interaction.editReply("❌ Error contacting Hive Resources API.");
  }
});


/* -------------------- */

client.login(DISCORD_TOKEN);
