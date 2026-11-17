# Finanças

Dashboard financeiro pessoal e familiar: receitas, despesas, cartões, metas e (em breve) lançamentos
por WhatsApp/Telegram com IA. Next.js 16 + Supabase, custo zero.

## Começar
```bash
pnpm install
pnpm db:start          # Supabase local (requer Docker Desktop aberto)
cp .env.example .env.local   # preencha com `supabase status`
pnpm dev               # http://localhost:3000  ·  e-mails de teste: http://127.0.0.1:54324
```

## Documentação
- [CLAUDE.md](CLAUDE.md) — visão, arquitetura, convenções e status das fases
- [docs/requisitos.md](docs/requisitos.md) — requisitos, regras de negócio, critérios de aceite
- [docs/modelo-de-dados.md](docs/modelo-de-dados.md) — diagrama ER e políticas de RLS
- [docs/adr/](docs/adr/) — decisões de arquitetura
- [docs/design-system.md](docs/design-system.md) — tokens, tipografia, componentes
- [docs/roadmap.md](docs/roadmap.md) — fases
- [docs/setup-manual.md](docs/setup-manual.md) — passo a passo do que configurar manualmente

## Qualidade
`pnpm check` roda typecheck, lint, testes unitários (Vitest) e testes de isolamento no banco (pgTAP).
