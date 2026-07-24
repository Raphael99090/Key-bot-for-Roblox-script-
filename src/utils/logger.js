function timestamp() {
    return new Date().toISOString().replace("T", " ").split(".")[0];
}

module.exports = {
    info: (msg) => console.log(`[${timestamp()}] ℹ️  ${msg}`),
    ok: (msg) => console.log(`[${timestamp()}] ✅ ${msg}`),
    warn: (msg) => console.warn(`[${timestamp()}] ⚠️  ${msg}`),
    error: (msg) => console.error(`[${timestamp()}] ❌ ${msg}`)
};
