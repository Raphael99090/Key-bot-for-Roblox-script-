<div align="center">

# 1NXITER KeyBot

**Sistema de licenciamento (key system) e loja via Discord para o 1NXITER HUB.**
Painel administrativo por Components V2, loja com tickets em thread,
API HTTP de validação — tudo num banco SQLite nativo, sem dependências
externas.

</div>

---

## Visão geral

O 1NXITER KeyBot resolve quatro problemas do hub:

1. **Distribuição de acesso** — geração, resgate e controle de keys de uso.
2. **Validação em tempo real** — o script Lua consulta uma API HTTP antes
   de liberar o hub, com bloqueio por HWID.
3. **Monetização de suporte** — reset de HWID tem cooldown gratuito
   configurável, com códigos de reset vendáveis para quem quer pular a
   espera.
4. **Vendas** — loja com 4 planos (1 dia, 7 dias, 30 dias, lifetime),
   cupons de desconto, e um ticket privado (thread) por compra pra
   negociar o pagamento com a administração.

Toda a administração roda através de um único comando (`/admin`), que
abre um painel por botões e formulários — sem precisar memorizar
sintaxe de comando para cada ação. Toda a interface usa **Discord
Components V2** (containers com texto e botões nativos, não embeds).

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
- 🛒 **Loja com 4 planos** (`/comprar`): 1 dia, 7 dias, 30 dias e
  lifetime, com preço configurável em cada botão, descrição e imagem
  próprias (dropdown pra escolher qual plano editar).
- 🎫 **Ticket por compra**: cada compra abre uma **thread privada**
  (com fallback automático pra thread pública em servidores sem boost
  nível 2) só entre o comprador e a administração, com as instruções
  de pagamento configuradas já postadas como referência.
- 💠 **Pix automático via Mercado Pago** (opcional): se
  `MERCADOPAGO_ACCESS_TOKEN` estiver configurado, o admin gera um Pix
  de verdade (QR Code + copia-e-cola) dentro do ticket, e a key é
  liberada sozinha quando o pagamento cair — sem precisar clicar em
  "Confirmar". Sem o token, o ticket usa só o botão manual.
- 🎟️ **Cupons de desconto**: código opcional na hora da compra, com
  limite de usos configurável; o desconto aparece no ticket pra você
  aplicar na cobrança.
- 📊 **Estatísticas**: visão consolidada de keys ativas, expiradas,
  revogadas, resgatadas, trials distribuídos e códigos vendidos.
- 🧹 **Manutenção**: remoção de keys antigas revogadas/expiradas, e
  opção de apagar TODAS as keys (com confirmação por texto), ambas com
  prévia antes de executar.
- 🛡️ **Confirmação em ações destrutivas**: revogar key e limpar dados
  antigos mostram uma prévia do que será afetado antes de executar.
- 📄 **Listagem paginada**: navegação por página no painel, em vez de
  cortar silenciosamente os resultados.
- 🔐 **API protegida por segredo** (opcional, mas recomendado) e com
  rate limiting básico.
- 🗒️ **Logs com contexto completo**: cada ação administrativa loga
  quem fez, quando (timestamp nativo do Discord) e, quando aplicável,
  a validade da key envolvida.
- 🌐 **API de validação HTTP**, consumida diretamente pelo `main.lua`
  do hub.

## Arquitetura

```
src/
├── index.js                    # entrada: inicia o bot e a API juntos
├── config.js                   # leitura do .env
├── db.js                       # conexão SQLite única (node:sqlite) + schema
├── store/                      # camada de dados, tudo em cima do SQLite
│   ├── keyStore.js              # CRUD de keys, cooldown, extend, purge
│   ├── settingsStore.js         # configurações ajustáveis pelo painel
│   ├── resetCodeStore.js        # códigos de reset vendáveis
│   ├── trialStore.js            # controle de 1 trial por conta
│   ├── orderStore.js            # pedidos/tickets de compra
│   └── couponStore.js           # cupons de desconto
├── discord/
│   ├── client.js                 # cliente + roteador de interações
│   ├── deployCommands.js          # registro dos slash commands
│   ├── v2.js                       # helper de Components V2 (Container/TextDisplay)
│   ├── adminPanel.js                # painel admin: telas, botões, modais
│   ├── storePanel.js                 # loja, tickets (threads) e cupons
│   ├── logNotifier.js                 # painel de log (quem/quando) no canal
│   └── commands/
│       ├── key.js                      # /key redeem|check|resethwid|trial
│       ├── comprar.js                   # /comprar — abre a loja
│       ├── admin.js                      # /admin — abre o painel
│       └── help.js                        # /help
├── api/
│   ├── server.js                  # servidor Express + rate limit + segredo
│   └── routes/validate.js          # GET /validate?key=&hwid=&secret=
└── utils/
    ├── logger.js                    # console + arquivo (data/bot.log)
    ├── permissions.js                 # quem é admin
    ├── validator.js                    # valida .env ao iniciar
    └── format.js                         # formatação de data/duração
data/                            # gerado em runtime, não versionado (bot.db, bot.log)
```

Comandos são carregados automaticamente a partir de `src/discord/commands/`
— para adicionar um novo, basta criar o arquivo no formato `{ data, execute }`.

## Comandos

| Comando | Acesso | Descrição |
|---|---|---|
| `/comprar` | todos | Abre a loja — escolhe um plano, informa cupom (opcional) e recebe um ticket privado |
| `/key redeem <key>` | todos | Vincula uma key à própria conta do Discord |
| `/key check <key>` | todos | Consulta o status de uma key |
| `/key trial` | todos | Resgata uma key de teste gratuita (1 por conta) |
| `/key resethwid <key> [codigo]` | dono da key | Reseta o HWID (respeita cooldown, salvo com código de reset) |
| `/admin` | admin | Abre o painel administrativo completo |
| `/help` | todos | Lista os comandos disponíveis |

