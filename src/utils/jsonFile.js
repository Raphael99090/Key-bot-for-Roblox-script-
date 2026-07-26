const fs = require("fs");
const path = require("path");
const logger = require("./logger");

/**
 * Cria um "arquivo JSON seguro": leitura/escrita com backup automático
 * se o conteúdo estiver corrompido (JSON inválido). Usado por todas as
 * stores (keyStore, settingsStore, resetCodeStore, trialStore) — é a
 * camada que centraliza a persistência em arquivo. Trocar isso por um
 * banco de dados de verdade no futuro significa só reimplementar esse
 * módulo, sem precisar tocar nas stores que o usam (elas só chamam
 * readAll()/writeAll(), não sabem nem se é JSON, SQLite ou outra coisa).
 */
function createJsonFile(filePath, defaultValue) {
    function ensureFile() {
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
        }
    }

    function backupCorrupted() {
        try {
            const backupPath = `${filePath}.bak-${Date.now()}`;
            fs.copyFileSync(filePath, backupPath);
            logger.error(`Arquivo corrompido detectado em ${filePath} — backup salvo em ${backupPath}.`);
        } catch (err) {
            logger.error(`Falha ao criar backup do arquivo corrompido ${filePath} -> ${err.message}`);
        }
    }

    function readAll() {
        ensureFile();
        let raw;
        try {
            raw = fs.readFileSync(filePath, "utf-8");
        } catch (err) {
            logger.error(`Falha ao ler ${filePath} -> ${err.message}`);
            return { ...defaultValue };
        }

        try {
            return JSON.parse(raw);
        } catch {
            // JSON corrompido: guarda uma cópia pra investigar depois e
            // reseta pro valor padrão, em vez de derrubar o bot inteiro.
            backupCorrupted();
            writeAll(defaultValue);
            return { ...defaultValue };
        }
    }

    function writeAll(data) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (err) {
            logger.error(`Falha ao escrever em ${filePath} -> ${err.message}`);
        }
    }

    return { readAll, writeAll };
}

module.exports = { createJsonFile };
