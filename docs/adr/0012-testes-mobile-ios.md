# ADR-0012 · Testes mobile/iOS: Playwright WebKit agora, iOS Simulator quando houver Xcode

**Status:** Aceita · **Decisor:** Arquiteto + Front-end

## Contexto
O app é usado principalmente no iPhone. A máquina de desenvolvimento é um Mac **sem Xcode** (só Command
Line Tools), então o iOS Simulator não está disponível ainda.

## Decisão
1. **Playwright com WebKit** (motor do Safari) e emulação de dispositivo: projetos *iPhone 15*,
   *iPhone SE (3ª geração)*, *Android 360×800* e *Desktop Chrome*. Roda local e no **GitHub Actions**.
   Checagens específicas em `e2e/mobile-ios.spec.ts` (overflow, safe area, 44 px, fonte ≥ 16 px, PWA…).
2. **Playwright MCP** (`@playwright/mcp`, `--browser=webkit --device="iPhone 15"`) registrado em `.mcp.json`
   para o Claude Code navegar como um iPhone em sessões futuras.
3. **iOS Simulator** quando o Xcode for instalado: usar **XcodeBuildMCP** (mantido pela Sentry, ativo) —
   controle do simulador + Safari real do iOS. Passo a passo no README.
4. **iPhone de verdade** pelo Wi-Fi: `pnpm dev:lan`.

## Limites conhecidos da emulação
Não reproduz a barra dinâmica do Safari, o teclado virtual do iOS nem `env(safe-area-inset-*)` reais
(valem 0). Por isso a validação final de cada fase inclui o iPhone físico.
