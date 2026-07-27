const crypto = require("crypto");
const { paths } = require("../config");
const { createJsonFile } = require("../utils/jsonFile");

/**
 * Formato de cada key salva:
 * {
 *   key: "1NX-AB12-CD34-EF56",
 *   discordId: "123..." | null,   // quem resgatou (redeem)
 *   hwid: "abcdef..." | null,     // travado no primeiro uso
 *   createdAt: 1710000000000,
 *   expiresAt: 1710000000000 | null,
 *   revoked: false,
 *   note: "",
 *   lastHwidReset: 1710000000000 | null   // pra calcular o cooldown
 * }
 */

const { readAll, writeAll } = createJsonFile(paths.keys, {});

function generateKeyString() {
    const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
    return `1NX-${part()}-${part()}-${part()}`;
}

function selectPurgeCandidates(all, olderThanDays) {
    const cutoff = Date.now() - olderThanDays * 86400000;
    const candidates = [];
    for (const [k, entry] of Object.entries(all)) {
        const isExpired = entry.expiresAt && entry.expiresAt < cutoff;
        const isOldRevoked = entry.revoked && entry.createdAt < cutoff;
        if (isExpired || isOldRevoked) candidates.push(k);
    }
    return candidates;
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
            note,
            lastHwidReset: null
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

    /**
     * Estende a validade de uma key (renovação). Se ela já tiver expirado
     * ou nunca tiver expirado, conta os dias a partir de agora; senão,
     * soma em cima da data de expiração atual.
     */
    extend(key, days) {
        const all = readAll();
        const entry = all[key];
        if (!entry) return { ok: false, reason: "not_found" };

        const base = entry.expiresAt && entry.expiresAt > Date.now() ? entry.expiresAt : Date.now();
        entry.expiresAt = base + days * 86400000;
        writeAll(all);
        return { ok: true, entry };
    },

    /**
     * Remove do arquivo as keys revogadas ou expiradas há mais de
     * `olderThanDays` dias. Retorna a lista das keys removidas.
     */
    purge(olderThanDays = 30) {
        const all = readAll();
        const toRemove = selectPurgeCandidates(all, olderThanDays);

        for (const k of toRemove) delete all[k];
        writeAll(all);
        return toRemove;
    },

    /**
     * Apaga TODAS as keys, sem exceção — não olha status nem validade.
     * Sem volta. Retorna a lista das keys removidas (pra log/confirmação).
     */
    deleteAll() {
        const all = readAll();
        const removed = Object.keys(all);
        writeAll({});
        return removed;
    },

    /**
     * Mesma seleção do purge(), mas sem apagar nada — só pra mostrar
     * numa tela de confirmação antes do usuário decidir de verdade.
     */
    previewPurge(olderThanDays = 30) {
        const all = readAll();
        return selectPurgeCandidates(all, olderThanDays);
    },

    /** Quanto tempo falta (em ms) até poder resetar de novo. 0 = pode resetar já. */
    cooldownRemaining(key, cooldownHours) {
        const all = readAll();
        const entry = all[key];
        if (!entry || !entry.lastHwidReset || !cooldownHours) return 0;
        const elapsed = Date.now() - entry.lastHwidReset;
        const total = cooldownHours * 3600000;
        return Math.max(0, total - elapsed);
    },

    /** Reseta o HWID de uma key (comando /key resethwid). */
    resetHwid(key) {
        const all = readAll();
        if (!all[key]) return false;
        all[key].hwid = null;
        all[key].lastHwidReset = Date.now();
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
