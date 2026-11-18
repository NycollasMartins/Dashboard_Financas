import type { Intent, NameContext, Payment, QueryTopic } from "../types";

/*
 * CONJUNTO DE AVALIAÇÃO do assistente (Fase 5): mensagens como gente de
 * verdade escreve (gíria, erro de digitação, sem acento, áudio transcrito)
 * com a saída esperada. Hoje fixo = terça 17/11/2026. Nomes = seed.
 * Só os campos informados são conferidos.
 */

export const EVAL_TODAY = "2026-11-17" as const;

export const EVAL_CONTEXT: NameContext = {
  categories: [
    ...["Moradia", "Mercado", "Restaurantes e delivery", "Transporte", "Contas e serviços", "Assinaturas", "Saúde", "Educação",
      "Lazer", "Compras", "Cuidados pessoais", "Pets", "Viagem", "Presentes e doações", "Impostos e taxas", "Outros"].map((name) => ({ name, kind: "expense" as const })),
    ...["Salário", "Freelance", "Presentes", "Rendimentos", "Reembolsos", "Outras receitas"].map((name) => ({ name, kind: "income" as const })),
  ],
  accounts: ["Conta Nubank", "Carteira", "Poupança"],
  cards: ["Nubank", "Inter"],
  goals: ["Carro", "Viagem", "Reserva de emergência"],
};

export type Expect = {
  intent: Intent | Intent[];
  amount?: number | number[];
  category?: string;
  payment?: Payment;
  card?: string;
  account?: string;
  toAccount?: string;
  goal?: string;
  installments?: number;
  date?: string;
  topic?: QueryTopic;
  workspace?: "familia" | "individual";
};

const D = "registrar_despesa" as const;
const R = "registrar_receita" as const;
const P = "registrar_compra_parcelada" as const;

