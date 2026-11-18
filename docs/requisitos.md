# Requisitos e regras de negócio

> Responsável: **Analista de Sistemas/Negócios**. Revisado pelo Arquiteto.
> Status: Fases 0, 1 e 2 concluídas. Requisitos de fases futuras são o "contrato" que cada fase deve cumprir.

## 1. Visão do produto

Dashboard financeiro **pessoal e familiar**, de uso privado (inicialmente um casal; depois pais e irmão).
Restrição forte: **custo zero** (planos gratuitos de hospedagem, banco e IA). Uso principal **pelo celular**.

### Personas

| Persona | Objetivo | Uso típico |
|---|---|---|
| **Admin da família** (dono) | Organizar as finanças da casa, cadastrar cartões e despesas fixas, acompanhar metas | Painel no celular + lançamentos por WhatsApp |
| **Membro da família** (cônjuge) | Registrar gastos rápido, ver como está o mês | Lançamento em ≤ 3 toques ou mensagem no WhatsApp |
| **Usuário individual** | Controlar o próprio dinheiro, separado da família | Alterna entre "Individual" e "Família" |

## 2. Glossário

| Termo | Significado |
|---|---|
| **Espaço (workspace)** | Conjunto isolado de dados financeiros. Pode ser *individual* (`personal`) ou *familiar* (`household`). |
| **Membro** | Usuário que participa de um espaço, com papel *admin* ou *membro*. |
| **Dono** | Quem criou o espaço. É sempre admin e não pode ser removido. |
| **Lançamento (transação)** | Receita ou despesa, com valor em centavos e data de competência. |
| **Recorrência** | Regra que gera um lançamento por mês (salário, aluguel, assinatura). |
| **Fatura** | Agrupamento das compras no crédito de um cartão por ciclo de fechamento. |
| **Meta** | Objetivo de poupança (ex.: carro R$ 60.000) com prazo opcional. |
| **Aporte** | Valor guardado (ou resgatado) para uma meta. |

## 3. Requisitos funcionais

Legenda de fase: **F1** = Fundação (feito), **F2…F8** = fases futuras.

### 3.1 Contas e acessos
| ID | Requisito | Fase |
|---|---|---|
| RF-01 | Cadastro com nome, e-mail e senha (mín. 8 caracteres, letras e números). Exige confirmação de e-mail. | F1 ✅ |
| RF-02 | Login com e-mail e senha; logout. | F1 ✅ |
| RF-03 | Recuperação de senha por link enviado por e-mail (link válido por 1 h). | F1 ✅ |
| RF-04 | No cadastro, o sistema cria automaticamente o **espaço individual** do usuário. | F1 ✅ |
| RF-05 | O usuário cria uma **família** e vira admin dela (limite: 5 famílias criadas por usuário). | F1 ✅ |
| RF-06 | Admin gera **convite** para um e-mail (papel membro ou admin). O convite é um link de uso único, válido por 7 dias, que pode ser enviado por WhatsApp. | F1 ✅ |
| RF-07 | O convidado aceita o convite estando logado com **o mesmo e-mail** do convite. | F1 ✅ |
| RF-08 | O usuário alterna entre espaço individual e famílias; a escolha fica salva (vale em qualquer dispositivo). | F1 ✅ |
| RF-09 | Admin altera papéis, remove membros, revoga convites e renomeia a família. Membro pode sair. Dono pode excluir a família. | F1 ✅ |
| RF-10 | Tema escuro (padrão) e claro. | F1 ✅ |
| RF-11 | Troca de e-mail com confirmação nos dois endereços (exige senha atual). | F1 ✅ |
| RF-12 | Transferir a posse de uma família para outro membro. | F1 ✅ |
| RF-13 | Excluir a própria conta (regras RN-40…RN-44). | F1 ✅ |

### 3.2 Receitas e despesas (F2 ✅)
| ID | Requisito |
|---|---|
| RF-20 | Lançar receita/despesa com valor, descrição, categoria, data, forma de pagamento (pix, débito, crédito, dinheiro, transferência, boleto, outro) e, opcionalmente, quem gastou/recebeu. |
| RF-21 | Lançamento rápido pelo painel em **no máximo 3 toques** (ver §6). |
| RF-22 | Receitas fixas (salários) e despesas fixas (aluguel, internet, assinaturas) como **recorrências mensais** com dia de recebimento/vencimento; geradas automaticamente todo mês como "previstas" e marcadas como pagas/recebidas. |
| RF-23 | Categorias padrão (22, já criadas em cada espaço) + criação, edição e arquivamento de categorias próprias. |
| RF-24 | Cartões de crédito com nome, bandeira, 4 últimos dígitos (opcional), limite, **dia de fechamento** e **dia de vencimento**. |
| RF-25 | Compra no crédito cai automaticamente na **fatura correta** (ver RN-10). |
| RF-26 | Compra **parcelada** gera N parcelas em faturas consecutivas (ver RN-11). |
| RF-27 | Pagar fatura (marca como paga, registra conta de origem). |
| RF-28 | Editar e excluir lançamentos (respeitando papéis, RN-03), com **desfazer** por 24 h. |
| RF-29 | Transferências entre contas do mesmo espaço (não contam como receita/despesa). |
| RF-29a | Contas/carteiras com saldo **calculado** (nunca digitado). |
| RF-29b | Limite disponível do cartão calculado. |
| RF-29c | Lista de lançamentos agrupada por dia, com total do dia, busca e filtros (período, tipo, categoria, membro, conta, cartão). |
| RF-29d | Subcategorias (1 nível); excluir categoria em uso exige escolher outra para receber os lançamentos. |
| RF-29e | Recorrências semanais, mensais e anuais; previstas ou confirmadas; editar "daqui pra frente". |
| RF-29f | Parcelas: editar/excluir "só esta", "esta e as próximas" ou "todas". |

