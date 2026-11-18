# ADR-0001 · Stack: Next.js 16 + Supabase + Vercel

> **Revisada pela [ADR-0020](0020-producao-easypanel-docker.md) (Fase 6):** a hospedagem passou a ser EasyPanel (Docker) na VPS do dono; a Vercel deixou de ser usada. O texto abaixo é histórico.

**Status:** Aceita · **Decisor:** Arquiteto · **Data:** 2026-11-17

## Contexto
App pessoal/familiar, custo zero, uso pesado no celular, back-end seguro e um único dev júnior mantendo.

## Decisão
| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript, Turbopack) | Front + back no mesmo projeto (Server Components, Server Actions, Route Handlers para webhooks). |
| UI | **Tailwind CSS v4** + **shadcn/ui** (estilo `base-nova`, sobre **Base UI**) | Componentes copiados para o repo (controle total) e acessíveis. O shadcn atual usa Base UI no lugar do Radix; a API usa `render={...}` em vez de `asChild`. |
| Banco/Auth | **Supabase** (Postgres 17 + Auth + RLS), plano Free | Postgres de verdade + RLS para isolamento no banco + Auth com e-mail/senha. |
| Hospedagem | **Vercel** Hobby | Deploy do Next.js sem configuração; uso pessoal não comercial é permitido no Hobby. |
| Validação | **Zod 4** | Mesmo schema no cliente e no servidor. |
| Testes | **Vitest** (regras puras) + **pgTAP** (`supabase test db`, RLS) | Testar a RLS de verdade, dentro do Postgres. |
| Gráficos (F3) | **Recharts** (via `shadcn/ui charts`) | Integra com os tokens de cor do design system; leve o suficiente. |

## Alternativas consideradas
- **Prisma/Drizzle + Postgres próprio**: mais controle, mas perderíamos o Auth pronto e a RLS ficaria
  "por fora" do ORM. Rejeitado.
- **Firebase**: regras de segurança mais fracas para dados relacionais (faturas, parcelas). Rejeitado.
- **Contestação feita pelo Arquiteto**: nenhuma troca na stack sugerida; apenas o detalhe de que o
  shadcn atual usa Base UI (não Radix) e de que o Next 16 renomeou `middleware.ts` para `proxy.ts`.

## Limites dos planos gratuitos (riscos)
- **Supabase Free**: projeto **pausa após 7 dias sem uso** (reativa no painel); 500 MB de banco;
  e-mails do Auth com SMTP padrão são **muito limitados** → ver ADR-0007.
- **Vercel Hobby**: cron jobs no máximo 1×/dia → geração de recorrências será feita com
  **pg_cron no próprio Supabase** (gratuito), não com cron da Vercel.
