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

| # | Etapa | Seção | Quanto tempo |
|---|---|---|---|
| 1 | Repositório privado | B | 1 min |
| 2 | DNS do domínio apontando para a VPS | K | 10 min (+ propagação) |
| 3 | VPS + EasyPanel | D | 30 min |
| 4 | Supabase de produção (migrations, Auth, Vault/cron) | C | 30 min |
| 5 | Brevo (SMTP com SPF/DKIM do larmais.tech) | H | 20 min (+ propagação) |
| 6 | Variáveis no EasyPanel e primeiro deploy | D.4–D.6 | 15 min |
| 7 | Bot do Telegram: token, webhook, foto de perfil | F | 15 min |
| 8 | Notificações (VAPID + segredo do cron) | G | 10 min |
| 9 | Smoke test de produção | J | 5 min |

> **Regra de ouro:** segredos (tokens, chaves, senhas) vão **só** no `.env.local` (seu computador) e nas
> variáveis do EasyPanel. Nunca em chat, issue, commit ou print.

---

## C. Supabase de produção (você aplica; o agente NUNCA executa nada em produção)

Plano **Free**. Cada etapa tem uma **consulta de verificação**: cole no *SQL Editor* do painel e compare.

### C.1 Criar o projeto
<https://supabase.com/dashboard> → **New project** → Plano **Free**, região **South America (São Paulo)**,
senha do banco forte (guarde num gerenciador de senhas).

### C.2 Enviar as migrations (versionadas em `supabase/migrations/`; o `seed.sql` de teste NÃO vai)
```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF     # o "ref" está na URL do painel
supabase db push --dry-run                      # mostra o que vai aplicar (confira: 10 migrations na 1ª vez)
supabase db push
```
**Verificação:**
```sql
select version from supabase_migrations.schema_migrations order by version;
-- esperado: 10 linhas, de 20261117000100 até 20261118001000
select count(*) as tabelas_sem_rls from pg_tables where schemaname = 'public' and not rowsecurity;
-- esperado: 0
select extname from pg_extension where extname in ('pg_cron', 'pg_net', 'pgcrypto', 'supabase_vault') order by 1;
-- esperado: pg_cron, pg_net, pgcrypto, supabase_vault
```

### C.3 Autenticação
**Authentication → Sign In / Providers → Email**: *Confirm email* **ligado**; **Secure email change** **ligado**
(troca de e-mail exige confirmação nos dois endereços). **Password**: mínimo 8, exigir letras e dígitos.
*(Proteção contra senhas vazadas é recurso do plano Pro — não necessário.)*

**Authentication → URL Configuration**
- **Site URL:** `https://larmais.tech`
- **Redirect URLs:** `https://larmais.tech/**` e `http://localhost:3000/**`

**Verificação:** abra `https://larmais.tech/recuperar-senha`, peça a redefinição para o seu e-mail e confira que o
link do e-mail começa com `https://larmais.tech/auth/confirm`.

### C.4 Modelos de e-mail com a marca Lar+
**Authentication → Emails → Templates**: em **Confirm signup**, **Reset password** e **Change email address**
cole o HTML de `supabase/templates/confirmation.html`, `recovery.html` e `email_change.html`; assuntos:
"Confirme seu e-mail · Lar+", "Redefinir sua senha · Lar+", "Confirme seu novo e-mail · Lar+".
O logo do e-mail é carregado de `https://larmais.tech/icons/icon-192.png` (precisa do app no ar).

### C.5 SMTP (Brevo) — ver seção **H** e depois volte aqui
**Authentication → Emails → SMTP Settings** → *Enable custom SMTP*: host `smtp-relay.brevo.com`, porta `587`,
usuário = login SMTP da Brevo, senha = **chave SMTP** da Brevo, remetente `nao-responda@larmais.tech`, nome `Lar+`.

### C.6 Chaves para o app
**Project Settings → API Keys**: copie **URL do projeto**, **Publishable key** (`sb_publishable_…`) e a
**Secret key** (`sb_secret_…`). A secret vai **só** em `SUPABASE_SECRET_KEY` no EasyPanel (nunca `NEXT_PUBLIC_`).

### C.7 Agendamentos (pg_cron) e segredos do Vault
As migrations já criam 3 jobs. O de notificações chama o app pela internet usando 2 segredos do **Vault**
(nunca no código). No *SQL Editor* (troque o valor pelo seu `CRON_SECRET`, o mesmo do EasyPanel):
```sql
select vault.create_secret('https://larmais.tech', 'larmais_app_url');
select vault.create_secret('COLE_AQUI_O_CRON_SECRET', 'larmais_cron_secret');
```
**Verificação:**
```sql
select jobname, schedule, active from cron.job order by jobname;
-- esperado: gerar-recorrencias '0 6 * * *' · limpar-assistente '30 6 * * *' · notificacoes '*/15 * * * *' (todos true)
select name from vault.decrypted_secrets where name like 'larmais_%' order by name;
-- esperado: larmais_app_url, larmais_cron_secret
-- 15–30 min depois do app no ar (só chama quando há notificação pendente):
select status_code, created from net._http_response order by created desc limit 5;   -- esperado: 200
select jobname, status, start_time from cron.job_run_details d join cron.job j using (jobid)
 order by start_time desc limit 5;                                                   -- esperado: succeeded
```
Para trocar o segredo depois: `select vault.update_secret((select id from vault.secrets where name = 'larmais_cron_secret'), 'NOVO');`

