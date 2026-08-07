const { SlashCommandBuilder } = require("discord.js");
const { subjectModal } = require("../supportPanel");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("suporte")
        .setDescription("Abre um ticket de suporte com a administração (dúvidas, problemas)"),

    async execute(interaction) {
        return interaction.showModal(subjectModal());
    }
};
