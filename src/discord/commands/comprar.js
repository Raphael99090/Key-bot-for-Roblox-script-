const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { initialPanel } = require("../storePanel");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("comprar")
        .setDescription("Comprar uma key do hub"),

    async execute(interaction) {
        const payload = initialPanel();
        return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
    }
};