### C.8 Advisors (segurança e desempenho)
Painel → **Advisors → Security Advisor** e **Performance Advisor** → *Rerun*. Esperado: **nenhum erro (ERROR)**.
Avisos conhecidos e aceitos: "Leaked password protection disabled" (recurso Pro) e índices "unused" logo após o deploy
(somem com o uso). Qualquer **ERROR** → me mande o texto do aviso (sem segredos).

### C.9 Dead-letter (falhas visíveis para você)
```sql
select * from public.ops_dead_letters order by created_at desc limit 20;
-- entregas de notificação que desistiram (5 tentativas) e updates do Telegram que falharam. Sem conteúdo de mensagem.
```

### C.10 Usuário do smoke test
Crie no app (`/cadastro`) uma conta **só para testes**, ex.: `seu-email+smoke@gmail.com` (o Gmail entrega
no seu e-mail). Não crie família nem dados reais nela. Usada na seção **J**.

⚠️ O plano Free **pausa o projeto após 7 dias sem uso**; com o uso diário isso não acontece. Se pausar: *Restore*.

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

### D.4 Build
*Build* → **Dockerfile** (caminho `Dockerfile`). O EasyPanel repassa as variáveis do app como **build args** —
as `NEXT_PUBLIC_*` precisam existir **antes** do build (elas vão para o navegador).

### D.5 Variáveis de ambiente (*Environment*)
| Variável | Valor | Tipo |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://larmais.tech` | pública (build) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto (C.6) | pública (build) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | pública (build) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | de `pnpm vapid` (G) | pública (build) |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | **secreta** |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | suas chaves (E) | **secretas** |
| `TELEGRAM_BOT_TOKEN` | do @BotFather (F) | **secreta** |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 32` | **secreta** |
| `TELEGRAM_BOT_USERNAME` | `LarMaisBot` | — |
| `VAPID_PRIVATE_KEY` | de `pnpm vapid` | **secreta** |
| `VAPID_SUBJECT` | `mailto:contato@larmais.tech` | — |
| `CRON_SECRET` | `openssl rand -hex 32` (o mesmo do Vault, C.7) | **secreta** |

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
4. Registre o webhook **depois** do app no ar (rode no seu computador, com os MESMOS valores do EasyPanel):
   ```bash
   TELEGRAM_BOT_TOKEN='...' TELEGRAM_WEBHOOK_SECRET='...' NEXT_PUBLIC_SITE_URL=https://larmais.tech pnpm telegram set
   pnpm telegram info     # esperado: Webhook https://larmais.tech/api/telegram/webhook · Pendentes 0 · sem "Último erro"
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

Gratuito: **300 e-mails/dia** (sobra para confirmação, senha e convites).
1. Crie a conta em <https://www.brevo.com> (sem cartão).
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain** → `larmais.tech` → escolha autenticar
   manualmente. A Brevo mostra os registros; crie-os no DNS do registrador (seção K):
   | Tipo | Nome | Valor (exemplo — use o que a Brevo mostrar) |
   |---|---|---|
   | TXT | `@` | `brevo-code:xxxxxxxx` (verificação) |
   | TXT/CNAME | `brevo1._domainkey` / `brevo2._domainkey` | **DKIM** (copie da Brevo) |
   | TXT | `@` | **SPF:** `v=spf1 include:spf.brevo.com ~all` (se já houver um SPF, junte num só) |
   | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:SEU_EMAIL` |
3. Clique em **Authenticate** até ficar tudo verde (pode levar até algumas horas).
4. **Senders → Add sender**: nome **Lar+**, e-mail `nao-responda@larmais.tech`.
5. **SMTP & API → SMTP → Generate a new SMTP key** → use no Supabase (C.5).

**Verificação:** `dig +short TXT larmais.tech` (mostra o SPF) · `dig +short TXT brevo1._domainkey.larmais.tech` (DKIM).
Peça uma redefinição de senha para você mesmo → no Gmail, *Mostrar original* → **SPF: PASS · DKIM: PASS**.

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

```bash
E2E_BASE_URL=https://larmais.tech SMOKE_EMAIL='seu-email+smoke@gmail.com' SMOKE_PASSWORD='...' pnpm test:smoke
```
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

## L. Testar no iPhone

- **iPhone real (Wi-Fi):** `pnpm dev:lan` e abra no Safari o endereço impresso. Detalhes e problemas
  comuns no README, seção 13.
- **iOS Simulator:** instale o **Xcode** pela App Store, rode
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`, instale um simulador em
  *Xcode → Settings → Components* e registre o MCP: `claude mcp add xcodebuild -- npx -y xcodebuildmcp@latest mcp`.
- **Emulação (já pronto):** `pnpm test:e2e:ios`.
