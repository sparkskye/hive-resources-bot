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

const MAP_API = process.env.HIVE_API_URL;           
const MODELS_API = process.env.HIVE_MODELS_API_URL;

const GUILD_ID = "1197113840899461140";


// ---------- Helpers ----------

// Convert folder display names → discord-friendly format
function formatGamemode(name) {
  return name
    .toLowerCase()
    .replace(/ — /g, ": ")
    .replace(/ - /g, ": ");
}

// Convert discord-friendly → original folder format
function unformatGamemode(name, originalList) {
  return originalList.find(g => formatGamemode(g) === name) || name;
}


// ---------- Discord Client ----------

const client = new Client({ intents: [GatewayIntentBits.Guilds] });


// ---------- Slash Commands ----------

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


// ---------- Register Commands (Guild) ----------

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("Slash commands registered to guild");
})();


// ---------- Safe Autocomplete ----------

async function safeRespond(interaction, choices) {
  try {
    if (!interaction.responded) {
      await interaction.respond(choices);
    }
  } catch {}
}


// ---------- Interaction Handler ----------

client.on("interactionCreate", async (interaction) => {

  // ----- AUTOCOMPLETE -----
  if (interaction.isAutocomplete()) {

    const focused = interaction.options.getFocused(true);
    const command = interaction.commandName;

    try {

      // ===== MAP AUTOCOMPLETE =====
      if (command === "map") {

        // Gamemodes
        if (focused.name === "gamemode") {
          const res = await fetch(`${MAP_API}?api=gamemodes`);
          const gamemodes = await res.json();

          const formatted = gamemodes.map(g => ({
            original: g,
            formatted: formatGamemode(g)
          }));

          const filtered = formatted
            .filter(g => g.formatted.includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(g => ({ name: g.formatted, value: g.formatted }));

          return safeRespond(interaction, filtered);
        }

        // Maps
        if (focused.name === "map") {
          const gmInput = interaction.options.getString("gamemode");
          if (!gmInput) return safeRespond(interaction, []);

          const res = await fetch(`${MAP_API}?api=gamemodes`);
          const gamemodes = await res.json();
          const gmOriginal = unformatGamemode(gmInput, gamemodes);

          const res2 = await fetch(`${MAP_API}?api=maps&gamemode=${encodeURIComponent(gmOriginal)}`);
          const maps = await res2.json();

          const filtered = maps
            .filter(m => m.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(m => ({ name: m, value: m }));

          return safeRespond(interaction, filtered);
        }
      }


      // ===== MODEL AUTOCOMPLETE =====
      if (command === "model") {

        // Gamemodes from MODELS API
        if (focused.name === "gamemode") {
          const res = await fetch(`${MODELS_API}?mode=json`);
          const data = await res.json();
          const gamemodes = data.gamemodes;

          const formatted = gamemodes.map(g => ({
            original: g,
            formatted: formatGamemode(g)
          }));

          const filtered = formatted
            .filter(g => g.formatted.includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(g => ({ name: g.formatted, value: g.formatted }));

          return safeRespond(interaction, filtered);
        }

        // Models per gamemode
        if (focused.name === "model") {
          const gmInput = interaction.options.getString("gamemode");
          if (!gmInput) return safeRespond(interaction, []);

          const res = await fetch(`${MODELS_API}?mode=json`);
          const data = await res.json();
          const gmOriginal = unformatGamemode(gmInput, data.gamemodes);

          const res2 = await fetch(`${MODELS_API}?mode=json&game=${encodeURIComponent(gmOriginal)}`);
          const data2 = await res2.json();
          const models = data2.models;

          const filtered = models
            .filter(m => m.displayName.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(m => ({ name: m.displayName, value: m.displayName }));

          return safeRespond(interaction, filtered);
        }
      }

    } catch {
      return safeRespond(interaction, []);
    }
  }


  // ----- COMMAND EXECUTION -----
  if (!interaction.isChatInputCommand()) return;


  // ===== /map =====
  if (interaction.commandName === "map") {

    await interaction.deferReply();

    const gmInput = interaction.options.getString("gamemode", true);
    const mapName = interaction.options.getString("map", true);

    const resGM = await fetch(`${MAP_API}?api=gamemodes`);
    const gamemodes = await resGM.json();
    const gmOriginal = unformatGamemode(gmInput, gamemodes);

    try {
      const res = await fetch(
        `${MAP_API}?api=map&gamemode=${encodeURIComponent(gmOriginal)}&map=${encodeURIComponent(mapName)}`
      );
      const data = await res.json();

      if (data.error) {
        return interaction.editReply(`❌ ${data.error}`);
      }

      const embed = new EmbedBuilder()
        .setColor(0x00afff)
        .setDescription(
          `**gamemode:** \`${formatGamemode(data.gamemode)}\`\n` +
          `**map:** \`${data.name}\`\n` +
          `**download:** [click here](${data.downloadUrl})`
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

    const gmInput = interaction.options.getString("gamemode", true);
    const modelName = interaction.options.getString("model", true);

    // Get gamemode list from models API
    const resGM = await fetch(`${MODELS_API}?mode=json`);
    const dataGM = await resGM.json();
    const gmOriginal = unformatGamemode(gmInput, dataGM.gamemodes);

    try {
      const res = await fetch(
        `${MODELS_API}?mode=json&game=${encodeURIComponent(gmOriginal)}&open=${encodeURIComponent(modelName)}`
      );
      const data = await res.json();

      if (!data.model) {
        return interaction.editReply("❌ Model not found.");
      }

      const viewerUrl =
        `${MODELS_API.replace("/exec","")}?game=${encodeURIComponent(gmOriginal)}&open=${encodeURIComponent(modelName)}`;

      const embed = new EmbedBuilder()
        .setColor(0x00afff)
        .setDescription(
          `**gamemode:** \`${formatGamemode(gmOriginal)}\`\n` +
          `**model:** \`${modelName}\`\n` +
          `**3d preview:** [open viewer](${viewerUrl})\n` +
          `**download:** [click here](${data.model.download})`
        )
        .setImage(data.model.thumbnail)
        .setFooter({ text: "Hive Resources" });

      return interaction.editReply({ embeds: [embed] });

    } catch {
      return interaction.editReply("❌ Error contacting Hive Resources Models API.");
    }
  }
});


// ---------- Login ----------
client.login(TOKEN);
