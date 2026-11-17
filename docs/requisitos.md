# Requisitos e regras de negócio

> Responsável: **Analista de Sistemas/Negócios**. Revisado pelo Arquiteto.
> Status: Fase 0 concluída. Requisitos de fases futuras são o "contrato" que cada fase deve cumprir.

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

### 3.2 Receitas e despesas (F2)
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
| RF-28 | Editar e excluir lançamentos (respeitando papéis, RN-03). |

### 3.3 Dashboard (F3)
| ID | Requisito |
|---|---|
| RF-30 | Visão do mês: receitas, despesas, saldo, quanto foi guardado, faturas abertas. |
| RF-31 | Gráficos: gastos por categoria, evolução mensal, comparação com meses anteriores, progresso das metas. |
| RF-32 | Filtros: período, categoria, membro da família, cartão. |

### 3.4 Metas e projeções (F4)
| ID | Requisito |
|---|---|
| RF-40 | Cadastrar meta (nome, valor-alvo, prazo opcional, ícone/cor). |
| RF-41 | Registrar aportes variáveis (e resgates) por meta. |
| RF-42 | Calcular: (a) valor mensal necessário para atingir no prazo; (b) prazo estimado dado um aporte mensal; considerando renda, despesas fixas e média de gastos variáveis (RN-20…23). |
| RF-43 | Recalcular a projeção a cada aporte. |
| RF-44 | Sugestões da IA ("reduzindo 15% em delivery, você antecipa a viagem em 2 meses"). |

### 3.5 Lançamento por mensagem — IA + WhatsApp/Telegram (F5–F6)
| ID | Requisito |
|---|---|
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
| RNF-04 | Segredos só no servidor (`.env.local` / variáveis da Vercel). Nada de chave secreta no bundle do navegador. |
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
- **RN-13** Fatura paga não recebe novos lançamentos; uma compra que cairia nela vai para a próxima fatura aberta.

### Recorrências
- **RN-14** Geradas mensalmente, uma vez por (recorrência, mês) — garantido por índice único. Ficam como **previstas** (`is_settled = false`) até serem confirmadas.
- **RN-15** Dia 29–31 em meses curtos → último dia do mês.
- **RN-16** Alterar o valor de uma recorrência afeta só os meses **ainda não gerados**.

### Metas e projeções
- **RN-20** Saldo da meta = soma dos aportes (resgates são negativos). Meta atingida quando saldo ≥ alvo.
- **RN-21** Valor mensal necessário = ⌈(alvo − saldo) / meses restantes⌉, com meses restantes ≥ 1.
- **RN-22** Prazo estimado com aporte mensal *A* = ⌈(alvo − saldo) / A⌉ meses.
- **RN-23** Capacidade de poupança sugerida = renda fixa − despesas fixas − média de gastos variáveis dos últimos 3 meses (sem o mês corrente).

### Bot e importação
- **RN-30 (duplicatas)** Hash = SHA-256 de (data, valor em centavos, descrição normalizada sem acentos/espaços extras, conta/cartão, id externo do OFX quando existir). Lançamento com hash existente no espaço é marcado como duplicado e não é importado por padrão.
- **RN-31** O bot só registra com confiança suficiente; senão, pergunta. "Desfazer" apaga apenas o último lançamento **criado pelo bot para aquele usuário** nas últimas 24 h.
- **RN-32** Limite de taxa do bot: 30 mensagens/min e 500/dia por número.

## 6. Fluxo de lançamento em 3 toques (F2)
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

## 9. Critérios de aceite da Fase 1 (todos verificados)
- [x] Cadastro → e-mail de confirmação (pt-BR) → login automático no painel.
- [x] Login com senha errada mostra "E-mail ou senha incorretos." e mantém o e-mail digitado.
- [x] Recuperação de senha troca a senha e o login com a nova funciona.
- [x] Criar família, gerar convite, aceitar com outra conta e ver a família no seletor.
- [x] Alternar entre individual e família.
- [x] 59 testes de banco (RLS/isolamento) e 42 testes unitários passando.
- [x] Typecheck, lint e build de produção sem erros.
