const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");
const KeyStore = require("../store/keyStore");
const SettingsStore = require("../store/settingsStore");
const OrderStore = require("../store/orderStore");
const CouponStore = require("../store/couponStore");
const { isAdmin } = require("../utils/permissions");
const { fmtDate } = require("../utils/format");
const logger = require("../utils/logger");
const { panel, v2Payload } = require("./v2");
const { sendActionLog } = require("./logNotifier");

const { PLAN_LABELS, PLAN_DAYS, PAYMENT_METHODS } = SettingsStore;

function priceLine(plan) {
    const price = SettingsStore.getPlanPrice(plan);
    return price || "preço a definir";
}

function planButtonsRow() {
    return new ActionRowBuilder().addComponents(
        Object.keys(PLAN_LABELS).map(plan =>
            new ButtonBuilder()
                .setCustomId(`store:buy:${plan}`)
                .setLabel(`${PLAN_LABELS[plan]} — ${priceLine(plan)}`)
                .setStyle(plan === "lifetime" ? ButtonStyle.Success : ButtonStyle.Primary)
        )
    );
}

/** Painel público/pessoal da loja — os 4 planos com preço já no botão. */
function shopPanel() {
    const description = SettingsStore.get("shopDescription") || "Escolha um plano abaixo pra comprar sua key.";
    const container = panel({
        title: "🛒 Loja — 1NXITER HUB",
        description: `${description}\n\n**🛒 Compre aqui:**`,
        footer: "Ao escolher um plano, um ticket privado é criado só pra você e a administração."
    });
    return v2Payload(container, [planButtonsRow()]);
}

function paymentReferenceText() {
    const lines = Object.entries(PAYMENT_METHODS)
        .map(([key, label]) => {
            const info = SettingsStore.getPaymentInfo(key);
            return info ? `**${label}:**\n${info}` : null;
        })
        .filter(Boolean);
    return lines.length > 0 ? lines.join("\n\n") : "_Nenhuma forma de pagamento configurada ainda — combine direto com o comprador._";
}

function ticketActionsRow(orderId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`store:confirm:${orderId}`).setLabel("✅ Confirmar Pagamento").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`store:reject:${orderId}`).setLabel("❌ Rejeitar").setStyle(ButtonStyle.Danger)
    );
}

function closeRow(orderId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`store:close:${orderId}`).setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Secondary)
    );
}

function couponModal(plan) {
    return new ModalBuilder()
        .setCustomId(`store_modal:buy:${plan}`)
        .setTitle(`Comprar — ${PLAN_LABELS[plan]}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("cupom")
                    .setLabel("Tem um cupom de desconto? (opcional)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder("deixe vazio se não tiver")
            )
        );
}

/**
 * Cria o ticket como THREAD, não canal — mais leve e não exige a
 * permissão "Gerenciar Canais" pra sempre. Tenta thread PRIVADA primeiro
 * (exige boost nível 2 no servidor); se o servidor não tiver boost
 * suficiente, cai pra thread pública automaticamente (ainda funciona,
 * só que fica visível pra quem também vê o canal-base).
 */
async function createTicketThread(interaction, buyer) {
    const baseChannelId = SettingsStore.get("ticketChannelId");
    const baseChannel = baseChannelId
        ? await interaction.guild.channels.fetch(baseChannelId).catch(() => null)
        : interaction.channel;

    if (!baseChannel || !baseChannel.isTextBased()) {
        throw new Error("Canal base pra criar o ticket não foi encontrado ou não é de texto — confere o 'Canal dos tickets' em /admin → Vendas/Loja.");
    }

    const safeName = buyer.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "comprador";
    const threadName = `ticket-${safeName}-${Date.now().toString(36).slice(-4)}`;

    let thread;
    let isPrivate = true;
    try {
        thread = await baseChannel.threads.create({
            name: threadName,
            type: ChannelType.PrivateThread,
            invitable: false,
            reason: `Ticket de compra de ${buyer.tag}`
        });
    } catch {
        // Provavelmente o servidor não tem boost nível 2 — thread privada
        // exige isso. Cai pra pública, que funciona em qualquer servidor.
        isPrivate = false;
        thread = await baseChannel.threads.create({
            name: threadName,
            type: ChannelType.PublicThread,
            reason: `Ticket de compra de ${buyer.tag}`
        });
    }

    await thread.members.add(buyer.id).catch(() => {});
    return { thread, isPrivate };
}

async function handleButton(interaction) {
    const [, action, param] = interaction.customId.split(":");

    if (action === "buy") {
        const plan = param;
        if (!PLAN_LABELS[plan]) {
            return interaction.reply({ content: "❌ Plano inválido.", ephemeral: true });
        }
        if (!interaction.inGuild()) {
            return interaction.reply({ content: "❌ Isso só funciona dentro do servidor.", ephemeral: true });
        }
        return interaction.showModal(couponModal(plan));
    }

    if (action === "confirm" || action === "reject") {
        if (!isAdmin(interaction)) {
            return interaction.reply({ content: "❌ Só admins podem confirmar/rejeitar pedidos.", ephemeral: true });
        }

        const order = OrderStore.get(param);
        if (!order) {
            const container = panel({ title: "❌ Pedido não encontrado", description: "Esse pedido não existe mais." });
            return interaction.update(v2Payload(container, []));
        }

        if (action === "confirm") {
            const days = PLAN_DAYS[order.plan];
            const keyEntry = KeyStore.create({ daysValid: days, note: `venda (${order.plan}) - pedido ${order.id}` });
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
                        `**Vence em:** ${fmtDate(keyEntry.expiresAt)}\n\n` +
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
                    { name: "Vencimento", value: fmtDate(keyEntry.expiresAt) },
                    { name: "DM enviada?", value: dmOk ? "sim" : "❌ falhou (DMs fechadas?) — a key já está escrita aqui em cima" }
                ]
            });
            await interaction.update(v2Payload(doneContainer, [closeRow(order.id)]));

            logger.action(interaction.user.id, `confirmou o pedido ${order.id} e gerou a key ${keyEntry.key} pra <@${order.discordId}>`);
            await sendActionLog(interaction.client, {
                title: "🛒 Pedido confirmado",
                actorId: interaction.user.id,
                color: 0x2ecc71,
                description: `Pedido \`${order.id}\` (${PLAN_LABELS[order.plan]}) — key \`${keyEntry.key}\` gerada pra <@${order.discordId}>. Vencimento: ${fmtDate(keyEntry.expiresAt)}.`
            });
            return;
        }

        if (action === "reject") {
            const result = OrderStore.reject(order.id, interaction.user.id);
            if (!result.ok) {
                return interaction.reply({ content: "⚠️ Esse pedido já tinha sido decidido antes.", ephemeral: true });
            }

            const rejectedContainer = panel({
                title: "❌ Pedido rejeitado",
                color: 0xe74c3c,
                fields: [{ name: "Pedido", value: `\`${order.id}\`` }, { name: "Comprador", value: `<@${order.discordId}>` }]
            });
            await interaction.update(v2Payload(rejectedContainer, [closeRow(order.id)]));

            logger.action(interaction.user.id, `rejeitou o pedido ${order.id} (comprador: ${order.discordId})`);
            await sendActionLog(interaction.client, {
                title: "🛒 Pedido rejeitado",
                actorId: interaction.user.id,
                color: 0xe74c3c,
                description: `Pedido \`${order.id}\` (${PLAN_LABELS[order.plan]}) — comprador <@${order.discordId}>.`
            });
            return;
        }
    }

    if (action === "close") {
        const order = OrderStore.get(param);
        const isBuyer = order && order.discordId === interaction.user.id;
        if (!isAdmin(interaction) && !isBuyer) {
            return interaction.reply({ content: "❌ Só o comprador ou um admin pode fechar esse ticket.", ephemeral: true });
        }

        await interaction.reply({ content: "🔒 Fechando o ticket em 5 segundos...", ephemeral: false });
        setTimeout(() => {
            interaction.channel?.delete().catch(() => {});
        }, 5000);
        return;
    }
}

