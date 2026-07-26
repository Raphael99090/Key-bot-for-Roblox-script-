const {
    EmbedBuilder,
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
    const embed = new EmbedBuilder()
        .setTitle("🛒 Comprar key — 1NXITER HUB")
        .setColor(0x8a3ffc)
        .setDescription("Escolha como você quer pagar. Depois de pagar, você confirma pra gente aqui mesmo, e a key é enviada no seu privado assim que o pagamento for aprovado.");

    return { embeds: [embed], components: [methodSelectRow()] };
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
        return interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle("⚠️ Método indisponível")
                    .setColor(0xe67e22)
                    .setDescription(`O método **${PAYMENT_METHODS[method]}** ainda não foi configurado pelo admin. Escolhe outro ou tenta mais tarde.`)
            ],
            components: [methodSelectRow()]
        });
    }

    const order = OrderStore.create({ discordId: interaction.user.id, method });

    const embed = new EmbedBuilder()
        .setTitle(`💳 Pagamento via ${PAYMENT_METHODS[method]}`)
        .setColor(0x8a3ffc)
        .setDescription(info)
        .addFields({ name: "Pedido", value: `\`${order.id}\`` })
        .setFooter({ text: "Depois de pagar, clica no botão abaixo pra avisar o admin." });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`store:paid:${order.id}`).setLabel("✅ Já paguei").setStyle(ButtonStyle.Success)
    );

    return interaction.update({ embeds: [embed], components: [row] });
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
            return interaction.update({
                embeds: [new EmbedBuilder().setTitle("Pedido").setColor(0x8a3ffc).setDescription(orderStatusLine(order))],
                components: []
            });
        }

        OrderStore.markPaidClaimed(orderId);

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle("📨 Avisamos o admin!")
                    .setColor(0x8a3ffc)
                    .setDescription(`Seu pedido \`${order.id}\` foi marcado como pago. Assim que um admin confirmar, você recebe a key aqui no privado — fica de olho nas mensagens diretas.`)
            ],
            components: []
        });

        const channel = await getSalesChannel(interaction.client);
        if (!channel) {
            logger.warn(`Pedido ${order.id} marcado como pago, mas nenhum canal de vendas está configurado (/admin → Vendas).`);
            return;
        }

        const notifyEmbed = new EmbedBuilder()
            .setTitle("🛒 Novo pedido pra confirmar")
            .setColor(0xf1c40f)
            .addFields(
                { name: "Pedido", value: `\`${order.id}\``, inline: true },
                { name: "Comprador", value: `<@${order.discordId}>`, inline: true },
                { name: "Método", value: PAYMENT_METHODS[order.method], inline: true }
            );
        const notifyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`store:confirm:${order.id}`).setLabel("✅ Confirmar pagamento").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`store:reject:${order.id}`).setLabel("❌ Rejeitar").setStyle(ButtonStyle.Danger)
        );
        await channel.send({ embeds: [notifyEmbed], components: [notifyRow] });
        return;
    }

    if (action === "confirm" || action === "reject") {
        if (!isAdmin(interaction)) {
            return interaction.reply({ content: "❌ Só admins podem confirmar/rejeitar pedidos.", ephemeral: true });
        }

        const order = OrderStore.get(orderId);
        if (!order) {
            return interaction.update({ content: "❌ Pedido não encontrado.", embeds: [], components: [] });
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
                await buyer.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("🔑 Sua key chegou!")
                            .setColor(0x2ecc71)
                            .setDescription(
                                `Pagamento confirmado — aqui está sua key:\n\n\`${keyEntry.key}\`\n\n` +
                                `**Como usar:** dentro do jogo, digite \`/key redeem key:${keyEntry.key}\` aqui no Discord ` +
                                `pra vincular ela na sua conta, depois cole a key na tela do hub quando ele carregar.`
                            )
                    ]
                });
            } catch {
                dmOk = false;
            }

            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("✅ Pedido confirmado")
                        .setColor(0x2ecc71)
                        .addFields(
                            { name: "Pedido", value: `\`${order.id}\``, inline: true },
                            { name: "Key gerada", value: `\`${keyEntry.key}\``, inline: true },
                            { name: "DM enviada?", value: dmOk ? "sim" : "❌ falhou (DMs fechadas?) — manda a key manualmente", inline: true }
                        )
                ],
                components: []
            });

            logger.action(interaction.user.id, `confirmou o pedido ${order.id} e gerou a key ${keyEntry.key} pra <@${order.discordId}>`);
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

            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("❌ Pedido rejeitado")
                        .setColor(0xe74c3c)
                        .addFields({ name: "Pedido", value: `\`${order.id}\`` }, { name: "Comprador", value: `<@${order.discordId}>` })
                ],
                components: []
            });

            logger.action(interaction.user.id, `rejeitou o pedido ${order.id} (comprador: ${order.discordId})`);
            return;
        }
    }
}

module.exports = { initialPanel, handleSelectMenu, handleButton };
