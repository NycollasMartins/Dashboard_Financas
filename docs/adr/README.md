# Decisões de arquitetura (ADRs)

Cada ADR registra **uma** decisão importante: contexto, decisão, alternativas e consequências.
Uma ADR aceita não é editada; se a decisão mudar, crie outra que a substitua.

| # | Decisão | Status |
|---|---|---|
| [0001](0001-stack.md) | Stack: Next.js 16 + Supabase + Vercel | Aceita |
| [0002](0002-multitenancy-workspaces-rls.md) | Multi-tenancy por workspace com RLS e FKs compostas | Aceita |
| [0003](0003-dinheiro-e-datas.md) | Dinheiro em centavos e datas em America/Sao_Paulo | Aceita |
| [0004](0004-bot-canais-desacoplados.md) | Bot com canais desacoplados (adapter) e service role restrita | Aceita |
| [0005](0005-provedor-de-ia.md) | IA: Gemini como primário e Groq como alternativa, atrás de interface | Aceita (revisar na Fase 5) |
| [0006](0006-whatsapp-cloud-api.md) | WhatsApp Cloud API oficial, sem grupos; Telegram como alternativa | Aceita |
| [0007](0007-convites-e-emails.md) | Convites por link compartilhável; SMTP próprio gratuito em produção | Aceita |
| [0008](0008-cache-components-e-sessao.md) | Cache Components do Next 16 com sessão Supabase | Aceita |
