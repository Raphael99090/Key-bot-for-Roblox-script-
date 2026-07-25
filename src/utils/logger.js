const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "..", "..", "data", "bot.log");

function ensureLogFile() {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
    return new Date().toISOString().replace("T", " ").split(".")[0];
}

function writeToFile(line) {
    try {
        ensureLogFile();
        fs.appendFileSync(LOG_FILE, line + "\n");
    } catch {
        // Se não conseguir escrever em arquivo (ex: filesystem read-only em
        // algumas hospedagens free tier), não derruba o bot por causa disso.
    }
}

function log(level, emoji, msg) {
    const line = `[${timestamp()}] ${emoji} ${msg}`;
    (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
    writeToFile(`[${level.toUpperCase()}] ${line}`);
}

module.exports = {
    info: (msg) => log("info", "ℹ️ ", msg),
    ok: (msg) => log("info", "✅", msg),
    warn: (msg) => log("warn", "⚠️ ", msg),
    error: (msg) => log("error", "❌", msg),

    /** Log dedicado pra ações administrativas — quem fez o quê. */
    action: (discordId, description) => log("info", "🛠️ ", `[admin: ${discordId}] ${description}`),

    /** Log dedicado pras tentativas de validação de key vindas do jogo. */
    validation: (key, hwid, result) => {
        const hwidShort = hwid ? `${String(hwid).slice(0, 8)}…` : "sem-hwid";
        log("info", "🔍", `validate key=${key} hwid=${hwidShort} -> ${result.valid ? "válida" : `inválida (${result.reason})`}`);
    }
};
