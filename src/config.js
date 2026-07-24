require("dotenv").config();
const path = require("path");

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID || null,
    apiPort: Number(process.env.API_PORT) || 3000,
    adminRoleId: process.env.ADMIN_ROLE_ID || null,

    // Onde os dados ficam salvos. Os dois arquivos são gerados
    // automaticamente na primeira execução (não vêm no repo).
    paths: {
        keys: path.join(__dirname, "..", "data", "keys.json"),
        settings: path.join(__dirname, "..", "data", "config.json")
    }
};
