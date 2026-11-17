#!/usr/bin/env node
/**
 * Sobe o Next em modo dev acessível pela rede local (Wi-Fi), para testar no
 * celular de verdade. Detecta o IP da máquina e usa-o como NEXT_PUBLIC_SITE_URL,
 * para que links de e-mail e redirecionamentos apontem para o IP, não "localhost".
 *
 * Uso: pnpm dev:lan   → abra no iPhone o endereço impresso (mesma rede Wi-Fi).
 */
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const PORT = process.env.PORT ?? "3000";

function lanAddress() {
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (!/^(en|eth|wlan|wl|Wi-Fi|Ethernet)/i.test(name)) continue;
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) if (a.family === "IPv4" && !a.internal) return a.address;
  }
  return null;
}

const ip = lanAddress();
if (!ip) {
  console.error("Não encontrei um IP de rede local. Você está conectado ao Wi-Fi?");
  process.exit(1);
}

const url = `http://${ip}:${PORT}`;
console.log(`\n📱 Abra no celular (mesma rede Wi-Fi): ${url}\n`);

const child = spawn("pnpm", ["exec", "next", "dev", "--hostname", "0.0.0.0", "--port", PORT], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_SITE_URL: url },
});
child.on("exit", (code) => process.exit(code ?? 0));
