/*
 * Conjunto de avaliação de FOTOS e ÁUDIOS (Fase 6). Tudo SINTÉTICO, sem dados
 * reais: as imagens são HTML desenhado e fotografado pelo Chromium; os áudios,
 * vozes do macOS (`say`, pt-BR) convertidas para OGG/Opus (formato da voz do
 * Telegram). Gerar de novo: `node scripts/generate-media-eval.mjs`.
 * O CPF/CNPJ impressos são FICTÍCIOS e servem para provar que NÃO são extraídos.
 */

export type ReceiptExpect = {
  file: string;
  /** Descrição do que a imagem mostra (para o gerador). */
  kind: "nfce" | "cupom" | "recibo" | "notificacao_cartao" | "comprovante_pix" | "fatura" | "nao_comprovante" | "ilegivel";
  isReceipt: boolean;
  legible?: boolean;
  merchantIncludes?: string;
  totalCents?: number;
  date?: string;
  payment?: "pix" | "debit" | "credit" | "cash";
  cardLast4?: string;
  minItems?: number;
  /** Texto que NUNCA pode aparecer na extração (CPF/CNPJ fictícios impressos). */
  forbidden?: string[];
};

export const RECEIPTS: ReceiptExpect[] = [
  { file: "01-nfce-mercado-farmacia.png", kind: "nfce", isReceipt: true, merchantIncludes: "bom preço", totalCents: 18734, date: "2026-11-14", payment: "debit", minItems: 6, forbidden: ["123.456.789-09", "12.345.678/0001-90", "12345678909"] },
  { file: "02-cupom-restaurante.png", kind: "cupom", isReceipt: true, merchantIncludes: "cantina", totalCents: 14630, date: "2026-11-15", payment: "credit", minItems: 3 },
  { file: "03-notificacao-nubank.png", kind: "notificacao_cartao", isReceipt: true, merchantIncludes: "posto", totalCents: 21050, payment: "credit", cardLast4: "4821" },
  { file: "04-comprovante-pix.png", kind: "comprovante_pix", isReceipt: true, merchantIncludes: "maria", totalCents: 8000, date: "2026-11-16", payment: "pix", forbidden: ["987.654.321-00", "maria.silva@email.com"] },
  { file: "05-recibo-diarista.png", kind: "recibo", isReceipt: true, totalCents: 18000, date: "2026-11-13", payment: "cash" },
  { file: "06-fatura-print.png", kind: "fatura", isReceipt: true, totalCents: 245690, payment: "credit", cardLast4: "7310" },
  { file: "07-cupom-padaria-desconto.png", kind: "cupom", isReceipt: true, merchantIncludes: "padaria", totalCents: 2340, date: "2026-11-17", minItems: 3 },
  { file: "08-notificacao-inter.png", kind: "notificacao_cartao", isReceipt: true, merchantIncludes: "ifood", totalCents: 6790, payment: "credit", cardLast4: "1029" },
  { file: "09-paisagem.png", kind: "nao_comprovante", isReceipt: false },
  { file: "10-cupom-borrado.png", kind: "ilegivel", isReceipt: true, legible: false },
];

export type AudioExpect = {
  file: string;
  text: string;
  voice: string;
  /** Palavras que a transcrição precisa conter (sem acento, minúsculas). */
  mustContain: string[];
  intent: string;
  amountCents?: number;
};

export const AUDIOS: AudioExpect[] = [
  { file: "01.ogg", voice: "Luciana", text: "gastei cinquentinha no uber", mustContain: ["uber"], intent: "registrar_despesa", amountCents: 5000 },
  { file: "02.ogg", voice: "Eddy", text: "caiu mil do freela", mustContain: ["mil", "freela"], intent: "registrar_receita", amountCents: 100000 },
  { file: "03.ogg", voice: "Flo", text: "paguei oitenta e cinco reais no mercado ontem", mustContain: ["mercado"], intent: "registrar_despesa", amountCents: 8500 },
  { file: "04.ogg", voice: "Reed", text: "guardei trezentos pra viagem", mustContain: ["viagem"], intent: "guardar_em_meta", amountCents: 30000 },
  { file: "05.ogg", voice: "Luciana", text: "quanto eu gastei com mercado esse mês", mustContain: ["mercado"], intent: "consultar" },
  { file: "06.ogg", voice: "Sandy", text: "comprei uma geladeira de três mil em dez vezes no nubank", mustContain: ["geladeira"], intent: "registrar_compra_parcelada", amountCents: 300000 },
  { file: "07.ogg", voice: "Rocko", text: "almoço trinta e dois e cinquenta", mustContain: ["almoco"], intent: "registrar_despesa", amountCents: 3250 },
  { file: "08.ogg", voice: "Shelley", text: "paguei a conta de luz", mustContain: ["luz"], intent: "confirmar_previsto" },
  { file: "09.ogg", voice: "Eddy", text: "recebi duzentos de reembolso da empresa", mustContain: ["reembolso"], intent: "registrar_receita", amountCents: 20000 },
  { file: "10.ogg", voice: "Flo", text: "desfazer", mustContain: ["desfaz"], intent: "desfazer_ultimo" },
  { file: "11.ogg", voice: "Grandpa", text: "gastei vinte conto de pão na padaria", mustContain: ["padaria"], intent: "registrar_despesa", amountCents: 2000 },
  { file: "12.ogg", voice: "Luciana", text: "dei quarenta pro flanelinha", mustContain: ["flanelinha"], intent: "registrar_despesa", amountCents: 4000 },
];
