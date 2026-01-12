import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_URL = process.env.HIVE_API_URL;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });


// ---- Register Slash Command ----
const commands = [
  new SlashCommandBuilder()
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
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Slash commands registered");
})();


// ---- Safe Autocomplete Helper ----
async function safeRespond(interaction, choices) {
  try {
    if (!interaction.responded) {
      await interaction.respond(choices);
    }
  } catch (err) {
    // Ignore "Unknown interaction" errors — Discord timed out
    if (err.code !== 10062) {
      console.error("Autocomplete error:", err);
    }
  }
}


// ---- Interaction Handling ----
client.on("interactionCreate", async (interaction) => {

  // ===== AUTOCOMPLETE =====
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused(true);
    const gm = interaction.options.getString("gamemode") || "";

    // Immediately defer by sending empty response if slow
    // (prevents Discord timeout)
    const start = Date.now();

    try {
      // ---- Gamemode ----
      if (focused.name === "gamemode") {
        const res = await fetch(`${API_URL}?api=gamemodes`);
        const gamemodes = await res.json();

        const filtered = gamemodes
          .filter(x => x.toLowerCase().includes(focused.value.toLowerCase()))
          .slice(0, 25)
          .map(x => ({ name: x, value: x }));

        return safeRespond(interaction, filtered);
      }

      // ---- Map ----
      if (focused.name === "map") {
        if (!gm) return safeRespond(interaction, []);

        const res = await fetch(`${API_URL}?api=maps&gamemode=${encodeURIComponent(gm)}`);
        const maps = await res.json();

        const filtered = maps
          .filter(x => x.toLowerCase().includes(focused.value.toLowerCase()))
          .slice(0, 25)
          .map(x => ({ name: x, value: x }));

        return safeRespond(interaction, filtered);
      }

    } catch (err) {
      return safeRespond(interaction, []);
    }
  }


  // ===== SLASH COMMAND =====
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "map") return;

  await interaction.deferReply();

  const gamemode = interaction.options.getString("gamemode", true);
  const map = interaction.options.getString("map", true);

  try {
    const url = `${API_URL}?api=map&gamemode=${encodeURIComponent(gamemode)}&map=${encodeURIComponent(map)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return interaction.editReply(`❌ ${data.error}`);
    }

    const embed = new EmbedBuilder()
      .setTitle(data.name)
      .setDescription(`**Gamemode:** ${data.gamemode}`)
      .addFields({ name: "Download (.glb)", value: `[Click here](${data.downloadUrl})` })
      .setColor(0x00afff)
      .setFooter({ text: "Hive Resources" });

    if (data.imgUrl) embed.setImage(data.imgUrl);

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    await interaction.editReply("❌ Error contacting Hive Resources API");
  }
});

client.login(TOKEN);
