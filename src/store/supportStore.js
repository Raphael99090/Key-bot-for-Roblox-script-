const crypto = require("crypto");
const db = require("../db");

function generateId() {
    return `SUP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

const stmts = {
    insert: db.prepare(`INSERT INTO support_tickets (id, discordId, channelId, subject, type, status, createdAt, lastActivityAt) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`),
    get: db.prepare(`SELECT * FROM support_tickets WHERE id = ?`),
    getByChannel: db.prepare(`SELECT * FROM support_tickets WHERE channelId = ?`),
    all: db.prepare(`SELECT * FROM support_tickets`),
    touch: db.prepare(`UPDATE support_tickets SET lastActivityAt = ? WHERE id = ?`),
    close: db.prepare(`UPDATE support_tickets SET status = 'closed', closedAt = ?, closedBy = ? WHERE id = ?`)
};

/**
 * Formato de cada ticket de suporte:
 * { id, discordId, channelId, subject, type ("duvida"|"compra"),
 *   status, createdAt, lastActivityAt, closedAt, closedBy }
 */
const SupportStore = {
    create({ discordId, channelId, subject, type }) {
        let id;
        do {
            id = generateId();
        } while (stmts.get.get(id));

        const now = Date.now();
        stmts.insert.run(id, discordId, channelId, subject || "", type || "duvida", now, now);
        return stmts.get.get(id);
    },

    get(id) {
        return stmts.get.get(id) || null;
    },

    getByChannel(channelId) {
        return stmts.getByChannel.get(channelId) || null;
    },

    list() {
        return stmts.all.all();
    },

    listOpen() {
        return this.list().filter(t => t.status === "open");
    },

    touchActivity(id) {
        stmts.touch.run(Date.now(), id);
    },

    close(id, closedBy) {
        const entry = this.get(id);
        if (!entry || entry.status !== "open") return { ok: false };
        stmts.close.run(Date.now(), closedBy, id);
        return { ok: true, entry: this.get(id) };
    }
};

module.exports = SupportStore;
