const fs = require("fs");
const path = require("path");
const { paths } = require("../config");

const filePath = path.join(path.dirname(paths.keys), "trials.json");

function ensureFile() {
    if (!fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
    }
}

function readAll() {
    ensureFile();
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
        return {};
    }
}

function writeAll(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const TrialStore = {
    hasClaimed(discordId) {
        return Boolean(readAll()[discordId]);
    },
    markClaimed(discordId, key) {
        const all = readAll();
        all[discordId] = { key, claimedAt: Date.now() };
        writeAll(all);
    }
};

module.exports = TrialStore;