### 3.3 Dashboard (F3 ✅)
| ID | Requisito |
|---|---|
| RF-30 | KPIs do período: receitas, despesas, saldo, taxa de economia, com variação vs. período anterior (seta, % e cor semântica). |
| RF-30a | Posição: saldo atual das contas, faturas em aberto, limite disponível dos cartões. |
| RF-30b | **Saldo projetado** para o fim do período (saldo atual + receitas previstas − despesas previstas − faturas a vencer). |
| RF-31 | Gráficos: gastos por categoria/subcategoria (clique → lançamentos filtrados), evolução de 12 meses, comparação com a média de 3 meses, uso do limite dos cartões. |
| RF-31a | Listas: próximos vencimentos (15 dias + vencidos), maiores gastos, gastos por membro, gastos por cartão/conta. |
| RF-31b | Insights em texto calculados por regras (sem IA). |
| RF-32 | Filtros globais na URL: período (mês, ano, intervalo), visão (competência/caixa), categoria, membro, conta, cartão. Link compartilhável e botão voltar. |
| RF-33 | Ocultar valores (ícone de olho), salvo no perfil. |
| RF-34 | Cada gráfico tem tabela alternativa; estados vazios e skeletons. |
| RF-35 | Progresso das metas no painel → **Fase 4**. |

### 3.4 Metas e projeções (F4 ✅)
| ID | Requisito |
|---|---|
| RF-40 | Meta: nome, ícone e cor, valor-alvo, prazo opcional, prioridade (alta/média/baixa), valor inicial já guardado, conta de reserva opcional, rendimento anual estimado opcional, observação. Status: ativa, pausada, concluída (automática), arquivada. |
| RF-40a | Metas do espaço individual (só o dono vê) ou da família (todos veem e guardam), com a contribuição de cada membro. |
| RF-41 | Aportes de qualquer valor, quando quiser; retiradas com motivo; histórico completo (excluir com permissão). |
| RF-41a | Aporte planejado recorrente (ex.: R$ 500 todo dia 5) que aparece como previsto e é confirmável. |
| RF-42 | Cálculos: quanto falta, % concluído, mensal necessário para o prazo (recalculado a cada aporte), data estimada pelo plano ou pelo ritmo real, status de ritmo (adiantada/no ritmo/atrasada). |
| RF-42a | Capacidade de poupança (renda − fixas − variáveis), quanto já está comprometido com metas, sugestão de distribuição e alerta de inviabilidade. |
| RF-43 | Simulador "e se" (aporte, prazo, alvo, rendimento) sem salvar; cenário "reduzir X% na categoria Y antecipa N meses". |
| RF-43a | Guardar em até 3 toques (botão + global ou botão da meta); celebração ao concluir. |
| RF-43b | Painel: "Guardado em metas" separado de despesas, taxa de economia com aportes, widget de metas; tela "Planejamento". |
| RF-44 | Sugestões da IA → **Fase 5** (o cenário por categoria já existe, calculado por regra). |
| RF-45 | API interna de metas reutilizável pela IA e pelo bot (docs/api-interna.md). |

### 3.5 Lançamento por mensagem — IA (F5 ✅, no app) + WhatsApp/Telegram (F6)
| ID | Requisito |
|---|---|
| RF-50a | (F5 ✅) Tela **Assistente** no app (e atalho no botão +): chat com sugestões, cartões de confirmação (Confirmar/Editar/Cancelar), opções, respostas em BRL e "desfazer"; histórico por usuário, apagável; aviso de privacidade. |
| RF-50b | (F5 ✅) Intenções: registrar_despesa, registrar_receita, registrar_compra_parcelada, transferir, guardar_em_meta, retirar_de_meta, confirmar_previsto, consultar, desfazer_ultimo, ajuda. Vários lançamentos numa mensagem. |
| RF-50c | (F5 ✅) Aprender a categoria corrigida pela pessoa ("padaria do zé" → Mercado) para o espaço. |
| RF-50 | Interpretar mensagens em linguagem natural ("gastei 50 no Uber", "100 no mercado no crédito do Nubank", "ganhei 1000 de freela", "guardei 300 pra viagem") em dados estruturados. |
| RF-51 | Registrar e responder com confirmação + saldo do mês. |
| RF-52 | Se faltar informação ou houver ambiguidade (ex.: dois cartões "Nubank"), **perguntar antes de registrar**. |
| RF-53 | Comando **desfazer** o último lançamento feito pelo bot. |
| RF-54 | Consultas: "quanto gastei com mercado esse mês?", "quanto falta pra meta do carro?". |
| RF-55 | Vincular número de WhatsApp / chat do Telegram a um usuário via **código de 8 caracteres** gerado no painel (expira em 10 min, uso único). |
| RF-56 | Escolher o espaço padrão dos lançamentos por mensagem (individual ou família); comando para trocar ("usar família"). |
| RF-57 | (Bônus, F7) Ler foto/print de notificação de compra e extrair os dados. |

