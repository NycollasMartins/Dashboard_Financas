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
| [0009](0009-auditoria-em-vez-de-soft-delete.md) | Trilha de auditoria em vez de soft delete | Aceita |
| [0010](0010-regra-contabil-cartao.md) | Regra contábil do cartão; status e saldos calculados | Aceita |
| [0011](0011-recorrencias-pg-cron.md) | Recorrências no banco com pg_cron, idempotentes | Aceita |
| [0012](0012-testes-mobile-ios.md) | Testes mobile/iOS com Playwright WebKit e XcodeBuildMCP | Aceita |
| [0013](0013-ciclo-de-vida-da-conta.md) | Troca de e-mail, transferência de posse e exclusão de conta | Aceita |
| [0014](0014-visoes-competencia-e-caixa.md) | Visões de período: competência (padrão) e caixa/por vencimento | Aceita |
| [0015](0015-camada-analitica-e-graficos.md) | Camada analítica no banco (SECURITY INVOKER) e gráficos sem biblioteca | Aceita |
