const KeyStore = require("../store/keyStore");
const { panel, v2Payload } = require("./v2");
const logger = require("../utils/logger");

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // checa a cada 1h
const REMINDER_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // avisa 2 dias antes de vencer

async function checkOnce(client) {
    const now = Date.now();
    const keys = KeyStore.list();

    for (const entry of keys) {
        if (entry.revoked || !entry.expiresAt || !entry.discordId) continue;
        if (entry.renewalNotifiedAt) continue; // já avisou uma vez pra essa validade

        const remaining = entry.expiresAt - now;
        if (remaining <= 0 || remaining > REMINDER_WINDOW_MS) continue;

        try {
            const user = await client.users.fetch(entry.discordId);
            const container = panel({
                title: "⏳ Sua key vai vencer em breve!",
                description:
                    `Sua key \`${entry.key}\` vence <t:${Math.floor(entry.expiresAt / 1000)}:R> ` +
                    `(<t:${Math.floor(entry.expiresAt / 1000)}:F>).\n\nSe quiser continuar usando o hub, digite \`/comprar\` pra renovar.`
            });
            await user.send(v2Payload(container, []));
        } catch (err) {
            logger.warn(`Falha ao avisar renovação da key ${entry.key} -> ${err.message}`);
        }

        KeyStore.markRenewalNotified(entry.key);
    }
}

function startRenewalReminder(client) {
    setInterval(() => checkOnce(client), CHECK_INTERVAL_MS);
    logger.info("Aviso de renovação iniciado (checa a cada 1h, avisa 2 dias antes de vencer).");
}

module.exports = { startRenewalReminder };