### 3.6 Importação (F7)
| ID | Requisito |
|---|---|
| RF-60 | Importar extrato/fatura **CSV** e **OFX**, com pré-visualização antes de gravar. |
| RF-61 | **Detectar duplicatas** (RN-30) e permitir desfazer uma importação inteira. |

## 4. Requisitos não funcionais

| ID | Requisito |
|---|---|
| RNF-01 | **Isolamento no banco** (Row Level Security) em todas as tabelas; o front nunca é a única barreira. |
| RNF-02 | Valores monetários sempre em **centavos (inteiro)**; nunca float. Moeda BRL. |
| RNF-03 | Datas no fuso **America/Sao_Paulo**. |
| RNF-04 | Segredos só no servidor (`.env.local` / variáveis do EasyPanel). Nada de chave secreta no bundle do navegador. |
| RNF-05 | Custo zero (planos gratuitos). Qualquer custo deve ser avisado antes, com alternativa gratuita. |
| RNF-06 | Mobile-first, PWA instalável (F8), toques ≥ 44 px, respeito a `prefers-reduced-motion`. |
| RNF-07 | Acessibilidade: contraste AA, navegação por teclado, labels em todos os campos, mensagens de erro associadas (`aria-describedby`). |
| RNF-08 | Webhooks: validar assinatura (WhatsApp `X-Hub-Signature-256`, Telegram `secret_token`), idempotência por id da mensagem e limite de taxa. |
| RNF-09 | Mensagens de erro em pt-BR, sem vazar detalhes técnicos. |

## 5. Regras de negócio

### Espaços e papéis
- **RN-01** Todo usuário tem exatamente **um** espaço individual, criado no cadastro. Ele não aceita outros membros e não pode ser excluído.
- **RN-02** O criador de uma família é o **dono**: sempre admin, não pode ser rebaixado nem removido. Só o dono exclui a família (apaga todos os dados dela).
- **RN-03** Matriz de permissões (garantida por RLS + funções no banco):

| Ação | Admin | Membro |
|---|:---:|:---:|
| Ver todos os dados do espaço | ✅ | ✅ |
| Criar lançamentos e aportes | ✅ | ✅ |
| Editar/excluir lançamentos e aportes | todos | só os que criou |
| Criar/editar contas, cartões, categorias, recorrências, metas | ✅ | ✅ |
| Excluir contas, cartões, categorias, recorrências, metas | todos | só os que criou |
| Renomear a família | ✅ | ❌ |
| Convidar, revogar convites, alterar papéis, remover membros | ✅ (exceto o dono) | ❌ |
| Sair da família | ✅ (exceto o dono) | ✅ |
| Excluir a família | só o dono | ❌ |

- **RN-04** Convite: token aleatório de 256 bits; o banco guarda **só o hash** (SHA-256). Uso único, expira em 7 dias, e só pode ser aceito por quem está logado com o **e-mail convidado**. Um novo convite para o mesmo e-mail revoga o anterior. Máximo de 20 convites pendentes por família.
- **RN-05** Autoria (`created_by`) é sempre definida pelo banco a partir da sessão, nunca pelo cliente.
- **RN-06** Nenhum registro pode mudar de espaço depois de criado.

### Dinheiro e datas
- **RN-07** Valores em centavos (`bigint`). Lançamentos têm valor **> 0**; o tipo (receita/despesa) define o sinal.
- **RN-08** Categoria do lançamento deve ser do mesmo tipo (categoria de despesa só em despesa).
- **RN-09** "Hoje" e o "mês atual" são calculados em America/Sao_Paulo.

### Cartão de crédito
- **RN-10 (fatura correta)** Para uma compra na data *D* em um cartão com fechamento *F* e vencimento *V*:
  1. Data de fechamento do mês de *D* = dia *F* desse mês (dias 29–31 inexistentes → último dia do mês).
  2. Se *D* **≥** data de fechamento → a compra vai para o ciclo que fecha no **mês seguinte**; senão, no ciclo que fecha no mês de *D*.
  3. Vencimento = dia *V* do mês de fechamento se *V > F*; senão, do mês seguinte.
  4. A fatura é identificada pelo **mês de vencimento** (`reference_month`).
  - Exemplo: fecha dia 3, vence dia 10. Compra em 02/11 → fatura de **nov** (vence 10/11). Compra em 03/11 → fatura de **dez** (vence 10/12).
