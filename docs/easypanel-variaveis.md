# Variáveis de ambiente de produção (EasyPanel) — Lar+

> **Sem valores reais aqui.** Os valores ficam só em `.env.production.local` (ignorado pelo git, permissão 600) e no
> EasyPanel. Gere/confira com `pnpm env:gen` → `pnpm env:check` → `pnpm env:copy-all`.

## Como o EasyPanel entrega as variáveis ao Dockerfile
- No EasyPanel, **todas** as variáveis ficam num único lugar: app `larmais` → seção **Environment**. Segundo a
  documentação do EasyPanel, elas são entregues **ao build e ao contêiner em execução**.
- O `Dockerfile` declara `ARG` **só** para as 4 públicas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) e as copia para `ENV` no estágio de build → o `next build`
  as embute no JavaScript do navegador. **Elas precisam existir ANTES do build**; trocar depois exige **rebuild** (Deploy).
- Os **segredos não têm `ARG`** no Dockerfile → não ficam gravados na imagem; o app lê em **runtime**. Trocar um segredo
  só exige reiniciar/redeploy (sem mudar código).
- Não há campo separado de "build args" para marcar: basta estar em **Environment** antes de clicar **Deploy**.
  Conferência depois do deploy: `curl -sI https://larmais.tech/entrar | grep -i content-security` precisa mostrar a URL
  do **seu** Supabase (se aparecer vazio, as `NEXT_PUBLIC_*` não chegaram ao build).

## 1) Variáveis de BUILD (públicas — vão para o navegador)
| # | Nome | Para quê | De onde vem | Formato |
|---|---|---|---|---|
| 1 | `NEXT_PUBLIC_SITE_URL` | links de e-mail, convites, botões do Telegram | fixo | `https://larmais.tech` |
| 2 | `NEXT_PUBLIC_SUPABASE_URL` | endereço da API do Supabase | Supabase → **Project Settings → API Keys** (ou **Data API**) → *Project URL* | `https://<20 letras>.supabase.co` |
| 3 | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave pública (a segurança vem da RLS) | **Project Settings → API Keys** → aba *Publishable and secret API keys* → **Publishable key** | `sb_publishable_…` |
| 4 | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push (navegador assina) | `pnpm env:gen` | ~87 caracteres base64url |

## 2) Variáveis de RUNTIME (SECRETAS — só no servidor)
| # | Nome | Para quê | De onde vem | Formato |
|---|---|---|---|---|
| 5 | `SUPABASE_SECRET_KEY` | webhook do Telegram e disparo de notificações (nunca dados financeiros) | **Project Settings → API Keys** → **Secret keys** → *Reveal* / criar | `sb_secret_…` |
| 6 | `GEMINI_API_KEY` | IA: texto difícil + leitura de fotos | Google AI Studio → **Get API key → Create API key** (projeto **só de produção**) | `AIza…` ou `AQ.…` |
| 7 | `GROQ_API_KEY` | IA reserva + transcrição de áudio | console.groq.com → **API Keys → Create API Key** (`larmais-producao`) | `gsk_…` |
| 8 | `TELEGRAM_BOT_TOKEN` | o @LarMaisBot | @BotFather → `/mybots` → LarMaisBot → **API Token** | `123456789:AA…` |
| 9 | `TELEGRAM_WEBHOOK_SECRET` | confere que o webhook veio do Telegram | `pnpm env:gen` | 64 hex |
| 10 | `TELEGRAM_BOT_USERNAME` | link `t.me/…` e QR | fixo | `LarMaisBot` |
| 11 | `VAPID_PRIVATE_KEY` | assina o Web Push | `pnpm env:gen` | ~43 caracteres base64url |
| 12 | `VAPID_SUBJECT` | contato exigido pelo Web Push | fixo | `mailto:contato@larmais.tech` |
| 13 | `CRON_SECRET` | pg_cron → `/api/notifications/dispatch` | `pnpm env:gen` — **igual** ao Vault `larmais_cron_secret` | 64 hex |

## 3) Opcionais (padrões já bons; só adicione se quiser mudar)
`GEMINI_MODEL` (`gemini-3.1-flash-lite`) · `GROQ_MODEL` (`openai/gpt-oss-20b`) · `GROQ_AUDIO_MODEL` (`whisper-large-v3`) ·
`ASSISTANT_AI_DAILY_LIMIT` (40) · `ASSISTANT_AI_PER_MINUTE` (8) · `ASSISTANT_PHOTO_DAILY_LIMIT` (15) ·
`ASSISTANT_AUDIO_DAILY_LIMIT` (30) · `ASSISTANT_MAX_AUDIO_SECONDS` (60) · `ASSISTANT_CONFIRM_ABOVE_CENTS` (100000) ·
`ASSISTANT_CONFIRM_AUDIO` (false) · `ASSISTANT_AI_ENABLED` (true) · `APP_VERSION` (aparece em `/api/health`).
**Não** coloque em produção: `TELEGRAM_WEBHOOK_URL` (só para túnel local), `EVAL_*`, `DEBUG_*`.

## 4) Passo a passo no EasyPanel
1. `pnpm env:check` → tudo ✓.
2. `pnpm env:copy-all` (copia as 13 linhas `NOME=valor`, sem mostrar).
3. EasyPanel → projeto **larmais** → app → **Environment** → cole no editor → **Save**.
4. Copie outra coisa qualquer (limpa a área de transferência).
5. **Deploy** (o build já recebe as `NEXT_PUBLIC_*`).
