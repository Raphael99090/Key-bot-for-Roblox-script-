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
    // Categoria onde os canais de ticket de compra são criados (opcional —
    // sem isso, o canal do ticket é criado sem categoria).
    ticketCategoryId: null,
    // Texto configurável que aparece no topo da loja (/comprar).
    shopDescription: "",
    // Preço mostrado em cada botão de plano. Texto livre (ex: "R$ 15,00").
    // Vazio = o plano aparece com "Preço a definir".
    plans: {
        day: "",
        week: "",
        month: "",
        lifetime: ""
    },
    // Instruções de pagamento mostradas dentro do ticket (referência pro
    // admin não precisar retranscrever a cada venda). Texto livre — chave
    // Pix, endereço BTC, link de cartão, etc.
    paymentInfo: {
        pix: "",
        btc: "",
        card: "",
        local: ""
    }
};

const PLAN_LABELS = {
    day: "1 Dia",
    week: "7 Dias",
    month: "30 Dias",
    lifetime: "Lifetime"
};

// Dias de validade de cada plano — lifetime é null (nunca expira).
// Isso é estrutural, não configurável (o preço sim, o prazo não).
const PLAN_DAYS = {
    day: 1,
    week: 7,
    month: 30,
    lifetime: null
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

    /** Preço configurado pra um plano ("day"|"week"|"month"|"lifetime"). */
    getPlanPrice(plan) {
        return read().plans?.[plan] || "";
    },

    /** Define o preço de um plano específico. */
    setPlanPrice(plan, price) {
        if (!(plan in PLAN_LABELS)) return false;
        const data = read();
        data.plans = { ...data.plans, [plan]: price };
        writeAll(data);
        return true;
    },

    PAYMENT_METHODS,
    PLAN_LABELS,
    PLAN_DAYS
};

module.exports = SettingsStore;

