const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Mostra os comandos disponíveis"),

    async execute(interaction) {
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("📖 Comandos — 1NXITER KeyBot")
                    .setColor(0x8a3ffc)
                    .addFields(
                        { name: "/key redeem <key>", value: "Vincula uma key à sua conta." },
                        { name: "/key check <key>", value: "Vê o status de uma key." },
                        { name: "/key resethwid <key> [codigo]", value: "Reseta o HWID (respeita cooldown, a menos que use um código comprado)." },
                        { name: "/key generate [dias] [nota]", value: "*(admin)* Gera uma key nova." },
                        { name: "/key list", value: "*(admin)* Lista todas as keys." },
                        { name: "/key revoke <key>", value: "*(admin)* Revoga uma key." },
                        { name: "/resetcode generate [nota]", value: "*(admin)* Gera um código de reset pra vender." },
                        { name: "/resetcode list", value: "*(admin)* Lista os códigos gerados." },
                        { name: "/resetcode revoke <codigo>", value: "*(admin)* Apaga um código não usado." },
                        { name: "/config show", value: "*(admin)* Mostra as configurações atuais." },
                        { name: "/config expiry <dias>", value: "*(admin)* Define validade padrão." },
                        { name: "/config hwidreset <bool>", value: "*(admin)* Restringe reset de HWID a admins." },
                        { name: "/config resetcooldown <horas>", value: "*(admin)* Define o cooldown entre resets gratuitos." },
                        { name: "/config logchannel [canal]", value: "*(admin)* Define canal de avisos." }
                    )
            ],
            ephemeral: true
        });
    }
};
