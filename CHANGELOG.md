# Changelog — 1NXITER KeyBot

## [Não lançado]

### Adicionado — segurança, resiliência e UX do painel
- **Segredo na API `/validate`**: `API_SECRET` no `.env`, checado via
  header `X-API-Key` ou `?secret=`. Desativado por padrão (compatível
  com quem já tinha o bot rodando), mas recomendado em produção.
- **`config.js` aceita `process.env.PORT`**, com prioridade sobre
  `API_PORT` — necessário pra hospedagens (Railway, etc.) que injetam a
  porta automaticamente.
- **Validação de ambiente ao iniciar** (`utils/validator.js`):
  `DISCORD_TOKEN`/`CLIENT_ID` faltando encerra o processo com mensagem
  clara; `GUILD_ID`/`ADMIN_ROLE_ID` faltando só avisa o trade-off.
- **Backup automático de JSON corrompido** (`utils/jsonFile.js`): se
  qualquer arquivo de dados vier corrompido, salva uma cópia
  (`.bak-<timestamp>`) e reseta pro padrão, em vez de derrubar o bot.
  As 4 stores (`keyStore`, `settingsStore`, `resetCodeStore`,
  `trialStore`) foram refatoradas pra usar esse helper único — é a
  camada de abstração que permite trocar por um banco de dados de
  verdade no futuro sem tocar nas stores.
- **Cooldown com precisão** (`utils/format.js` → `fmtDuration`): mostra
  "1h 23min" / "45min" / "30s" em vez de arredondar tudo pra hora cheia.
- **Confirmação antes de ações destrutivas**: revogar key e limpar
  dados antigos (`purge`) agora mostram uma prévia do que será afetado
  e exigem clique em "Confirmar" — `KeyStore.previewPurge()` calcula a
  prévia sem apagar nada.
- **Paginação na listagem de keys**: painel `/admin` → Listar Keys
  agora mostra 10 por página com botões Anterior/Próximo, em vez de
  cortar silenciosamente em 25.

### Alterado
- `main.lua` do hub atualizado: envia `&secret=` na validação (se
  `API_SECRET` configurado) e trata o motivo `unauthorized`.

## v2.0.0 — Painel Admin + Monetização

### ⚠️ Breaking changes
- `/config`, `/resetcode` e `/stats` foram removidos como comandos
  separados — toda a administração agora vive dentro de **`/admin`**,
  um painel interativo por botões e formulários.
- `/key` ficou restrito ao uso pessoal: `redeem`, `check`, `resethwid`,
  `trial`. As ações de admin (`generate`, `list`, `revoke`, `extend`,
  `purge`) migraram pro painel.

### Adicionado
- Painel administrativo completo (`/admin`): gerar keys (individual ou
  em lote, até 25), listar, revogar, renovar, gerar/listar/revogar
  códigos de reset, ajustar configurações e ver estatísticas — tudo por
  botões e modais.
- `/key trial` — key de teste gratuita autoatendida, 1 por conta do
  Discord.
- **Monetização de reset de HWID**: cooldown configurável entre resets
  gratuitos, e códigos de reset vendáveis que pulam esse cooldown.
- Renovação de key (`extend`) e limpeza de dados antigos (`purge`).
- README reescrito, mais completo e profissional.

## v1.0.0 — Primeira versão
- Bot com `/key` e `/config` separados, API de validação em `/validate`,
  armazenamento em JSON simples (`keyStore.js`, `settingsStore.js`),
  carregamento automático de comandos, workflow de CI (checagem de
  sintaxe + guarda contra `.env`/`data/keys.json` commitado).

