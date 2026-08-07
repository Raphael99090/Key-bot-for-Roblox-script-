const { AttachmentBuilder } = require("discord.js");
const SettingsStore = require("../store/settingsStore");
const logger = require("../utils/logger");

/**
 * Busca as mensagens do ticket e posta um arquivo .txt no canal de log
 * ANTES do canal ser apagado — sem isso, a conversa se perde pra sempre
 * quando o ticket fecha (compra, inatividade ou fechamento manual).
 */
async function postTicketTranscript(client, order, channel) {
    const logChannelId = SettingsStore.get("logChannelId");
    if (!logChannelId || !channel) return;

    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        const lines = sorted.map(m => {
            const time = new Date(m.createdTimestamp).toLocaleString("pt-BR");
            const content = m.content || "[sem texto — embed/componente/anexo]";
            return `[${time}] ${m.author.tag}: ${content}`;
        });

        const text = lines.length > 0 ? lines.join("\n") : "(nenhuma mensagem no ticket)";
        const attachment = new AttachmentBuilder(Buffer.from(text, "utf-8"), { name: `ticket-${order.id}.txt` });

        const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel?.isTextBased()) return;

        await logChannel.send({
            content: `📄 Transcript do ticket \`${order.id}\` (status: ${order.status}) antes de fechar.`,
            files: [attachment]
        });
    } catch (err) {
        logger.warn(`Falha ao gerar transcript do ticket ${order.id} -> ${err.message}`);
    }
}

module.exports = { postTicketTranscript };
