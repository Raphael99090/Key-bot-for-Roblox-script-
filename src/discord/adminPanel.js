const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");
const KeyStore = require("../store/keyStore");
const SettingsStore = require("../store/settingsStore");
const ResetCodeStore = require("../store/resetCodeStore");
const { isAdmin } = require("../utils/permissions");
const logger = require("../utils/logger");

function fmtDate(ts) {
    return ts ? new Date(ts).toLocaleString("pt-BR") : "nunca";
}

function statusOf(entry) {
    if (entry.revoked) return "🔴 Revogada";
    if (entry.expiresAt && Date.now() > entry.expiresAt) return "🟠 Expirada";
    return "🟢 Ativa";
}

async function notifyLogChannel(interaction, text) {
    const channelId = SettingsStore.get("logChannelId");
    if (!channelId) return;
    try {
        const channel = await interaction.client.channels.fetch(channelId);
        if (channel?.isTextBased()) await channel.send(text);
    } catch (err) {
        logger.warn(`Falha ao enviar log no canal configurado -> ${err.message}`);
    }
}

// ============================================================
// PAINÉIS (embed + botões)
// ============================================================

function mainPanel() {
    const embed = new EmbedBuilder()
        .setTitle("🛠️ Painel Admin — 1NXITER KeyBot")
        .setColor(0x8a3ffc)
        .setDescription("Escolha uma ação abaixo.");

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:generate").setLabel("Gerar Key").setEmoji("🔑").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("admin:list").setLabel("Listar Keys").setEmoji("📋").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("admin:revoke").setLabel("Revogar Key").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("admin:extend").setLabel("Renovar Key").setEmoji("📅").setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:resetcode_generate").setLabel("Gerar Código Reset").setEmoji("🔓").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("admin:resetcode_list").setLabel("Códigos Reset").setEmoji("📦").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("admin:purge").setLabel("Limpar Antigas").setEmoji("🧹").setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:stats").setLabel("Estatísticas").setEmoji("📊").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("admin:config").setLabel("Configurações").setEmoji("⚙️").setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2, row3] };
}

function configPanel() {
    const s = SettingsStore.getAll();
    const embed = new EmbedBuilder()
        .setTitle("⚙️ Configurações")
        .setColor(0x8a3ffc)
        .addFields(
            { name: "Validade padrão", value: s.defaultExpiryDays ? `${s.defaultExpiryDays} dias` : "nunca expira", inline: true },
            { name: "Cooldown reset HWID", value: s.resetCooldownHours ? `${s.resetCooldownHours}h` : "sem cooldown", inline: true },
            { name: "Validade do trial", value: s.trialDays ? `${s.trialDays} dia(s)` : "desativado", inline: true },
            { name: "Reset HWID restrito a admin", value: s.hwidResetAdminOnly ? "sim" : "não", inline: true },
            { name: "Canal de log", value: s.logChannelId ? `<#${s.logChannelId}>` : "desativado", inline: true }
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:config_expiry").setLabel("Validade padrão").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("admin:config_cooldown").setLabel("Cooldown reset").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("admin:config_trialdays").setLabel("Dias de trial").setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:config_toggle_hwidreset").setLabel("Alternar: HWID só admin").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("admin:config_logchannel").setLabel("Canal de log").setStyle(ButtonStyle.Secondary)
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2, row3] };
}

function backRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:back").setLabel("⬅️ Voltar ao painel").setStyle(ButtonStyle.Secondary)
    );
}

// ============================================================
// MODAIS (formulários pra pedir input)
// ============================================================

function modal(customId, title, fields) {
    const m = new ModalBuilder().setCustomId(customId).setTitle(title);
    for (const f of fields) {
        m.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(f.id)
                    .setLabel(f.label)
                    .setStyle(f.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setPlaceholder(f.placeholder || "")
                    .setRequired(f.required !== false)
            )
        );
    }
    return m;
}

