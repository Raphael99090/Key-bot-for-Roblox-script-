const { SlashCommandBuilder } = require("discord.js");
const { initialPanel } = require("../storePanel");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("comprar")
        .setDescription("Comprar uma key do hub"),

    async execute(interaction) {
        return interaction.reply({ ...initialPanel(), ephemeral: true });
    }
};
