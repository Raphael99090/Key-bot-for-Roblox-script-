const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");
const SettingsStore = require("../store/settingsStore");
const SupportStore = require("../store/supportStore");
const { isAdmin } = require("../utils/permissions");
const logger = require("../utils/logger");
const { panel, v2Payload } = require("./v2");
const { sendActionLog } = require("./logNotifier");
const { postTicketTranscript } = require("./transcript");

function subjectModal() {
    return new ModalBuilder()
        .setCustomId("support_modal:open")
        .setTitle("Abrir ticket de suporte")
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("assunto")
                    .setLabel("Qual é o problema ou dúvida?")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );
}

function closeRow(ticketId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`support:close:${ticketId}`).setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Secondary)
    );
}

/**
 * Mesma lógica de fallback do ticket de compra (privada com boost nível
 * 2, senão pública) — só que usando o canal-base de SUPORTE, separado
 * do canal-base de compra.
 */
async function createSupportThread(interaction) {
    const baseChannelId = SettingsStore.get("supportChannelId");
    const baseChannel = baseChannelId
        ? await interaction.guild.channels.fetch(baseChannelId).catch(() => null)
        : interaction.channel;

    if (!baseChannel || !baseChannel.isTextBased()) {
        throw new Error("Canal-base de suporte não encontrado — confere em /admin → Configurações → Canal de suporte.");
    }

    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "usuario";
    const threadName = `suporte-${safeName}-${Date.now().toString(36).slice(-4)}`;

    let thread, isPrivate = true;
    try {
        thread = await baseChannel.threads.create({
            name: threadName,
            type: ChannelType.PrivateThread,
            invitable: false,
            reason: `Suporte de ${interaction.user.tag}`
        });
    } catch {
        isPrivate = false;
        thread = await baseChannel.threads.create({
            name: threadName,
            type: ChannelType.PublicThread,
            reason: `Suporte de ${interaction.user.tag}`
        });
    }

    await thread.members.add(interaction.user.id).catch(() => {});
    return { thread, isPrivate };
}

async function handleModalSubmit(interaction) {
    if (interaction.customId !== "support_modal:open") return;

    // Rate limit: só 1 ticket de suporte aberto por vez por pessoa.
    const existing = SupportStore.listOpen().find(t => t.discordId === interaction.user.id);
    if (existing) {
        return interaction.reply({
            content: `❌ Você já tem um ticket de suporte aberto: <#${existing.channelId}>.`,
            ephemeral: true
        });
    }

    const subject = interaction.fields.getTextInputValue("assunto")?.trim();
    await interaction.deferReply({ ephemeral: true });

    let thread, isPrivate;
    try {
        ({ thread, isPrivate } = await createSupportThread(interaction));
    } catch (err) {
        logger.error(`Falha ao criar ticket de suporte -> ${err.message}`);
        return interaction.editReply({ content: `❌ Não consegui criar o ticket. ${err.message}` });
    }

    const ticket = SupportStore.create({ discordId: interaction.user.id, channelId: thread.id, subject });

    const container = panel({
        title: "🎫 Ticket de suporte",
        color: 0x5865f2,
        description: `Olá <@${interaction.user.id}>! Um admin vai te atender aqui em breve.\n\n**Assunto:**\n${subject}`,
        footer: isPrivate ? `Ticket ${ticket.id} — thread privada.` : `Ticket ${ticket.id} — thread pública (servidor sem boost nível 2).`
    });

    await thread.send(v2Payload(container, [closeRow(ticket.id)]));
    await interaction.editReply({ content: `✅ Ticket criado: ${thread}` });

    await sendActionLog(interaction.client, {
        title: "🎫 Novo ticket de suporte",
        actorId: interaction.user.id,
        color: 0x5865f2,
        description: `Ticket \`${ticket.id}\` — ${thread}\n**Assunto:** ${subject}`
    });
}

async function handleButton(interaction) {
    const [, action, ticketId] = interaction.customId.split(":");
    if (action !== "close") return;

    const ticket = SupportStore.get(ticketId);
    const isOwner = ticket && ticket.discordId === interaction.user.id;
    if (!isAdmin(interaction) && !isOwner) {
        return interaction.reply({ content: "❌ Só quem abriu o ticket ou um admin pode fechar.", ephemeral: true });
    }

    await interaction.reply({ content: "🔒 Fechando o ticket em 5 segundos...", ephemeral: false });

    if (ticket) SupportStore.close(ticket.id, interaction.user.id);

    setTimeout(async () => {
        const channel = interaction.channel;
        if (ticket) await postTicketTranscript(interaction.client, { id: ticket.id, status: "closed" }, channel);
        await channel?.delete().catch(() => {});
    }, 5000);
}

module.exports = { subjectModal, handleModalSubmit, handleButton };
