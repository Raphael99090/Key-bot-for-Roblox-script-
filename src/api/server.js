const express = require("express");
const validateRoute = require("./routes/validate");
const { apiPort } = require("../config");
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

    app.use(validateRoute);

    app.get("/", (req, res) => res.send("1NXITER KeyBot API — online"));

    app.listen(apiPort, () => {
        logger.ok(`API de validação escutando na porta ${apiPort}`);
    });
}

module.exports = { startApi };
