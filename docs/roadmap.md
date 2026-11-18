# Roadmap

| Fase | Entrega | Status |
|---|---|---|
| 0 | Planejamento: requisitos, arquitetura, modelo de dados, RLS, design system | ✅ Concluída |
| 1 | Fundação: projeto, Supabase, migrations + RLS, auth, família/convites, alternância de espaço, layout | ✅ Concluída |
| 2 | Receitas, despesas, categorias, contas, cartões, faturas, parcelamento, recorrências | ✅ Concluída |
| 3 | Dashboard e gráficos | ✅ Concluída |
| 4 | Metas e projeções | ✅ Concluída |
| 5 | IA de interpretação de mensagens | ✅ Concluída |
| 6 | WhatsApp (Cloud API) + Telegram | ⏭️ Próxima |
| 7 | Importação CSV/OFX e leitura de prints | Planejada |
| 8 | PWA, testes finais, deploy e hardening | Planejada |

> O deploy em produção (Supabase em nuvem + EasyPanel/Docker — ADR-0020) pode ser feito **já** ao fim da Fase 1, seguindo
> `docs/setup-manual.md`. A Fase 8 trata do hardening final, não do primeiro deploy.

## Entregue além do planejado
- **Fase 1+**: troca de e-mail, exclusão de conta, transferência de posse (ADR-0013); ambiente de testes
  iPhone/Android com Playwright WebKit, CI no GitHub Actions, `pnpm dev:lan`, ícones e manifest PWA (ADR-0012).
- **Fase 2+**: transferências, auditoria com desfazer (ADR-0009), subcategorias, recorrências semanais/anuais.
- **Fase 5+**: holdout honesto de avaliação, aprendizado de categoria, confirmação editável, correções no chat
  (envio antes da hidratação), testes de integração rodando no CI.
- **Fase 4+**: motor de projeção por regras (36 meses), lista de lançamentos na visão caixa e com projeções,
  tela Planejamento, API interna de metas para IA/bot, correção do campo de valor (cursor).
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

## Fase 4 · Metas e projeções ✅
- **Antes da fase:** motor de projeção a partir das regras (ADR-0017) e lista na visão caixa igual ao gráfico.
- **Back-end:** metas com prioridade, valor inicial, reserva, rendimento e status; aportes/retiradas; aporte
  planejado via recorrências; regra contábil "aporte não é despesa" (ADR-0016); capacidade de poupança; RLS e
  pgTAP; API interna (`docs/api-interna.md`).
- **Front-end:** Metas (cartões ordenáveis), detalhe (gráfico realizado × projetado × ideal, simulador, corte por
  categoria, plano, histórico, quem guardou), Planejamento, "Guardar para meta" em 3 toques, celebração,
  "Guardado em metas" no painel e widget.
- **Aceite (verificado):** nada contado duas vezes; mês atual da projeção = Fase 3; casos de borda dos cálculos.

## Fase 5 · IA de mensagens ✅
- Parser local + Gemini/Groq atrás de `AiParser`; a IA só interpreta (ADR-0018); privacidade/cota (ADR-0019).
- Motor de conversa por canal com estado no banco; tela Assistente; aprendizado de categoria; desfazer em lote.
- API interna de lançamentos extraída (telas e assistente usam a mesma).
- Avaliação: 169 mensagens + holdout de 40; integração mensagem → banco; pgTAP; E2E em 4 dispositivos.
- Acurácia da IA real medida em 18/11/2026 (README §12).

## Fase 6 · Lar+: Telegram, fotos, áudio, notificações e produção ✅
- Identidade **Lar+** (logo, ícones PWA/maskable, telas de abertura do iPhone, foto do bot, e-mails).
- Produção: EasyPanel (Docker standalone, sem root, healthcheck) em `larmais.tech`, CSP/HSTS, smoke test (ADR-0020).
- **Somente Telegram** (WhatsApp fora por custo): webhook com `secret_token`, idempotência, vinculação por código/QR,
  comandos, teclados inline, sessão do próprio usuário (ADR-0021).
- **Fotos** (cupom/NFC-e, recibo, notificação de cartão, Pix, fatura) e **áudio** (Whisper) no Telegram e no app (ADR-0022).
- **Notificações**: Web Push (VAPID), Telegram e central no app; pg_cron + fila com retentativas e dead-letter (ADR-0023).
- **Aceite:** webhook com segredo inválido → 401; mesmo `update_id` duas vezes → um processamento; foto sempre confirma.

## Fase 7 · Importação CSV/OFX
- Parsers CSV (Nubank, Inter, Itaú, genérico com mapeamento de colunas) e OFX; pré-visualização;
  deduplicação (RN-30); desfazer importação. (Leitura de prints foi antecipada para a Fase 6.)

## Fase 8 · PWA, testes e hardening
- Service worker com offline do shell (o de push já existe desde a Fase 6).
- Rever a CSP (hashes/SRI quando estável com PPR), revisão de headers, `supabase db lint`/advisors, testes E2E (Playwright) dos fluxos críticos.
- Backups (export agendado), política de exclusão de conta (transferência de dono antes de excluir).
- Checklist de segurança: chaves rotacionadas, RLS revisada tabela a tabela, logs sem dados sensíveis.
