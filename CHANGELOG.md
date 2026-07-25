# Changelog — 1NXITER KeyBot

## [Não lançado]

### Alterado — consolidação em painel admin
- **Reduzido de ~4 comandos pra 3** (`/key`, `/admin`, `/help`). Tudo que
  era admin (`/key generate|list|revoke|extend|purge`, `/resetcode
  generate|list|revoke`, `/config show|expiry|hwidreset|resetcooldown|
  trialdays|logchannel`, `/stats`) virou um único **painel interativo por
  botões** (`/admin`), com modais pra pedir input em vez de opções de
  slash command.
- `/key` agora só tem os subcomandos de uso pessoal: `redeem`, `check`,
  `resethwid`, `trial`.
- Removidos os arquivos `commands/config.js`, `commands/resetcode.js` e
  `commands/stats.js` — a lógica deles foi movida pra dentro de
  `discord/adminPanel.js`.
- `discord/client.js` agora roteia três tipos de interação: slash
  commands, botões (`admin:*`) e envio de modal (`admin_modal:*`).

### Adicionado
- `discord/adminPanel.js` — painel principal, painel de configurações,
  geração de modais e os handlers de botão/modal.
- `commands/admin.js` — abre o painel (`/admin`).
- Geração de key em lote (campo "quantidade" no modal de gerar, até 25
  por vez).
- `/key extend` (via painel) — renova a validade de uma key existente.
- `/key trial` — key de teste grátis autoatendida, 1 por conta do
  Discord (`store/trialStore.js` controla isso).
- `/key purge` (via painel) — remove do JSON keys revogadas/expiradas
  antigas.
- Estatísticas (via painel) — total de keys, ativas, expiradas,
  revogadas, resgatadas, trials distribuídos, códigos de reset
  gerados/vendidos.
- **Monetização de reset de HWID**: cooldown configurável
  (`resetCooldownHours`, padrão 24h) entre resets gratuitos, e códigos de
  reset vendáveis (`store/resetCodeStore.js`) que pulam o cooldown quando
  usados em `/key resethwid codigo:`.

### Anterior (primeira versão)
- Bot com `/key` e `/config` separados, API de validação em `/validate`,
  armazenamento em JSON simples (`keyStore.js`, `settingsStore.js`),
  carregamento automático de comandos, workflow de CI (checagem de
  sintaxe + guarda contra `.env`/`data/keys.json` commitado).
