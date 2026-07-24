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
                        { name: "/key resethwid <key>", value: "Reseta o HWID pra trocar de dispositivo." },
                        { name: "/key generate [dias] [nota]", value: "*(admin)* Gera uma key nova." },
                        { name: "/key list", value: "*(admin)* Lista todas as keys." },
                        { name: "/key revoke <key>", value: "*(admin)* Revoga uma key." },
                        { name: "/config show", value: "*(admin)* Mostra as configurações atuais." },
                        { name: "/config expiry <dias>", value: "*(admin)* Define validade padrão." },
                        { name: "/config hwidreset <bool>", value: "*(admin)* Restringe reset de HWID a admins." },
                        { name: "/config logchannel [canal]", value: "*(admin)* Define canal de avisos." }
                    )
            ],
            ephemeral: true
        });
    }
};