const MODALS = {
    generate: () => modal("admin_modal:generate", "Gerar key(s)", [
        { id: "dias", label: "Validade em dias (vazio = padrão configurado)", required: false, placeholder: "ex: 30" },
        { id: "quantidade", label: "Quantidade (padrão 1, máx 25)", required: false, placeholder: "ex: 5" },
        { id: "nota", label: "Nota interna (ex: nome do comprador)", required: false }
    ]),
    revoke: () => modal("admin_modal:revoke", "Revogar key", [
        { id: "key", label: "Key a revogar" }
    ]),
    extend: () => modal("admin_modal:extend", "Renovar key", [
        { id: "key", label: "Key a renovar" },
        { id: "dias", label: "Dias a adicionar", placeholder: "ex: 30" }
    ]),
    purge: () => modal("admin_modal:purge", "Limpar keys antigas", [
        { id: "dias", label: "Remove o que expirou/foi revogado há +X dias", required: false, placeholder: "padrão: 30" }
    ]),
    resetcode_generate: () => modal("admin_modal:resetcode_generate", "Gerar código de reset", [
        { id: "nota", label: "Nota interna (ex: nome do comprador)", required: false }
    ]),
    resetcode_revoke: () => modal("admin_modal:resetcode_revoke", "Apagar código de reset", [
        { id: "codigo", label: "Código a apagar" }
    ]),
    config_expiry: () => modal("admin_modal:config_expiry", "Validade padrão das novas keys", [
        { id: "dias", label: "Dias (0 = nunca expira)", placeholder: "ex: 30" }
    ]),
    config_cooldown: () => modal("admin_modal:config_cooldown", "Cooldown de reset de HWID", [
        { id: "horas", label: "Horas (0 = sem cooldown)", placeholder: "ex: 24" }
    ]),
    config_trialdays: () => modal("admin_modal:config_trialdays", "Validade da key de trial", [
        { id: "dias", label: "Dias (0 = desativa o trial)", placeholder: "ex: 1" }
    ]),
    config_logchannel: () => modal("admin_modal:config_logchannel", "Canal de log", [
        { id: "canal", label: "ID do canal (vazio = desativar)", required: false, placeholder: "ex: 123456789012345678" }
    ])
};

// ============================================================
// HANDLERS
// ============================================================

