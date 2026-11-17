# Roadmap

| Fase | Entrega | Status |
|---|---|---|
| 0 | Planejamento: requisitos, arquitetura, modelo de dados, RLS, design system | ✅ Concluída |
| 1 | Fundação: projeto, Supabase, migrations + RLS, auth, família/convites, alternância de espaço, layout | ✅ Concluída |
| 2 | Receitas, despesas, categorias, contas, cartões, faturas, parcelamento, recorrências | ✅ Concluída |
| 3 | Dashboard e gráficos | ✅ Concluída |
| 4 | Metas e projeções | ⏭️ Próxima |
| 5 | IA de interpretação de mensagens | Planejada |
| 6 | WhatsApp (Cloud API) + Telegram | Planejada |
| 7 | Importação CSV/OFX e leitura de prints | Planejada |
| 8 | PWA, testes finais, deploy e hardening | Planejada |

> O deploy em produção (Supabase em nuvem + Vercel) pode ser feito **já** ao fim da Fase 1, seguindo
> `docs/setup-manual.md`. A Fase 8 trata do hardening final, não do primeiro deploy.

## Entregue além do planejado
- **Fase 1+**: troca de e-mail, exclusão de conta, transferência de posse (ADR-0013); ambiente de testes
  iPhone/Android com Playwright WebKit, CI no GitHub Actions, `pnpm dev:lan`, ícones e manifest PWA (ADR-0012).
- **Fase 2+**: transferências, auditoria com desfazer (ADR-0009), subcategorias, recorrências semanais/anuais.
- **Fase 3+**: saldo projetado, insights por regra, ocultar valores, tabela alternativa em todo gráfico,
  formulário de lançamento carregado sob demanda (desempenho), correção da 1ª compra parcelada.

## Fase 2 · Lançamentos e cartões ✅
- **Back-end:** funções puras e testadas `invoiceFor(purchaseDate, card)` (RN-10) e geração de parcelas
  (RN-11); RPC `create_card_purchase` (cria/acha a fatura e as parcelas numa transação só);
  geração de recorrências por **pg_cron** diário (idempotente, RN-14); pagamento de fatura.
- **Front-end:** lista de lançamentos com filtro por mês; folha de **lançamento rápido em 3 toques**
  (teclado numérico, grade de categorias, chips de ajuste); CRUD de categorias, contas, cartões e recorrências.
- **Aceite:** compra no dia do fechamento cai na fatura seguinte; 3x de R$ 100 = 33,34/33,33/33,33;
  recorrência rodada duas vezes no mesmo mês não duplica; membro não edita lançamento alheio.

## Fase 3 · Dashboard ✅
- **Back-end:** funções `analytics_*` (`SECURITY INVOKER`) com visões competência × caixa (ADR-0014),
  realizado × previsto, saldo projetado, vencimentos; índices medidos com `EXPLAIN ANALYZE` (ADR-0015).
- **Front-end:** painel com KPIs e variação semântica, saldo projetado, posição, insights, categorias,
  evolução de 12 meses, comparação com a média, limites, vencimentos, maiores gastos, por membro e por
  cartão/conta; filtros na URL; ocultar valores; tabela alternativa; estados vazios e skeletons.
- **Aceite (verificado):** as duas visões batem no acumulado; RLS entre famílias; filtros compartilháveis e
  botão voltar; Lighthouse mobile acessibilidade 100.
- **Pendências herdadas:** retenção do `audit_log` (Fase 8); progresso das metas no painel (Fase 4).

## Fase 4 · Metas e projeções (próxima)
- Módulo puro `projections.ts` (RN-20…23) com testes de tabela; CRUD de metas e aportes (inclui resgate).
- Tela da meta: progresso, valor mensal necessário, prazo estimado, simulador "e se eu guardar X?".
- **Aceite:** aportes de 100/200/300 recalculam prazo e valor mensal corretamente.

## Fase 5 · IA de mensagens
- Interface `AiParser` + `GeminiParser` + `GroqParser` (ADR-0005); saída JSON validada com Zod.
- `MessageService`: intents `create_expense`, `create_income`, `goal_contribution`, `query`, `undo`,
  `switch_workspace`; perguntas de esclarecimento com estado em `bot_sessions`.
- Painel de teste ("simulador de chat") dentro do app, para usar antes de ter WhatsApp.
- **Aceite:** conjunto de ≥ 50 frases reais com expectativa (teste de regressão do parser).

## Fase 6 · WhatsApp + Telegram
- Route Handlers `/api/webhooks/whatsapp` e `/api/webhooks/telegram`: verificação de assinatura,
  idempotência, rate limit, resposta em < 5 s (processamento com `after()`).
- Vinculação por código no painel (Configurações → WhatsApp/Telegram).
- **Aceite:** webhook com assinatura inválida → 401; mesma mensagem duas vezes → um lançamento só.

## Fase 7 · Importação e prints
- Parsers CSV (Nubank, Inter, Itaú, genérico com mapeamento de colunas) e OFX; pré-visualização;
  deduplicação (RN-30); desfazer importação.
- Leitura de print/foto de notificação via Gemini (imagem) → mesmo fluxo de confirmação do bot.

## Fase 8 · PWA, testes e hardening
- Manifest, ícones, service worker (offline do shell), instalação no celular.
- CSP estrita, revisão de headers, `supabase db lint`/advisors, testes E2E (Playwright) dos fluxos críticos.
- Backups (export agendado), política de exclusão de conta (transferência de dono antes de excluir).
- Checklist de segurança: chaves rotacionadas, RLS revisada tabela a tabela, logs sem dados sensíveis.
