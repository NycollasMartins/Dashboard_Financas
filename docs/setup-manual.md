# Lar+ · o que você precisa fazer manualmente (passo a passo)

Tudo aqui é **gratuito**. Se algum passo mostrar cobrança, pare e me avise.

---

## A. Rodar localmente (já deixei pronto na sua máquina)

Pré-requisitos já instalados: Node 24, pnpm, Docker Desktop e Supabase CLI.

```bash
# 1. Abra o Docker Desktop e espere ficar "running"
# 2. Suba o Supabase local (Postgres + Auth + caixa de e-mails de teste)
pnpm db:start

# 3. (só na primeira vez ou se apagar) crie o .env.local
cp .env.example .env.local
supabase status        # copie PUBLISHABLE_KEY para NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

# 4. Rode o app
pnpm dev               # http://localhost:3000
```

- **E-mails locais** (confirmação, recuperação) **não são enviados de verdade**: abra o Mailpit em
  <http://127.0.0.1:54324> para clicar nos links.
- **Usuários de teste** (criados pelo `supabase/seed.sql` a cada `pnpm db:reset`) estão descritos
  no topo desse arquivo.
- Comandos úteis:

| Comando | O que faz |
|---|---|
| `pnpm check` | typecheck + lint + testes unitários + testes de banco |
| `pnpm test:db` | Testes de RLS (pgTAP) |
| `pnpm db:reset` | Recria o banco local do zero (migrations + seed) |
| `pnpm db:types` | Regenera os tipos TypeScript a partir do banco |
| `pnpm db:stop` | Desliga os containers do Supabase |

> 💡 Se aparecer "JWT issued at future" ou login estranho depois de o Mac dormir, reinicie o Docker
> Desktop (o relógio da VM do Docker pode atrasar).

---

## B. Repositório no GitHub (privado)

O repositório já existe (`origin`). Para torná-lo privado: GitHub → *Settings → General → Danger Zone →
Change visibility → Make private*.
- **CI (GitHub Actions)** continua funcionando: 2.000 minutos/mês grátis em repositórios privados
  (cada execução leva ~5–7 min). Limite de gasto padrão US$ 0 → sem cobrança; se acabar, o CI espera o mês virar.
  Acompanhe em *Settings → Billing and plans → Usage* (ou no seu perfil → *Billing*).
- O selo "CI" do README continua aparecendo para quem tem acesso ao repositório.

---


## Ordem recomendada para colocar no ar (larmais.tech)

Foi assim que fizemos a primeira vez (18/11/2026) — siga nesta ordem:

| # | Etapa | Seção | Verificação |
|---|---|---|---|
| 1 | DNS: `A @` e `www` → VPS | K | `dig +short larmais.tech` |
| 2 | Supabase: projeto, migrations, Vault/cron | C.1–C.4 | consultas SQL com ✅ |
| 3 | Brevo (domínio + remetente + chave SMTP) | H | domínio *Authenticated* |
| 4 | Supabase: Auth, SMTP, modelos Lar+, limites | C.5–C.7 | e-mail de teste com DKIM PASS |
| 5 | Advisors e primeiro backup | C.8–C.9, M | 0 ERROR · `.enc` gerado |
| 6 | Variáveis de produção | D.5 + `docs/easypanel-variaveis.md` | `pnpm env:check` tudo ✓ |
| 7 | EasyPanel: fonte, build, Environment, domínio → **Deploy** | D | `/api/health?deep=1` |
| 8 | Bot: webhook + foto | F | `pnpm telegram:prod info` |
| 9 | Notificações e smoke test | G, J | push de teste · smoke verde |

> **Regra de ouro:** segredos (tokens, chaves, senhas) vão **só** no `.env.production.local` (seu Mac, ignorado pelo
> git) e nas variáveis do EasyPanel. Nunca em chat, issue, commit ou print. Use `pnpm env:copy NOME` para copiar sem exibir.

---

## C. Supabase de produção (você aplica; o agente NUNCA executa nada em produção)

Plano **Free**. Cada etapa que muda o banco tem uma **consulta de verificação** (SQL Editor → **+ New query** → **Run**).