- **RN-11 (parcelamento)** Total dividido em N parcelas inteiras; o resto dos centavos vai para a **1ª parcela** (R$ 100,00 em 3x = 33,34 + 33,33 + 33,33). A parcela *k* cai na fatura *k−1* meses após a fatura da compra. 2 a 48 parcelas.
- **RN-12** Receitas não podem ser lançadas no crédito (estornos são tratados na F7).
- **RN-13** ~~Fatura paga não recebe novos lançamentos~~ (substituída na Fase 2): a compra **sempre** vai para a
  fatura do seu ciclo, como no banco. Se cair numa fatura já paga, ela volta a ter saldo a pagar (status calculado, RN-54).

### Recorrências
- **RN-14** Geradas mensalmente, uma vez por (recorrência, mês) — garantido por índice único. Ficam como **previstas** (`is_settled = false`) até serem confirmadas.
- **RN-15** Dia 29–31 em meses curtos → último dia do mês.
- **RN-16** Alterar uma recorrência afeta só os meses **ainda não gerados**; opcionalmente ("aplicar aos previstos")
  refaz também os lançamentos **previstos a partir de hoje**. Confirmados e passados nunca mudam.
- **RN-17** Frequências: semanal (mesmo dia da semana do início), mensal, anual (mesmo mês do início).
- **RN-18** Recorrências são geradas até o fim do mês corrente: na criação e diariamente às 03:00 (pg_cron).
  Rodar duas vezes não duplica; ocorrência excluída pelo usuário não volta.
- **RN-19** Categoria em uso não pode ser excluída sem reatribuição (garantido por FK `RESTRICT`).
  Subcategoria tem o mesmo tipo da mãe e só um nível.

### Metas e projeções (Fase 4) — ver ADR-0016 e ADR-0017
Convenção de calendário: um aporte por mês; o **mês 1 é o próximo mês**. Prazo em nov/2028 visto em
nov/2026 = **24 meses**. Prazo no mês atual = 0 meses ("falta tudo agora"); prazo no passado = vencido.
- **RN-70** Aporte em meta **não é receita nem despesa**: sai da conta de origem e entra na conta de
  reserva da meta (ou fica na "caixinha" da meta, se não houver conta). Saldos refletem só os confirmados.
- **RN-71** "Guardado no período" = aportes − retiradas **confirmados** no período. O valor inicial já
  guardado não entra (não é movimento). Taxa de economia = (receitas − despesas) ÷ receitas; o painel mostra
  quanto dela foi para metas.
- **RN-72** Guardado da meta = valor inicial + aportes − retiradas confirmados. % = guardado ÷ alvo
  (limitado a 100% na barra); excedente é mostrado ("atingida com R$ X a mais").
- **RN-73** Retirada exige motivo e não pode deixar a meta negativa ("retirada que zera" é permitida).
- **RN-74** Atingir o alvo conclui a meta automaticamente; retirada ou aumento do alvo que deixe abaixo
  volta para ativa. Pausada/arquivada só mudam pela pessoa. Arquivada não recebe aportes.
- **RN-75** Na família, todos os membros veem e guardam; contribuição por membro = soma dos aportes de
  cada um ("quem guardou" ou, se vazio, quem registrou). Excluir aporte: quem registrou ou admin.
- **RN-76** Aporte planejado = recorrência com `goal_id` (mensal/semanal/anual; dia 31 → último dia). Gera
  aportes **previstos** idempotentes; confirmar com ✓ ou automático. Um plano ativo por meta (trocar o plano
  encerra o anterior e apaga os previstos futuros dele).
- **RN-77** Previsto não conta no guardado nem nos saldos; entra só na projeção.
- **RN-78** Mensal necessário (com prazo): sem rendimento = ⌈restante ÷ n⌉; com rendimento anual *a*
  (taxa mensal i = (1+a)^(1/12) − 1): PMT = (alvo − guardado·(1+i)ⁿ)·i ÷ ((1+i)ⁿ − 1), arredondado para
  cima. n = meses até o mês do prazo. n = 0 → falta tudo agora; n < 0 → prazo vencido. Recalculado a cada
  aporte (se você atrasar, n diminui e o mensal sobe).
- **RN-79** Ritmo real = média **ponderada** dos aportes líquidos dos últimos meses **fechados** desde o
  início da meta (até 6): ritmo = Σ(pₖ·vₖ) ÷ Σpₖ, com peso 1 no mais antigo … n no mais recente; meses sem
  aporte contam 0. Sem meses fechados, usa o mês atual. Ritmo ≤ 0 = "sem ritmo".
- **RN-80** Data estimada = fim do mês (hoje + N), com N = menor número de meses para atingir o alvo com o
  **aporte planejado** (se houver) ou o **ritmo real**. Status: N < meses até o prazo → adiantada;
  igual → no ritmo; maior → atrasada (mostra quantos meses); sem prazo → "sem prazo"; sem ritmo → "sem ritmo".
