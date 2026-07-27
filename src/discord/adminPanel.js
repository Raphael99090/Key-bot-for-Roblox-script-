const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require("discord.js");
const KeyStore = require("../store/keyStore");
const SettingsStore = require("../store/settingsStore");
const ResetCodeStore = require("../store/resetCodeStore");
const { isAdmin } = require("../utils/permissions");
const logger = require("../utils/logger");
const { panel, v2Payload } = require("./v2");
const { sendActionLog } = require("./logNotifier");
const { fmtDate } = require("../utils/format");

function statusOf(entry) {
    if (entry.revoked) return "🔴 Revogada";
    if (entry.expiresAt && Date.now() > entry.expiresAt) return "🟠 Expirada";
    return "🟢 Ativa";
}

/** Loga em arquivo (sempre) e manda um painel pro canal configurado (se houver). */
async function logAction(interaction, plainText) {
    logger.action(interaction.user.id, plainText);
    await sendActionLog(interaction.client, {
        title: "🛠️ Ação administrativa",
        actorId: interaction.user.id,
        description: `${plainText.charAt(0).toUpperCase()}${plainText.slice(1)}.`
    });
}

/**
 * Responde a uma interação de painel editando a MESMA mensagem em vez de
 * mandar uma nova. Funciona tanto pra botão (sempre editável) quanto pra
 * modal (editável quando o modal foi aberto a partir de um componente da
 * mensagem, que é sempre o nosso caso). Se por algum motivo não for
 * possível editar, cai pra um reply ephemeral como último recurso.
 * O payload já vem pronto de v2Payload() (com a flag de Components V2).
 */
async function respondToPanel(interaction, payload) {
    if (typeof interaction.isFromMessage === "function" && interaction.isFromMessage()) {
        return interaction.update(payload);
    }
    if (interaction.isButton?.()) {
        return interaction.update(payload);
    }
    // Fallback ephemeral: combina a flag de Ephemeral com a de Components V2
    // já presente no payload, em vez de usar o atalho `ephemeral: true`
    // (não dá pra misturar os dois jeitos na mesma resposta).
    return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
}

// ============================================================
// PAINÉIS (Container + botões)
// ============================================================

function mainPanel() {
    const container = panel({
        title: "🛠️ Painel Admin — 1NXITER KeyBot",
        description: "Escolha uma ação abaixo."
    });

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

    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:payments").setLabel("Vendas / Pagamentos").setEmoji("💳").setStyle(ButtonStyle.Secondary)
    );

    const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:delete_all_keys").setLabel("⚠️ Apagar TODAS as keys").setStyle(ButtonStyle.Danger)
    );

    return v2Payload(container, [row1, row2, row3, row4, row5]);
}

function configPanel() {
    const s = SettingsStore.getAll();
    const container = panel({
        title: "⚙️ Configurações",
        fields: [
            { name: "Validade padrão", value: s.defaultExpiryDays ? `${s.defaultExpiryDays} dias` : "nunca expira" },
            { name: "Cooldown reset HWID", value: s.resetCooldownHours ? `${s.resetCooldownHours}h` : "sem cooldown" },
            { name: "Validade do trial", value: s.trialDays ? `${s.trialDays} dia(s)` : "desativado" },
            { name: "Reset HWID restrito a admin", value: s.hwidResetAdminOnly ? "sim" : "não" },
            { name: "Canal de log", value: s.logChannelId ? `<#${s.logChannelId}>` : "desativado" }
        ]
    });

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

    return v2Payload(container, [row1, row2, row3]);
}

