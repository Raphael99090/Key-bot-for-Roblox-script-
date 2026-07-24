const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const KeyStore = require("../../store/keyStore");
const SettingsStore = require("../../store/settingsStore");
const ResetCodeStore = require("../../store/resetCodeStore");
const { isAdmin } = require("../../utils/permissions");
const logger = require("../../utils/logger");

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName("key")
        .setDescription("Gerenciar keys de acesso do hub")
        .addSubcommand(sub =>
            sub.setName("generate")
                .setDescription("[admin] Gera uma nova key")
                .addIntegerOption(opt =>
                    opt.setName("dias")
                        .setDescription("Validade em dias (deixe vazio pra usar o padrão configurado)")
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName("nota")
                        .setDescription("Nota interna (ex: nome do comprador)")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName("list")
                .setDescription("[admin] Lista todas as keys")
        )
        .addSubcommand(sub =>
            sub.setName("revoke")
                .setDescription("[admin] Revoga uma key")
                .addStringOption(opt =>
                    opt.setName("key").setDescription("A key a revogar").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("check")
                .setDescription("Verifica o status de uma key")
                .addStringOption(opt =>
                    opt.setName("key").setDescription("A key a verificar").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("redeem")
                .setDescription("Resgata uma key e vincula à sua conta do Discord")
                .addStringOption(opt =>
                    opt.setName("key").setDescription("A key recebida").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("resethwid")
                .setDescription("Reseta o HWID de uma key (permite trocar de dispositivo)")
                .addStringOption(opt =>
                    opt.setName("key").setDescription("A key a resetar").setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("codigo")
                        .setDescription("Código de reset comprado (pula o cooldown)")
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // --- generate ---
        if (sub === "generate") {
            if (!isAdmin(interaction)) {
                return interaction.reply({ content: "❌ Só admins podem gerar keys.", ephemeral: true });
            }
            const dias = interaction.options.getInteger("dias") ?? SettingsStore.get("defaultExpiryDays");
            const nota = interaction.options.getString("nota") ?? "";
            const entry = KeyStore.create({ daysValid: dias, note: nota });

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🔑 Key gerada")
                        .setColor(0x8a3ffc)
                        .addFields(
                            { name: "Key", value: `\`${entry.key}\`` },
                            { name: "Validade", value: fmtDate(entry.expiresAt), inline: true },
                            { name: "Nota", value: nota || "—", inline: true }
                        )
                ],
                ephemeral: true
            });

            await notifyLogChannel(interaction, `🔑 Key \`${entry.key}\` gerada por <@${interaction.user.id}>.`);
            return;
        }

        // --- list ---
        if (sub === "list") {
            if (!isAdmin(interaction)) {
                return interaction.reply({ content: "❌ Só admins podem listar keys.", ephemeral: true });
            }
            const all = KeyStore.list();
            if (all.length === 0) {
                return interaction.reply({ content: "Nenhuma key cadastrada ainda.", ephemeral: true });
            }

            const lines = all
                .slice(0, 25) // limite de campos de embed
                .map(e => `\`${e.key}\` — ${statusOf(e)} — ${e.discordId ? `<@${e.discordId}>` : "não resgatada"}`);

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`🔑 Keys cadastradas (${all.length})`)
                        .setDescription(lines.join("\n"))
                        .setColor(0x8a3ffc)
                        .setFooter(all.length > 25 ? { text: "Mostrando as 25 primeiras" } : null)
                ],
                ephemeral: true
            });
            return;
        }

        // --- revoke ---
        if (sub === "revoke") {
            if (!isAdmin(interaction)) {
                return interaction.reply({ content: "❌ Só admins podem revogar keys.", ephemeral: true });
            }
            const key = interaction.options.getString("key").trim();
            const ok = KeyStore.revoke(key);
            await interaction.reply({
                content: ok ? `🔴 Key \`${key}\` revogada.` : `❌ Key \`${key}\` não encontrada.`,
                ephemeral: true
            });
            if (ok) await notifyLogChannel(interaction, `🔴 Key \`${key}\` revogada por <@${interaction.user.id}>.`);
            return;
        }

        // --- check ---
        if (sub === "check") {
            const key = interaction.options.getString("key").trim();
            const entry = KeyStore.get(key);
            if (!entry) {
                return interaction.reply({ content: `❌ Key \`${key}\` não encontrada.`, ephemeral: true });
            }
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`🔑 ${key}`)
                        .setColor(0x8a3ffc)
                        .addFields(
                            { name: "Status", value: statusOf(entry), inline: true },
                            { name: "Expira", value: fmtDate(entry.expiresAt), inline: true },
                            { name: "Resgatada por", value: entry.discordId ? `<@${entry.discordId}>` : "ninguém", inline: true },
                            { name: "HWID vinculado", value: entry.hwid ? "sim" : "não", inline: true }
                        )
                ],
                ephemeral: true
            });
            return;
        }

        // --- redeem ---
        if (sub === "redeem") {
            const key = interaction.options.getString("key").trim();
            const result = KeyStore.redeem(key, interaction.user.id);

            const reasons = {
                not_found: "❌ Key não encontrada.",
                revoked: "❌ Essa key foi revogada.",
                already_claimed: "❌ Essa key já foi resgatada por outra pessoa."
            };

            if (!result.ok) {
                return interaction.reply({ content: reasons[result.reason] || "❌ Erro ao resgatar.", ephemeral: true });
            }

            await interaction.reply({ content: `✅ Key \`${key}\` vinculada à sua conta!`, ephemeral: true });
            await notifyLogChannel(interaction, `✅ Key \`${key}\` resgatada por <@${interaction.user.id}>.`);
            return;
        }

        // --- resethwid ---
        if (sub === "resethwid") {
            const key = interaction.options.getString("key").trim();
            const codigo = interaction.options.getString("codigo");
            const entry = KeyStore.get(key);

            if (!entry) {
                return interaction.reply({ content: `❌ Key \`${key}\` não encontrada.`, ephemeral: true });
            }

            const requireAdmin = SettingsStore.get("hwidResetAdminOnly");
            const ownsKey = entry.discordId === interaction.user.id;
            const admin = isAdmin(interaction);

            if (requireAdmin && !admin && !codigo) {
                return interaction.reply({ content: "❌ Reset de HWID está restrito a admins (ou use um código de reset).", ephemeral: true });
            }
            if (!requireAdmin && !ownsKey && !admin && !codigo) {
                return interaction.reply({ content: "❌ Essa key não é sua.", ephemeral: true });
            }

            // Se veio um código, ele precisa ser válido — e aí pula o cooldown de vez.
            let usedCode = null;
            if (codigo) {
                const result = ResetCodeStore.use(codigo.trim(), key, interaction.user.id);
                if (!result.ok) {
                    const reasons = {
                        not_found: "❌ Código de reset não encontrado.",
                        already_used: "❌ Esse código de reset já foi usado."
                    };
                    return interaction.reply({ content: reasons[result.reason] || "❌ Código inválido.", ephemeral: true });
                }
                usedCode = result.entry;
            } else if (!admin) {
                // Sem código e sem ser admin: respeita o cooldown configurado.
                const cooldownHours = SettingsStore.get("resetCooldownHours");
                const remaining = KeyStore.cooldownRemaining(key, cooldownHours);
                if (remaining > 0) {
                    const horas = Math.ceil(remaining / 3600000);
                    return interaction.reply({
                        content: `⏳ Essa key só pode resetar o HWID de novo em ~${horas}h. Se precisar agora, use um código de reset com \`/key resethwid codigo:\`.`,
                        ephemeral: true
                    });
                }
            }

            KeyStore.resetHwid(key);
            await interaction.reply({
                content: usedCode
                    ? `🔄 HWID da key \`${key}\` resetado (código \`${usedCode.code}\` consumido).`
                    : `🔄 HWID da key \`${key}\` resetado.`,
                ephemeral: true
            });
            await notifyLogChannel(
                interaction,
                `🔄 HWID da key \`${key}\` resetado por <@${interaction.user.id}>${usedCode ? ` usando código \`${usedCode.code}\`` : ""}.`
            );
            return;
        }
    }
};