- **RN-81** Capacidade de poupança (sobra mensal realista) = receitas fixas do **próximo mês** (projeção) +
  média das receitas eventuais − despesas fixas do próximo mês (recorrências e parcelas, projeção) − média
  das despesas variáveis. Médias dos últimos 6 meses fechados, a partir do primeiro mês com movimento.
  Comprometido com metas = soma dos aportes planejados (equivalente mensal: semanal ×52/12, anual ÷12).
  Sobra livre = sobra − comprometido. Sobra negativa é mostrada como alerta.
- **RN-82** Distribuição sugerida: 1º) metas com prazo recebem o mensal necessário, por prioridade (alta
  primeiro) e prazo mais próximo; 2º) o restante vai para metas sem prazo, proporcional ao peso da
  prioridade (3/2/1), sem passar do que falta. Inviável quando Σ mensais necessários > sobra: "para cumprir
  todas no prazo você precisaria de R$ X/mês; sua sobra média é R$ Y".
- **RN-83** Gráfico da meta: realizado (acumulado mês a mês), projetado no ritmo atual até atingir, linha
  ideal reta do início até o alvo no prazo.
- **RN-84** Simulador "e se": muda aporte mensal, prazo, alvo e rendimento e recalcula na hora, sem salvar.
- **RN-85** Corte por categoria: economia = média mensal da categoria (só gastos **variáveis**, 3 meses
  fechados) × X%; soma ao ritmo e mostra quantos meses antecipa.
- **RN-86** Rendimento é **estimativa** informada pela pessoa (0–50% a.a., padrão 0), juros compostos
  mensais; a interface avisa que não é garantia.
- **RN-87** Projeção (ADR-0017): até 36 meses à frente, a partir das recorrências **ativas** (início/fim,
  pausa), parcelas já lançadas e faturas; o mês atual é idêntico ao da Fase 3.
- **RN-88** Lista de lançamentos na visão caixa mostra exatamente os itens do gráfico, com compras no cartão
  pela data de vencimento (selo "Vence dd/mm · compra dd/mm"); meses futuros incluem as projeções (somente leitura).
- **RN-89** Guardar em até 3 toques: + → "Guardar para meta" → valor → Guardar (a meta usada por último já vem
  marcada); ou "Guardar" no cartão da meta → valor → Guardar.

### Bot e importação
- **RN-30 (duplicatas)** Hash = SHA-256 de (data, valor em centavos, descrição normalizada sem acentos/espaços extras, conta/cartão, id externo do OFX quando existir). Lançamento com hash existente no espaço é marcado como duplicado e não é importado por padrão.
- **RN-31** O bot só registra com confiança suficiente; senão, pergunta. "Desfazer" apaga apenas o último lançamento **criado pelo bot para aquele usuário** nas últimas 24 h.

### Assistente (Fase 5) — ver ADR-0018 e ADR-0019
- **RN-90** A IA só **interpreta**. Validação (Zod), cálculo e gravação são do sistema, pelas mesmas APIs das telas.
- **RN-91** Camadas: parser local (sem rede/cota) → Gemini → Groq → parser local. A IA só é chamada quando o
  parser local tem confiança < 0,8 (sem verbo claro, sem valor, sem categoria reconhecida, ambiguidade).
- **RN-92** Enviado ao provedor: só o texto (≤ 500 caracteres), data/hora e NOMES de categorias, contas,
  cartões e metas. Nunca saldos, valores do histórico, e-mails ou nomes de pessoas.
- **RN-93** Grava direto (com "desfazer") só se: parser local confiante, 1 item e valor ≤ R$ 1.000
  (configurável). Pede confirmação: vários itens, resultado da IA, baixa confiança, valor acima do limite.
- **RN-94** Pergunta antes de gravar quando falta dado obrigatório ou há ambiguidade, com opções:
  valor ausente; crédito sem cartão (com 2+ cartões); nome que é cartão E conta ("no nubank"); transferência
  sem origem/destino; meta não identificada; retirada sem motivo.
- **RN-95** Valores aceitos: "50", "R$ 50,90", "50.90", "1.234,56", "50 conto/pila", "1k", "1,5k", "2 mil",
  "mil e duzentos", "cinquenta reais". Números de parcelas ("10x"), dias ("dia 5"), datas e % não são valor.
- **RN-96** Datas relativas no fuso de São Paulo: hoje, ontem, anteontem, "dia 5" (se for depois de hoje,
  é do mês passado), "05/11", dia da semana (+ "passada"). Data futura vinda da IA é ignorada.
- **RN-97** Categoria: regras aprendidas do espaço → sinônimos (uber/99/táxi → Transporte; ifood → Restaurantes
  e delivery; …) → nome da categoria no texto. Corrigir a categoria no cartão grava a regra.
- **RN-98** "paguei o aluguel"/"recebi o salário" **sem valor** = confirmar o previsto correspondente (até 45 dias
  antes e 20 depois); vários candidatos → pergunta qual; nenhum → orienta a informar o valor.
