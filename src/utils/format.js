/**
 * Formata uma duração em ms de forma legível: "1h 23min", "45min", "30s".
 * Usado pra mostrar tempo restante de cooldown com precisão de verdade,
 * em vez de arredondar tudo pra hora cheia.
 */
function fmtDuration(ms) {
    if (ms <= 0) return "0s";

    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
    }
    if (minutes > 0) {
        return seconds > 0 ? `${minutes}min ${seconds}s` : `${minutes}min`;
    }
    return `${seconds}s`;
}

/**
 * Formata a expiração de uma key. Usa o timestamp nativo do Discord
 * (<t:...:f>) — mostra a data certa no fuso de quem estiver lendo, sem
 * precisar formatar manualmente. "nunca expira" quando não há data.
 */
function fmtDate(ts) {
    if (!ts) return "nunca expira";
    return `<t:${Math.floor(ts / 1000)}:f>`;
}

module.exports = { fmtDuration, fmtDate };
