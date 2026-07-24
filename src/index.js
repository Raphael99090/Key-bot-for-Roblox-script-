const config = require("./config");
const { createClient } = require("./discord/client");
const { startApi } = require("./api/server");
const logger = require("./utils/logger");

if (!config.token || !config.clientId) {
    logger.error("Faltam DISCORD_TOKEN / CLIENT_ID no .env — copie .env.example pra .env e preencha.");
    process.exit(1);
}

const client = createClient();
client.login(config.token);

startApi();
