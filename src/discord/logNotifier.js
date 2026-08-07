const SettingsStore = require("../store/settingsStore");
const logger = require("../utils/logger");
const { panel, v2Payload } = require("./v2");

/**
 * Manda um painel de log pro canal configurado (logChannelId), com quem
 * fez a ação e quando (timestamp nativo do Discord — já mostra certo no
 * fuso horário de cada pessoa que olhar, sem precisar formatar data à mão).
 */
async function sendActionLog(client, { title, actorId, description, color = 0x8a3ffc }) {
    const channelId = SettingsStore.get("logChannelId");
    if (!channelId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel?.isTextBased()) return;

        const nowUnix = Math.floor(Date.now() / 1000);
        const container = panel({
            title,
            description,
            color,
            fields: [
                { name: "Por", value: `<@${actorId}>` },
                { name: "Quando", value: `<t:${nowUnix}:F> (<t:${nowUnix}:R>)` }
            ]
        });

        await channel.send(v2Payload(container, []));
    } catch (err) {
        logger.warn(`Falha ao enviar log no canal configurado -> ${err.message}`);
    }
}

module.exports = { sendActionLog };
