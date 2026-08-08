const { SlashCommandBuilder } = require("discord.js");
const { isAdmin } = require("../../utils/permissions");
const { fixedPanel } = require("../supportPanel");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("suporte")
        .setDescription("[admin] Posta o painel fixo de suporte nesse canal"),

    async execute(interaction) {
        if (!isAdmin(interaction)) {
            return interaction.reply({ content: "❌ Só admins podem postar o painel de suporte.", ephemeral: true });
        }
        await interaction.channel.send(fixedPanel());
        return interaction.reply({ content: "✅ Painel de suporte postado.", ephemeral: true });
    }
};
