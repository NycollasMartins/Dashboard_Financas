# ADR-0008 · Cache Components do Next 16 com sessão do Supabase

**Status:** Aceita · **Decisor:** Arquiteto + Dev Front-end

## Contexto
O Next 16 vem com `cacheComponents` e `partialPrefetching` ligados: tudo que lê cookies/sessão precisa
estar dentro de `<Suspense>`, e valores não determinísticos (como `Date.now()`, usado internamente pelo
supabase-js para checar o JWT) são proibidos durante o prerender.

## Decisão
- `createClient()` do servidor chama **`await connection()`**: dados do Supabase são sempre por
  requisição e nunca entram no shell estático.
- Cada página exporta um **shell estático** (cabeçalho) e coloca o conteúdo da sessão em `<Suspense>`
  com skeleton → navegação instantânea.
- `proxy.ts` (antigo middleware) só renova a sessão e faz redirecionamento otimista; a autorização
  real é do banco (RLS) e das Server Actions.
- `fetchWithClockSkewRetry`: o PostgREST atualiza o relógio ~1×/s e pode recusar um JWT recém-emitido
  com `PGRST303 JWT issued at future`; repetimos uma vez após 1,1 s.
- Componentes que dependem do tema (só conhecido no navegador) usam `useMounted()` para evitar erro
  de hidratação.
