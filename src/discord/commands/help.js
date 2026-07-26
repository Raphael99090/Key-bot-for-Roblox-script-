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
                { name: "/comprar", value: "Compra uma key (Pix, Bitcoin, cartão ou moeda local) — escolhe o método, paga, avisa o admin e recebe a key no privado." },
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
