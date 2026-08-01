const config = require("../config");
const logger = require("../utils/logger");

let paymentClient = null;

/**
 * Carrega a SDK do Mercado Pago só se o token estiver configurado — assim
 * o bot sobe normalmente mesmo sem o pacote/token, sem quebrar nada.
 */
function getPaymentClient() {
    if (!config.mercadoPagoAccessToken) return null;
    if (paymentClient) return paymentClient;

    const { MercadoPagoConfig, Payment } = require("mercadopago");
    const mpConfig = new MercadoPagoConfig({ accessToken: config.mercadoPagoAccessToken });
    paymentClient = new Payment(mpConfig);
    return paymentClient;
}

function isConfigured() {
    return Boolean(config.mercadoPagoAccessToken);
}

/**
 * Cria uma cobrança Pix. Retorna o QR Code (imagem em base64 e o
 * "copia e cola") junto com o ID pra depois checar o status.
 */
async function createPixCharge({ amount, description, payerEmail = "cliente@exemplo.com" }) {
    const payment = getPaymentClient();
    if (!payment) throw new Error("Mercado Pago não configurado (MERCADOPAGO_ACCESS_TOKEN ausente no .env).");

    const data = await payment.create({
        body: {
            transaction_amount: amount,
            description,
            payment_method_id: "pix",
            payer: { email: payerEmail }
        }
    });

    const txData = data.point_of_interaction?.transaction_data;
    if (!txData?.qr_code) {
        throw new Error("Mercado Pago não retornou os dados do Pix — confere se o Access Token é de PRODUÇÃO, não de teste.");
    }

    return {
        id: data.id,
        qrCodeBase64: txData.qr_code_base64,
        qrCodeText: txData.qr_code
    };
}

/** "approved" | "pending" | "rejected" | "cancelled" | etc. */
async function checkPaymentStatus(paymentId) {
    const payment = getPaymentClient();
    if (!payment) return null;
    try {
        const info = await payment.get({ id: paymentId });
        return info.status;
    } catch (err) {
        logger.warn(`Falha ao consultar status do pagamento ${paymentId} -> ${err.message}`);
        return null;
    }
}

module.exports = { isConfigured, createPixCharge, checkPaymentStatus };