function paymentsPanel() {
    const s = SettingsStore.getAll();
    const preview = (text) => (text ? (text.length > 60 ? `${text.slice(0, 60)}…` : text) : "não configurado");

    const container = panel({
        title: "💳 Vendas / Pagamentos",
        description: "Configure as instruções que o cliente vê em `/comprar`, e o canal onde os pedidos aparecem pra você confirmar.",
        fields: [
            { name: "Pix", value: preview(s.paymentInfo?.pix) },
            { name: "Bitcoin", value: preview(s.paymentInfo?.btc) },
            { name: "Cartão", value: preview(s.paymentInfo?.card) },
            { name: "Moeda local", value: preview(s.paymentInfo?.local) },
            { name: "Canal de pedidos", value: s.salesChannelId ? `<#${s.salesChannelId}>` : (s.logChannelId ? `<#${s.logChannelId}> (canal de log)` : "não configurado") }
        ]
    });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:payment_pix").setLabel("Editar Pix").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("admin:payment_btc").setLabel("Editar Bitcoin").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("admin:payment_card").setLabel("Editar Cartão").setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:payment_local").setLabel("Editar Moeda Local").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("admin:payment_saleschannel").setLabel("Canal de pedidos").setStyle(ButtonStyle.Secondary)
    );
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
    );

    return v2Payload(container, [row1, row2, row3]);
}

function backRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("admin:back").setLabel("⬅️ Voltar ao painel").setStyle(ButtonStyle.Secondary)
    );
}

const KEYS_PER_PAGE = 10;

/** Painel paginado de listagem de keys. page é 0-indexed. */
function keyListPanel(page = 0) {
    const all = KeyStore.list();
    const totalPages = Math.max(1, Math.ceil(all.length / KEYS_PER_PAGE));
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);
    const slice = all.slice(safePage * KEYS_PER_PAGE, safePage * KEYS_PER_PAGE + KEYS_PER_PAGE);

    const container = panel({
        title: `🔑 Keys cadastradas (${all.length})`,
        description: slice.length === 0
            ? "Nenhuma key cadastrada ainda."
            : slice.map(e => `\`${e.key}\` — ${statusOf(e)} — ${e.discordId ? `<@${e.discordId}>` : "não resgatada"}`).join("\n"),
        footer: `Página ${safePage + 1} de ${totalPages}`
    });

    const nav = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`admin:list_page:${safePage - 1}`)
            .setLabel("⬅️ Anterior")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage <= 0),
        new ButtonBuilder()
            .setCustomId(`admin:list_page:${safePage + 1}`)
            .setLabel("Próximo ➡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage >= totalPages - 1)
    );

    return v2Payload(container, [nav, backRow()]);
}

/** Painel de confirmação genérico, usado antes de qualquer ação destrutiva. */
function confirmPanel({ title, description, confirmCustomId, confirmLabel = "Confirmar", danger = true }) {
    const container = panel({ title, description, color: danger ? 0xe74c3c : 0x8a3ffc });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(confirmCustomId).setLabel(confirmLabel).setStyle(danger ? ButtonStyle.Danger : ButtonStyle.Primary).setEmoji("✅"),
        new ButtonBuilder().setCustomId("admin:back").setLabel("Cancelar").setStyle(ButtonStyle.Secondary).setEmoji("✖️")
    );

    return v2Payload(container, [row]);
}

// ============================================================
// MODAIS (formulários pra pedir input — não são afetados por Components V2)
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
    ]),
    payment_pix: () => modal("admin_modal:payment_pix", "Instruções — Pix", [
        { id: "texto", label: "Chave/valor/instruções", long: true, required: false }
    ]),
    payment_btc: () => modal("admin_modal:payment_btc", "Instruções — Bitcoin", [
        { id: "texto", label: "Endereço/valor/instruções", long: true, required: false }
    ]),
    payment_card: () => modal("admin_modal:payment_card", "Instruções — Cartão", [
        { id: "texto", label: "Link de pagamento/instruções", long: true, required: false }
    ]),
    payment_local: () => modal("admin_modal:payment_local", "Instruções — Moeda local", [
        { id: "texto", label: "Instruções de pagamento", long: true, required: false }
    ]),
    payment_saleschannel: () => modal("admin_modal:payment_saleschannel", "Canal de pedidos", [
        { id: "canal", label: "ID do canal (vazio = usa o canal de log)", required: false, placeholder: "ex: 123456789012345678" }
    ]),
    delete_all_keys: () => modal("admin_modal:delete_all_keys", "⚠️ Apagar TODAS as keys", [
        { id: "confirmacao", label: 'Digite exatamente "APAGAR" pra confirmar', placeholder: "APAGAR" }
    ])
};

