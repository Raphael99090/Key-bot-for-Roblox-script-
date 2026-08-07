const logger = require("./logger");

/**
 * Confere as variáveis de ambiente antes do bot subir. Divide entre
 * obrigatórias (o bot não funciona sem elas — encerra o processo) e
 * recomendadas (funcionam sem, mas com trade-off — só avisa).
 */
function validateEnv(config) {
    const missingRequired = [];

    if (!config.token) missingRequired.push("DISCORD_TOKEN");
    if (!config.clientId) missingRequired.push("CLIENT_ID");

    if (missingRequired.length > 0) {
        logger.error(
            `Variáveis de ambiente obrigatórias faltando: ${missingRequired.join(", ")}. ` +
            `Copie .env.example para .env e preencha antes de iniciar.`
        );
        process.exit(1);
    }

    if (!config.guildId) {
        logger.warn(
            "GUILD_ID não definido — os slash commands serão registrados globalmente " +
            "(pode levar até 1h pra aparecer no Discord). Defina GUILD_ID no .env para registro instantâneo."
        );
    }

    if (!config.adminRoleId) {
        logger.warn(
            "ADMIN_ROLE_ID não definido — só quem tiver a permissão de Administrator no servidor " +
            "vai conseguir usar /admin."
        );
    }
}

module.exports = { validateEnv };
