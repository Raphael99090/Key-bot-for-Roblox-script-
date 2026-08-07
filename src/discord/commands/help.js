const { SlashCommandBuilder } = require("discord.js");
const { panel, v2Payload } = require("../v2");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Mostra os comandos disponíveis"),

    async execute(interaction) {
        const container = panel({
            title: "📖 Comandos — 1NXITER KeyBot",
            fields: [
                { name: "/comprar", value: "Escolhe um plano (1 dia, 7 dias, 30 dias ou lifetime) — cria um ticket privado com a administração pra combinar o pagamento e receber a key." },
                { name: "/suporte", value: "Abre um ticket de suporte geral (dúvidas, problemas) — separado do ticket de compra." },
                { name: "/key redeem <key>", value: "Vincula uma key à sua conta." },
                { name: "/key check <key>", value: "Vê o status de uma key." },
                { name: "/key trial", value: "Pega uma key de teste grátis (1 por pessoa)." },
                { name: "/key resethwid <key> [codigo]", value: "Reseta o HWID (respeita cooldown, a menos que use um código comprado)." },
                { name: "/admin", value: "*(admin)* Abre o painel administrativo — gerar/listar/revogar/renovar keys, códigos de reset, configurações, vendas/pagamentos e estatísticas, tudo por botões." }
            ]
        });

        await interaction.reply(v2Payload(container, [], { ephemeral: true }));
    }
};
