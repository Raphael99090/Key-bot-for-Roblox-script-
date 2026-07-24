const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const config = require("../config");
const logger = require("../utils/logger");

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
        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (err) {
            logger.error(`Erro ao executar /${interaction.commandName} -> ${err.stack || err}`);
            const payload = { content: "❌ Ocorreu um erro ao executar esse comando.", ephemeral: true };
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
