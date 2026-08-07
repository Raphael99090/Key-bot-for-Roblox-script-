const OrderStore = require("../store/orderStore");
const logger = require("../utils/logger");
const { postTicketTranscript } = require("./transcript");

const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutos
const SWEEP_INTERVAL_MS = 30 * 1000; // confere a cada 30s

async function sweepOnce(client) {
    const now = Date.now();
    const openOrders = OrderStore.listOpen();

    for (const order of openOrders) {
        const lastActivity = order.lastActivityAt || order.createdAt;
        if (now - lastActivity < INACTIVITY_MS) continue;

        const result = OrderStore.expire(order.id);
        if (!result.ok) continue; // outro caminho já decidiu esse pedido nesse meio-tempo

        try {
            const channel = await client.channels.fetch(order.channelId).catch(() => null);
            if (channel) {
                await postTicketTranscript(client, result.entry, channel);
                await channel.send("🔒 Ticket fechado automaticamente por inatividade (3 minutos sem mensagens).").catch(() => {});
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }
        } catch (err) {
            logger.warn(`Falha ao encerrar ticket inativo ${order.id} -> ${err.message}`);
        }

        logger.action("sistema", `fechou o ticket ${order.id} por inatividade (3min)`);
    }
}

function startTicketSweeper(client) {
    setInterval(() => sweepOnce(client), SWEEP_INTERVAL_MS);
    logger.info("Sweeper de tickets inativos iniciado (checa a cada 30s, fecha após 3min sem mensagem).");
}

module.exports = { startTicketSweeper };
