const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { dbPath } = require("./config");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS keys (
        key TEXT PRIMARY KEY,
        discordId TEXT,
        hwid TEXT,
        createdAt INTEGER NOT NULL,
        expiresAt INTEGER,
        revoked INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        lastHwidReset INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resetcodes (
        code TEXT PRIMARY KEY,
        used INTEGER NOT NULL DEFAULT 0,
        usedOnKey TEXT,
        usedBy TEXT,
        usedAt INTEGER,
        createdAt INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS trials (
        discordId TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        claimedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        discordId TEXT NOT NULL,
        plan TEXT NOT NULL,
        channelId TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        createdAt INTEGER NOT NULL,
        decidedAt INTEGER,
        decidedBy TEXT,
        generatedKey TEXT,
        couponCode TEXT
    );

    CREATE TABLE IF NOT EXISTS coupons (
        code TEXT PRIMARY KEY,
        discountText TEXT NOT NULL DEFAULT '',
        maxUses INTEGER,
        uses INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL
    );
`);

module.exports = db;
