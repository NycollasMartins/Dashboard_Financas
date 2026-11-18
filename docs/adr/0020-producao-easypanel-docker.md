# ADR-0020 · Produção: EasyPanel (Docker) na VPS própria, domínio larmais.tech e CSP sem nonce

- **Status:** Aceita (18/11/2026) — substitui a parte de hospedagem da ADR-0001 (Vercel Hobby)
- **Decisores:** dono do produto, Arquiteto, DevOps

## Contexto
O produto passou a se chamar **Lar+** (`larmais` em identificadores) com domínio próprio `larmais.tech`.
A Vercel Hobby com repositório privado só publica commits do dono e impõe limites de função/cron; o dono já
tem uma VPS com **EasyPanel** (Docker + Traefik + Let's Encrypt), sem custo adicional.

## Decisão
1. **Next.js `output: "standalone"`** + **Dockerfile multi-stage** (deps → build → runner `node:24-alpine`),
   usuário **sem root** (`nextjs`, uid 1001), `HEALTHCHECK` em `/api/health` (não depende do banco: se o
   Supabase cair, o contêiner não entra em loop de reinício; `?deep=1` testa o Supabase).
2. `NEXT_PUBLIC_*` entram como **build args** (vão para o navegador); **segredos só em runtime** (nunca na imagem).
3. Deploy automático: webhook do EasyPanel no push da `main` (só com CI verde). Voltar versão: *Redeploy* de um
   deploy anterior + `git revert`.
4. **CSP sem nonce** (`script-src 'self' 'unsafe-inline'`): o guia do Next 16 diz que nonce exige renderização
   100% dinâmica e é **incompatível com Partial Prerendering** (Cache Components), que usamos (ADR-0008).
   O resto é fechado: `default-src 'self'`, `connect-src` só o próprio site e o Supabase, `frame-ancestors 'none'`,
   `object-src 'none'`, `form-action 'self'`, `upgrade-insecure-requests`. HSTS com preload, COOP `same-origin`.
   `Permissions-Policy`: câmera e microfone **só para o próprio site** (foto/áudio no Assistente).
5. Domínio e bot **configuráveis** por variável (`NEXT_PUBLIC_SITE_URL`, `TELEGRAM_BOT_USERNAME`).
6. CI ganha o job **Imagem Docker**: build + sobe o contêiner + espera `healthy` + confere usuário não-root.

## Consequências
- (+) Custo zero (VPS já existente), sem limites de função/cron da Vercel, `after()` roda no próprio processo Node.
- (+) Imagem ~70 MB de app + base Node (~336 MB descompactada no total).
- (−) Somos responsáveis pela VPS (atualizações do SO, backup do EasyPanel). Banco continua no Supabase (backups dele).
- (−) `'unsafe-inline'` em scripts: risco de XSS mitigado por React (escapa por padrão), nenhum `dangerouslySetInnerHTML`
  com dado do usuário (só o SVG do QR gerado no servidor) e CSP restritiva no resto. Rever quando o Next suportar
  hashes (SRI) com PPR de forma estável.

## Nota histórica
Até a Fase 5 o plano era Vercel Hobby (ADR-0001). Configurações da Vercel foram removidas na Fase 6.
