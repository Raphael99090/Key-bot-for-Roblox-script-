<div align="center">

# 1NXITER KeyBot

**Sistema de licenciamento (key system) via Discord para o 1NXITER HUB.**
Bot de administração por painel interativo + API HTTP de validação,
sem dependência de banco de dados externo.

</div>

---

## Visão geral

O 1NXITER KeyBot resolve três problemas do hub:

1. **Distribuição de acesso** — geração, venda e controle de keys de uso.
2. **Validação em tempo real** — o script Lua consulta uma API HTTP antes
   de liberar o hub, com bloqueio por HWID.
3. **Monetização de suporte** — reset de HWID tem cooldown gratuito
   configurável, com códigos de reset vendáveis para quem quer pular a
   espera.

Toda a administração roda através de um único comando (`/admin`), que
abre um painel por botões e formulários — sem precisar memorizar
sintaxe de comando para cada ação.

## Funcionalidades

- 🔑 **Keys**: geração (individual ou em lote, até 25 por vez), resgate
  vinculado à conta do Discord, verificação de status, revogação,
  renovação e expiração automática.
- 🎁 **Trial autoatendido**: qualquer usuário pode resgatar uma key de
  teste gratuita, limitada a uma por conta do Discord.
- 🔒 **HWID lock**: cada key trava no primeiro dispositivo que a usar.
- ⏳ **Cooldown de reset configurável**: evita reset de HWID ilimitado
  sem custo.
- 💰 **Códigos de reset vendáveis**: pulam o cooldown quando usados —
  o produto que você vende para quem precisa resetar com urgência.
- 📊 **Estatísticas**: visão consolidada de keys ativas, expiradas,
  revogadas, resgatadas, trials distribuídos e códigos vendidos.
- 🧹 **Manutenção**: remoção de keys antigas revogadas/expiradas.
- 🌐 **API de validação HTTP**, consumida diretamente pelo `main.lua`
  do hub.

## Arquitetura

```
src/
├── index.js                    # entrada: inicia o bot e a API juntos
├── config.js                   # leitura do .env
├── store/                      # persistência em JSON (sem dependências nativas)
│   ├── keyStore.js              # CRUD de keys, cooldown, extend, purge
│   ├── settingsStore.js         # configurações ajustáveis pelo painel
│   ├── resetCodeStore.js        # códigos de reset vendáveis
│   └── trialStore.js            # controle de 1 trial por conta
├── discord/
│   ├── client.js                 # cliente + roteador de interações
│   ├── deployCommands.js          # registro dos slash commands
│   ├── adminPanel.js               # painel admin: embeds, botões, modais
│   └── commands/
│       ├── key.js                  # /key redeem|check|resethwid|trial
│       ├── admin.js                 # /admin — abre o painel
│       └── help.js                   # /help
├── api/
│   ├── server.js                  # servidor Express + rate limit
│   └── routes/validate.js          # GET /validate?key=&hwid=
└── utils/
    ├── logger.js
    └── permissions.js
data/                            # gerado em runtime, não versionado
```

Comandos são carregados automaticamente a partir de `src/discord/commands/`
— para adicionar um novo, basta criar o arquivo no formato `{ data, execute }`.

## Comandos

| Comando | Acesso | Descrição |
|---|---|---|
| `/key redeem <key>` | todos | Vincula uma key à própria conta do Discord |
| `/key check <key>` | todos | Consulta o status de uma key |
| `/key trial` | todos | Resgata uma key de teste gratuita (1 por conta) |
| `/key resethwid <key> [codigo]` | dono da key | Reseta o HWID (respeita cooldown, salvo com código de reset) |
| `/admin` | admin | Abre o painel administrativo completo |
| `/help` | todos | Lista os comandos disponíveis |

Toda a administração (gerar/listar/revogar/renovar keys, gerar e listar
códigos de reset, ajustar configurações, ver estatísticas, limpar dados
antigos) vive dentro do painel do `/admin` — não são slash commands
separados.

### Quem é "admin"?

Qualquer membro com a permissão **Administrator** no servidor, ou com o
cargo definido em `ADMIN_ROLE_ID` no `.env`.

## Instalação

### Pré-requisitos
- Node.js 18 ou superior
- Uma aplicação de bot criada em [discord.com/developers/applications](https://discord.com/developers/applications)

### Passo a passo

```bash
git clone <https://github.com/Raphael99090/Key-bot-for-Roblox-script->
cd keybot
npm install
cp .env.example .env
```

Preencha o `.env`:

| Variável | Descrição |
|---|---|
| `DISCORD_TOKEN` | Token do bot (Developer Portal → Bot) |
| `CLIENT_ID` | Application ID (Developer Portal → General Information) |
| `GUILD_ID` | ID do servidor onde os comandos serão registrados (recomendado — sem isso, o registro global demora até 1h para propagar) |
| `ADMIN_ROLE_ID` | ID do cargo com acesso ao painel admin (opcional) |
| `API_PORT` | Porta da API HTTP (padrão `3000`) |

Registre os comandos e inicie:

```bash
npm run deploy-commands
npm start
```

## Hospedagem

O bot mantém uma conexão persistente com o Discord (gateway WebSocket),
então **não é compatível com hospedagem serverless** (Cloudflare Workers,
Vercel Functions). Opções gratuitas recomendadas:

- **Railway** ou **Render** — free tier com URL pública já incluída,
  ideal porque a API de validação sobe junto com o bot no mesmo processo.
- **Fly.io** — free allowance generoso.
- **Self-hosted (Termux/dispositivo próprio)** — `npm start` e deixe
  rodando; para expor a API publicamente sem IP fixo, use um túnel
  gratuito (`cloudflared tunnel` ou `ngrok`).

## Integração com o hub (`main.lua`)

```lua
local API_URL = "https://seu-bot.exemplo.com/validate"

local function ValidateKey(key)
    local hwid = game:GetService("RbxAnalyticsService"):GetClientId()
    local ok, response = pcall(function()
        return game:HttpGet(API_URL .. "?key=" .. key .. "&hwid=" .. hwid)
    end)
    if not ok then return false, "request_failed" end

    local data = game:GetService("HttpService"):JSONDecode(response)
    return data.valid, data.reason
end
```

A resposta da API nunca inclui dados internos da key (nota, Discord ID
vinculado) — apenas `{ valid: boolean, reason: string|null }`.

## Segurança e limitações conhecidas

- A rota `/validate` não exige autenticação, apenas rate limiting básico
  (20 requisições / 10s por IP). Suficiente para o caso de uso, mas não
  é um sistema de nível bancário.
- HWID é o identificador que o executor/jogo fornece — funciona como
  dificultador de compartilhamento de key, não como trava criptográfica
  inquebrável.
- Os dados residem em arquivos JSON locais (`data/`). Em plataformas cujo
  free tier reseta o filesystem a cada deploy, isso causa perda de dados
  entre implantações — nesse caso, migrar para um banco externo (ex.:
  Postgres free tier) é recomendado.

## Licença

Projeto open source, de uso livre.
