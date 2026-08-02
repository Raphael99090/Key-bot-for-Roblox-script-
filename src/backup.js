const fs = require("fs");
const path = require("path");
const db = require("./db");
const { dbPath } = require("./config");
const logger = require("./utils/logger");

const BACKUP_DIR = path.join(path.dirname(dbPath), "backups");
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_BACKUPS = 7;

function runBackup() {
    try {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = path.join(BACKUP_DIR, `bot-${stamp}.db`);

        // VACUUM INTO é a forma segura/atômica do SQLite de copiar o banco
        // — funciona mesmo com o banco em uso, sem risco de pegar um
        // arquivo pela metade (o que uma cópia de arquivo comum poderia).
        db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

        logger.ok(`Backup do banco criado: ${backupPath}`);
        pruneOldBackups();
    } catch (err) {
        logger.error(`Falha ao fazer backup do banco -> ${err.message}`);
    }
}

function pruneOldBackups() {
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith("bot-") && f.endsWith(".db"))
        .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

    for (const file of files.slice(MAX_BACKUPS)) {
        fs.unlinkSync(path.join(BACKUP_DIR, file.name));
    }
}

function startAutoBackup() {
    runBackup(); // um logo ao iniciar, além dos periódicos
    setInterval(runBackup, BACKUP_INTERVAL_MS);
}

module.exports = { startAutoBackup, runBackup };
