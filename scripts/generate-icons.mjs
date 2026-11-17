#!/usr/bin/env node
/**
 * Gera os ícones PNG do app (PWA / iOS) a partir do SVG da marca, usando o
 * Chromium do Playwright. Rodar após mudar a marca: `pnpm icons`.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BG = "#0b0d13";
const mark = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="width:100%;height:100%;padding:${pad}%;box-sizing:border-box">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>
  <path d="M7 20.5 12 15.5l3.5 3.5L24.5 10" fill="none" stroke="url(#g)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="24.5" cy="10" r="2.3" fill="#5eead4"/>
</svg>`;

const icons = [
  { file: "public/apple-touch-icon.png", size: 180, pad: 12 },
  { file: "public/icons/icon-192.png", size: 192, pad: 12 },
  { file: "public/icons/icon-512.png", size: 512, pad: 12 },
  // "maskable": o Android recorta em círculo/squircle → mais margem.
  { file: "public/icons/icon-maskable-512.png", size: 512, pad: 22 },
  { file: "src/app/icon.png", size: 64, pad: 8 },
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
for (const { file, size, pad } of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<html><body style="margin:0;background:radial-gradient(circle at 30% 20%,#13202a,${BG} 70%);width:${size}px;height:${size}px">${mark(pad)}</body></html>`,
  );
  await page.screenshot({ path: file, omitBackground: false });
  await page.close();
  console.log("✓", file);
}
await browser.close();
