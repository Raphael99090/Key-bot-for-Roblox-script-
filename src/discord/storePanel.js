const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require("discord.js");
const KeyStore = require("../store/keyStore");
const SettingsStore = require("../store/settingsStore");
const OrderStore = require("../store/orderStore");
const { isAdmin } = require("../utils/permissions");
const logger = require("../utils/logger");
const { panel, v2Payload } = require("./v2");
const { sendActionLog } = require("./logNotifier");

const { PAYMENT_METHODS } = SettingsStore;

async function getSalesChannel(client) {
    const channelId = SettingsStore.get("salesChannelId") || SettingsStore.get("logChannelId");
    if (!channelId) return null;
    try {
        const channel = await client.channels.fetch(channelId);
        return channel?.isTextBased() ? channel : null;
    } catch (err) {
        logger.warn(`Falha ao buscar o canal de vendas -> ${err.message}`);
        return null;
    }
}

function methodSelectRow() {
    const options = Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ label, value }));
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("store:select_method")
            .setPlaceholder("Escolha a forma de pagamento")
            .addOptions(options)
    );
}

function initialPanel() {
    const container = panel({
        title: "🛒 Comprar key — 1NXITER HUB",
        description: "Escolha como você quer pagar. Depois de pagar, você confirma pra gente aqui mesmo, e a key é enviada no seu privado assim que o pagamento for aprovado."
    });
    return v2Payload(container, [methodSelectRow()]);
}

function orderStatusLine(order) {
    const map = {
        pending: "⏳ Aguardando pagamento",
        paid_claimed: "📨 Pagamento avisado — aguardando confirmação do admin",
        confirmed: "✅ Confirmado",
        rejected: "❌ Rejeitado"
    };
    return map[order.status] || order.status;
}

async function handleSelectMenu(interaction) {
    if (interaction.customId !== "store:select_method") return;

    const method = interaction.values[0];
    const info = SettingsStore.getPaymentInfo(method);

    if (!info) {
        const container = panel({
            title: "⚠️ Método indisponível",
            color: 0xe67e22,
            description: `O método **${PAYMENT_METHODS[method]}** ainda não foi configurado pelo admin. Escolhe outro ou tenta mais tarde.`
        });
        return interaction.update(v2Payload(container, [methodSelectRow()]));
    }

    const order = OrderStore.create({ discordId: interaction.user.id, method });

    const container = panel({
        title: `💳 Pagamento via ${PAYMENT_METHODS[method]}`,
        description: info,
        fields: [{ name: "Pedido", value: `\`${order.id}\`` }],
        footer: "Depois de pagar, clica no botão abaixo pra avisar o admin."
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`store:paid:${order.id}`).setLabel("✅ Já paguei").setStyle(ButtonStyle.Success)
    );

    return interaction.update(v2Payload(container, [row]));
}

