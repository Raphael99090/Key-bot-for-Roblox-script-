const { PermissionFlagsBits } = require("discord.js");
const { adminRoleId } = require("../config");

/**
 * Considera admin quem tiver permissão de Administrator no servidor,
 * OU o cargo configurado em ADMIN_ROLE_ID (.env).
 */
function isAdmin(interaction) {
    if (!interaction.inGuild()) return false;

    const member = interaction.member;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;

    if (adminRoleId && member.roles?.cache?.has(adminRoleId)) return true;

    return false;
}

module.exports = { isAdmin };