### C.1 Criar o projeto
<https://supabase.com/dashboard> → (organização *Personal*, plano **Free**) → **New project**: nome `larmais`,
**Region South America (São Paulo)**, **Generate a password** → guarde no gerenciador de senhas ("Supabase larmais —
senha do banco"; não dá para ver de novo; trocar em *Project Settings → Database → Reset database password*) →
**Create new project**. O **project ref** (20 letras) está em *Project Settings → General → Project ID* e na URL.

### C.2 Enviar as migrations (o `seed.sql` de teste NÃO vai)
```bash
supabase login                                  # autoriza no navegador; token fica no Keychain
supabase link --project-ref SEU_REF             # pede a senha do banco (não aparece ao colar)
supabase migration list                         # 10 linhas, coluna Remote vazia
supabase db push --dry-run                      # mostra o que seria aplicado
supabase db push                                # Y → "Applying migration…" ×10 → "Finished supabase db push."
supabase migration list                         # Local = Remote
```
⚠️ **Nunca** rode `supabase db reset --linked` (apaga a produção) nem `db push --include-seed` (dados de teste).

**Verificação (somente leitura) — todas as linhas ✅:**
```sql
with checks as (
  select 1 as n, 'migrations aplicadas' as item, '10' as esperado, (select count(*) from supabase_migrations.schema_migrations)::text as obtido
  union all select 2, 'última migration', '20261118001000', (select max(version) from supabase_migrations.schema_migrations)
  union all select 3, 'tabelas no public', '33', (select count(*) from pg_tables where schemaname = 'public')::text
  union all select 4, 'tabelas SEM RLS', '0', (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity)::text
  union all select 5, 'views no public', '5', (select count(*) from pg_views where schemaname = 'public')::text
  union all select 6, 'funções no public', '31', (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public')::text
  union all select 7, 'funções no private', '44', (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'private')::text
  union all select 8, 'extensões', 'citext, pg_cron, pg_net, pgcrypto, supabase_vault',
    (select string_agg(extname, ', ' order by extname) from pg_extension where extname in ('citext','pg_cron','pg_net','pgcrypto','supabase_vault'))
  union all select 9, 'jobs pg_cron', 'gerar-recorrencias, limpar-assistente, notificacoes', (select string_agg(jobname, ', ' order by jobname) from cron.job where active)
  union all select 10, 'usuários (sem seed)', '0', (select count(*) from auth.users)::text
)
select n, item, esperado, obtido, case when esperado = obtido then '✅' else '❌' end ok from checks order by n;
```
(Os números das linhas 3, 5–7 mudam quando novas migrations entrarem — confira com o mesmo SQL no banco local.)

### C.3 Extensões, agendamentos e segredos do Vault
- **Extensões:** nada a ativar — as migrations ligam `pg_cron` e `pg_net` (veja em *Database → Extensions*).
- **Agendamentos:** *Integrations → Cron* — horários em **UTC** (Brasília = UTC−3): `gerar-recorrencias` 03:00,
  `limpar-assistente` 03:30, `notificacoes` a cada 15 min.
- **Vault** (*Integrations → Vault* — em algumas versões *Project Settings → Vault*) → **Secrets → Add new secret**:
  - `larmais_cron_secret` = o `CRON_SECRET` (copie sem exibir: `pnpm env:copy CRON_SECRET`);
  - `larmais_app_url` = `https://larmais.tech` (sem barra no fim).
  Prefira a tela do Vault ao SQL (`vault.create_secret`) para o segredo não ficar salvo no histórico do SQL Editor.

**Verificação (não exibe o segredo):**
```sql
select n, item, esperado, obtido, case when esperado = obtido then '✅' else '❌' end ok from (
  select 1 n, 'jobs' item, 'gerar-recorrencias 0 6 * * * | limpar-assistente 30 6 * * * | notificacoes */15 * * * *' esperado,
         (select string_agg(jobname || ' ' || schedule, ' | ' order by jobname) from cron.job where active) obtido
  union all select 2, 'segredos', 'larmais_app_url, larmais_cron_secret', (select string_agg(name, ', ' order by name) from vault.decrypted_secrets where name like 'larmais_%')
  union all select 3, 'URL do app', 'https://larmais.tech', (select decrypted_secret from vault.decrypted_secrets where name = 'larmais_app_url')
  union all select 4, 'tamanho do CRON_SECRET', '64', (select length(decrypted_secret)::text from vault.decrypted_secrets where name = 'larmais_cron_secret')
) t order by n;
```
O job só chama o app quando há notificação pendente — antes de existirem usuários, `net._http_response` fica vazio (normal).

### C.4 Chaves para o app
*Project Settings → API Keys*: **Project URL**, **Publishable key** (`sb_publishable_…`) e **Secret key**
(`sb_secret_…`, *Reveal* ou *Create new secret key* `larmais-app`) → `.env.production.local` (D.5). A secret **nunca** em `NEXT_PUBLIC_`.

### C.5 Autenticação
- **Authentication → URL Configuration:** Site URL `https://larmais.tech` · Redirect URLs **só** `https://larmais.tech/**`
  (sem localhost em produção — o app volta para `/configuracoes`, `/redefinir-senha` e convites, por isso o `/**` do próprio domínio).
- **Authentication → Sign In / Providers:** *Allow new users to sign up* ligado → provedor **Email**: *Confirm email* ✅,
  *Secure email change* ✅, *Secure password change* desligado, senha mínima **8** com **letras e números**
  (se não estiver aí: *Authentication → Attack Protection*). *Leaked password protection* é do plano Pro → deixar desligado.

### C.6 SMTP (Brevo) — **obrigatório antes dos modelos**
Desde 03/06/2026 o Supabase **só deixa editar os modelos de e-mail com SMTP próprio** (e o SMTP padrão manda só 2 e-mails/hora).
Faça a seção **H** (Brevo) e depois: **Authentication → Emails → SMTP Settings → Enable custom SMTP**:

| Campo | Valor |
|---|---|
| Sender email address | `nao-responda@larmais.tech` (**não** use Gmail: falha no DMARC e cai no spam) |
| Sender name | `Lar+` |
| Host / Port | `smtp-relay.brevo.com` / `587` |
| Minimum interval per user | `60` |
| Username | o **Login** mostrado em Brevo → *SMTP & API → SMTP* |
| Password | a **SMTP key** `xsmtpsib-…` (não a API key `xkeysib-…`) — guarde só no gerenciador de senhas |

**Authentication → Rate Limits:** e-mails = **30/hora** (Brevo Free = 300/dia).
**Teste:** *Authentication → Users → Add user → Send invitation* para o seu e-mail → chega "Lar+ <nao-responda@larmais.tech>"
→ Gmail *Mostrar original*: **DKIM PASS e DMARC PASS** → apague o usuário de teste.

### C.7 Modelos de e-mail com a marca Lar+
**Authentication → Emails → Templates** — para cada um: `pbcopy < arquivo` no Terminal → abrir o modelo → *Subject* →
corpo (aba *Source*, Cmd+A, Cmd+V) → **Save**:

| Modelo | Subject | Arquivo |
|---|---|---|
| Confirm signup | `Confirme seu e-mail · Lar+` | `supabase/templates/confirmation.html` |
| Reset Password | `Redefinir sua senha · Lar+` | `supabase/templates/recovery.html` |
| Change Email Address | `Confirme seu novo e-mail · Lar+` | `supabase/templates/email_change.html` |

Não altere `{{ .SiteURL }}`, `{{ .TokenHash }}`, `{{ .RedirectTo }}`. O ícone só aparece no e-mail depois do deploy.

### C.8 Advisors
*Advisors → Security Advisor* e *Performance Advisor* → **Rerun linter**. Esperado: **0 ERROR**. Aceitos:
WARN *Leaked Password Protection* (Pro) e *Insufficient MFA* (Fase 8); INFO *RLS Enabled No Policy* em **5 tabelas só do
servidor** (`bot_sessions`, `channel_link_codes`, `notification_deliveries`, `rate_limits`, `telegram_updates` — **não crie
policy**), *Unindexed foreign keys* (~57) e *Unused index*. Prévia local: `supabase db advisors --local --type all`
(**nunca** `--linked` sem saber o que faz). ERROR ou WARN fora dessa lista → investigar.

### C.9 Dead-letter (falhas visíveis para você)
```sql
select * from public.ops_dead_letters order by created_at desc limit 20;
```

### C.10 Usuário do smoke test
Crie no app (`/cadastro`, depois do deploy) uma conta **só para testes**, ex.: `seu-email+smoke@gmail.com`. Sem família, sem dados reais.

⚠️ O plano Free **pausa o projeto após 7 dias sem uso**; com uso diário não acontece. Se pausar: *Restore*.

---

## D. VPS + EasyPanel (Docker) — hospedagem

### D.1 Requisitos mínimos da VPS
| Recurso | Mínimo | Recomendado | Por quê |
|---|---|---|---|
| CPU | 1 vCPU | 2 vCPU | o build do Next.js usa CPU por ~3–5 min |
| RAM | 2 GB | 2–4 GB | build precisa de ~1,5 GB; com 1 GB, crie **swap de 2 GB** |
| Disco | 20 GB SSD | 40 GB | imagens Docker + cache do build |
| Sistema | Ubuntu 24.04 LTS (64 bits) | — | suportado pelo EasyPanel |
| Rede | IP fixo, portas **80** e **443** abertas | — | HTTPS (Let's Encrypt) |

O app em execução usa ~150–250 MB de RAM. O banco **não** roda na VPS (é o Supabase).

### D.2 Instalar o EasyPanel
```bash
ssh root@IP_DA_VPS
curl -sSL https://get.easypanel.io | sh
```
Abra `http://IP_DA_VPS:3000`, crie o usuário administrador (senha forte + 2FA em *Settings*).
Confira em *Settings → Billing* que está no plano gratuito (1 projeto basta). **Se pedir cartão, pare e me avise.**

### D.3 Conectar o repositório privado
Opção recomendada — **deploy key (só leitura, só este repositório)**:
1. No seu computador: `ssh-keygen -t ed25519 -f larmais_deploy -N "" -C easypanel-larmais`
2. GitHub → repositório → *Settings → Deploy keys → Add deploy key*: cole `larmais_deploy.pub`, **sem** "Allow write".
3. No EasyPanel: crie o projeto **larmais** → **+ Service → App** → *Source* **Git** → URL
   `git@github.com:NycollasMartins/Dashboard_Financas.git`, branch `main`, cole a chave **privada** `larmais_deploy`.
4. Apague os arquivos `larmais_deploy*` do computador depois.
(Alternativa: *Source* **GitHub** com um token *fine-grained* só deste repositório, permissão *Contents: Read*.)
**Atenção:** o **Auto Deploy** nativo do EasyPanel só existe com *Source* **GitHub**. Com *Source* **Git** + deploy key, use a
**Deployment Trigger URL** (aba *Deployments*) como webhook no GitHub (*Settings → Webhooks → Add webhook*, evento *push*).

### D.4 Build
*Build* → **Dockerfile** (caminho `Dockerfile`). O EasyPanel repassa as variáveis do app como **build args** —
as `NEXT_PUBLIC_*` precisam existir **antes** do build (elas vão para o navegador).

### D.5 Variáveis de ambiente (*Environment*)
Lista completa, origem de cada uma e build × runtime: **[`docs/easypanel-variaveis.md`](easypanel-variaveis.md)**.
```bash
pnpm env:gen        # gera CRON_SECRET, TELEGRAM_WEBHOOK_SECRET e VAPID em .env.production.local (sem exibir)
code .env.production.local   # você cola: Supabase (URL, publishable, secret), Gemini, Groq, token do bot
pnpm env:check      # 13 ✓ + "URL do Supabase = projeto vinculado"; avisa (⚠) se reaproveitou chave de desenvolvimento
pnpm env:copy-all   # copia as 13 linhas → EasyPanel → app → Environment → colar → Save
```
Chaves de produção **separadas** das de desenvolvimento (Gemini em projeto próprio = cota própria; um bot só tem um webhook →
bot de desenvolvimento separado). As `NEXT_PUBLIC_*` entram no build (`ARG` no Dockerfile): mudou → **novo Deploy**.

### D.6 Domínio, HTTPS e deploy automático
1. *Domains* → **Add domain** `larmais.tech` (porta **3000**, HTTPS ligado) e `www.larmais.tech` → redirecionar para
   `larmais.tech`. O certificado **Let's Encrypt** é emitido sozinho quando o DNS (seção K) já aponta para a VPS.
2. **Deploy**. Acompanhe em *Deployments*. O contêiner só fica "healthy" depois que `/api/health` responde.
3. **Deploy automático a cada push na `main`:** *Deployments → Auto Deploy* → ligue e copie a **Deploy Webhook URL** →
   GitHub → *Settings → Webhooks → Add webhook* (payload URL = essa URL, *Just the push event*).
   Dica: só faça push na `main` com CI verde (o fluxo do projeto já é assim).

**Verificação:**
```bash
curl -s https://larmais.tech/api/health?deep=1        # {"status":"ok","app":"larmais",...,"supabase":"ok"}
curl -sI https://larmais.tech/entrar | grep -iE 'strict-transport|content-security'
# a CSP precisa conter a URL do SEU Supabase (senão as NEXT_PUBLIC não entraram no build → D.4)
```

### D.7 Logs e voltar versão
- **Logs:** serviço → *Logs* (tempo real). Erros do bot aparecem como `telegram: update … falhou` (sem conteúdo).
- **Voltar para uma versão anterior:** *Deployments* → escolha um deploy antigo que deu certo → **Redeploy**.
  Depois corrija com `git revert <commit>` + push (o automático publica a correção). Nunca force push na `main`.
- **Migrations não voltam sozinhas:** se um deploy trouxe migration nova, voltar o app não desfaz o banco — fale comigo antes.

---

## E. Chaves de IA do assistente (opcional, gratuito)

Sem chaves o assistente funciona com o **parser local** (texto). **Fotos e áudios precisam das chaves.**
**Não cadastre cartão/billing** em nenhum dos dois: assim continua grátis.

**Google Gemini (texto difícil + leitura de fotos)**
1. <https://aistudio.google.com> → entre com uma conta Google.
2. **Get API key → Create API key** → copie para `GEMINI_API_KEY` (`.env.local` e EasyPanel).
3. Em **Rate limits** confira o limite do `gemini-3.1-flash-lite` (por projeto, somando todos os usuários).
4. Privacidade: no gratuito o Google pode usar o conteúdo enviado (texto/fotos) para melhorar produtos — ver README.

**Groq (reserva do texto + transcrição de áudio com Whisper)**
1. <https://console.groq.com> → crie a conta (sem cartão) → **API Keys → Create API Key** → `GROQ_API_KEY`.
2. Em **Settings → Limits** confira `openai/gpt-oss-20b` (texto) e `whisper-large-v3` (áudio).

**Medir a acurácia real (gasta cota):**
`EVAL_PROVIDER=gemini EVAL_SET=holdout pnpm eval:assistant` (texto) ·
`EVAL_MEDIA=photos pnpm eval:assistant src/lib/assistant/eval/media.eval.ts` (fotos) ·
`EVAL_MEDIA=audio pnpm eval:assistant src/lib/assistant/eval/media.eval.ts` (áudios).
Desligar a IA a qualquer momento: `ASSISTANT_AI_ENABLED=false`.

---

## F. Bot do Telegram (@LarMaisBot)

1. **@BotFather** (você já está fazendo): `/newbot` → nome **Lar+**, usuário **LarMaisBot** (se ocupado, use outro e
   ajuste `TELEGRAM_BOT_USERNAME`). Depois:
   - `/setjoingroups` → **Disable** (o bot só funciona em conversa privada — ver ADR-0021);
   - `/setprivacy` → **Enable**;
   - `/setdescription` → "Assistente do Lar+: lance gastos por texto, foto de cupom ou áudio.";
   - `/setuserpic` → envie **`public/brand/telegram-avatar.png`** (512×512, a logo do Lar+).
2. Guarde o **token** no `.env.local` e no EasyPanel (`TELEGRAM_BOT_TOKEN`). **Nunca cole o token em chat.**
3. Gere o segredo do webhook: `openssl rand -hex 32` → `TELEGRAM_WEBHOOK_SECRET` (EasyPanel). Faça o deploy.
4. Registre o webhook **depois** do app no ar — o comando lê o `.env.production.local` (mesmos valores do EasyPanel),
   sem você digitar o token:
   ```bash
   pnpm telegram:prod set
   pnpm telegram:prod info   # esperado: Bot @LarMaisBot · Webhook https://larmais.tech/api/telegram/webhook · Pendentes 0 · sem "Último erro"
   ```
   (O comando também cadastra os comandos /ajuda /resumo /desfazer /espaco /desvincular.)
5. Teste: app → **Configurações → Canais → Gerar código → Abrir no Telegram → Iniciar**.

> **Um bot só tem UM webhook.** Para testar localmente sem derrubar o de produção, crie um **segundo bot só de
> desenvolvimento** (ex.: @LarMaisDevBot) e use o token dele no `.env.local` (seção I).

---

## G. Notificações (Web Push + Telegram + central)

1. Gere as chaves VAPID **uma vez**: `pnpm vapid` → copie as 3 linhas para o EasyPanel
   (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). A pública entra no build → **redeploy**.
   Trocar as chaves depois obriga cada aparelho a ativar de novo.
2. `CRON_SECRET` (D.5) e os segredos do Vault (C.7) com o **mesmo** valor.
3. **iPhone (só aparelho real; o simulador/emulação não recebe push):** precisa de **iOS 16.4+**.
   1. Safari → `https://larmais.tech` → entrar → **Compartilhar → Adicionar à Tela de Início → Adicionar**.
   2. Abra o Lar+ **pelo ícone** (não pelo Safari).
   3. **Configurações → Notificações → Ativar notificações** → **Permitir**.
   4. Toque em **Enviar teste** → a notificação "Lar+ · teste" chega mesmo com o app fechado.
   5. Toque na notificação → abre a Central. Se não chegar: *Ajustes → Notificações → Lar+* (permitido?) e Foco/Não Perturbe.

---

## H. Brevo (e-mails do Lar+ com remetente @larmais.tech)

Gratuito: **300 e-mails/dia**, sem cartão.
1. <https://www.brevo.com> → **Sign up free** (plano Free).
2. **Settings → Senders, Domains & Dedicated IPs → Domains → Add a domain** → `larmais.tech` → autenticar manualmente.
3. Na Hostinger (**Domains → DNS → DNS records**), crie **exatamente** o que a Brevo mostrar — no campo **Nome** só o prefixo
   (a Hostinger completa o domínio):

| Tipo | Nome | Conteúdo (exemplo — copie da sua tela) | TTL |
|---|---|---|---|
| TXT | `@` | `brevo-code:…` | 300–3600 |
| CNAME | `brevo1._domainkey` | `b1.larmais-tech.dkim.brevo.com` | 300–3600 |
| CNAME | `brevo2._domainkey` | `b2.larmais-tech.dkim.brevo.com` | 300–3600 |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` (**um só** `_dmarc`) | 300–3600 |

   **SPF não é necessário** para a Brevo (não mexa em SPF existente). O domínio não tem MX (não recebe e-mail) — ok.
4. Brevo → **Authenticate this email domain** → *Authenticated*.
5. **Senders → Add sender:** `Lar+` / `nao-responda@larmais.tech`. O remetente criado no cadastro com o seu Gmail
   aparece com ⚠️ DKIM "Padrão" e DMARC "Freemail" — **não use esse** no Supabase.
6. **Settings → SMTP & API → SMTP → Generate a new SMTP key** (`supabase-larmais`) → anote o **Login** → volte ao **C.6**.

**Verificação de DNS (pública):**
```bash
for r in "TXT larmais.tech" "CNAME brevo1._domainkey.larmais.tech" "CNAME brevo2._domainkey.larmais.tech" "TXT _dmarc.larmais.tech"; do
  t=${r%% *}; n=${r#* }; echo "$t $n → $(dig +short +time=5 @8.8.8.8 "$n" "$t")"; done
```

---

## I. Testar o webhook do Telegram no seu computador (Cloudflare Tunnel, gratuito)

O Telegram só chama HTTPS público. O túnel rápido da Cloudflare dá um endereço HTTPS temporário **sem conta**:
```bash
brew install cloudflared
pnpm dev                                         # terminal 1
cloudflared tunnel --url http://localhost:3000   # terminal 2 → copie https://xxxx.trycloudflare.com
# terminal 3 (com o token do bot de DESENVOLVIMENTO no .env.local):
TELEGRAM_WEBHOOK_URL=https://xxxx.trycloudflare.com pnpm telegram set
pnpm telegram info
```
No `.env.local` também: `SUPABASE_SECRET_KEY` (de `supabase status`) e `TELEGRAM_WEBHOOK_SECRET`.
Ao terminar: `pnpm telegram delete`. O endereço muda a cada execução (rode o `set` de novo).

---

## J. Smoke test de produção (depois de cada deploy importante)

Usuário de teste dedicado (C.10). A senha é digitada sem aparecer e não fica no histórico do terminal:
```bash
read -s -p "Senha do usuário de smoke: " SMOKE_PASSWORD; echo; export SMOKE_PASSWORD
E2E_BASE_URL=https://larmais.tech SMOKE_EMAIL='seu-email+smoke@gmail.com' pnpm test:smoke
unset SMOKE_PASSWORD
```
Esperado: `3 passed`. Sem `SMOKE_PASSWORD` os 2 primeiros rodam e o terceiro é pulado.
Confere: saúde (app + Supabase), headers de segurança, manifest Lar+, que o webhook e o disparo de
notificações **recusam** chamadas sem segredo, login, painel e o assistente (grava e **desfaz** um lançamento de
R$ 1,00 no usuário de teste). Sem dados reais.

---

## K. DNS do domínio larmais.tech (no site onde você registrou o domínio)

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| A | `@` | IP da VPS | 300 |
| A (ou CNAME → `larmais.tech`) | `www` | IP da VPS | 300 |
| AAAA | `@` | IPv6 da VPS (só se a VPS tiver) | 300 |
| CAA (opcional) | `@` | `0 issue "letsencrypt.org"` | 3600 |
| TXT / DKIM / DMARC | — | os da Brevo (seção H) | 3600 |

Apague registros de "estacionamento" do registrador (A/CNAME padrão) para `@` e `www`.
**Verificação:** `dig +short larmais.tech` e `dig +short www.larmais.tech` → IP da VPS (propagação: minutos a horas).

---

## M. Backups e restauração (gratuito)

O plano Free **não garante** backups automáticos (diários são do Pro). Rotina:
- **Todo domingo** e **antes de qualquer migration nova**: `pnpm backup:prod` (Docker aberto; pede a senha do banco e a
  frase-senha do backup, nada aparece na tela) → gera `backups/AAAA-MM-DD_HHMM-prod.tar.gz.enc` (AES-256; mantém os 8
  últimos; `backups/` é ignorado pelo git) → **copie para fora do Mac** (iCloud/Google Drive/HD externo).
- **1× por mês**, teste se abre:
  ```bash
  read -s -p "Frase-senha: " BACKUP_PASSPHRASE; echo; export BACKUP_PASSPHRASE
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in backups/NOME.tar.gz.enc | tar -tzf -
  unset BACKUP_PASSPHRASE      # esperado: roles.sql, schema.sql, data.sql, auth.sql
  ```
- O `pg_dump` do Homebrew (v16) **não** serve para o Postgres 17 do Supabase; o script usa o do CLI (Docker).

**Restaurar** (só em emergência, num projeto **novo** — fale comigo antes):
1. Crie um projeto novo (C.1) e pegue a *connection string* em **Connect → Session pooler** (`postgresql://…`).
2. Descriptografe: `… openssl enc -d … | tar -xzf - -C /tmp/restore`.
3. `psql "$URL" -f roles.sql` → `psql "$URL" -f schema.sql` →
   `psql "$URL" -c "SET session_replication_role = replica" -f data.sql -f auth.sql` (desliga triggers durante a carga).
4. Refaça C.3 (Vault), C.5–C.7 (Auth/SMTP/modelos) e troque as variáveis do Supabase no EasyPanel → Deploy.

---

## L. Testar no iPhone

- **iPhone real (Wi-Fi):** `pnpm dev:lan` e abra no Safari o endereço impresso. Detalhes e problemas
  comuns no README, seção 13.
- **iOS Simulator:** instale o **Xcode** pela App Store, rode
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`, instale um simulador em
  *Xcode → Settings → Components* e registre o MCP: `claude mcp add xcodebuild -- npx -y xcodebuildmcp@latest mcp`.
- **Emulação (já pronto):** `pnpm test:e2e:ios`.
