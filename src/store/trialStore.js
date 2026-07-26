const { paths } = require("../config");
const { createJsonFile } = require("../utils/jsonFile");

const { readAll, writeAll } = createJsonFile(paths.trials, {});

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