- **RN-99** "Desfazer" (texto ou botão) reverte o **último lote** do assistente daquele usuário em 24 h: apaga
  lançamentos/aportes, apaga o plano de parcelas inteiro, ou volta o previsto para "não pago".
- **RN-100** Cota: por usuário/dia/provedor (padrão 40) e por minuto (padrão 8), atômica no banco; sem cota →
  próxima camada. Estado de conversa expira em 15 min.
- **RN-101** Espaço: "na família" / "no meu individual" na mensagem muda o destino (se a pessoa for membro);
  senão, o espaço ativo. Toda gravação registra origem (`assistant`, canal) e a mensagem original (auditoria).
- **RN-32** Limite de taxa do bot: 30 mensagens/min e 500/dia por número.

### Conta e posse (Fase 1 — pendências)
- **RN-40** Ações sensíveis (trocar e-mail, excluir conta) exigem a senha atual.
- **RN-41** Troca de e-mail só se completa após confirmar nos **dois** endereços.
- **RN-42** Só o dono transfere a posse, e só para um membro; o novo dono vira admin.
- **RN-43** Exclusão de conta é bloqueada se o usuário for dono de família **com outros membros**.
- **RN-44** Ao excluir a conta: apaga espaço individual e famílias em que está sozinho; nas demais, os
  registros ficam **anonimizados** (sem autor/"quem gastou"), preservando as contas da família.

### Regra contábil (Fase 2) — ver ADR-0010
- **RN-50** Transferência entre contas não é receita nem despesa.
- **RN-51** A **compra no crédito é a despesa** e conta na **data da compra**. Parcela *k* conta na data da
  compra + (k−1) meses (dia preso ao fim do mês).
- **RN-52** Saldo da conta = saldo inicial + receitas confirmadas − despesas confirmadas (fora do crédito)
  + transferências recebidas − transferências enviadas − pagamentos de fatura. Previstos aparecem à parte.
- **RN-53** **Pagar a fatura não é despesa**: é saída da conta para o cartão. Não altera "despesas do mês"
  (a despesa já foi contada na compra) — assim nada é contado duas vezes.
- **RN-54** Status da fatura é calculado: **paga** (pagamentos ≥ total) → **vencida** (passou do vencimento
  com saldo) → **fechada** (passou do fechamento) → **aberta**. Pagamento parcial é permitido.
- **RN-55** Limite usado = soma das compras no cartão (inclui parcelas futuras) − pagamentos; disponível =
  limite − usado.
- **RN-56** Membro edita/exclui só o que criou; admin edita tudo (vale para lançamentos, transferências e
  pagamentos de fatura).
- **RN-57** Toda criação/alteração/exclusão fica na trilha de auditoria (quem, quando, antes/depois).
- **RN-58** Exclusão de lançamento pode ser desfeita por até 24 h (por quem excluiu ou admin), mantendo o
  autor original.

### Dashboard e análises (Fase 3) — ver ADR-0014 e ADR-0015
- **RN-60** Duas visões de período. **Competência** (padrão): cada lançamento conta na sua data (compra,
  parcela, recebimento). **Caixa**: compra no cartão conta no **vencimento da fatura**; o resto, na data em
  que sai/entra na conta. Num período que contém todas as datas, as duas visões somam o mesmo.
- **RN-61** Período = mês (padrão: atual), ano ou intervalo de até 36 meses. O "anterior" tem o mesmo
  tamanho (mês → mês anterior; ano → ano anterior; intervalo → intervalo imediatamente antes).
- **RN-62** **Realizado × previsto**. Competência: previsto = não confirmado **ou** data futura (parcelas
  futuras). Caixa: compra no cartão é prevista até a fatura estar **quitada** (pagamento parcial não basta);
  o resto segue a regra da competência.
- **RN-63** Cor da variação: gasto subindo = ruim; receita, saldo e taxa de economia subindo = bom.
  Variação < 0,5% = estável. Sempre com seta e texto, nunca só cor.
- **RN-64** Taxa de economia = (receitas − despesas) ÷ receitas, só com o realizado; sem receita = "—".
- **RN-65** Saldo projetado (período que inclui hoje ou futuro) = saldo atual das contas + receitas
  previstas − despesas previstas fora do cartão − saldo das faturas não quitadas que vencem até o fim do
  período (inclui vencidas). Compras no cartão entram **só** pela fatura. Período passado = saldo realizado
  no último dia. Limitação: para meses futuros, só entram as recorrências já geradas (até o fim do mês atual).
- **RN-65a** Comparação com a média de 3 meses (gráfico e insights de categoria) só na visão **por mês**;
  em ano/intervalo a comparação é com o período anterior de mesmo tamanho.
- **RN-66** Insights (máx. 4, alertas primeiro): contas vencidas; projeção negativa; despesas > receitas;
  limite ≥ 80%; categoria ≥ 20% **e** ≥ R$ 50 acima da média mensal dos 3 meses anteriores (até 2);
  receitas/despesas previstas restantes; economia ≥ 20%; categoria ≥ 20% abaixo da média (só período fechado).