Toda a administração (gerar/listar/revogar/renovar keys, apagar tudo,
códigos de reset, configurações, loja/planos/cupons, estatísticas,
limpeza de dados antigos) vive dentro do painel do `/admin` — não são
slash commands separados.

### Quem é "admin"?

Qualquer membro com a permissão **Administrator** no servidor, ou com o
cargo definido em `ADMIN_ROLE_ID` no `.env`.

## Instalação

### Pré-requisitos
- **Node.js 22.5 ou superior** (usa `node:sqlite`, nativo do Node —
  sem instalar nenhum pacote de banco de dados, sem compilar binário
  nenhum)
- Uma aplicação de bot criada em [discord.com/developers/applications](https://discord.com/developers/applications)
- Permissão **"Gerenciar Threads"** (e "Criar Threads Públicas/Privadas")
  no cargo do bot, pra ele conseguir abrir os tickets de compra

### Passo a passo

```bash
git clone <url-do-seu-repo>
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
| `ADMIN_ROLE_ID` | ID do cargo com acesso ao painel admin (recomendado — também é quem consegue ver os tickets privados) |
| `API_PORT` | Porta da API HTTP local (padrão `3000`). Em hospedagens que injetam a porta via `PORT` (Railway, etc.), essa variável tem prioridade. |
| `API_SECRET` | Segredo exigido pra chamar `/validate` (recomendado em produção — sem ele, a API fica aberta pra qualquer um) |

O bot valida essas variáveis ao iniciar: se `DISCORD_TOKEN` ou `CLIENT_ID`
estiverem faltando, ele encerra com uma mensagem clara. `GUILD_ID` e
`ADMIN_ROLE_ID` são recomendados, mas o bot sobe sem eles (só avisa o
trade-off no console).

Registre os comandos e inicie:

```bash
npm run deploy-commands
npm start
```

Depois, configure em `/admin → Vendas/Pagamentos`:
- Instruções de Pix/Bitcoin/Cartão/Moeda local (referência dentro dos tickets)
- **🛍️ Configurar Loja**: descrição, imagem (URL), canal-base dos
  tickets, e o preço de cada plano (selecionado por um dropdown)
- **🎟️ Cupons**: gerar/listar/revogar códigos de desconto

## Hospedagem

O bot mantém uma conexão persistente com o Discord (gateway WebSocket),
então **não é compatível com hospedagem serverless** (Cloudflare Workers,
Vercel Functions). Opções recomendadas:

- **VPS própria** (ex: Oracle Cloud Free Tier) — mais estável pra rodar
  24/7, e evita instabilidade de rede que causa erros de interação
  expirada (`Unknown interaction`) em conexões mais fracas.
- **Render/Fly.io** — free tiers com URL pública incluída.
- **Self-hosted (Termux/dispositivo próprio)** — `npm start` e deixe
  rodando com `termux-wake-lock` ativo (evita o Android suspender o
  processo em segundo plano); pra expor a API publicamente sem IP fixo,
  use um túnel gratuito (`cloudflared tunnel` ou `ngrok`).

## Integração com o hub (`main.lua`)

```lua
local API_URL = "https://seu-bot.exemplo.com/validate"
local API_SECRET = "" -- mesmo valor do API_SECRET no .env do bot, se tiver

local function ValidateKey(key)
    local hwid = game:GetService("RbxAnalyticsService"):GetClientId()
    local url = API_URL .. "?key=" .. key .. "&hwid=" .. hwid
    if API_SECRET ~= "" then url = url .. "&secret=" .. API_SECRET end

    local ok, response = pcall(function()
        return game:HttpGet(url)
    end)
    if not ok then return false, "request_failed" end

    local data = game:GetService("HttpService"):JSONDecode(response)
    return data.valid, data.reason
end
```

A resposta da API nunca inclui dados internos da key (nota, Discord ID
vinculado) — apenas `{ valid: boolean, reason: string|null }`.

## Segurança e limitações conhecidas

- A rota `/validate` aceita rate limiting básico (20 requisições / 10s
  por IP) sempre, e exige `API_SECRET` (header `X-API-Key` ou `?secret=`)
  quando essa variável está definida no `.env`. Sem `API_SECRET`
  configurado, a rota fica aberta — recomendado configurar em produção.
- HWID é o identificador que o executor/jogo fornece — funciona como
  dificultador de compartilhamento de key, não como trava criptográfica
  inquebrável.
- **Persistência de dados**: SQLite em `data/bot.db`, via `node:sqlite`
  (nativo do Node — sem dependência npm, sem compilação). As stores só
  conhecem métodos como `create()`/`get()`/`list()` — trocar o motor de
  banco no futuro (ex: Postgres) significa reimplementar só a camada
  interna de cada store, sem tocar nos comandos/painéis.
- **Threads de ticket**: thread privada exige boost nível 2 no servidor;
  sem isso, o bot cria como thread pública automaticamente (ainda
  funciona, só fica visível pra quem também vê o canal-base configurado).
- **Cupons não calculam desconto automaticamente**: como os preços dos
  planos são texto livre (não numérico), o cupom só carrega uma
  descrição do desconto (ex: "10% OFF") — quem aplica de fato na
  cobrança é o admin, dentro do ticket.
- Em plataformas cujo free tier reseta o filesystem a cada deploy, o
  arquivo `data/bot.db` se perde entre implantações — nesse caso, um
  volume persistente (a maioria das hospedagens oferece) é necessário.

## Licença

Projeto open source, de uso livre.
