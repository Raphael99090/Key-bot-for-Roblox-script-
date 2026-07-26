const { paths } = require("../config");
const { createJsonFile } = require("../utils/jsonFile");

const DEFAULTS = {
    // Dias de validade padrão quando /key generate não especifica.
    defaultExpiryDays: null, // null = nunca expira
    // Se true, o comando /key resethwid só pode ser usado por admin.
    hwidResetAdminOnly: false,
    // Horas de espera entre resets gratuitos de HWID (0 = sem cooldown).
    // Um código de reset comprado (/resetcode) pula esse cooldown.
    resetCooldownHours: 24,
    // Dias de validade da key de trial grátis (/key trial). 0 = trial desativado.
    trialDays: 1,
    // Canal onde o bot avisa quando uma key é gerada/resgatada/revogada (opcional).
    logChannelId: null
};

const { readAll, writeAll } = createJsonFile(paths.settings, DEFAULTS);

function read() {
    return { ...DEFAULTS, ...readAll() };
}

const SettingsStore = {
    getAll() {
        return read();
    },
    get(k) {
        return read()[k];
    },
    set(k, v) {
        if (!(k in DEFAULTS)) return false;
        const data = read();
        data[k] = v;
        writeAll(data);
        return true;
    },
    validKeys() {
        return Object.keys(DEFAULTS);
    }
};

module.exports = SettingsStore;

