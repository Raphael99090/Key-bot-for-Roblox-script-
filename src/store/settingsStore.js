const fs = require("fs");
const path = require("path");
const { paths } = require("../config");

const DEFAULTS = {
    // Dias de validade padrão quando /key generate não especifica.
    defaultExpiryDays: null, // null = nunca expira
    // Se true, o comando /key resethwid só pode ser usado por admin.
    hwidResetAdminOnly: false,
    // Canal onde o bot avisa quando uma key é gerada/resgatada/revogada (opcional).
    logChannelId: null
};

function ensureFile() {
    if (!fs.existsSync(paths.settings)) {
        fs.mkdirSync(path.dirname(paths.settings), { recursive: true });
        fs.writeFileSync(paths.settings, JSON.stringify(DEFAULTS, null, 2));
    }
}

function read() {
    ensureFile();
    try {
        return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(paths.settings, "utf-8")) };
    } catch {
        return { ...DEFAULTS };
    }
}

function write(data) {
    fs.writeFileSync(paths.settings, JSON.stringify(data, null, 2));
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
        write(data);
        return true;
    },
    validKeys() {
        return Object.keys(DEFAULTS);
    }
};

module.exports = SettingsStore;
