# ADR-0018 · A IA só interpreta; o domínio valida, calcula e grava

**Status:** Aceita · **Decisor:** Arquiteto · **Fase:** 5 · Revisa a ADR-0005

## Contexto
O assistente transforma mensagens ("gastei 50 no uber", "quanto falta pra viagem?") em ações. Um modelo de
linguagem pode errar, inventar valores ou ser manipulado pelo texto do usuário (*prompt injection*). Dinheiro
não pode depender disso.

## Decisão
1. **Fluxo único**: mensagem → **interpretação** → **validação** → (pergunta/confirmação se necessário) →
   **API interna de domínio** → **resposta formatada pelo sistema**.
2. **Quem interpreta** (`src/lib/assistant/interpret.ts`): primeiro o **parser local** determinístico; só se
   ele não tiver confiança, um provedor de IA (Gemini → Groq). Ambos devolvem o MESMO contrato:
   `{ items: [{ intent, amount, category, payment, card, account, goal, installments, date, topic, … }] }`.
3. **A IA nunca grava e nunca faz contas.** A saída dela é validada por **schema Zod**: intenção fora da lista
   de 10 intenções é descartada; nomes que não existem no espaço viram `null`; valor citado pela IA sem número
   no texto é descartado; datas futuras são ignoradas.
4. **Quem grava** (`server/executor.ts`) usa as **mesmas APIs internas das telas** (`src/lib/ledger/service.ts`,
   `src/lib/goals/service.ts`), com a sessão do usuário (RLS) e `source = 'assistant'`. Cada gravação gera uma
   linha em `assistant_actions` com a **mensagem original** (auditada no `audit_log`).
5. **Quem responde** é o sistema: consultas ("quanto gastei") são calculadas pelas funções do banco
   (Fases 3–4) e escritas por template. A IA só identificou a pergunta.
6. **Confirmação**: grava direto (com "desfazer") só quando o parser local está confiante, há 1 item e o valor
   é ≤ `ASSISTANT_CONFIRM_ABOVE_CENTS` (padrão R$ 1.000). Pede confirmação quando: vários itens, resultado
   veio da IA, baixa confiança ou valor alto. Pergunta (com opções) quando falta dado obrigatório ou há
   ambiguidade (ex.: cartão "Nubank" × "Conta Nubank").
7. **Canal desacoplado**: `server/engine.ts#handleAssistant(ctx, input)` é o ponto de entrada de TODOS os
   canais e devolve respostas estruturadas (texto, cartão de confirmação, opções, desfazer). O estado da
   conversa (aguardando confirmação/escolha) fica em `assistant_sessions` (15 min). Respostas em texto
   ("1", "sim", "cancelar", o motivo da retirada) já funcionam → o WhatsApp/Telegram da Fase 6 só traduzem.
8. **Aprendizado**: quando a pessoa corrige a categoria no cartão de confirmação, o sistema grava uma regra
   (`category_rules`, por espaço) e o parser local passa a usá-la — sem IA.

## Alternativas rejeitadas
- **IA com "function calling" gravando direto**: o modelo decidiria quando gravar; difícil de auditar e de proteger.
- **Só IA** (sem parser local): gasta cota, depende de rede e envia mais dados para fora.
- **Respostas de consulta geradas pela IA**: exigiria mandar valores/saldos para o provedor (proibido pela ADR-0019).
