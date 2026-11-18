# Decisões de arquitetura (ADRs)

Cada ADR registra **uma** decisão importante: contexto, decisão, alternativas e consequências.
Uma ADR aceita não é editada; se a decisão mudar, crie outra que a substitua.

| # | Decisão | Status |
|---|---|---|
| [0001](0001-stack.md) | Stack: Next.js 16 + Supabase (+ Vercel até a Fase 5) | Revisada pela 0020 |
| [0002](0002-multitenancy-workspaces-rls.md) | Multi-tenancy por workspace com RLS e FKs compostas | Aceita |
| [0003](0003-dinheiro-e-datas.md) | Dinheiro em centavos e datas em America/Sao_Paulo | Aceita |
| [0004](0004-bot-canais-desacoplados.md) | Bot com canais desacoplados (adapter) e service role restrita | Revisada pela 0021 |
| [0005](0005-provedor-de-ia.md) | IA: Gemini como primário e Groq como alternativa, atrás de interface | Revisada pelas ADR-0018/0019 |
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
| [0016](0016-aporte-em-meta-nao-e-despesa.md) | Aporte em meta não é despesa (reserva/caixinha, retirada com motivo) | Aceita |
| [0017](0017-motor-de-projecao.md) | Motor de projeção a partir das regras (até 36 meses, sem gravar) | Aceita |
| [0018](0018-ia-so-interpreta.md) | A IA só interpreta; o domínio valida, calcula e grava | Aceita |
| [0019](0019-privacidade-cota-e-provedores.md) | Privacidade, cota e cadeia de provedores (local → Gemini → Groq → local) | Aceita |
| [0020](0020-producao-easypanel-docker.md) | Produção: EasyPanel (Docker), larmais.tech, CSP sem nonce | Aceita |
| [0021](0021-telegram-unico-canal.md) | Telegram como único canal; sessão do usuário vinculado | Aceita |
| [0022](0022-fotos-e-audio.md) | Fotos e áudio: a IA só extrai/transcreve; nada guardado | Aceita |
| [0023](0023-notificacoes.md) | Notificações: pg_cron + fila + Web Push/Telegram | Aceita |
