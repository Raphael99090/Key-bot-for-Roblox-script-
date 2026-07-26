const crypto = require("crypto");
const { paths } = require("../config");
const { createJsonFile } = require("../utils/jsonFile");

/**
 * Formato de cada pedido:
 * {
 *   id: "ORD-AB12CD34",
 *   discordId: "123...",       // quem comprou
 *   method: "pix"|"btc"|"card"|"local",
 *   status: "pending"|"paid_claimed"|"confirmed"|"rejected",
 *   createdAt: 1710000000000,
 *   decidedAt: 1710000000000 | null,
 *   decidedBy: "discordId" | null,   // admin que confirmou/rejeitou
 *   generatedKey: "1NX-..." | null
 * }
 */

const { readAll, writeAll } = createJsonFile(paths.orders, {});

function generateId() {
    return `ORD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

const OrderStore = {
    create({ discordId, method }) {
        const all = readAll();
        let id;
        do {
            id = generateId();
        } while (all[id]);

        all[id] = {
            id,
            discordId,
            method,
            status: "pending",
            createdAt: Date.now(),
            decidedAt: null,
            decidedBy: null,
            generatedKey: null
        };
        writeAll(all);
        return all[id];
    },

    get(id) {
        const all = readAll();
        return all[id] || null;
    },

    list() {
        return Object.values(readAll());
    },

    listPending() {
        return this.list().filter(o => o.status === "pending" || o.status === "paid_claimed");
    },

    /** Comprador avisa que já pagou — só muda o status pra evidenciar isso pro admin. */
    markPaidClaimed(id) {
        const all = readAll();
        if (!all[id]) return false;
        all[id].status = "paid_claimed";
        writeAll(all);
        return true;
    },

    confirm(id, generatedKey, adminId) {
        const all = readAll();
        const entry = all[id];
        if (!entry) return { ok: false, reason: "not_found" };
        if (entry.status === "confirmed" || entry.status === "rejected") {
            return { ok: false, reason: "already_decided" };
        }
        entry.status = "confirmed";
        entry.generatedKey = generatedKey;
        entry.decidedAt = Date.now();
        entry.decidedBy = adminId;
        writeAll(all);
        return { ok: true, entry };
    },

    reject(id, adminId) {
        const all = readAll();
        const entry = all[id];
        if (!entry) return { ok: false, reason: "not_found" };
        if (entry.status === "confirmed" || entry.status === "rejected") {
            return { ok: false, reason: "already_decided" };
        }
        entry.status = "rejected";
        entry.decidedAt = Date.now();
        entry.decidedBy = adminId;
        writeAll(all);
        return { ok: true, entry };
    }
};

module.exports = OrderStore;
