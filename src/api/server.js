const express = require("express");
const validateRoute = require("./routes/validate");
const { apiPort, apiSecret } = require("../config");
const logger = require("../utils/logger");

function startApi() {
    const app = express();

    // Rate limit bem simples e sem dependência extra: no máximo 20
    // requisições por IP a cada 10 segundos. Suficiente pra não deixar
    // alguém tentar "forçar" keys por tentativa e erro sem limite.
    const hits = new Map();
    app.use((req, res, next) => {
        const ip = req.ip;
        const now = Date.now();
        const windowMs = 10_000;
        const max = 20;

        const record = hits.get(ip) || { count: 0, start: now };
        if (now - record.start > windowMs) {
            record.count = 0;
            record.start = now;
        }
        record.count++;
        hits.set(ip, record);

        if (record.count > max) {
            return res.status(429).json({ valid: false, reason: "rate_limited" });
        }
        next();
    });

    // Segredo da API: se API_SECRET estiver definido no .env, exige ele
    // via header X-API-Key ou ?secret=. Sem isso, qualquer um na internet
    // podia bater na rota — agora só quem tem o segredo (ex: o próprio
    // script Lua do hub) consegue.
    app.use((req, res, next) => {
        if (!apiSecret) return next(); // sem segredo configurado = desativado
        const provided = req.header("x-api-key") || req.query.secret;
        if (provided !== apiSecret) {
            return res.status(401).json({ valid: false, reason: "unauthorized" });
        }
        next();
    });

    app.use(validateRoute);

    app.get("/", (req, res) => res.send("1NXITER KeyBot API — online"));

    app.listen(apiPort, () => {
        logger.ok(`API de validação escutando na porta ${apiPort}`);
    });
}

module.exports = { startApi };