// ============================================================
// HANDLERS
// ============================================================

async function handleButton(interaction) {
    if (!isAdmin(interaction)) {
        return interaction.reply({ content: "❌ Só admins podem usar esse painel.", ephemeral: true });
    }

    const [, action, param] = interaction.customId.split(":");

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

    if (action === "payments") {
        return interaction.update(paymentsPanel());
    }

    if (action === "config_toggle_hwidreset") {
        const atual = SettingsStore.get("hwidResetAdminOnly");
        SettingsStore.set("hwidResetAdminOnly", !atual);
        await logAction(interaction, `alterou "HWID reset restrito a admin" para ${!atual ? "sim" : "não"}`);
        return interaction.update(configPanel());
    }

    if (action === "list" || action === "list_page") {
        const page = action === "list_page" ? Number(param) || 0 : 0;
        return interaction.update(keyListPanel(page));
    }

    if (action === "resetcode_list") {
        const all = ResetCodeStore.list();
        const lines = all.length === 0
            ? "Nenhum código gerado ainda."
            : all.slice(0, 25).map(c => {
                const status = c.used ? `🔴 usado (key \`${c.usedOnKey}\`)` : "🟢 disponível";
                return `\`${c.code}\` — ${status}${c.note ? ` — _${c.note}_` : ""}`;
            }).join("\n");

        const container = panel({
            title: `🔓 Códigos de reset (${all.length})`,
            description: lines,
            color: 0x2ecc71,
            footer: all.length > 25 ? "Mostrando os 25 primeiros" : null
        });
        return interaction.update(v2Payload(container, [backRow()]));
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

        const container = panel({
            title: "📊 Estatísticas",
            fields: [
                { name: "🔑 Total de keys", value: String(keys.length) },
                { name: "🟢 Ativas", value: String(ativas) },
                { name: "🟠 Expiradas", value: String(expiradas) },
                { name: "🔴 Revogadas", value: String(revogadas) },
                { name: "✅ Resgatadas", value: String(resgatadas) },
                { name: "🎁 Trials", value: String(trials) },
                { name: "🔓 Códigos gerados", value: String(codigos.length) },
                { name: "💰 Códigos vendidos", value: String(codigosUsados) }
            ]
        });
        return interaction.update(v2Payload(container, [backRow()]));
    }

    // "purge" (botão rápido, 30 dias) só mostra a PRÉVIA — quem apaga de
    // verdade é o "confirm_purge", depois da confirmação.
    if (action === "purge") {
        const preview = KeyStore.previewPurge(30);
        return interaction.update(confirmPanel({
            title: "🧹 Confirmar limpeza",
            description: preview.length === 0
                ? "Nenhuma key revogada/expirada há mais de 30 dias — nada a remover."
                : `Isso vai remover **${preview.length}** key(s):\n${preview.slice(0, 20).join(", ")}${preview.length > 20 ? "…" : ""}`,
            confirmCustomId: "admin:confirm_purge:30",
            confirmLabel: "Confirmar limpeza"
        }));
    }

    if (action === "confirm_purge") {
        const dias = Number(param) || 30;
        const removidas = KeyStore.purge(dias);
        const container = panel({
            title: "🧹 Limpeza concluída",
            description: `${removidas.length} key(s) revogada(s)/expirada(s) há mais de ${dias} dias foram removidas.`
        });
        await interaction.update(v2Payload(container, [backRow()]));
        return logAction(interaction, `limpou ${removidas.length} key(s) antiga(s) (+${dias} dias)${removidas.length ? `: ${removidas.join(", ")}` : ""}`);
    }

    if (action === "confirm_revoke") {
        const key = param;
        const ok = KeyStore.revoke(key);
        const container = panel({
            title: ok ? "🔴 Key revogada" : "❌ Key não encontrada",
            description: ok ? `A key \`${key}\` foi revogada.` : `Não achei a key \`${key}\`.`
        });
        await interaction.update(v2Payload(container, [backRow()]));
        if (ok) await logAction(interaction, `revogou a key \`${key}\``);
        return;
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

        const container = panel({
            title: quantidade === 1 ? "🔑 Key gerada" : `🔑 ${quantidade} keys geradas`,
            description: entries.map(e => `\`${e.key}\``).join("\n"),
            fields: [{ name: "Validade", value: fmtDate(entries[0].expiresAt) }]
        });

        await respondToPanel(interaction, v2Payload(container, [backRow()]));
        const keysList = entries.map(e => e.key).join(", ");
        return logAction(interaction, `gerou ${quantidade} key(s): ${keysList} — vencimento: ${fmtDate(entries[0].expiresAt)}${nota ? ` (nota: "${nota}")` : ""}`);
    }

    if (action === "revoke") {
        const key = get("key");
        const entry = KeyStore.get(key);
        if (!entry) {
            const container = panel({ title: "❌ Key não encontrada", description: `Não achei a key \`${key}\`.` });
            return respondToPanel(interaction, v2Payload(container, [backRow()]));
        }
        return respondToPanel(interaction, confirmPanel({
            title: "🗑️ Confirmar revogação",
            description: `Tem certeza que quer revogar a key \`${key}\`?${entry.discordId ? ` Ela está vinculada a <@${entry.discordId}>.` : ""}`,
            confirmCustomId: `admin:confirm_revoke:${key}`,
            confirmLabel: "Revogar"
        }));
    }

    if (action === "extend") {
        const key = get("key");
        const dias = Number(get("dias"));
        const result = KeyStore.extend(key, dias);
        if (!result.ok) {
            const container = panel({ title: "❌ Key não encontrada", description: `Não achei a key \`${key}\`.` });
            return respondToPanel(interaction, v2Payload(container, [backRow()]));
        }
        const container = panel({
            title: "✅ Key renovada",
            description: `Key \`${key}\` — nova validade: ${fmtDate(result.entry.expiresAt)}.`
        });
        await respondToPanel(interaction, v2Payload(container, [backRow()]));
        return logAction(interaction, `renovou a key \`${key}\` por +${dias} dias — novo vencimento: ${fmtDate(result.entry.expiresAt)}`);
    }

    if (action === "purge") {
        const dias = Number(get("dias")) || 30;
        const preview = KeyStore.previewPurge(dias);
        return respondToPanel(interaction, confirmPanel({
            title: "🧹 Confirmar limpeza",
            description: preview.length === 0
                ? `Nenhuma key revogada/expirada há mais de ${dias} dias — nada a remover.`
                : `Isso vai remover **${preview.length}** key(s):\n${preview.slice(0, 20).join(", ")}${preview.length > 20 ? "…" : ""}`,
            confirmCustomId: `admin:confirm_purge:${dias}`,
            confirmLabel: "Confirmar limpeza"
        }));
    }

    if (action === "resetcode_generate") {
        const nota = get("nota") || "";
        const entry = ResetCodeStore.create({ note: nota });
        const container = panel({
            title: "🔓 Código de reset gerado",
            color: 0x2ecc71,
            fields: [{ name: "Código", value: `\`${entry.code}\`` }, { name: "Nota", value: nota || "—" }],
            footer: "Manda esse código pra quem comprou — usa em /key resethwid codigo:"
        });
        await respondToPanel(interaction, v2Payload(container, [backRow()]));
        return logAction(interaction, `gerou o código de reset \`${entry.code}\`${nota ? ` (nota: "${nota}")` : ""}`);
    }

    if (action === "resetcode_revoke") {
        const codigo = get("codigo");
        const entry = ResetCodeStore.get(codigo);
        if (!entry) {
            const container = panel({ title: "❌ Código não encontrado", description: `Não achei o código \`${codigo}\`.` });
            return respondToPanel(interaction, v2Payload(container, [backRow()]));
        }
        if (entry.used) {
            const container = panel({ title: "❌ Código já usado", description: `O código \`${codigo}\` já foi usado.` });
            return respondToPanel(interaction, v2Payload(container, [backRow()]));
        }
        ResetCodeStore.revoke(codigo);
        const container = panel({ title: "🗑️ Código apagado", description: `Código \`${codigo}\` apagado.` });
        await respondToPanel(interaction, v2Payload(container, [backRow()]));
        return logAction(interaction, `apagou o código de reset \`${codigo}\``);
    }

    if (action === "config_expiry") {
        const dias = Number(get("dias"));
        SettingsStore.set("defaultExpiryDays", dias > 0 ? dias : null);
        await respondToPanel(interaction, configPanel());
        return logAction(interaction, `definiu a validade padrão: ${dias > 0 ? `${dias} dias` : "nunca expira"}`);
    }

    if (action === "config_cooldown") {
        const horas = Number(get("horas"));
        SettingsStore.set("resetCooldownHours", horas > 0 ? horas : 0);
        await respondToPanel(interaction, configPanel());
        return logAction(interaction, `definiu o cooldown de reset: ${horas > 0 ? `${horas}h` : "desativado"}`);
    }

    if (action === "config_trialdays") {
        const dias = Number(get("dias"));
        SettingsStore.set("trialDays", dias > 0 ? dias : 0);
        await respondToPanel(interaction, configPanel());
        return logAction(interaction, `definiu o trial: ${dias > 0 ? `${dias} dia(s)` : "desativado"}`);
    }

    if (action === "config_logchannel") {
        const raw = get("canal");
        const id = raw ? raw.replace(/[<#>]/g, "") : null;
        SettingsStore.set("logChannelId", id || null);
        await respondToPanel(interaction, configPanel());
        return logAction(interaction, `definiu o canal de log: ${id ? `<#${id}>` : "desativado"}`);
    }

    if (["payment_pix", "payment_btc", "payment_card", "payment_local"].includes(action)) {
        const method = action.replace("payment_", "");
        const texto = get("texto") || "";
        SettingsStore.setPaymentInfo(method, texto);
        await respondToPanel(interaction, paymentsPanel());
        return logAction(interaction, `atualizou as instruções de pagamento (${method})`);
    }

    if (action === "payment_saleschannel") {
        const raw = get("canal");
        const id = raw ? raw.replace(/[<#>]/g, "") : null;
        SettingsStore.set("salesChannelId", id || null);
        await respondToPanel(interaction, paymentsPanel());
        return logAction(interaction, `definiu o canal de pedidos: ${id ? `<#${id}>` : "desativado (usa o de log)"}`);
    }

    if (action === "delete_all_keys") {
        const confirmacao = get("confirmacao");
        if (confirmacao?.toUpperCase() !== "APAGAR") {
            const container = panel({
                title: "❌ Cancelado",
                description: 'Você não digitou exatamente "APAGAR" — nada foi apagado.'
            });
            return respondToPanel(interaction, v2Payload(container, [backRow()]));
        }

        const removidas = KeyStore.deleteAll();
        const container = panel({
            title: "🗑️ Todas as keys foram apagadas",
            color: 0xe74c3c,
            description: `${removidas.length} key(s) removida(s) do banco. Essa ação não tem volta — se precisar recuperar, use o backup mais recente em \`data/keys.json.bak-*\`, se existir.`
        });
        await respondToPanel(interaction, v2Payload(container, [backRow()]));

        // Log completo (arquivo sempre; canal mostra até 30 pra não ficar gigante)
        logger.action(interaction.user.id, `APAGOU TODAS AS ${removidas.length} KEY(S): ${removidas.join(", ")}`);
        return sendActionLog(interaction.client, {
            title: "🗑️⚠️ TODAS as keys foram apagadas",
            actorId: interaction.user.id,
            color: 0xe74c3c,
            description: `${removidas.length} key(s) removida(s) permanentemente.${removidas.length ? `\n\n${removidas.slice(0, 30).join(", ")}${removidas.length > 30 ? "…" : ""}` : ""}`
        });
    }
}

module.exports = { mainPanel, configPanel, handleButton, handleModalSubmit };
