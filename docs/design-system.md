# Design system · "Aurora"

> Responsável: **Designer Gráfico/UI-UX Sênior**. Implementação: `src/app/globals.css` (tokens),
> `src/components/ui/*` (componentes base), `src/components/*` (componentes de produto).

## Princípios
1. **O número é o herói.** Valores grandes, tabulares e com cor semântica; o resto recua.
2. **Escuro por padrão, calmo e preciso.** Superfícies em camadas de azul-grafite, um único acento
   (menta/aqua) para ação, brilhos sutis só no fundo.
3. **Mobile-first, polegar-first.** Ações principais na metade inferior da tela; alvos ≥ 44 px.
4. **Movimento com propósito.** Entradas de 420 ms com *ease-out-expo*; nada pisca nem gira à toa;
   `prefers-reduced-motion` desliga tudo.
5. **Hierarquia por luz, não por borda.** Cartões se separam por superfície e brilho, com bordas a 8% de opacidade.

## Cores (tokens OKLCH)
Use sempre o **token** (`bg-card`, `text-income`), nunca hex soltos.

| Token | Escuro (padrão) | Claro | Uso |
|---|---|---|---|
| `background` | `oklch(0.155 0.012 265)` ≈ #0b0d13 | `oklch(0.982 0.004 265)` | Fundo da página |
| `card` | `oklch(0.195 0.014 265)` | branco | Superfície 1 (cartões) |
| `surface-2` | `oklch(0.235 0.016 265)` | `oklch(0.962 …)` | Inputs, hovers, ícones |
| `foreground` | `oklch(0.965 …)` | `oklch(0.21 …)` | Texto principal |
| `muted-foreground` | `oklch(0.72 …)` | `oklch(0.48 …)` | Texto secundário (contraste AA) |
| `primary` | menta `oklch(0.86 0.13 178)` | `oklch(0.52 0.1 182)` | Ação principal, foco, item ativo |
| `income` | verde `oklch(0.82 0.16 155)` | `oklch(0.52 0.14 155)` | Receitas, sucesso |
| `expense` | coral `oklch(0.74 0.16 22)` | `oklch(0.56 0.19 25)` | Despesas |
| `savings` | violeta `oklch(0.76 0.15 290)` | `oklch(0.52 0.18 290)` | Metas, guardado, família |
| `warning` | âmbar | âmbar escuro | Avisos, dono da família |
| `destructive` | vermelho | vermelho | Excluir, erros |
| `chart-1…5` | menta, violeta, âmbar, coral, céu | versões escuras | Séries de gráficos (nesta ordem) |

Variantes `*-muted` (ex.: `bg-income-muted`) = a cor a 10–16% de opacidade, para fundos de badges e ícones.

## Tipografia
| Papel | Fonte | Uso |
|---|---|---|
| Títulos e números de destaque | **Space Grotesk** (600) | `h1–h4`, KPIs |
| Texto e UI | **Inter** | Corpo, formulários, menus |
| Código/IDs | **JetBrains Mono** | Links de convite, códigos |

Escala: `text-xs` 12 · `text-sm` 14 · `text-base` 16 (inputs no celular, evita zoom do iOS) · `text-xl` 20 ·
`text-2xl` 24 · `text-3xl` 30. Valores monetários usam a utility **`text-money`** (`tabular-nums`) para
as colunas alinharem.

## Espaçamento, raio e elevação
- Grade de 4 px (Tailwind). Gutter da página: 16 px no celular, 24 px no tablet, 40 px no desktop.
- Gaps: 12 px entre cartões no celular, 16 px no desktop. Padding de cartão: 16–24 px.
- Raio base `--radius: 0.875rem` (14 px). Cartões `rounded-2xl`, inputs/botões `rounded-lg`.
- Elevação: sem sombras pesadas no escuro; o botão primário tem um *glow* da própria cor.
- Utility **`glass`**: superfície translúcida com blur (barra superior/inferior no celular, cards de auth).

## Movimento
| Token | Valor | Uso |
|---|---|---|
| `animate-rise` | 420 ms, translateY 8 px → 0 | Entrada de cartões/seções (escalonar com `animationDelay` de 50 ms) |
| `animate-glow` | 6 s, alternado | Brilhos decorativos de fundo |
| Transições | 150–200 ms | Hover, foco, troca de estado |

## Componentes
**Base (shadcn/Base UI, ajustados):** `Button` (altura 40 px; `lg` 48 px; ícone 40 px), `Input` (44 px),
`DropdownMenu` (itens com 36 px+), `Dialog`, `Avatar`, `Badge`, `Tooltip`, `Skeleton`, `Toaster` (sonner).

**Produto:**
| Componente | Arquivo | Descrição |
|---|---|---|
| `Logo` / `LogoMark` | `components/brand/logo.tsx` | Pulso ascendente em anel com gradiente menta→violeta |
| `Money` | `components/money.tsx` | Valor em centavos formatado, com tom (`income`/`expense`/`savings`) |
| `PageHeader` | `components/page-header.tsx` | Sobretítulo (mês), título, descrição, ações |
| `EmptyState` | `components/empty-state.tsx` | Ícone + título + texto + ação, borda tracejada |
| `Field` / `PasswordField` / `SubmitButton` / `FormMessage` | `components/forms/fields.tsx` | Formulário acessível (label, erro com `aria-describedby`, estado pendente) |
| `WorkspaceSwitcher` | `components/app-shell/workspace-switcher.tsx` | Alterna individual/família (ícone: pessoa = menta, casa = violeta) |
| `AppShell` | `components/app-shell/app-shell.tsx` | Sidebar (desktop) + topo e barra inferior com botão **+** central (celular) |

## Layout
- **Desktop (≥ 1024 px):** sidebar fixa de 272 px (logo, seletor de espaço, navegação, atalho de lançamento, usuário).
- **Celular:** topo de 56 px (logo, seletor compacto, avatar) + barra inferior de 64 px com 4 itens e o
  botão **+** central (zona do polegar). Conteúdo com `pb-28` para não ficar sob a barra; `safe-area` respeitada.
- KPIs: grade 2×2 no celular, 4 colunas no desktop.

## UX e escrita
- Linguagem direta, em segunda pessoa ("Você está no espaço da família…").
- Erros dizem **o que fazer** ("Confirme seu e-mail antes de entrar.").
- Ações destrutivas sempre com diálogo de confirmação explicando a consequência.
- Formulários mantêm os valores digitados quando há erro.
- Lançamento rápido em 3 toques: ver `docs/requisitos.md` §6.
