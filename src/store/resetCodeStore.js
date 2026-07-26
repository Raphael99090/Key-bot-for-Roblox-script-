const crypto = require("crypto");
const { paths } = require("../config");
const { createJsonFile } = require("../utils/jsonFile");

/**
 * Formato de cada código:
 * {
 *   code: "RESET-AB12CD34",
 *   used: false,
 *   usedOnKey: "1NX-..." | null,
 *   usedBy: "discordId" | null,
 *   usedAt: 1710000000000 | null,
 *   createdAt: 1710000000000,
 *   note: "" // ex: "vendido pro João, 24/07"
 * }
 */

const { readAll, writeAll } = createJsonFile(paths.resetCodes, {});

function generateCode() {
    return `RESET-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

const ResetCodeStore = {
    create({ note = "" } = {}) {
        const all = readAll();
        let code;
        do {
            code = generateCode();
        } while (all[code]);

        all[code] = {
            code,
            used: false,
            usedOnKey: null,
            usedBy: null,
            usedAt: null,
            createdAt: Date.now(),
            note
        };
        writeAll(all);
        return all[code];
    },

    get(code) {
        const all = readAll();
        return all[code] || null;
    },

    list() {
        return Object.values(readAll());
    },

    revoke(code) {
        const all = readAll();
        if (!all[code]) return false;
        delete all[code];
        writeAll(all);
        return true;
    },

    /** Marca o código como usado, vinculado à key e ao usuário que usou. */
    use(code, key, discordId) {
        const all = readAll();
        const entry = all[code];
        if (!entry) return { ok: false, reason: "not_found" };
        if (entry.used) return { ok: false, reason: "already_used" };

        entry.used = true;
        entry.usedOnKey = key;
        entry.usedBy = discordId;
        entry.usedAt = Date.now();
        writeAll(all);
        return { ok: true, entry };
    }
};

module.exports = ResetCodeStore;