async function handleModalSubmit(interaction) {
    const [, action, plan] = interaction.customId.split(":");
    if (action !== "buy" || !PLAN_LABELS[plan]) return;

    const codigoDigitado = interaction.fields.getTextInputValue("cupom")?.trim();
    let coupon = null;

    if (codigoDigitado) {
        const result = CouponStore.use(codigoDigitado);
        if (!result.ok) {
            const reasons = {
                not_found: "❌ Cupom não encontrado.",
                inactive: "❌ Esse cupom foi desativado.",
                exhausted: "❌ Esse cupom já atingiu o limite de usos."
            };
            return interaction.reply({ content: reasons[result.reason] || "❌ Cupom inválido.", ephemeral: true });
        }
        coupon = result.entry;
    }

    await interaction.deferReply({ ephemeral: true });

    let thread, isPrivate;
    try {
        ({ thread, isPrivate } = await createTicketThread(interaction, interaction.user));
    } catch (err) {
        logger.error(`Falha ao criar thread de ticket -> ${err.message}`);
        return interaction.editReply({ content: `❌ Não consegui criar o ticket. ${err.message}` });
    }

    const order = OrderStore.create({
        discordId: interaction.user.id,
        plan,
        channelId: thread.id,
        couponCode: coupon?.code || null
    });

    const days = PLAN_DAYS[plan];
    const ticketContainer = panel({
        title: `🎫 Ticket de compra — ${PLAN_LABELS[plan]}`,
        description:
            `Olá <@${interaction.user.id}>! Aqui está seu ticket pra comprar o plano **${PLAN_LABELS[plan]}** por **${priceLine(plan)}**.\n\n` +
            (coupon ? `**Cupom aplicado:** \`${coupon.code}\` — ${coupon.discountText || "desconto combinado com o admin"}\n\n` : "") +
            `Combine a forma de pagamento com a administração. Referência do que já está configurado:\n\n${paymentReferenceText()}`,
        fields: [
            { name: "Pedido", value: `\`${order.id}\`` },
            { name: "Validade da key", value: days ? `${days} dia(s)` : "vitalícia (lifetime)" }
        ],
        footer: isPrivate
            ? "Um admin confirma o pagamento aqui pra liberar a key."
            : "Um admin confirma o pagamento aqui pra liberar a key. (Thread pública — o servidor não tem boost nível 2 pra threads privadas.)"
    });

    await thread.send(v2Payload(ticketContainer, [ticketActionsRow(order.id)]));
    await interaction.editReply({ content: `✅ Ticket criado: ${thread}` });

    await sendActionLog(interaction.client, {
        title: "🎫 Novo ticket de compra",
        actorId: interaction.user.id,
        description: `Pedido \`${order.id}\` — plano **${PLAN_LABELS[plan]}** — ${thread}${coupon ? ` — cupom \`${coupon.code}\`` : ""}.`
    });
}

module.exports = { shopPanel, handleButton, handleModalSubmit };
