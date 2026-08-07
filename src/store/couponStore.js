const crypto = require("crypto");
const db = require("../db");

function generateCode() {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function rowToEntry(row) {
    if (!row) return null;
    return { ...row, active: Boolean(row.active) };
}

const stmts = {
    insert: db.prepare(`INSERT INTO coupons (code, discountText, maxUses, uses, active, createdAt) VALUES (?, ?, ?, 0, 1, ?)`),
    get: db.prepare(`SELECT * FROM coupons WHERE code = ?`),
    all: db.prepare(`SELECT * FROM coupons`),
    incrUses: db.prepare(`UPDATE coupons SET uses = uses + 1 WHERE code = ?`),
    deactivate: db.prepare(`UPDATE coupons SET active = 0 WHERE code = ?`)
};

/**
 * Formato de cada cupom:
 * { code, discountText, maxUses (null = ilimitado), uses, active, createdAt }
 *
 * Sem processamento automático de preço (os preços dos planos são texto
 * livre, não numérico) — o cupom só carrega uma descrição de desconto
 * (ex: "10% OFF", "R$5 de desconto") que aparece no ticket pro admin
 * aplicar manualmente na hora de cobrar.
 */
const CouponStore = {
    create({ code, discountText, maxUses = null } = {}) {
        let finalCode = (code || generateCode()).toUpperCase().trim();
        if (stmts.get.get(finalCode)) {
            finalCode = generateCode(); // evita colisão se admin digitou um código repetido
        }
        stmts.insert.run(finalCode, discountText || "", maxUses, Date.now());
        return rowToEntry(stmts.get.get(finalCode));
    },

    get(code) {
        return rowToEntry(stmts.get.get(code?.toUpperCase().trim()));
    },

    list() {
        return stmts.all.all().map(rowToEntry);
    },

    /** Só confere se o cupom pode ser usado — não marca uso nem altera nada. */
    validate(code) {
        const entry = this.get(code);
        if (!entry) return { ok: false, reason: "not_found" };
        if (!entry.active) return { ok: false, reason: "inactive" };
        if (entry.maxUses !== null && entry.uses >= entry.maxUses) return { ok: false, reason: "exhausted" };
        return { ok: true, entry };
    },

    /** Valida e já incrementa o contador de uso (chame só quando for aplicar de fato). */
    use(code) {
        const result = this.validate(code);
        if (!result.ok) return result;
        stmts.incrUses.run(result.entry.code);
        return { ok: true, entry: this.get(result.entry.code) };
    },

    revoke(code) {
        const entry = this.get(code);
        if (!entry) return false;
        stmts.deactivate.run(entry.code);
        return true;
    }
};

module.exports = CouponStore;