- **RN-67** "Ocultar valores" troca todos os valores por "R$ ••••" (inclusive leitor de tela, eixos e
  tooltips) e vale em qualquer aparelho (perfil).
- **RN-68** Membro efetivo de um gasto = "quem gastou" ou, se vazio, quem lançou. Filtro de categoria-pai
  inclui as subcategorias. Filtro de conta exclui compras no cartão; filtro de cartão inclui só aquele cartão.
- **RN-69** Agregados respeitam a RLS: uma família nunca vê números de outra (funções `SECURITY INVOKER`).

## 6. Fluxo de lançamento em 3 toques (F2 ✅)
1. **Toque 1**: botão **+** (sempre visível na barra inferior).
2. Teclado numérico abre já focado no valor; a pessoa digita o valor (digitar não conta como toque).
3. **Toque 2**: escolhe a categoria numa grade com as 8 mais usadas (padrão: despesa, hoje, forma de pagamento mais usada).
4. **Toque 3**: **Salvar**. Ajustes opcionais (receita, data, cartão, parcelas) ficam em chips acima do botão.

## 7. Casos de uso principais (Fase 1)

**UC-01 Criar conta**: usuário preenche nome/e-mail/senha → recebe e-mail → clica no link → sessão criada → painel no espaço individual.
Exceções: e-mail já usado (resposta neutra, sem revelar), senha fraca, link expirado ("Link inválido ou expirado").

**UC-02 Criar família e convidar**: admin cria família → informa e-mail do cônjuge → recebe link → envia pelo WhatsApp.
Exceções: e-mail inválido, pessoa já membro, limite de convites.

**UC-03 Aceitar convite**: convidado abre o link → se não logado, vai ao login/cadastro preservando o link → aceita → entra no espaço da família.
Exceções: logado com outro e-mail (oferece trocar de conta), convite expirado/revogado/usado, já é membro.

**UC-04 Alternar espaço**: seletor no topo/sidebar → escolhe espaço → todas as telas passam a mostrar os dados dele.

## 8. Casos de borda mapeados
- Convite aberto por quem já é membro → mensagem "você já participa".
- Dono tentando sair → bloqueado no banco.
- Exclusão de família com membros → remove tudo em cascata; os membros voltam ao espaço individual.
- Membro removido com aquele espaço ativo → volta automaticamente para o individual (o contexto cai no espaço pessoal se o salvo não for mais acessível).
- Links de e-mail abertos em outro dispositivo → funcionam (fluxo `token_hash`).
- Parâmetro `next` malicioso (`//evil.com`, `https://…`) → ignorado (redirecionamento seguro).
- Dois cliques em "aceitar" → o segundo recebe "convite já usado" (lock `FOR UPDATE`).
- Primeira consulta logo após login falhando com "JWT issued at future" (relógio do PostgREST) → repetida automaticamente após 1 s.
- (Fase 3) 1ª compra **parcelada** num cartão sem fatura no ciclo falhava (`first_invoice_month` nulo) →
  corrigido na migration 0007, com teste de banco e E2E de regressão.
- (Fase 3) Saldos com muitos dígitos alargavam /contas no iPhone SE → grids com `minmax(0,1fr)`.
- (Fase 4) Tocar no meio do campo de valor e digitar inseria dígitos antes dos zeros (R$ 500 → R$ 500.000) →
  máscara independente do cursor (`beforeinput`), com teste E2E.
- (Fase 4) Meta: aporte maior que o restante, retirada que zera, prazo no passado/no mês atual, meta sem
  aporte, sobra negativa, meta criada neste mês (ritmo pelo mês atual) — todos tratados e testados.

## 9d. Critérios de aceite da Fase 6 (verificados)
- [x] Webhook do Telegram: segredo inválido/ausente → 401; mesmo `update_id` → processado uma vez; grupo ignorado;
      chat não vinculado recebe só instrução (integração com payloads no formato real).
- [x] Vinculação por código de uso único (10 min) + QR + deep link; um chat por usuário; desvincular pelo app e pelo bot.
- [x] Foto: extração validada (soma × total, data, valor > 0, duplicata), sem CPF/CNPJ, **sempre** confirma,
      dividir por categoria; áudio: "Entendi: …" e o fluxo normal. Auditoria com `input_kind`.
- [x] Notificações: preferências por tipo/canal, silêncio, idempotência, retentativa → dead-letter (pgTAP, 27).
- [x] Docker: build + healthcheck + usuário não-root no CI; CSP/HSTS; smoke test de produção.
- [x] E2E: Canais, central/preferências de notificação, guia do iPhone, foto/microfone no Assistente.
- [ ] Push em iPhone real e Telegram com o bot de produção: roteiro manual (setup-manual §G e README).

