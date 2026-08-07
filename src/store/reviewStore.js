const db = require("../db");

const stmts = {
    insert: db.prepare(`INSERT INTO reviews (orderId, discordId, stars, comment, createdAt) VALUES (?, ?, ?, ?, ?)`),
    all: db.prepare(`SELECT * FROM reviews`),
    byOrder: db.prepare(`SELECT * FROM reviews WHERE orderId = ?`)
};

const ReviewStore = {
    create({ orderId, discordId, stars, comment = "" }) {
        stmts.insert.run(orderId, discordId, stars, comment, Date.now());
    },

    list() {
        return stmts.all.all();
    },

    getByOrder(orderId) {
        return stmts.byOrder.get(orderId) || null;
    },

    averageStars() {
        const all = this.list();
        if (all.length === 0) return null;
        return all.reduce((sum, r) => sum + r.stars, 0) / all.length;
    }
};

module.exports = ReviewStore;
