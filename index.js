import { 
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
} from "discord.js";

import fetch from "node-fetch";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const MAP_API = process.env.HIVE_API_URL;           // Maps Apps Script
const MODELS_API = process.env.HIVE_MODELS_API_URL; // Models Apps Script


// =====================
// Discord Client
// =====================

const client = new Client({ intents: [GatewayIntentBits.Guilds] });


// =====================
// Slash Commands
// =====================

const mapCommand = new SlashCommandBuilder()
  .setName("map")
  .setDescription("Fetch a Hive Resources map download")
  .addStringOption(opt =>
    opt.setName("gamemode")
      .setDescription("Gamemode")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt.setName("map")
      .setDescription("Map name")
      .setRequired(true)
      .setAutocomplete(true)
  );

const modelCommand = new SlashCommandBuilder()
  .setName("model")
  .setDescription("Fetch a Hive Resources model (entity or item)")
  .addStringOption(opt =>
    opt.setName("gamemode")
      .setDescription("Gamemode")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt.setName("model")
      .setDescription("Model name")
      .setRequired(true)
      .setAutocomplete(true)
  );

const commands = [
  mapCommand.toJSON(),
  modelCommand.toJSON()
];


// =====================
// Register Commands
// =====================

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
  console.log("Slash commands registered");
})();


// =====================
// Helper: Safe Autocomplete
// =====================

async function safeRespond(interaction, choices) {
  try {
    if (!interaction.responded) {
      await interaction.respond(choices);
    }
  } catch (err) {
    if (err.code !== 10062) {
      console.error("Autocomplete error:", err);
    }
  }
}


// =====================
// Interaction Handler
// =====================

client.on("interactionCreate", async (interaction) => {

  // ---------------------
  // AUTOCOMPLETE
  // ---------------------

  if (interaction.isAutocomplete()) {

    const focused = interaction.options.getFocused(true);
    const command = interaction.commandName;

    try {

      // ---- /map autocomplete ----
      if (command === "map") {

        if (focused.name === "gamemode") {
          const res = await fetch(`${MAP_API}?api=gamemodes`);
          const gamemodes = await res.json();

          const filtered = gamemodes
            .filter(g => g.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(g => ({ name: g, value: g }));

          return safeRespond(interaction, filtered);
        }

        if (focused.name === "map") {
          const gm = interaction.options.getString("gamemode");
          if (!gm) return safeRespond(interaction, []);

          const res = await fetch(`${MAP_API}?api=maps&gamemode=${encodeURIComponent(gm)}`);
          const maps = await res.json();

          const filtered = maps
            .filter(m => m.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(m => ({ name: m, value: m }));

          return safeRespond(interaction, filtered);
        }
      }


      // ---- /model autocomplete ----
      if (command === "model") {

        if (focused.name === "gamemode") {
          const res = await fetch(`${MODELS_API}?api=gamemodes`);
          const gamemodes = await res.json();

          const filtered = gamemodes
            .filter(g => g.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(g => ({ name: g, value: g }));

          return safeRespond(interaction, filtered);
        }

        if (focused.name === "model") {
          const gm = interaction.options.getString("gamemode");
          if (!gm) return safeRespond(interaction, []);

          const res = await fetch(`${MODELS_API}?api=models&gamemode=${encodeURIComponent(gm)}`);
          const models = await res.json();

          const filtered = models
            .filter(m => m.name.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(m => ({ name: m.name, value: m.name }));

          return safeRespond(interaction, filtered);
        }
      }

    } catch {
      return safeRespond(interaction, []);
    }
  }


  // ---------------------
  // COMMAND EXECUTION
  // ---------------------

  if (!interaction.isChatInputCommand()) return;

  // ===== /map =====
  if (interaction.commandName === "map") {

    await interaction.deferReply();

    const gamemode = interaction.options.getString("gamemode", true);
    const mapName = interaction.options.getString("map", true);

    try {
      const res = await fetch(
        `${MAP_API}?api=map&gamemode=${encodeURIComponent(gamemode)}&map=${encodeURIComponent(mapName)}`
      );
      const data = await res.json();

      if (data.error) {
        return interaction.editReply(`❌ ${data.error}`);
      }

      const embed = new EmbedBuilder()
        .setColor(0x00afff)
        .setTitle("Hive Resources")
        .setDescription(
          `**Gamemode:** \`${data.gamemode}\`\n` +
          `**Map:** \`${data.name}\`\n` +
          `**Download (\`.${data.format}\`):** [Click here](${data.downloadUrl})`
        )
        .setImage(data.imgUrl)
        .setFooter({ text: "Hive Resources" });

      return interaction.editReply({ embeds: [embed] });

    } catch {
      return interaction.editReply("❌ Error contacting Hive Resources API.");
    }
  }


  // ===== /model =====
  if (interaction.commandName === "model") {

    await interaction.deferReply();

    const gamemode = interaction.options.getString("gamemode", true);
    const modelName = interaction.options.getString("model", true);

    try {
      const res = await fetch(
        `${MODELS_API}?api=model&gamemode=${encodeURIComponent(gamemode)}&model=${encodeURIComponent(modelName)}`
      );
      const data = await res.json();

      if (data.error) {
        return interaction.editReply(`❌ ${data.error}`);
      }

      // Build link to your 3D viewer
      const viewerUrl =
        `${MODELS_API.replace("/exec","")}?game=${encodeURIComponent(gamemode)}&open=${encodeURIComponent(modelName)}`;

      const embed = new EmbedBuilder()
        .setColor(0x00afff)
        .setTitle("Hive Resources")
        .setDescription(
          `**Gamemode:** \`${gamemode}\`\n` +
          `**Model:** \`${modelName}\`\n` +
          `**3D Preview:** [Open viewer](${viewerUrl})\n` +
          `**Download (\`.${data.format}\`):** [Click here](${data.downloadUrl})`
        )
        .setImage(data.imgUrl)
        .setFooter({ text: "Hive Resources" });

      return interaction.editReply({ embeds: [embed] });

    } catch {
      return interaction.editReply("❌ Error contacting Hive Resources API.");
    }
  }
});


// =====================
// Login
// =====================

client.login(TOKEN);
