const express = require("express");
const KeyStore = require("../../store/keyStore");
const logger = require("../../utils/logger");

const router = express.Router();

// GET /validate?key=1NX-XXXX-XXXX-XXXX&hwid=abc123
router.get("/validate", (req, res) => {
    const { key, hwid } = req.query;

    if (!key) {
        logger.warn(`Tentativa de validação sem key (IP: ${req.ip})`);
        return res.status(400).json({ valid: false, reason: "missing_key" });
    }

    const cleanKey = String(key).trim();
    const cleanHwid = hwid ? String(hwid).trim() : null;
    const result = KeyStore.validate(cleanKey, cleanHwid);

    logger.validation(cleanKey, cleanHwid, result);

    // Nunca devolve o objeto inteiro da key (evita expor discordId/nota
    // pra quem só devia saber "válido ou não").
    return res.json({ valid: result.valid, reason: result.reason || null });
});

module.exports = router;
