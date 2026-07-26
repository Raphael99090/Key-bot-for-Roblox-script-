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
    logChannelId: null,
    // Canal onde o bot posta os pedidos pra você confirmar/rejeitar
    // (botões de Confirmar/Rejeitar aparecem lá). Se vazio, usa logChannelId.
    salesChannelId: null,
    // Instruções de pagamento mostradas pro cliente em cada método.
    // Texto livre — coloque a chave Pix, o endereço BTC, o link de
    // cartão, etc. Vazio = método aparece como "ainda não configurado".
    paymentInfo: {
        pix: "",
        btc: "",
        card: "",
        local: ""
    }
};

const PAYMENT_METHODS = {
    pix: "Pix",
    btc: "Bitcoin",
    card: "Cartão",
    local: "Moeda local"
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
    },

    /** Texto de instrução configurado pra um método ("pix"|"btc"|"card"|"local"). */
    getPaymentInfo(method) {
        return read().paymentInfo?.[method] || "";
    },

    /** Define o texto de instrução de um método específico. */
    setPaymentInfo(method, text) {
        if (!(method in PAYMENT_METHODS)) return false;
        const data = read();
        data.paymentInfo = { ...data.paymentInfo, [method]: text };
        writeAll(data);
        return true;
    },

    PAYMENT_METHODS
};

module.exports = SettingsStore;

