const express = require("express");
const KeyStore = require("../../store/keyStore");

const router = express.Router();

// GET /validate?key=1NX-XXXX-XXXX-XXXX&hwid=abc123
router.get("/validate", (req, res) => {
    const { key, hwid } = req.query;

    if (!key) {
        return res.status(400).json({ valid: false, reason: "missing_key" });
    }

    const result = KeyStore.validate(String(key).trim(), hwid ? String(hwid).trim() : null);

    // Nunca devolve o objeto inteiro da key (evita expor discordId/nota
    // pra quem só devia saber "válido ou não").
    return res.json({ valid: result.valid, reason: result.reason || null });
});

module.exports = router;
