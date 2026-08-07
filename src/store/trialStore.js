const db = require("../db");

const stmts = {
    get: db.prepare(`SELECT * FROM trials WHERE discordId = ?`),
    insert: db.prepare(`INSERT INTO trials (discordId, key, claimedAt) VALUES (?, ?, ?) ON CONFLICT(discordId) DO UPDATE SET key = excluded.key, claimedAt = excluded.claimedAt`)
};

const TrialStore = {
    hasClaimed(discordId) {
        return Boolean(stmts.get.get(discordId));
    },
    markClaimed(discordId, key) {
        stmts.insert.run(discordId, key, Date.now());
    }
};

module.exports = TrialStore;
