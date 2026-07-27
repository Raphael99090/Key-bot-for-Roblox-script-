const crypto = require("crypto");
const { paths } = require("../config");
const { createJsonFile } = require("../utils/jsonFile");

/**
 * Formato de cada pedido/ticket:
 * {
 *   id: "ORD-AB12CD34",
 *   discordId: "123...",         // quem comprou
 *   plan: "day"|"week"|"month"|"lifetime",
 *   channelId: "123...",          // canal privado (ticket) criado pra essa compra
 *   status: "open"|"confirmed"|"rejected",
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
    create({ discordId, plan, channelId }) {
        const all = readAll();
        let id;
        do {
            id = generateId();
        } while (all[id]);

        all[id] = {
            id,
            discordId,
            plan,
            channelId,
            status: "open",
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

    getByChannel(channelId) {
        return this.list().find(o => o.channelId === channelId) || null;
    },

    list() {
        return Object.values(readAll());
    },

    listOpen() {
        return this.list().filter(o => o.status === "open");
    },

    confirm(id, generatedKey, adminId) {
        const all = readAll();
        const entry = all[id];
        if (!entry) return { ok: false, reason: "not_found" };
        if (entry.status !== "open") return { ok: false, reason: "already_decided" };

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
        if (entry.status !== "open") return { ok: false, reason: "already_decided" };

        entry.status = "rejected";
        entry.decidedAt = Date.now();
        entry.decidedBy = adminId;
        writeAll(all);
        return { ok: true, entry };
    }
};

module.exports = OrderStore;
