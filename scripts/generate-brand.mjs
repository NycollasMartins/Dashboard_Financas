#!/usr/bin/env node
/**
 * Gera TODA a identidade visual do Lar+ a partir de scripts/brand-mark.mjs,
 * usando o Chromium do Playwright (sem dependência extra). Rodar após mudar a
 * marca: `pnpm brand`.
 *   • public/brand/*.svg        logo (tema escuro/claro) e marca
 *   • ícones PWA/iOS            apple-touch-icon, 192/512, maskable 192/512, favicon
 *   • public/splash/*.png       telas de abertura do PWA no iPhone
 *   • public/brand/telegram-avatar.png  foto do @LarMaisBot (512×512, /setuserpic)
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { INK, logoSvg, markSvg } from "./brand-mark.mjs";

const glow = (w, h) =>
  `background:radial-gradient(circle at 30% 18%,#13262c 0,${INK} ${Math.round(Math.max(w, h) * 0.7)}px);`;

mkdirSync("public/brand", { recursive: true });
mkdirSync("public/icons", { recursive: true });
mkdirSync("public/splash", { recursive: true });

// SVGs (versionados; usados no README e no app)
writeFileSync("public/brand/larmais-logo-dark.svg", logoSvg("dark"));
writeFileSync("public/brand/larmais-logo-light.svg", logoSvg("light"));
writeFileSync("public/brand/larmais-mark.svg", markSvg({ size: 64 }));
writeFileSync(
  "src/app/icon.svg",
  markSvg({ size: 32, pad: 1, stroke: 2.8, bg: `<rect width="32" height="32" rx="8" fill="${INK}"/>` }),
);
console.log("✓ SVGs");

// pad = margem em unidades do viewBox (32). Maskable: zona segura = círculo de 80% → mais margem.
const squares = [
  { file: "public/apple-touch-icon.png", size: 180, pad: 4.5 },
  { file: "public/icons/icon-192.png", size: 192, pad: 4.5 },
  { file: "public/icons/icon-512.png", size: 512, pad: 4.5 },
  { file: "public/icons/icon-maskable-192.png", size: 192, pad: 7.5 },
  { file: "public/icons/icon-maskable-512.png", size: 512, pad: 7.5 },
  { file: "src/app/icon.png", size: 64, pad: 2.5 },
  // Telegram recorta em círculo.
  { file: "public/brand/telegram-avatar.png", size: 512, pad: 7 },
];

// Telas de abertura do iPhone (pixels do aparelho; media query em src/app/layout.tsx).
export const SPLASH = [
  { w: 750, h: 1334, dw: 375, dh: 667, r: 2 }, // iPhone SE 2/3, 8
  { w: 1125, h: 2436, dw: 375, dh: 812, r: 3 }, // iPhone X/XS/11 Pro/12-13 mini
  { w: 1170, h: 2532, dw: 390, dh: 844, r: 3 }, // iPhone 12/13/14
  { w: 1179, h: 2556, dw: 393, dh: 852, r: 3 }, // iPhone 14 Pro/15/16
  { w: 1284, h: 2778, dw: 428, dh: 926, r: 3 }, // iPhone 12/13 Pro Max, 14 Plus
  { w: 1290, h: 2796, dw: 430, dh: 932, r: 3 }, // iPhone 14/15 Pro Max, 15 Plus
];

const browser = await chromium.launch();
for (const { file, size, pad } of squares) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<html><body style="margin:0;${glow(size, size)}width:${size}px;height:${size}px">${markSvg({ size, pad, stroke: 2.4 })}</body></html>`,
  );
  await page.screenshot({ path: file });
  await page.close();
  console.log("✓", file);
}
for (const s of SPLASH) {
  const page = await browser.newPage({ viewport: { width: s.dw, height: s.dh }, deviceScaleFactor: s.r });
  await page.setContent(`<html><body style="margin:0;${glow(s.dw, s.dh)}width:${s.dw}px;height:${s.dh}px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:system-ui">
    ${markSvg({ size: 96, stroke: 2.2 })}
    <div style="font:600 34px/1 'Space Grotesk',system-ui;color:#f8f9fc;letter-spacing:-.5px">Lar<span style="color:#a78bfa">+</span></div>
  </body></html>`);
  const file = `public/splash/splash-${s.w}x${s.h}.png`;
  await page.screenshot({ path: file });
  await page.close();
  console.log("✓", file);
}
await browser.close();
