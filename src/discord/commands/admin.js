const { SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../../utils/permissions");
const { mainPanel } = require("../adminPanel");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("admin")
        .setDescription("[admin] Abre o painel administrativo do KeyBot"),

    async execute(interaction) {
        if (!isAdmin(interaction)) {
            return interaction.reply({ content: "❌ Só admins podem abrir esse painel.", ephemeral: true });
        }
        return interaction.reply({ ...mainPanel(), ephemeral: true });
    }
};
