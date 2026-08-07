const OrderStore = require("../store/orderStore");
const SupportStore = require("../store/supportStore");
const logger = require("../utils/logger");
const { postTicketTranscript } = require("./transcript");

const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutos (ticket de compra)
const SUPPORT_INACTIVITY_MS = 15 * 60 * 1000; // 15 minutos (ticket de suporte — conversa mais devagar)
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

async function sweepSupportOnce(client) {
    const now = Date.now();
    const openTickets = SupportStore.listOpen();

    for (const ticket of openTickets) {
        const lastActivity = ticket.lastActivityAt || ticket.createdAt;
        if (now - lastActivity < SUPPORT_INACTIVITY_MS) continue;

        const result = SupportStore.close(ticket.id, null);
        if (!result.ok) continue;

        try {
            const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
            if (channel) {
                await postTicketTranscript(client, { id: ticket.id, status: "closed" }, channel);
                await channel.send("🔒 Ticket de suporte fechado automaticamente por inatividade (15 minutos sem mensagens).").catch(() => {});
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }
        } catch (err) {
            logger.warn(`Falha ao encerrar ticket de suporte inativo ${ticket.id} -> ${err.message}`);
        }

        logger.action("sistema", `fechou o ticket de suporte ${ticket.id} por inatividade (15min)`);
    }
}

function startTicketSweeper(client) {
    setInterval(() => sweepOnce(client), SWEEP_INTERVAL_MS);
    setInterval(() => sweepSupportOnce(client), SWEEP_INTERVAL_MS);
    logger.info("Sweeper de tickets inativos iniciado (compra: 3min, suporte: 15min, checa a cada 30s).");
}

module.exports = { startTicketSweeper };
