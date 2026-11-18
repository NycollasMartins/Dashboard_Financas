import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseUrl.replace(/^http/, "ws");

/*
 * CSP SEM nonce (ADR-0020): nonce exige renderização 100% dinâmica e é
 * incompatível com o Partial Prerendering (Cache Components) que usamos.
 * Por isso 'unsafe-inline' em script/style — o resto é fechado: só o próprio
 * site e o Supabase, sem iframes, sem plugins, formulários só para o próprio site.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs}${isDev ? " ws: http://127.0.0.1:*" : ""}`.trim(),
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Só com o site em HTTPS (produção). Em http://localhost o WebKit (Safari) "promove"
  // os pedidos para https://localhost, que não existe → o app inteiro quebra no iPhone.
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Câmera (foto de cupom) e microfone (áudio) só para o próprio site — Fase 6.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Imagem Docker enxuta: só o servidor e as dependências usadas (ADR-0020).
  output: "standalone",
  // Foto (já reduzida no aparelho) e áudio de até 60 s no Assistente (Fase 6).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // O indicador "N" cobria a barra inferior no celular; erros continuam aparecendo no overlay.
  devIndicators: false,
  // Permite abrir o servidor de desenvolvimento pelo IP da rede local (celular no Wi-Fi).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [{ source: "/", destination: "/painel", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // O service worker precisa ser sempre revalidado e pode controlar o site todo.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
