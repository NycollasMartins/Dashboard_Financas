#!/usr/bin/env node
/**
 * Gera o conjunto SINTÉTICO de avaliação de fotos e áudios (Fase 6):
 *   src/lib/assistant/eval/media/receipts/*.png  (Chromium do Playwright)
 *   src/lib/assistant/eval/media/audio/*.ogg     (macOS `say` pt-BR + ffmpeg → OGG/Opus, como o Telegram)
 * Nada é real: lojas, pessoas, CPF/CNPJ são fictícios.
 * Uso: node scripts/generate-media-eval.mjs   (áudio só no macOS com ffmpeg)
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { AUDIOS } from "../src/lib/assistant/eval/media-dataset.ts";

const OUT = "src/lib/assistant/eval/media";
mkdirSync(`${OUT}/receipts`, { recursive: true });
mkdirSync(`${OUT}/audio`, { recursive: true });

const paper = (inner, { rotate = -1.5, blur = 0, width = 330 } = {}) => `
<body style="margin:0;width:640px;height:900px;display:grid;place-items:center;background:linear-gradient(135deg,#7a6650,#5c4a38)">
  <div style="width:${width}px;background:#fbfaf6;padding:22px 20px;transform:rotate(${rotate}deg);box-shadow:0 18px 40px rgba(0,0,0,.45);
    font:13px/1.45 'Courier New',monospace;color:#222;filter:blur(${blur}px)">${inner}</div></body>`;
const line = (l, r) => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${l}</span><span>${r}</span></div>`;
const hr = `<div style="border-top:1px dashed #888;margin:8px 0"></div>`;
const center = (t, extra = "") => `<div style="text-align:center;${extra}">${t}</div>`;

const nfce = paper(`
  ${center("<b>SUPERMERCADO BOM PREÇO LTDA</b>")}
  ${center("CNPJ 12.345.678/0001-90")}
  ${center("Av. das Palmeiras, 1000 - São Paulo/SP")}
  ${hr}${center("DOCUMENTO AUXILIAR DA NOTA FISCAL<br>DE CONSUMIDOR ELETRÔNICA")}${hr}
  ${line("ARROZ TIPO 1 5KG", "28,90")}${line("FEIJAO CARIOCA 1KG", "8,49")}${line("LEITE INTEGRAL 6UN", "34,74")}
  ${line("FRANGO CONGELADO 1KG", "23,90")}${line("DETERGENTE 500ML", "2,49")}${line("CAFE 500G", "16,52")}
  ${line("DIPIRONA 500MG 10CP", "12,50")}${line("PROTETOR SOLAR FPS50", "49,90")}${line("CREME DENTAL 90G", "9,90")}
  ${hr}${line("QTD. TOTAL DE ITENS", "9")}${line("<b>VALOR TOTAL R$</b>", "<b>187,34</b>")}
  ${line("FORMA DE PAGAMENTO", "")}${line("Cartão de Débito", "187,34")}${hr}
  ${center("CONSUMIDOR CPF: 123.456.789-09")}
  ${center("NFC-e nº 004512 Série 001<br>Emissão: 14/11/2026 18:42:07")}
  ${center("Chave de acesso:<br>3526 1112 3456 7800 0190 6500 1000 0045 1210 0012 3456", "font-size:11px")}`);

const cantina = paper(`
  ${center("<b>CANTINA DA NONNA</b><br>Restaurante e Pizzaria")}${hr}
  ${center("CUPOM NÃO FISCAL - MESA 12")}${hr}
  ${line("1 LASANHA BOLONHESA", "58,00")}${line("1 SPAGHETTI CARBONARA", "49,90")}${line("1 TACA VINHO TINTO", "25,10")}
  ${hr}${line("SUBTOTAL", "133,00")}${line("TAXA DE SERVIÇO 10%", "13,30")}${line("<b>TOTAL</b>", "<b>146,30</b>")}
  ${line("PAGAMENTO: CRÉDITO", "146,30")}${hr}${center("15/11/2026 21:17 · Obrigado e volte sempre!")}`, { rotate: 1.2 });

const phone = (inner) => `
<body style="margin:0;width:430px;height:932px;background:radial-gradient(circle at 30% 20%,#3a4e8c,#141a33);font-family:-apple-system,Helvetica,Arial;color:#fff">
  <div style="text-align:center;padding-top:60px;font-size:82px;font-weight:300">10:24</div>
  <div style="text-align:center;font-size:18px;opacity:.85">segunda-feira, 17 de novembro</div>
  <div style="margin:40px 14px 0;padding:14px 16px;border-radius:22px;background:rgba(245,245,250,.82);color:#111">${inner}</div></body>`;
const nubank = phone(`<div style="display:flex;gap:10px;align-items:center;font-size:13px;color:#555">
  <span style="width:22px;height:22px;border-radius:6px;background:#820ad1;display:inline-block"></span> NUBANK <span style="margin-left:auto">agora</span></div>
  <div style="font-weight:600;font-size:15px;margin-top:6px">Compra aprovada</div>
  <div style="font-size:15px">Compra de R$ 210,50 APROVADA em POSTO SHELL AV PAULISTA para o cartão com final 4821.</div>`);
const inter = phone(`<div style="display:flex;gap:10px;align-items:center;font-size:13px;color:#555">
  <span style="width:22px;height:22px;border-radius:6px;background:#ff7a00;display:inline-block"></span> INTER <span style="margin-left:auto">há 2 min</span></div>
  <div style="font-weight:600;font-size:15px;margin-top:6px">Compra no crédito</div>
  <div style="font-size:15px">Você fez uma compra de R$ 67,90 em IFOOD *RESTAURANTE SABOR no cartão final 1029.</div>`);

const pix = `
<body style="margin:0;width:430px;height:932px;background:#f4f6f8;font-family:Helvetica,Arial;color:#1d2433">
  <div style="background:#00a868;color:#fff;padding:40px 22px 26px"><div style="font-size:14px;opacity:.9">Banco Exemplo</div>
  <div style="font-size:24px;font-weight:700;margin-top:8px">Comprovante de transferência Pix</div></div>
  <div style="padding:22px;display:grid;gap:14px;font-size:15px">
    <div><div style="color:#677">Valor</div><div style="font-size:30px;font-weight:700">R$ 80,00</div></div>
    <div><div style="color:#677">Data e hora</div>16/11/2026 às 09:12</div>
    <div><div style="color:#677">Para</div><b>Maria Silva</b><br>CPF 987.654.321-00<br>Chave: maria.silva@email.com<br>Instituição: Banco Fictício S.A.</div>
    <div><div style="color:#677">De</div>Conta corrente · Banco Exemplo</div>
    <div><div style="color:#677">ID da transação</div><span style="font-size:12px">E1234567820261116091200000000001</span></div>
  </div></body>`;

const recibo = paper(`
  <div style="font:22px/1.5 'Comic Sans MS','Marker Felt',cursive;color:#203070">
  <div style="text-align:center;font-size:28px"><u>RECIBO</u></div><br>
  Recebi a quantia de <b>R$ 180,00</b> (cento e oitenta reais), em dinheiro, referente à faxina do apartamento.<br><br>
  São Paulo, 13/11/2026<br><br><div style="text-align:right">_____________<br>Joana (diarista)</div></div>`, { rotate: 2, width: 420 });

const fatura = `
<body style="margin:0;width:430px;height:932px;background:#111318;font-family:Helvetica,Arial;color:#f2f3f7">
  <div style="padding:50px 22px 10px;font-size:15px;color:#9aa">‹  Cartão final 7310</div>
  <div style="padding:10px 22px"><div style="font-size:16px;color:#9aa">Fatura de novembro · Fechada</div>
  <div style="font-size:40px;font-weight:700;margin:6px 0">R$ 2.456,90</div>
  <div style="font-size:15px">Vencimento 10/12/2026</div>
  <div style="margin-top:22px;padding:14px;border-radius:14px;background:#1d2029;font-size:14px;line-height:1.9">
  Supermercado ........ R$ 812,40<br>Posto de combustível ...... R$ 420,00<br>Restaurantes .......... R$ 356,50<br>Assinaturas ............ R$ 89,80<br>Outros ............... R$ 778,20</div>
  <div style="margin-top:22px;padding:14px;border-radius:14px;background:#7c5cdb;text-align:center;font-weight:600">Pagar fatura</div></div></body>`;

const padaria = paper(`
  ${center("<b>PADARIA PÃO DOURADO</b>")}${hr}
  ${line("PAO FRANCES 10UN", "8,90")}${line("CAFE COM LEITE", "7,50")}${line("PAO DE QUEIJO 4UN", "8,00")}
  ${line("DESCONTO CLUBE", "-1,00")}${hr}${line("<b>TOTAL R$</b>", "<b>23,40</b>")}${line("PIX", "23,40")}${hr}${center("17/11/2026 07:48")}`, { rotate: -3 });

const paisagem = `<body style="margin:0;width:640px;height:900px;background:linear-gradient(#7fb8f0,#cfe8ff 55%,#3f7d4a 55%,#2b5c34)">
  <div style="position:absolute;left:80px;top:300px;width:0;height:0;border-left:180px solid transparent;border-right:180px solid transparent;border-bottom:220px solid #6b7c8f"></div>
  <div style="position:absolute;left:300px;top:340px;width:0;height:0;border-left:160px solid transparent;border-right:160px solid transparent;border-bottom:180px solid #58697c"></div>
  <div style="position:absolute;left:470px;top:90px;width:90px;height:90px;border-radius:50%;background:#ffe27a"></div></body>`;

const borrado = paper(nfce.replace(/<body[^>]*>|<\/body>/g, ""), { blur: 7, rotate: 4 });

const RECEIPT_HTML = {
  "01-nfce-mercado-farmacia.png": nfce, "02-cupom-restaurante.png": cantina, "03-notificacao-nubank.png": nubank,
  "04-comprovante-pix.png": pix, "05-recibo-diarista.png": recibo, "06-fatura-print.png": fatura,
  "07-cupom-padaria-desconto.png": padaria, "08-notificacao-inter.png": inter, "09-paisagem.png": paisagem, "10-cupom-borrado.png": borrado,
};

const browser = await chromium.launch();
for (const [file, html] of Object.entries(RECEIPT_HTML)) {
  const phoneSized = /notificacao|pix|fatura/.test(file);
  const page = await browser.newPage({ viewport: phoneSized ? { width: 430, height: 932 } : { width: 640, height: 900 } });
  await page.setContent(html);
  await page.screenshot({ path: `${OUT}/receipts/${file}`, type: "png" });
  await page.close();
  console.log("✓", file);
}
await browser.close();

if (process.platform === "darwin") {
  for (const a of AUDIOS) {
    const aiff = `${OUT}/audio/${a.file}.aiff`;
    execFileSync("say", ["-v", a.voice, "-r", "185", "-o", aiff, a.text]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "24k", `${OUT}/audio/${a.file}`]);
    rmSync(aiff);
    console.log("✓", a.file, `(${a.voice})`);
  }
} else console.log("(áudios só no macOS)");
