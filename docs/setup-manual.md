# O que você precisa fazer manualmente (passo a passo)

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

## C. Supabase em nuvem (produção)

1. Entre em <https://supabase.com/dashboard> → **New project**.
   - Plano: **Free**. Região: **South America (São Paulo)**.
   - Gere uma **senha do banco** forte e guarde num gerenciador de senhas.
2. Vincule e envie as migrations (o `seed.sql` de teste **não** é enviado):
   ```bash
   supabase login
   supabase link --project-ref SEU_PROJECT_REF   # o "ref" está na URL do painel
   supabase db push
   ```
3. **Authentication → Sign In / Providers → Email**: deixe "Confirm email" **ligado** e
   **"Secure email change"** ligado (a troca de e-mail exige confirmação nos dois endereços).
   Em **Password**: mínimo 8 caracteres, exigir letras e dígitos.
4. **Authentication → URL Configuration**:
   - Site URL: a URL da Vercel (ex.: `https://seu-app.vercel.app`)
   - Redirect URLs: `https://seu-app.vercel.app/**` e `http://localhost:3000/**`
5. **Authentication → Email Templates**: para **Confirm signup**, **Reset password** e **Change email
   address**, cole o HTML de `supabase/templates/confirmation.html`, `recovery.html` e `email_change.html`
   e use os assuntos que estão em `supabase/config.toml`.
6. **E-mail de verdade (SMTP gratuito)**: o SMTP padrão do Supabase só serve para testes
   (pouquíssimos e-mails por hora). Para sua esposa conseguir criar conta:
   1. Crie conta gratuita na **Brevo** (<https://www.brevo.com>) e verifique um remetente (seu e-mail).
   2. Em Brevo → *SMTP & API* → gere uma **chave SMTP**.
   3. No Supabase → **Authentication → Emails → SMTP Settings**: ative *Custom SMTP* com
      host `smtp-relay.brevo.com`, porta `587`, usuário e senha da Brevo, remetente = e-mail verificado.
7. **Project Settings → API Keys**: copie a **URL do projeto** e a **Publishable key** (`sb_publishable_…`).
   ⚠️ **Nunca** copie a *Secret key* para variáveis com prefixo `NEXT_PUBLIC_`.
8. **Recorrências automáticas**: a migration 0006 habilita a extensão **pg_cron** e agenda o job
   `gerar-recorrencias` (03:00 de São Paulo). Confira em *Integrations → Cron* que ele aparece.
9. ⚠️ O plano Free **pausa o projeto após 7 dias sem uso**. Se pausar, entre no painel e clique em *Restore*.

---

## D. Deploy na Vercel (Hobby, gratuito)

1. <https://vercel.com/new> → importe o repositório do GitHub (framework detectado: Next.js).
   Como o repositório é **privado**, clique em *Adjust GitHub App Permissions* e libere o acesso a ele.
   No plano Hobby, a Vercel só publica commits **cujo autor é o dono da conta** (você). Se um deploy
   aparecer como *Blocked* ("commit author does not have contributing access"):
   - confira em GitHub → *Settings → Emails* que o e-mail dos commits (o *noreply*) é da sua conta e que
     a conta da Vercel está ligada a esse mesmo GitHub (*Vercel → Account Settings → Authentication*);
   - faça *Redeploy* pelo painel da Vercel;
   - se continuar bloqueando, me avise antes de qualquer upgrade (o Pro custa US$ 20/mês) — alternativas
     gratuitas: voltar o repositório a público ou publicar pela Vercel CLI a partir do seu computador.
2. Em **Environment Variables**, cadastre:

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `NEXT_PUBLIC_SITE_URL` | `https://seu-app.vercel.app` (a URL final, sem barra no fim) |

3. **Deploy**. Depois, volte ao passo C.4 e confirme que a Site URL do Supabase é exatamente a URL da Vercel.
4. Teste: crie sua conta → confirme o e-mail → crie a família → gere o convite → envie pelo WhatsApp.

---

## E. Próximas fases (não faça agora — só para você se planejar)

| Fase | Você vai precisar |
|---|---|
| 5 · IA | Chave gratuita do **Google AI Studio** (<https://aistudio.google.com>) e/ou do **Groq** (<https://console.groq.com>) |
| 6 · WhatsApp | Conta de desenvolvedor Meta, app do tipo *Business*, produto **WhatsApp**, número de teste, token permanente (System User), *App Secret*, e configurar o webhook com a URL da Vercel |
| 6 · Telegram | Criar o bot com o **@BotFather** e guardar o token |
| 8 · Produção | Revisar variáveis, rotacionar chaves, ativar backups |

---

## F. Testar no iPhone

- **iPhone real (Wi-Fi):** `pnpm dev:lan` e abra no Safari o endereço impresso. Detalhes e problemas
  comuns no README, seção 13.
- **iOS Simulator:** instale o **Xcode** pela App Store, rode
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`, instale um simulador em
  *Xcode → Settings → Components* e registre o MCP: `claude mcp add xcodebuild -- npx -y xcodebuildmcp@latest mcp`.
- **Emulação (já pronto):** `pnpm test:e2e:ios`.
