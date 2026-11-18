/** Identidade do produto (textos). Domínio e bot vêm de variáveis de ambiente. */
export const APP_NAME = "Lar+";
export const APP_DESCRIPTION = "Finanças da casa e da família: lançamentos, cartões, metas e assistente por mensagem.";

/** Telas de abertura do PWA no iPhone (geradas por `pnpm brand`). */
export const SPLASH_SCREENS = [
  { w: 750, h: 1334, dw: 375, dh: 667, r: 2 },
  { w: 1125, h: 2436, dw: 375, dh: 812, r: 3 },
  { w: 1170, h: 2532, dw: 390, dh: 844, r: 3 },
  { w: 1179, h: 2556, dw: 393, dh: 852, r: 3 },
  { w: 1284, h: 2778, dw: 428, dh: 926, r: 3 },
  { w: 1290, h: 2796, dw: 430, dh: 932, r: 3 },
].map((s) => ({
  url: `/splash/splash-${s.w}x${s.h}.png`,
  media: `(device-width: ${s.dw}px) and (device-height: ${s.dh}px) and (-webkit-device-pixel-ratio: ${s.r}) and (orientation: portrait)`,
}));
