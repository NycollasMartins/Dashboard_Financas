/**
 * Marca Lar+ — fonte única dos desenhos (usada pelo gerador de ícones/logos).
 * Conceito: o contorno de uma CASA (lar, família) em menta e, no lugar da
 * chaminé, um "+" violeta subindo (crescimento, metas). Traço único, cantos
 * arredondados, sem detalhes finos (legível em 16 px).
 * O componente React (src/components/brand/logo.tsx) repete estes caminhos
 * usando tokens CSS — mudou aqui, mude lá.
 */
export const MINT = "#5eead4";
export const VIOLET = "#a78bfa";
export const INK = "#0b0d13";
export const PAPER = "#f8f9fc";

/** Caminhos no viewBox 0 0 32 32. */
export const PATHS = {
  // Telhado + paredes + base (um traço contínuo, aberto no canto direito do telhado).
  house: "M6.5 15.5 15 8.6a1.6 1.6 0 0 1 2 0l2.2 1.8M9 13.6v9.9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.8",
  // Porta.
  door: "M14 25.5v-4.2a2 2 0 0 1 4 0v4.2",
  // "+" que sobe (crescimento).
  plus: "M24.5 6.2v7M21 9.7h7",
};

/** SVG da marca. `stroke` maior em tamanhos pequenos fica mais legível. */
export function markSvg({ size = 32, pad = 0, bg = null, stroke = 2.4, mint = MINT, violet = VIOLET } = {}) {
  const inner = 32 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  ${bg ?? ""}
  <g transform="translate(${pad} ${pad}) scale(${inner / 32})" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${PATHS.house}" stroke="${mint}" stroke-width="${stroke}"/>
    <path d="${PATHS.door}" stroke="${mint}" stroke-width="${stroke}" opacity=".8"/>
    <path d="${PATHS.plus}" stroke="${violet}" stroke-width="${stroke + 0.2}"/>
  </g>
</svg>`;
}

/** Logo horizontal (marca + "Lar+"). `theme` = fundo onde será usado. */
export function logoSvg(theme = "dark") {
  const text = theme === "dark" ? PAPER : INK;
  const mint = theme === "dark" ? MINT : "#0f9f8c";
  const violet = theme === "dark" ? VIOLET : "#7c5cdb";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="48" viewBox="0 0 168 48" role="img" aria-label="Lar+">
  <title>Lar+</title>
  <g transform="translate(4 4) scale(1.25)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${PATHS.house}" stroke="${mint}" stroke-width="2.4"/>
    <path d="${PATHS.door}" stroke="${mint}" stroke-width="2.4" opacity=".8"/>
    <path d="${PATHS.plus}" stroke="${violet}" stroke-width="2.6"/>
  </g>
  <text x="54" y="34" font-family="'Space Grotesk','Inter',system-ui,sans-serif" font-size="30" font-weight="600" letter-spacing="-0.5" fill="${text}">Lar<tspan fill="${violet}">+</tspan></text>
</svg>`;
}
