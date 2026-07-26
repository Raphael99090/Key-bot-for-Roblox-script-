const config = require("./config");
const { createClient } = require("./discord/client");
const { startApi } = require("./api/server");
const { validateEnv } = require("./utils/validator");

validateEnv(config);

const client = createClient();
client.login(config.token);

startApi();