export const DATASET: [string, Expect][] = [
  // ---------------- Despesas simples ----------------
  ["gastei 50 no uber", { intent: D, amount: 50, category: "Transporte" }],
  ["100 mercado", { intent: D, amount: 100, category: "Mercado" }],
  ["gastei 45,90 no ifood", { intent: D, amount: 45.9, category: "Restaurantes e delivery" }],
  ["paguei 120 de luz", { intent: D, amount: 120, category: "Contas e serviços" }],
  ["comprei pão 12 reais", { intent: D, amount: 12, category: "Mercado" }],
  ["uber 23,50", { intent: D, amount: 23.5, category: "Transporte" }],
  ["gatei 30 no uber", { intent: D, amount: 30, category: "Transporte" }],
  ["gastei 50 conto de gasolina", { intent: D, amount: 50, category: "Transporte" }],
  ["abasteci 200", { intent: D, amount: 200, category: "Transporte" }],
  ["farmacia 37,80", { intent: D, amount: 37.8, category: "Saúde" }],
  ["paguei a academia 99,90", { intent: D, amount: 99.9, category: "Saúde" }],
  ["gastei R$ 1.234,56 no aluguel", { intent: D, amount: 1234.56, category: "Moradia" }],
  ["pizza 70", { intent: D, amount: 70, category: "Restaurantes e delivery" }],
  ["torrei 300 na balada", { intent: D, amount: 300, category: "Lazer" }],
  ["cinema 60 reais", { intent: D, amount: 60, category: "Lazer" }],
  ["netflix 55,90", { intent: D, amount: 55.9, category: "Assinaturas" }],
  ["gastei 15 no cafe", { intent: D, amount: 15, category: "Restaurantes e delivery" }],
  ["almocei 32", { intent: D, amount: 32, category: "Restaurantes e delivery" }],
  ["jantar 180 com a familia", { intent: D, amount: 180, category: "Restaurantes e delivery" }],
  ["ração do dog 150", { intent: D, amount: 150, category: "Pets" }],
  ["veterinario 280", { intent: D, amount: 280, category: "Pets" }],
  ["cortei o cabelo 50", { intent: D, amount: 50, category: "Cuidados pessoais" }],
  ["barbeiro 45", { intent: D, amount: 45, category: "Cuidados pessoais" }],
  ["comprei um tenis de 400", { intent: D, amount: 400, category: "Compras" }],
  ["shopee 89,90", { intent: D, amount: 89.9, category: "Compras" }],
  ["internet 119,90", { intent: D, amount: 119.9, category: "Contas e serviços" }],
  ["conta de agua 85", { intent: D, amount: 85, category: "Contas e serviços" }],
  ["paguei o condominio 650", { intent: D, amount: 650, category: "Moradia" }],
  ["ipva 1.890,00", { intent: D, amount: 1890, category: "Impostos e taxas" }],
  ["multa de 195,23", { intent: D, amount: 195.23, category: "Impostos e taxas" }],
  ["curso de ingles 350", { intent: D, amount: 350, category: "Educação" }],
  ["livro 59", { intent: D, amount: 59, category: "Educação" }],
  ["presente da minha mae 120", { intent: D, amount: 120, category: "Presentes e doações" }],
  ["hotel 450", { intent: D, amount: 450, category: "Viagem" }],
  ["estacionamento 25", { intent: D, amount: 25, category: "Transporte" }],
  ["pedagio 12,40", { intent: D, amount: 12.4, category: "Transporte" }],
  ["onibus 4,40", { intent: D, amount: 4.4, category: "Transporte" }],
  ["99 pra casa 18", { intent: D, amount: 18, category: "Transporte" }],
  ["lanche 25", { intent: D, amount: 25, category: "Restaurantes e delivery" }],
  ["acai 22", { intent: D, amount: 22, category: "Restaurantes e delivery" }],
  ["feira 65", { intent: D, amount: 65, category: "Mercado" }],
  ["acougue 98,50", { intent: D, amount: 98.5, category: "Mercado" }],
  ["supermercado 412,37", { intent: D, amount: 412.37, category: "Mercado" }],
  ["remedio 43", { intent: D, amount: 43, category: "Saúde" }],
  ["consulta medica 300", { intent: D, amount: 300, category: "Saúde" }],
  ["dentista 250", { intent: D, amount: 250, category: "Saúde" }],
  ["spotify 21,90", { intent: D, amount: 21.9, category: "Assinaturas" }],
  ["cerveja 40", { intent: D, amount: 40, category: "Lazer" }],
  ["show 180", { intent: D, amount: 180, category: "Lazer" }],
  ["diarista 160", { intent: D, amount: 160, category: "Moradia" }],
  // Valores em formatos variados
  ["gastei cinquenta reais de gasolina", { intent: D, amount: 50, category: "Transporte" }],
  ["paguei mil e duzentos de aluguel", { intent: D, amount: 1200, category: "Moradia" }],
  ["gastei 1k no mercado", { intent: D, amount: 1000, category: "Mercado" }],
  ["comprei uma geladeira de 2 mil", { intent: D, amount: 2000, category: "Compras" }],
  ["gastei 30 pila no bar", { intent: D, amount: 30, category: "Lazer" }],
  ["gastei 50.90 no mercado", { intent: D, amount: 50.9, category: "Mercado" }],
  ["cento e vinte no mercado", { intent: D, amount: 120, category: "Mercado" }],
  ["mercado R$412", { intent: D, amount: 412, category: "Mercado" }],
  // Datas
  ["ontem gastei 40 no uber", { intent: D, amount: 40, category: "Transporte", date: "2026-11-16" }],
  ["gastei 80 no mercado anteontem", { intent: D, amount: 80, category: "Mercado", date: "2026-11-15" }],
  ["dia 5 paguei 2800 de aluguel", { intent: D, amount: 2800, category: "Moradia", date: "2026-11-05" }],
  ["sexta passada gastei 150 no bar", { intent: D, amount: 150, category: "Lazer", date: "2026-11-13" }],
  ["no sabado fui no cinema 70", { intent: D, amount: 70, category: "Lazer", date: "2026-11-14" }],
  ["gastei 33 de uber em 10/11", { intent: D, amount: 33, category: "Transporte", date: "2026-11-10" }],
  ["hoje 25 de lanche", { intent: D, amount: 25, category: "Restaurantes e delivery", date: "2026-11-17" }],
  // Forma de pagamento / cartão / conta
  ["gastei 100 no mercado no debito", { intent: D, amount: 100, category: "Mercado", payment: "debit" }],
  ["mercado 200 no credito do inter", { intent: D, amount: 200, category: "Mercado", payment: "credit", card: "Inter" }],
  ["uber 30 no cartao inter", { intent: D, amount: 30, category: "Transporte", payment: "credit", card: "Inter" }],
  ["paguei 50 no pix de mercado", { intent: D, amount: 50, category: "Mercado", payment: "pix" }],
  ["padaria 15 em dinheiro", { intent: D, amount: 15, category: "Mercado", payment: "cash" }],
  ["boleto da internet 119,90", { intent: D, amount: 119.9, category: "Contas e serviços", payment: "boleto" }],
  ["gastei 60 na farmacia no credito do nubank", { intent: D, amount: 60, category: "Saúde", payment: "credit", card: "Nubank" }],
  ["gastei 20 de lanche na carteira", { intent: D, amount: 20, category: "Restaurantes e delivery", account: "Carteira" }],
  ["ifood 54 no inter", { intent: D, amount: 54, category: "Restaurantes e delivery", card: "Inter" }],
  // Sem acento / erros / áudio transcrito
  ["gaste 40 reais no ubber", { intent: D, amount: 40, category: "Transporte" }],
  ["comprie remedio na farmasia 30", { intent: D, amount: 30, category: "Saúde" }],
  ["paguei vinte e cinco reais no estacionamento", { intent: D, amount: 25, category: "Transporte" }],
  ["entao eu gastei tipo uns 90 reais no mercado hoje", { intent: D, amount: 90, category: "Mercado", date: "2026-11-17" }],
  ["oi assistente gastei 35 no ifod", { intent: D, amount: 35, category: "Restaurantes e delivery" }],
  ["foi 48 o uber", { intent: D, amount: 48, category: "Transporte" }],
  ["deu 230 a feira e o acougue", { intent: D, amount: 230, category: "Mercado" }],
  ["pedi um mc donalds de 42", { intent: D, amount: 42, category: "Restaurantes e delivery" }],
  ["tomei uma breja de 18", { intent: D, amount: 18, category: "Lazer" }],
  // ---------------- Receitas ----------------
  ["ganhei 1000 freela", { intent: R, amount: 1000, category: "Freelance" }],
  ["recebi o salario 6500", { intent: R, amount: 6500, category: "Salário" }],
  ["caiu o salario de 4.800", { intent: R, amount: 4800, category: "Salário" }],
  ["recebi 1k de freela", { intent: R, amount: 1000, category: "Freelance" }],
  ["ganhei 200 de presente da vó", { intent: R, amount: 200, category: "Presentes" }],
  ["vendi a bike por 800", { intent: R, amount: 800, category: "Outras receitas" }],
  ["recebi reembolso de 150", { intent: R, amount: 150, category: "Reembolsos" }],
  ["rendeu 32,50 na poupança", { intent: R, amount: 32.5, category: "Rendimentos" }],
  ["entrou 3 mil de bonus", { intent: R, amount: 3000, category: "Outras receitas" }],
  ["recebi 13o 3250", { intent: R, amount: 3250, category: "Salário" }],
  ["fiz um bico e ganhei 300", { intent: R, amount: 300, category: "Freelance" }],
  ["me pagaram 450 do job", { intent: R, amount: 450, category: "Freelance" }],
  ["recebi 500 no pix do freela", { intent: R, amount: 500, category: "Freelance", payment: "pix" }],
  ["ganhei mil e quinhentos de extra", { intent: R, amount: 1500, category: "Outras receitas" }],
  ["resebi 250 de freela", { intent: R, amount: 250, category: "Freelance" }],
  // ---------------- Parceladas ----------------
  ["comprei uma tv de 3000 em 10x no nubank", { intent: P, amount: 3000, installments: 10, card: "Nubank", payment: "credit", category: "Compras" }],
  ["celular novo 2400 em 12x no inter", { intent: P, amount: 2400, installments: 12, card: "Inter", category: "Compras" }],
  ["comprei um sofa de 3.600 em 6 vezes", { intent: P, amount: 3600, installments: 6, payment: "credit", category: "Compras" }],
  ["passagem aerea 1800 em 3x", { intent: P, amount: 1800, installments: 3, category: "Viagem" }],
  ["notebook 4500 parcelado em 10 parcelas no nubank", { intent: P, amount: 4500, installments: 10, card: "Nubank" }],
  ["geladeira 2.999,90 10x inter", { intent: P, amount: 2999.9, installments: 10, card: "Inter" }],
  ["parcelei o curso 1200 em 4x", { intent: P, amount: 1200, installments: 4, category: "Educação" }],
  ["comprei roupa 300 em 2x no cartao", { intent: P, amount: 300, installments: 2, payment: "credit", category: "Compras" }],
  // ---------------- Metas ----------------
  ["guardei 300 viagem", { intent: "guardar_em_meta", amount: 300, goal: "Viagem" }],
  ["guardei 500 pro carro", { intent: "guardar_em_meta", amount: 500, goal: "Carro" }],
  ["coloquei 200 na reserva", { intent: "guardar_em_meta", amount: 200, goal: "Reserva de emergência" }],
  ["separei 150 pra viagem", { intent: "guardar_em_meta", amount: 150, goal: "Viagem" }],
  ["guardei mil na reserva de emergencia", { intent: "guardar_em_meta", amount: 1000, goal: "Reserva de emergência" }],
  ["gardei 100 pra viajem", { intent: "guardar_em_meta", amount: 100, goal: "Viagem" }],
  ["juntei 250 pro carro hoje", { intent: "guardar_em_meta", amount: 250, goal: "Carro", date: "2026-11-17" }],
  ["poupei 80 pra viagem", { intent: "guardar_em_meta", amount: 80, goal: "Viagem" }],
  ["tirei 200 da reserva", { intent: "retirar_de_meta", amount: 200, goal: "Reserva de emergência" }],
  ["retirei 500 da meta do carro pra pagar o mecanico", { intent: "retirar_de_meta", amount: 500, goal: "Carro" }],
  ["usei 300 da viagem", { intent: "retirar_de_meta", amount: 300, goal: "Viagem" }],
  ["resgatei 1000 da reserva de emergencia", { intent: "retirar_de_meta", amount: 1000, goal: "Reserva de emergência" }],
  // ---------------- Transferências ----------------
  ["transferi 500 da conta nubank pra poupança", { intent: "transferir", amount: 500, account: "Conta Nubank", toAccount: "Poupança" }],
  ["passei 200 da poupança pra carteira", { intent: "transferir", amount: 200, account: "Poupança", toAccount: "Carteira" }],
  ["transfere 100 da carteira para conta nubank", { intent: "transferir", amount: 100, account: "Carteira", toAccount: "Conta Nubank" }],
  ["mandei 1000 da conta nubank pra poupanca", { intent: "transferir", amount: 1000, account: "Conta Nubank", toAccount: "Poupança" }],
  // ---------------- Confirmar previsto ----------------
  ["paguei o aluguel", { intent: "confirmar_previsto" }],
  ["paguei a luz", { intent: "confirmar_previsto" }],
  ["ja paguei a internet", { intent: "confirmar_previsto" }],
  ["recebi o salario", { intent: "confirmar_previsto" }],
  ["caiu o salario", { intent: "confirmar_previsto" }],
  ["paguei a academia", { intent: "confirmar_previsto" }],
  // ---------------- Consultas ----------------
  ["quanto gastei com mercado?", { intent: "consultar", topic: "gastos", category: "Mercado" }],
  ["quanto eu gastei esse mes", { intent: "consultar", topic: "gastos" }],
  ["quanto gastei de uber mes passado", { intent: "consultar", topic: "gastos", category: "Transporte" }],
  ["qual meu saldo", { intent: "consultar", topic: "saldo" }],
  ["saldo", { intent: "consultar", topic: "saldo" }],
  ["quanto tenho na conta", { intent: "consultar", topic: "saldo" }],
  ["qual a fatura do nubank", { intent: "consultar", topic: "fatura", card: "Nubank" }],
  ["fatura do inter?", { intent: "consultar", topic: "fatura", card: "Inter" }],
  ["como ta a meta do carro", { intent: "consultar", topic: "meta", goal: "Carro" }],
  ["quanto falta pra viagem", { intent: "consultar", topic: "meta", goal: "Viagem" }],
  ["quanto falta guardar esse mes", { intent: "consultar", topic: "falta_guardar" }],
  ["quanto preciso guardar no mes?", { intent: "consultar", topic: "falta_guardar" }],
  ["quanto eu ganhei esse mes", { intent: "consultar", topic: "receitas" }],
  ["quanto gastei com ifood semana passada", { intent: "consultar", topic: "gastos", category: "Restaurantes e delivery" }],
  ["me mostra o resumo do mes", { intent: "consultar", topic: "resumo" }],
  ["quanto ja gastei em restaurante", { intent: "consultar", topic: "gastos", category: "Restaurantes e delivery" }],
  ["gastos com transporte em outubro", { intent: "consultar", topic: "gastos", category: "Transporte" }],
  ["como estao minhas metas", { intent: "consultar", topic: "meta" }],
  // ---------------- Desfazer / ajuda ----------------
  ["desfazer", { intent: "desfazer_ultimo" }],
  ["desfaz o ultimo", { intent: "desfazer_ultimo" }],
  ["apaga o ultimo lancamento", { intent: "desfazer_ultimo" }],
  ["errei, cancela o ultimo", { intent: "desfazer_ultimo" }],
  ["ajuda", { intent: "ajuda" }],
  ["o que voce faz?", { intent: "ajuda" }],
  ["oi", { intent: "ajuda" }],
  ["como funciona", { intent: "ajuda" }],
  // ---------------- Vários lançamentos ----------------
  ["gastei 30 no uber e 80 no mercado", { intent: [D, D], amount: [30, 80] }],
  ["uber 20, ifood 45 e farmacia 30", { intent: [D, D, D], amount: [20, 45, 30] }],
  ["paguei 120 de luz e 90 de agua", { intent: [D, D], amount: [120, 90] }],
  ["mercado 200 mais padaria 15", { intent: [D, D], amount: [200, 15] }],
  // ---------------- Espaço ----------------
  ["gastei 100 no mercado na familia", { intent: D, amount: 100, category: "Mercado", workspace: "familia" }],
  ["uber 25 no meu individual", { intent: D, amount: 25, category: "Transporte", workspace: "individual" }],
  ["guardei 300 pra viagem da familia", { intent: "guardar_em_meta", amount: 300, goal: "Viagem", workspace: "familia" }],
  // ---------------- Difíceis (esperado: o local não ter confiança → IA) ----------------
  ["paguei a padaria do zé 23", { intent: D, amount: 23, category: "Mercado" }],
  ["dei 50 pro flanelinha", { intent: D, amount: 50 }],
  ["coisinha de 12 reais na lojinha", { intent: D, amount: 12 }],
  ["fui no rodizio japones e deu 189 pra dois", { intent: D, amount: 189 }],
  ["paguei a mensalidade da escola do pedro 980", { intent: D, amount: 980, category: "Educação" }],
  ["comprei umas plantas 85", { intent: D, amount: 85 }],
  ["paguei o seguro do carro 2100", { intent: D, amount: 2100 }],
  ["paguei 40 na lavagem do carro", { intent: D, amount: 40 }],
  // Fase 6 — fala transcrita (áudio): diminutivos e "reais e centavos" falados.
  ["gastei cinquentinha no uber", { intent: D, amount: 50, category: "Transporte" }],
  ["almoço 32 e 50", { intent: D, amount: 32.5, category: "Restaurantes e delivery" }],
  ["um vintinho de lanche", { intent: D, amount: 20 }],
  ["paguei 12 e 90 na farmácia", { intent: D, amount: 12.9, category: "Saúde" }],
];

