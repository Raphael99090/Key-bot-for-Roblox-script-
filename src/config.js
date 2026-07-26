require("dotenv").config();
const path = require("path");

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID || null,
    // Plataformas de hospedagem (Railway, etc.) costumam injetar a porta
    // via process.env.PORT, não deixam você escolher — por isso ela tem
    // prioridade sobre API_PORT, que continua valendo pra rodar local.
    apiPort: Number(process.env.PORT) || Number(process.env.API_PORT) || 3000,
    adminRoleId: process.env.ADMIN_ROLE_ID || null,
    // Segredo exigido na API /validate (header X-API-Key ou ?secret=).
    // Deixe vazio pra desativar a exigência (não recomendado em produção).
    apiSecret: process.env.API_SECRET || null,

    // Onde os dados ficam salvos. Os arquivos são gerados
    // automaticamente na primeira execução (não vêm no repo).
    paths: {
        keys: path.join(__dirname, "..", "data", "keys.json"),
        settings: path.join(__dirname, "..", "data", "config.json"),
        resetCodes: path.join(__dirname, "..", "data", "resetcodes.json"),
        trials: path.join(__dirname, "..", "data", "trials.json"),
        orders: path.join(__dirname, "..", "data", "orders.json")
    }
};
