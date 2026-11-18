#!/usr/bin/env node
/**
 * Gera um par de chaves VAPID (Web Push). Rode UMA vez por ambiente e guarde:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY → pública (vai para o navegador; também é build arg do Docker)
 *   VAPID_PRIVATE_KEY            → SECRETA (só no servidor: .env.local / EasyPanel)
 * Trocar as chaves invalida as assinaturas: cada aparelho precisa ativar de novo.
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log("# Copie para o .env.local (e para o EasyPanel em produção):");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:contato@larmais.tech");
