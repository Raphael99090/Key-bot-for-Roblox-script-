const crypto = require("crypto");
const db = require("../db");

function generateCode() {
    return `RESET-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function rowToEntry(row) {
    if (!row) return null;
    return { ...row, used: Boolean(row.used) };
}

const stmts = {
    insert: db.prepare(`INSERT INTO resetcodes (code, used, usedOnKey, usedBy, usedAt, createdAt, note) VALUES (?, 0, NULL, NULL, NULL, ?, ?)`),
    get: db.prepare(`SELECT * FROM resetcodes WHERE code = ?`),
    all: db.prepare(`SELECT * FROM resetcodes`),
    markUsed: db.prepare(`UPDATE resetcodes SET used = 1, usedOnKey = ?, usedBy = ?, usedAt = ? WHERE code = ?`),
    deleteOne: db.prepare(`DELETE FROM resetcodes WHERE code = ?`)
};

const ResetCodeStore = {
    create({ note = "" } = {}) {
        let code;
        do {
            code = generateCode();
        } while (stmts.get.get(code));

        stmts.insert.run(code, Date.now(), note);
        return rowToEntry(stmts.get.get(code));
    },

    get(code) {
        return rowToEntry(stmts.get.get(code));
    },

    list() {
        return stmts.all.all().map(rowToEntry);
    },

    revoke(code) {
        if (!stmts.get.get(code)) return false;
        stmts.deleteOne.run(code);
        return true;
    },

    /** Marca o código como usado, vinculado à key e ao usuário que usou. */
    use(code, key, discordId) {
        const entry = rowToEntry(stmts.get.get(code));
        if (!entry) return { ok: false, reason: "not_found" };
        if (entry.used) return { ok: false, reason: "already_used" };

        stmts.markUsed.run(key, discordId, Date.now(), code);
        return { ok: true, entry: rowToEntry(stmts.get.get(code)) };
    }
};

module.exports = ResetCodeStore;
