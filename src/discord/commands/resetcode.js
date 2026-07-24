const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const ResetCodeStore = require("../../store/resetCodeStore");
const { isAdmin } = require("../../utils/permissions");

function fmtDate(ts) {
    return ts ? new Date(ts).toLocaleString("pt-BR") : "—";
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("resetcode")
        .setDescription("[admin] Gerencia os códigos de reset de HWID vendáveis")
        .addSubcommand(sub =>
            sub.setName("generate")
                .setDescription("Gera um código novo de reset (pra vender)")
                .addStringOption(opt =>
                    opt.setName("nota")
                        .setDescription("Nota interna (ex: nome de quem comprou)")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName("list")
                .setDescription("Lista os códigos gerados (usados e não usados)")
        )
        .addSubcommand(sub =>
            sub.setName("revoke")
                .setDescription("Apaga um código ainda não usado")
                .addStringOption(opt =>
                    opt.setName("codigo").setDescription("O código a apagar").setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!isAdmin(interaction)) {
            return interaction.reply({ content: "❌ Só admins podem gerenciar códigos de reset.", ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === "generate") {
            const nota = interaction.options.getString("nota") ?? "";
            const entry = ResetCodeStore.create({ note: nota });

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🔓 Código de reset gerado")
                        .setColor(0x2ecc71)
                        .addFields(
                            { name: "Código", value: `\`${entry.code}\`` },
                            { name: "Nota", value: nota || "—" }
                        )
                        .setFooter({ text: "Manda esse código pra quem comprou — ele usa em /key resethwid codigo:" })
                ],
                ephemeral: true
            });
        }

        if (sub === "list") {
            const all = ResetCodeStore.list();
            if (all.length === 0) {
                return interaction.reply({ content: "Nenhum código gerado ainda.", ephemeral: true });
            }

            const lines = all
                .slice(0, 25)
                .map(c => {
                    const status = c.used ? `🔴 usado em ${fmtDate(c.usedAt)} (key \`${c.usedOnKey}\`)` : "🟢 disponível";
                    return `\`${c.code}\` — ${status}${c.note ? ` — _${c.note}_` : ""}`;
                });

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`🔓 Códigos de reset (${all.length})`)
                        .setDescription(lines.join("\n"))
                        .setColor(0x2ecc71)
                        .setFooter(all.length > 25 ? { text: "Mostrando os 25 primeiros" } : null)
                ],
                ephemeral: true
            });
        }

        if (sub === "revoke") {
            const codigo = interaction.options.getString("codigo").trim();
            const entry = ResetCodeStore.get(codigo);
            if (!entry) {
                return interaction.reply({ content: `❌ Código \`${codigo}\` não encontrado.`, ephemeral: true });
            }
            if (entry.used) {
                return interaction.reply({ content: `❌ Código \`${codigo}\` já foi usado, não dá pra apagar.`, ephemeral: true });
            }
            ResetCodeStore.revoke(codigo);
            return interaction.reply({ content: `🗑️ Código \`${codigo}\` apagado.`, ephemeral: true });
        }
    }
};
