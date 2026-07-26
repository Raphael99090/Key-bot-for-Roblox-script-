const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const config = require("../config");
const logger = require("../utils/logger");
const adminPanel = require("./adminPanel");
const storePanel = require("./storePanel");

function createClient() {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    client.commands = new Collection();

    // Carrega todo arquivo dentro de commands/ automaticamente —
    // pra adicionar um comando novo, basta criar o arquivo lá,
    // não precisa registrar ele em lugar nenhum aqui.
    const commandsDir = path.join(__dirname, "commands");
    for (const file of fs.readdirSync(commandsDir)) {
        if (!file.endsWith(".js")) continue;
        const command = require(path.join(commandsDir, file));
        if (!command?.data || !command?.execute) {
            logger.warn(`Comando em ${file} está incompleto (faltando 'data' ou 'execute') — ignorado.`);
            continue;
        }
        client.commands.set(command.data.name, command);
    }
    logger.info(`${client.commands.size} comando(s) carregado(s): ${[...client.commands.keys()].join(", ")}`);

    client.on("interactionCreate", async (interaction) => {
        try {
            // Slash commands (/key, /admin, /help)
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                return await command.execute(interaction);
            }

            // Botões e modais do painel admin usam customId "admin:..." / "admin_modal:..."
            if (interaction.isButton() && interaction.customId.startsWith("admin:")) {
                return await adminPanel.handleButton(interaction);
            }
            if (interaction.isModalSubmit() && interaction.customId.startsWith("admin_modal:")) {
                return await adminPanel.handleModalSubmit(interaction);
            }

            // Fluxo de compra (/comprar) usa customId "store:..."
            if (interaction.isStringSelectMenu() && interaction.customId.startsWith("store:")) {
                return await storePanel.handleSelectMenu(interaction);
            }
            if (interaction.isButton() && interaction.customId.startsWith("store:")) {
                return await storePanel.handleButton(interaction);
            }
        } catch (err) {
            logger.error(`Erro ao processar interação -> ${err.stack || err}`);
            const payload = { content: "❌ Ocorreu um erro ao processar isso.", ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(payload).catch(() => {});
            } else {
                await interaction.reply(payload).catch(() => {});
            }
        }
    });

    client.once("ready", () => {
        logger.ok(`Bot conectado como ${client.user.tag}`);
    });

    return client;
}

module.exports = { createClient };