/*
 * HOLDOUT: 40 mensagens escritas DEPOIS do parser pronto e NÃO usadas para
 * ajustá-lo. É a medida mais honesta da camada local (o conjunto principal
 * tem viés: foi escrito junto com o parser).
 */
export const HOLDOUT: [string, Expect][] = [
  ["botei 70 de gasolina no carro", { intent: D, amount: 70, category: "Transporte" }],
  ["mandei 25 pro motoboy", { intent: D, amount: 25 }],
  ["paguei 89 na conta do celular", { intent: D, amount: 89, category: "Contas e serviços" }],
  ["comprei remedio pra gripe 34,90", { intent: D, amount: 34.9, category: "Saúde" }],
  ["saiu 210 o mercado hoje", { intent: D, amount: 210, category: "Mercado", date: "2026-11-17" }],
  ["gastei uns 60 conto no boteco ontem", { intent: D, amount: 60, category: "Lazer", date: "2026-11-16" }],
  ["uber pro trabalho 19,80", { intent: D, amount: 19.8, category: "Transporte" }],
  ["pizza de sexta 85 reais", { intent: D, amount: 85, category: "Restaurantes e delivery" }],
  ["netflix e spotify 77,80", { intent: D, amount: 77.8, category: "Assinaturas" }],
  ["mensalidade da academia 120 no debito", { intent: D, amount: 120, category: "Saúde", payment: "debit" }],
  ["comprei uma camiseta de 59 no credito", { intent: D, amount: 59, payment: "credit" }],
  ["ifood ontem 62", { intent: D, amount: 62, category: "Restaurantes e delivery", date: "2026-11-16" }],
  ["peguei um 99 de 27", { intent: D, amount: 27, category: "Transporte" }],
  ["corte de cabelo 40 no pix", { intent: D, amount: 40, category: "Cuidados pessoais", payment: "pix" }],
  ["dois mil de aluguel", { intent: D, amount: 2000, category: "Moradia" }],
  ["recebi 350 de um freela de design", { intent: R, amount: 350, category: "Freelance" }],
  ["minha vó me deu 100", { intent: R, amount: 100 }],
  ["caiu 5.200 de salario hoje", { intent: R, amount: 5200, category: "Salário" }],
  ["vendi um fone usado por 120", { intent: R, amount: 120, category: "Outras receitas" }],
  ["devolveram 49,90 da compra", { intent: R, amount: 49.9 }],
  ["comprei um ar condicionado 2.800 em 12 vezes no inter", { intent: P, amount: 2800, installments: 12, card: "Inter" }],
  ["parcelei a passagem em 5x de 400", { intent: P, installments: 5 }],
  ["celular 1.999 6x nubank", { intent: P, amount: 1999, installments: 6, card: "Nubank" }],
  ["guarda 200 na viagem", { intent: "guardar_em_meta", amount: 200, goal: "Viagem" }],
  ["reservei 400 pro carro esse mes", { intent: "guardar_em_meta", amount: 400, goal: "Carro" }],
  ["tirei 150 da viagem pra pagar o hotel", { intent: "retirar_de_meta", amount: 150, goal: "Viagem" }],
  ["passa 300 da poupança pra conta nubank", { intent: "transferir", amount: 300, account: "Poupança", toAccount: "Conta Nubank" }],
  ["ja paguei o condominio", { intent: "confirmar_previsto" }],
  ["recebi o freela que tava previsto", { intent: "confirmar_previsto" }],
  ["quanto foi o mercado esse mes?", { intent: "consultar", topic: "gastos", category: "Mercado" }],
  ["quanto eu gastei ontem", { intent: "consultar", topic: "gastos" }],
  ["tenho quanto na poupança?", { intent: "consultar", topic: "saldo" }],
  ["quanto ta a fatura do inter", { intent: "consultar", topic: "fatura", card: "Inter" }],
  ["quanto falta pro carro", { intent: "consultar", topic: "meta", goal: "Carro" }],
  ["resumo", { intent: "consultar", topic: "resumo" }],
  ["apaga isso", { intent: "desfazer_ultimo" }],
  ["volta o ultimo", { intent: "desfazer_ultimo" }],
  ["me ajuda", { intent: "ajuda" }],
  ["uber 18 e padaria 9", { intent: [D, D], amount: [18, 9] }],
  ["gastei 40 de luz 60 de agua e 120 de internet", { intent: [D, D, D], amount: [40, 60, 120] }],
];
