const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require("discord.js");
const SettingsStore = require("../../store/settingsStore");
const { isAdmin } = require("../../utils/permissions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("config")
        .setDescription("[admin] Configurações do bot de key")
        .addSubcommand(sub =>
            sub.setName("show")
                .setDescription("Mostra a configuração atual")
        )
        .addSubcommand(sub =>
            sub.setName("expiry")
                .setDescription("Define a validade padrão (em dias) das novas keys")
                .addIntegerOption(opt =>
                    opt.setName("dias")
                        .setDescription("0 = nunca expira")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("hwidreset")
                .setDescription("Define se só admins podem resetar HWID")
                .addBooleanOption(opt =>
                    opt.setName("somente_admin")
                        .setDescription("true = só admin pode resetar HWID de qualquer key")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("resetcooldown")
                .setDescription("Define o cooldown (em horas) entre resets gratuitos de HWID")
                .addIntegerOption(opt =>
                    opt.setName("horas")
                        .setDescription("0 = sem cooldown")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("logchannel")
                .setDescription("Define o canal onde o bot avisa sobre keys geradas/resgatadas/revogadas")
                .addChannelOption(opt =>
                    opt.setName("canal")
                        .setDescription("Canal de log (deixe vazio pra desativar)")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        if (!isAdmin(interaction)) {
            return interaction.reply({ content: "❌ Só admins podem usar esse comando.", ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === "show") {
            const s = SettingsStore.getAll();
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("⚙️ Configuração atual")
                        .setColor(0x8a3ffc)
                        .addFields(
                            { name: "Validade padrão", value: s.defaultExpiryDays ? `${s.defaultExpiryDays} dias` : "nunca expira" },
                            { name: "Reset de HWID restrito a admin", value: s.hwidResetAdminOnly ? "sim" : "não" },
                            { name: "Cooldown de reset de HWID", value: s.resetCooldownHours ? `${s.resetCooldownHours}h` : "sem cooldown" },
                            { name: "Canal de log", value: s.logChannelId ? `<#${s.logChannelId}>` : "desativado" }
                        )
                ],
                ephemeral: true
            });
        }

        if (sub === "resetcooldown") {
            const horas = interaction.options.getInteger("horas");
            SettingsStore.set("resetCooldownHours", horas > 0 ? horas : 0);
            return interaction.reply({ content: `✅ Cooldown de reset de HWID: ${horas > 0 ? `${horas}h` : "desativado"}.`, ephemeral: true });
        }

        if (sub === "expiry") {
            const dias = interaction.options.getInteger("dias");
            SettingsStore.set("defaultExpiryDays", dias > 0 ? dias : null);
            return interaction.reply({ content: `✅ Validade padrão definida: ${dias > 0 ? `${dias} dias` : "nunca expira"}.`, ephemeral: true });
        }

        if (sub === "hwidreset") {
            const valor = interaction.options.getBoolean("somente_admin");
            SettingsStore.set("hwidResetAdminOnly", valor);
            return interaction.reply({ content: `✅ Reset de HWID ${valor ? "agora exige admin" : "liberado pro dono da key"}.`, ephemeral: true });
        }

        if (sub === "logchannel") {
            const canal = interaction.options.getChannel("canal");
            SettingsStore.set("logChannelId", canal ? canal.id : null);
            return interaction.reply({ content: canal ? `✅ Canal de log definido: ${canal}.` : "✅ Canal de log desativado.", ephemeral: true });
        }
    }
};
