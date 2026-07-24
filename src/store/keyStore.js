const fs = require("fs");
const crypto = require("crypto");
const { paths } = require("../config");

/**
 * Formato de cada key salva:
 * {
 *   key: "1NX-AB12-CD34-EF56",
 *   discordId: "123..." | null,   // quem resgatou (redeem)
 *   hwid: "abcdef..." | null,     // travado no primeiro uso
 *   createdAt: 1710000000000,
 *   expiresAt: 1710000000000 | null,
 *   revoked: false,
 *   note: "" 
 * }
 */

function ensureFile() {
    if (!fs.existsSync(paths.keys)) {
        fs.mkdirSync(require("path").dirname(paths.keys), { recursive: true });
        fs.writeFileSync(paths.keys, JSON.stringify({}, null, 2));
    }
}

function readAll() {
    ensureFile();
    const raw = fs.readFileSync(paths.keys, "utf-8");
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function writeAll(data) {
    fs.writeFileSync(paths.keys, JSON.stringify(data, null, 2));
}

function generateKeyString() {
    const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
    return `1NX-${part()}-${part()}-${part()}`;
}

const KeyStore = {
    /** Cria uma key nova. daysValid = null significa "nunca expira". */
    create({ daysValid = null, note = "" } = {}) {
        const all = readAll();
        let key;
        do {
            key = generateKeyString();
        } while (all[key]); // evita colisão (extremamente raro, mas garante)

        const now = Date.now();
        all[key] = {
            key,
            discordId: null,
            hwid: null,
            createdAt: now,
            expiresAt: daysValid ? now + daysValid * 86400000 : null,
            revoked: false,
            note
        };
        writeAll(all);
        return all[key];
    },

    get(key) {
        const all = readAll();
        return all[key] || null;
    },

    list() {
        const all = readAll();
        return Object.values(all);
    },

    revoke(key) {
        const all = readAll();
        if (!all[key]) return false;
        all[key].revoked = true;
        writeAll(all);
        return true;
    },

    /** Vincula a key a um usuário do Discord (comando /key redeem). */
    redeem(key, discordId) {
        const all = readAll();
        const entry = all[key];
        if (!entry) return { ok: false, reason: "not_found" };
        if (entry.revoked) return { ok: false, reason: "revoked" };
        if (entry.discordId && entry.discordId !== discordId) {
            return { ok: false, reason: "already_claimed" };
        }
        entry.discordId = discordId;
        writeAll(all);
        return { ok: true, entry };
    },

    /** Reseta o HWID de uma key (comando /key resethwid). */
    resetHwid(key) {
        const all = readAll();
        if (!all[key]) return false;
        all[key].hwid = null;
        writeAll(all);
        return true;
    },

    /**
     * Valida uma key vinda do jogo (usado pela API HTTP).
     * Se a key não tiver HWID ainda, trava no primeiro HWID que aparecer.
     */
    validate(key, hwid) {
        const all = readAll();
        const entry = all[key];

        if (!entry) return { valid: false, reason: "not_found" };
        if (entry.revoked) return { valid: false, reason: "revoked" };
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            return { valid: false, reason: "expired" };
        }
        if (!entry.hwid && hwid) {
            entry.hwid = hwid;
            writeAll(all);
        } else if (entry.hwid && hwid && entry.hwid !== hwid) {
            return { valid: false, reason: "hwid_mismatch" };
        }

        return { valid: true, entry };
    }
};

module.exports = KeyStore;