async function handleButton(interaction) {
    if (!isAdmin(interaction)) {
        return interaction.reply({ content: "❌ Só admins podem usar esse painel.", ephemeral: true });
    }

    const action = interaction.customId.split(":")[1];

    // Ações que abrem um modal
    if (MODALS[action]) {
        return interaction.showModal(MODALS[action]());
    }

    // Ações diretas (editam o painel na mesma mensagem)
    if (action === "back") {
        return interaction.update(mainPanel());
    }

    if (action === "config") {
        return interaction.update(configPanel());
    }

    if (action === "config_toggle_hwidreset") {
        const atual = SettingsStore.get("hwidResetAdminOnly");
        SettingsStore.set("hwidResetAdminOnly", !atual);
        return interaction.update(configPanel());
    }

    if (action === "list") {
        const all = KeyStore.list();
        const embed = new EmbedBuilder().setTitle(`🔑 Keys cadastradas (${all.length})`).setColor(0x8a3ffc);
        if (all.length === 0) {
            embed.setDescription("Nenhuma key cadastrada ainda.");
        } else {
            const lines = all.slice(0, 25).map(e => `\`${e.key}\` — ${statusOf(e)} — ${e.discordId ? `<@${e.discordId}>` : "não resgatada"}`);
            embed.setDescription(lines.join("\n"));
            if (all.length > 25) embed.setFooter({ text: "Mostrando as 25 primeiras" });
        }
        return interaction.update({ embeds: [embed], components: [backRow()] });
    }

    if (action === "resetcode_list") {
        const all = ResetCodeStore.list();
        const embed = new EmbedBuilder().setTitle(`🔓 Códigos de reset (${all.length})`).setColor(0x2ecc71);
        if (all.length === 0) {
            embed.setDescription("Nenhum código gerado ainda.");
        } else {
            const lines = all.slice(0, 25).map(c => {
                const status = c.used ? `🔴 usado (key \`${c.usedOnKey}\`)` : "🟢 disponível";
                return `\`${c.code}\` — ${status}${c.note ? ` — _${c.note}_` : ""}`;
            });
            embed.setDescription(lines.join("\n"));
            if (all.length > 25) embed.setFooter({ text: "Mostrando os 25 primeiros" });
        }
        return interaction.update({ embeds: [embed], components: [backRow()] });
    }

    if (action === "stats") {
        const keys = KeyStore.list();
        const now = Date.now();
        const ativas = keys.filter(k => !k.revoked && (!k.expiresAt || k.expiresAt > now)).length;
        const expiradas = keys.filter(k => !k.revoked && k.expiresAt && k.expiresAt <= now).length;
        const revogadas = keys.filter(k => k.revoked).length;
        const resgatadas = keys.filter(k => k.discordId).length;
        const trials = keys.filter(k => k.note?.startsWith("trial")).length;
        const codigos = ResetCodeStore.list();
        const codigosUsados = codigos.filter(c => c.used).length;

        const embed = new EmbedBuilder()
            .setTitle("📊 Estatísticas")
            .setColor(0x8a3ffc)
            .addFields(
                { name: "🔑 Total de keys", value: String(keys.length), inline: true },
                { name: "🟢 Ativas", value: String(ativas), inline: true },
                { name: "🟠 Expiradas", value: String(expiradas), inline: true },
                { name: "🔴 Revogadas", value: String(revogadas), inline: true },
                { name: "✅ Resgatadas", value: String(resgatadas), inline: true },
                { name: "🎁 Trials", value: String(trials), inline: true },
                { name: "🔓 Códigos gerados", value: String(codigos.length), inline: true },
                { name: "💰 Códigos vendidos", value: String(codigosUsados), inline: true }
            );
        return interaction.update({ embeds: [embed], components: [backRow()] });
    }

    if (action === "purge") {
        const removidas = KeyStore.purge(30);
        const embed = new EmbedBuilder()
            .setTitle("🧹 Limpeza concluída")
            .setColor(0x8a3ffc)
            .setDescription(`${removidas} key(s) revogada(s)/expirada(s) há mais de 30 dias foram removidas.`);
        return interaction.update({ embeds: [embed], components: [backRow()] });
    }
}