async function handleButton(interaction) {
    const [, action, orderId] = interaction.customId.split(":");

    if (action === "paid") {
        const order = OrderStore.get(orderId);
        if (!order) {
            return interaction.reply({ content: "❌ Pedido não encontrado (talvez tenha expirado).", ephemeral: true });
        }
        if (order.discordId !== interaction.user.id) {
            return interaction.reply({ content: "❌ Esse pedido não é seu.", ephemeral: true });
        }
        if (order.status !== "pending") {
            const container = panel({ title: "Pedido", description: orderStatusLine(order) });
            return interaction.update(v2Payload(container, []));
        }

        OrderStore.markPaidClaimed(orderId);

        const claimedContainer = panel({
            title: "📨 Avisamos o admin!",
            description: `Seu pedido \`${order.id}\` foi marcado como pago. Assim que um admin confirmar, você recebe a key aqui no privado — fica de olho nas mensagens diretas.`
        });
        await interaction.update(v2Payload(claimedContainer, []));

        const channel = await getSalesChannel(interaction.client);
        if (!channel) {
            logger.warn(`Pedido ${order.id} marcado como pago, mas nenhum canal de vendas está configurado (/admin → Vendas).`);
            return;
        }

        const notifyContainer = panel({
            title: "🛒 Novo pedido pra confirmar",
            color: 0xf1c40f,
            fields: [
                { name: "Pedido", value: `\`${order.id}\`` },
                { name: "Comprador", value: `<@${order.discordId}>` },
                { name: "Método", value: PAYMENT_METHODS[order.method] }
            ]
        });
        const notifyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`store:confirm:${order.id}`).setLabel("✅ Confirmar pagamento").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`store:reject:${order.id}`).setLabel("❌ Rejeitar").setStyle(ButtonStyle.Danger)
        );
        await channel.send(v2Payload(notifyContainer, [notifyRow]));
        return;
    }

    if (action === "confirm" || action === "reject") {
        if (!isAdmin(interaction)) {
            return interaction.reply({ content: "❌ Só admins podem confirmar/rejeitar pedidos.", ephemeral: true });
        }

        const order = OrderStore.get(orderId);
        if (!order) {
            const container = panel({ title: "❌ Pedido não encontrado", description: "Esse pedido não existe mais." });
            return interaction.update(v2Payload(container, []));
        }

        if (action === "confirm") {
            const defaultDays = SettingsStore.get("defaultExpiryDays");
            const keyEntry = KeyStore.create({ daysValid: defaultDays, note: `venda (${order.method}) - pedido ${order.id}` });
            KeyStore.redeem(keyEntry.key, order.discordId);

            const result = OrderStore.confirm(order.id, keyEntry.key, interaction.user.id);
            if (!result.ok) {
                return interaction.reply({ content: "⚠️ Esse pedido já tinha sido decidido antes.", ephemeral: true });
            }

            let dmOk = true;
            try {
                const buyer = await interaction.client.users.fetch(order.discordId);
                const dmContainer = panel({
                    title: "🔑 Sua key chegou!",
                    color: 0x2ecc71,
                    description:
                        `Pagamento confirmado — aqui está sua key:\n\n\`${keyEntry.key}\`\n\n` +
                        `**Como usar:** dentro do jogo, digite \`/key redeem key:${keyEntry.key}\` aqui no Discord ` +
                        `pra vincular ela na sua conta, depois cole a key na tela do hub quando ele carregar.`
                });
                await buyer.send(v2Payload(dmContainer, []));
            } catch {
                dmOk = false;
            }

            const doneContainer = panel({
                title: "✅ Pedido confirmado",
                color: 0x2ecc71,
                fields: [
                    { name: "Pedido", value: `\`${order.id}\`` },
                    { name: "Key gerada", value: `\`${keyEntry.key}\`` },
                    { name: "DM enviada?", value: dmOk ? "sim" : "❌ falhou (DMs fechadas?) — manda a key manualmente" }
                ]
            });
            await interaction.update(v2Payload(doneContainer, []));

            logger.action(interaction.user.id, `confirmou o pedido ${order.id} e gerou a key ${keyEntry.key} pra <@${order.discordId}>`);
            await sendActionLog(interaction.client, {
                title: "🛒 Pedido confirmado",
                actorId: interaction.user.id,
                color: 0x2ecc71,
                description: `Pedido \`${order.id}\` (${PAYMENT_METHODS[order.method]}) — key \`${keyEntry.key}\` gerada pra <@${order.discordId}>.`
            });
            return;
        }

        if (action === "reject") {
            const result = OrderStore.reject(order.id, interaction.user.id);
            if (!result.ok) {
                return interaction.reply({ content: "⚠️ Esse pedido já tinha sido decidido antes.", ephemeral: true });
            }

            try {
                const buyer = await interaction.client.users.fetch(order.discordId);
                await buyer.send(`❌ Seu pedido \`${order.id}\` foi rejeitado pelo admin. Se acha que é engano, entra em contato no servidor.`);
            } catch {
                // sem DM, sem problema — o admin já vê o resultado no painel
            }

            const rejectedContainer = panel({
                title: "❌ Pedido rejeitado",
                color: 0xe74c3c,
                fields: [{ name: "Pedido", value: `\`${order.id}\`` }, { name: "Comprador", value: `<@${order.discordId}>` }]
            });
            await interaction.update(v2Payload(rejectedContainer, []));

            logger.action(interaction.user.id, `rejeitou o pedido ${order.id} (comprador: ${order.discordId})`);
            await sendActionLog(interaction.client, {
                title: "🛒 Pedido rejeitado",
                actorId: interaction.user.id,
                color: 0xe74c3c,
                description: `Pedido \`${order.id}\` (${PAYMENT_METHODS[order.method]}) — comprador <@${order.discordId}>.`
            });
            return;
        }
    }
}

module.exports = { initialPanel, handleSelectMenu, handleButton };