### Fase 6 — regras
- **RN-110** Lançamento vindo de foto **sempre** pede confirmação.
- **RN-111** A imagem e o áudio nunca são armazenados; a auditoria guarda só a extração/transcrição.
- **RN-112** CPF/CNPJ do consumidor e dados de contato nunca são extraídos, logados ou gravados.
- **RN-113** Áudio de no máximo 60 s; imagem de no máximo 4 MB (reduzida a 1600 px antes de enviar).
- **RN-114** O bot só responde em chat privado e só a chats vinculados; um chat por usuário.
- **RN-115** Toda resposta do bot que grava informa o espaço (individual/família).
- **RN-116** O mesmo evento nunca gera duas notificações para a mesma pessoa; silêncio padrão 22h–7h.

## 9c. Critérios de aceite da Fase 5 (verificados)
- [x] Parser local: 169 mensagens (intenção 100%) e holdout de 40 escritas depois (1ª medição honesta: intenção
      77,5%, precisão quando confiante 87,1%; após correções gerais: 100%) — ver README §Assistente.
- [x] IA: saída fora do schema rejeitada; nomes inexistentes viram null; valor inventado descartado; fallback
      Gemini → Groq → local testado com provedor simulado.
- [x] Integração mensagem → banco (8 cenários): grava, confirma, pergunta, aprende categoria, consulta, desfaz.
- [x] RLS: histórico/sessão/ações só do próprio usuário; regras por família; cota atômica (pgTAP, 18 asserções).
- [x] E2E do chat em desktop, iPhone 15, iPhone SE e Android.
- [x] Acurácia contra o Gemini/Groq reais (18/11/2026): ver README §12 (Gemini 94% de precisão; Groq 80% caso inteiro).

## 9b. Critérios de aceite da Fase 4 (verificados)
- [x] Aporte não aparece em despesas; saldo de origem cai, reserva sobe, patrimônio igual (pgTAP).
- [x] Retirada sem motivo é recusada; retirada maior que o guardado é recusada; retirada que zera é aceita.
- [x] Aporte maior que o restante conclui a meta e celebra; retirada abaixo do alvo reativa.
- [x] Aporte planejado gera previstos idempotentes, confirmáveis, sem criar despesa.
- [x] Projeção: mês atual idêntico à Fase 3; 36 meses à frente; nada gravado; lista do mês futuro mostra as projeções.
- [x] Lista na visão caixa soma o mesmo que o gráfico (verificado em 6 meses/visões e por E2E).
- [x] Família vê metas da família; individual só o dono; estranho não vê nem aporta (pgTAP).
- [x] Cálculos com casos de borda (meta atingida, aporte maior, retirada que zera, prazo passado, prazo no mês
      atual, sem aportes, sobra negativa, juros) em Vitest.
- [x] Guardar em ≤ 3 toques (E2E conta os toques) em desktop e iPhone; sem rolagem horizontal em metas,
      detalhe e planejamento no iPhone 15, iPhone SE e Android.

## 9a. Critérios de aceite da Fase 3 (verificados)
- [x] Totais por competência e por caixa batem no acumulado de um período fechado (pgTAP).
- [x] Mês vazio, só previstos, parcelas cruzando o ano, fatura paga parcialmente e família com vários
      membros testados no banco (42 asserções) e nas regras puras (Vitest).
- [x] Uma família não vê agregados de outra; anônimo não executa as funções.
- [x] Filtros na URL: link compartilhável reabre igual; botão voltar desfaz o último filtro (E2E).
- [x] Clique na categoria abre os lançamentos filtrados (inclui subcategorias).
- [x] Ocultar valores persiste após recarregar; gráficos têm tabela alternativa.
- [x] Sem rolagem horizontal no painel (mês, ano, caixa) no iPhone 15, iPhone SE e Android.
- [x] Lighthouse mobile: acessibilidade 100; desempenho 95 com throttling real (ver README §Desempenho).

## 9. Critérios de aceite da Fase 2 (verificados)
- [x] Lançar despesa em 3 toques (teste E2E conta os toques) no desktop, iPhone 15, iPhone SE e Android.
- [x] Compra no dia do fechamento cai na fatura seguinte; virada de ano e fevereiro testados (pgTAP + Vitest).
- [x] R$ 100 em 3x = 33,34 + 33,33 + 33,33; R$ 10,01 em 2x = 5,01 + 5,00.
- [x] Recorrência rodada duas vezes não duplica; dia 31 → último dia do mês.
- [x] Pagar a fatura muda o status para "Paga" e não cria despesa.
- [x] Membro não exclui transferência de outra pessoa; estranho não vê saldos/faturas/auditoria.
- [x] Categoria em uso só é excluída movendo os lançamentos.
- [x] Excluir lançamento e desfazer.

## 10. Critérios de aceite da Fase 1 (todos verificados)
- [x] Cadastro → e-mail de confirmação (pt-BR) → login automático no painel.
- [x] Login com senha errada mostra "E-mail ou senha incorretos." e mantém o e-mail digitado.
- [x] Recuperação de senha troca a senha e o login com a nova funciona.
- [x] Criar família, gerar convite, aceitar com outra conta e ver a família no seletor.
- [x] Alternar entre individual e família.
- [x] 59 testes de banco (RLS/isolamento) e 42 testes unitários passando.
- [x] Typecheck, lint e build de produção sem erros.