async function handleModalSubmit(interaction) {
    if (!isAdmin(interaction)) {
        return interaction.reply({ content: "❌ Só admins podem usar esse painel.", ephemeral: true });
    }

    const action = interaction.customId.split(":")[1];
    const get = (id) => interaction.fields.getTextInputValue(id)?.trim();

    if (action === "generate") {
        const dias = get("dias") ? Number(get("dias")) : SettingsStore.get("defaultExpiryDays");
        const nota = get("nota") || "";
        const quantidade = Math.min(Math.max(Number(get("quantidade")) || 1, 1), 25);

        const entries = [];
        for (let i = 0; i < quantidade; i++) entries.push(KeyStore.create({ daysValid: dias, note: nota }));

        const embed = new EmbedBuilder()
            .setTitle(quantidade === 1 ? "🔑 Key gerada" : `🔑 ${quantidade} keys geradas`)
            .setColor(0x8a3ffc)
            .setDescription(entries.map(e => `\`${e.key}\``).join("\n"))
            .addFields({ name: "Validade", value: fmtDate(entries[0].expiresAt) });

        await interaction.reply({ embeds: [embed], components: [backRow()], ephemeral: true });
        return notifyLogChannel(interaction, `🔑 ${quantidade} key(s) gerada(s) por <@${interaction.user.id}>.`);
    }

    if (action === "revoke") {
        const key = get("key");
        const ok = KeyStore.revoke(key);
        await interaction.reply({
            content: ok ? `🔴 Key \`${key}\` revogada.` : `❌ Key \`${key}\` não encontrada.`,
            components: [backRow()],
            ephemeral: true
        });
        if (ok) await notifyLogChannel(interaction, `🔴 Key \`${key}\` revogada por <@${interaction.user.id}>.`);
        return;
    }

    if (action === "extend") {
        const key = get("key");
        const dias = Number(get("dias"));
        const result = KeyStore.extend(key, dias);
        if (!result.ok) {
            return interaction.reply({ content: `❌ Key \`${key}\` não encontrada.`, components: [backRow()], ephemeral: true });
        }
        await interaction.reply({
            content: `✅ Key \`${key}\` renovada — nova validade: ${fmtDate(result.entry.expiresAt)}.`,
            components: [backRow()],
            ephemeral: true
        });
        return notifyLogChannel(interaction, `📅 Key \`${key}\` renovada por +${dias} dias por <@${interaction.user.id}>.`);
    }

    if (action === "purge") {
        const dias = Number(get("dias")) || 30;
        const removidas = KeyStore.purge(dias);
        return interaction.reply({
            content: `🧹 ${removidas} key(s) removida(s) (revogadas/expiradas há +${dias} dias).`,
            components: [backRow()],
            ephemeral: true
        });
    }

    if (action === "resetcode_generate") {
        const nota = get("nota") || "";
        const entry = ResetCodeStore.create({ note: nota });
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("🔓 Código de reset gerado")
                    .setColor(0x2ecc71)
                    .addFields({ name: "Código", value: `\`${entry.code}\`` }, { name: "Nota", value: nota || "—" })
                    .setFooter({ text: "Manda esse código pra quem comprou — usa em /key resethwid codigo:" })
            ],
            components: [backRow()],
            ephemeral: true
        });
    }

    if (action === "resetcode_revoke") {
        const codigo = get("codigo");
        const entry = ResetCodeStore.get(codigo);
        if (!entry) return interaction.reply({ content: `❌ Código \`${codigo}\` não encontrado.`, components: [backRow()], ephemeral: true });
        if (entry.used) return interaction.reply({ content: `❌ Código \`${codigo}\` já foi usado.`, components: [backRow()], ephemeral: true });
        ResetCodeStore.revoke(codigo);
        return interaction.reply({ content: `🗑️ Código \`${codigo}\` apagado.`, components: [backRow()], ephemeral: true });
    }

    if (action === "config_expiry") {
        const dias = Number(get("dias"));
        SettingsStore.set("defaultExpiryDays", dias > 0 ? dias : null);
        return interaction.reply({ content: `✅ Validade padrão: ${dias > 0 ? `${dias} dias` : "nunca expira"}.`, components: [backRow()], ephemeral: true });
    }

    if (action === "config_cooldown") {
        const horas = Number(get("horas"));
        SettingsStore.set("resetCooldownHours", horas > 0 ? horas : 0);
        return interaction.reply({ content: `✅ Cooldown de reset: ${horas > 0 ? `${horas}h` : "desativado"}.`, components: [backRow()], ephemeral: true });
    }

    if (action === "config_trialdays") {
        const dias = Number(get("dias"));
        SettingsStore.set("trialDays", dias > 0 ? dias : 0);
        return interaction.reply({ content: `✅ Trial grátis: ${dias > 0 ? `${dias} dia(s)` : "desativado"}.`, components: [backRow()], ephemeral: true });
    }

    if (action === "config_logchannel") {
        const raw = get("canal");
        const id = raw ? raw.replace(/[<#>]/g, "") : null;
        SettingsStore.set("logChannelId", id || null);
        return interaction.reply({ content: id ? `✅ Canal de log definido: <#${id}>.` : "✅ Canal de log desativado.", components: [backRow()], ephemeral: true });
    }
}

module.exports = { mainPanel, configPanel, handleButton, handleModalSubmit };
