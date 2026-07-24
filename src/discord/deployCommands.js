const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");
const config = require("../config");
const logger = require("../utils/logger");

async function deploy() {
    const commandsDir = path.join(__dirname, "commands");
    const commands = [];

    for (const file of fs.readdirSync(commandsDir)) {
        if (!file.endsWith(".js")) continue;
        const command = require(path.join(commandsDir, file));
        if (command?.data) commands.push(command.data.toJSON());
    }

    if (!config.token || !config.clientId) {
        logger.error("DISCORD_TOKEN e/ou CLIENT_ID faltando no .env — não é possível registrar os comandos.");
        process.exit(1);
    }

    const rest = new REST().setToken(config.token);

    try {
        const route = config.guildId
            ? Routes.applicationGuildCommands(config.clientId, config.guildId)
            : Routes.applicationCommands(config.clientId);

        await rest.put(route, { body: commands });

        logger.ok(
            `${commands.length} comando(s) registrado(s) ${
                config.guildId ? "no servidor configurado (instantâneo)" : "globalmente (pode levar até 1h pra aparecer)"
            }.`
        );
    } catch (err) {
        logger.error(`Falha ao registrar comandos -> ${err.stack || err}`);
        process.exit(1);
    }
}

deploy();
