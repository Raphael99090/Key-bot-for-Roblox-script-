# 1NXITER KeyBot

Bot de Discord + API HTTP de validação de key pro **1NXITER HUB**.
Gera, resgata, revoga e valida keys sem precisar de banco de dados externo
(tudo salvo em JSON simples em `data/`).

## Estrutura

```
src/
  index.js              # entrada: liga o bot + a API juntos
  config.js              # lê o .env
  store/
    keyStore.js           # CRUD das keys (JSON)
    settingsStore.js       # configurações ajustáveis via /config
  discord/
    client.js              # cliente + carregador automático de comandos
    deployCommands.js       # registra os slash commands no Discord
    commands/
      key.js                # /key generate|list|revoke|check|redeem|resethwid
      config.js              # /config show|expiry|hwidreset|logchannel
      help.js                 # /help
  api/
    server.js               # servidor Express
    routes/
      validate.js            # GET /validate?key=...&hwid=...
  utils/
    logger.js
    permissions.js
data/                      # criado automaticamente (não vem no git)
```

Pra adicionar um comando novo: crie um arquivo em `src/discord/commands/`
seguindo o mesmo formato (`data` + `execute`) — ele é carregado sozinho,
não precisa registrar em nenhum outro lugar.

## Setup

1. **Criar a aplicação do bot**: [discord.com/developers/applications](https://discord.com/developers/applications)
   → New Application → Bot → copia o **Token** e o **Application ID** (Client ID).
2. **Convidar o bot pro seu servidor** com a permissão `applications.commands` + `bot`.
3. Clonar o repo e instalar:
   ```bash
   npm install
   cp .env.example .env
   ```
4. Preencher o `.env`:
   - `DISCORD_TOKEN` — token do bot
   - `CLIENT_ID` — application ID
   - `GUILD_ID` — ID do seu servidor (recomendado: os comandos aparecem instantâneo; sem isso, demora até 1h)
   - `ADMIN_ROLE_ID` — ID do cargo que pode usar comandos de admin (opcional — quem já tem permissão de Administrator sempre pode)
   - `API_PORT` — porta da API (padrão 3000)
5. Registrar os comandos:
   ```bash
   npm run deploy-commands
   ```
6. Rodar:
   ```bash
   npm start
   ```

## Hospedagem — leitura importante

O **bot** precisa ficar rodando o tempo todo (conexão persistente com o
Discord), então **não dá pra hospedar em serverless** (Cloudflare Workers,
Vercel Functions, etc). Opções de graça:

- **Railway** ou **Render** (free tier — dão uma URL pública de graça, ótimo
  porque a API de validação já sai hospedada junto).
- **Fly.io** (free allowance generoso).
- **No seu próprio Termux**, já que é onde você desenvolve: `npm start` e
  deixa rodando. Nesse caso, a API só fica acessível de fora com um túnel
  grátis (ex: `cloudflared tunnel` ou `ngrok`), porque o celular não tem
  IP público por padrão.

Qualquer uma dessas te dá uma URL (ex: `https://seu-bot.up.railway.app`)
que o `main.lua` do hub vai chamar.

## Integração com o `main.lua`

No lugar da tela de key fixa, o `main.lua` faria algo assim (ajuste a URL
pela que você receber ao hospedar):

```lua
local API_URL = "https://seu-bot.up.railway.app/validate"

local function ValidateKey(key)
    local hwid = game:GetService("RbxAnalyticsService"):GetClientId() -- ou gethwid(), se seu executor tiver
    local ok, response = pcall(function()
        return game:HttpGet(API_URL .. "?key=" .. key .. "&hwid=" .. hwid)
    end)
    if not ok then return false, "request_failed" end

    local data = game:GetService("HttpService"):JSONDecode(response)
    return data.valid, data.reason
end
```

Me chama quando tiver a URL pronta que eu já plugo isso de vez na tela de
key do hub, no lugar da key fixa de teste.

## Comandos

| Comando | Quem pode | O que faz |
|---|---|---|
| `/key generate [dias] [nota]` | admin | Gera uma key nova |
| `/key list` | admin | Lista todas as keys |
| `/key revoke <key>` | admin | Revoga uma key |
| `/key check <key>` | todos | Vê o status de uma key |
| `/key redeem <key>` | todos | Vincula a key à sua conta do Discord |
| `/key resethwid <key>` | dono da key (ou admin, se configurado) | Reseta o HWID |
| `/config show` | admin | Mostra a configuração atual |
| `/config expiry <dias>` | admin | Define validade padrão das novas keys |
| `/config hwidreset <bool>` | admin | Restringe reset de HWID a admins |
| `/config logchannel [canal]` | admin | Define canal de avisos |
| `/help` | todos | Lista os comandos |

## Segurança / limitações conhecidas

- A API de validação não tem autenticação (só rate limit básico) — qualquer
  um pode chamar `/validate?key=X`, mas só recebe `valid: true/false`, nunca
  os dados internos da key. Suficiente pro caso de uso, mas não é um
  sistema de nível bancário.
- HWID aqui é o que o seu executor/jogo mandar — não é uma trava
  criptográfica inquebrável, é só uma dificuldade extra pra compartilhar
  key.
- Dados ficam em arquivo local (`data/keys.json`). Se você hospedar em
  Railway/Render, cheque se o plano free mantém o disco entre reinícios
  (alguns free tiers resetam o filesystem a cada deploy) — se for o caso,
  me avisa que a gente troca pra um banco externo grátis (ex: um Postgres
  free tier).
