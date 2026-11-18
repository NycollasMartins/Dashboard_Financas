# Design system · "Aurora" — marca Lar+

## Marca Lar+ (Fase 6)
- **Conceito:** o contorno de uma **casa** (lar, família) em menta (`primary`) e um **"+" violeta** (`savings`) no
  lugar da chaminé, subindo — crescimento, metas. Traço único arredondado, legível em 16 px.
- **Nome:** "Lar" + "+" em violeta; lê-se "Lar Mais". Identificadores técnicos: `larmais`.
- **Fonte única dos desenhos:** `scripts/brand-mark.mjs` (o componente `src/components/brand/logo.tsx` repete os caminhos
  com tokens). `pnpm brand` gera: `public/brand/larmais-logo-{dark,light}.svg`, `larmais-mark.svg`, ícones PWA
  (192/512 + maskable com margem para o recorte), `apple-touch-icon`, favicon (`src/app/icon.svg/.png`), telas de
  abertura do iPhone (`public/splash/*`) e a foto do bot (`public/brand/telegram-avatar.png`, 512×512).
- E-mails: cabeçalho com o ícone e "Lar+" (violeta no "+"), fundo grafite.

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
| `viz-income` | `oklch(0.64 0.13 170)` #00a580 | `oklch(0.58 0.12 172)` #009172 | Série "Receitas" nos gráficos |
| `viz-expense` | `oklch(0.6 0.17 35)` #d25030 | `oklch(0.6 0.19 32)` #da452c | Série "Despesas" e barras de gasto |
| `viz-balance` | `oklch(0.62 0.15 290)` #8673d9 | `oklch(0.52 0.18 290)` #6b4ec7 | Linha do saldo |
| `viz-grid` | branco 7% | grafite 8% | Linhas de grade (sólidas, finas) |

> As cores `viz-*` são **mais escuras** que `income`/`expense` de propósito: barras grandes precisam ficar
> na faixa de luminosidade em que daltônicos (protan/deutan) ainda distinguem verde × coral. Validadas com
> script (ΔE ≥ 9,9 sob simulação; contraste ≥ 3:1 com o cartão) nos dois temas. Texto nunca usa `viz-*`.

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
| `AppShell` | `components/app-shell/app-shell.tsx` | Sidebar (desktop) + topo e barra inferior **sólida** com botão **+** central (celular) |
| `Sheet` | `components/ui/sheet.tsx` | Folha que sobe de baixo no celular (alça, safe area, até 92dvh) e vira painel central no desktop. Formulário longo: `scroll={false}` + rodapé fixo |
| `MoneyInput` | `components/ledger/money-input.tsx` | Valor com máscara BRL da direita para a esquerda, `inputMode="decimal"`, envia centavos |
| `EntrySheet` | `components/ledger/entry-sheet.tsx` | Lançamento rápido: tipo (segmentado) → valor grande → grade 4×2 de categorias (mais usadas) → chips de pagamento → "Mais opções" → **Salvar** fixo |
| `CategoryIcon` | `components/ledger/category-icon.tsx` | Ícone sobre a cor da categoria a 18% |
| `InvoiceStatusBadge` | `components/ledger/invoice-status.tsx` | Aberta (menta) · Fechada (âmbar) · Vencida (vermelho) · Paga (verde) |

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

## Regras de layout aprendidas na Fase 2
- Grids de página usam `grid-cols-[minmax(0,1fr)]`: sem isso, itens com texto longo alargam a coluna e a
  página rola para os lados no iPhone.
- Barras fixas sobre conteúdo (barra inferior) são **sólidas**; translucidez fica para o topo.
- Ações secundárias de linhas de lista vão para uma **segunda linha** no celular.
- Meses: "Dezembro de 2026" (só a 1ª maiúscula) — nunca `text-transform: capitalize`, que gera "De".

## Dashboard (Fase 3)
**Hierarquia (de cima para baixo, igual no celular e no desktop):**
1. **Filtros** numa linha só, acima de tudo que eles afetam: período (◀ mês ▶, toque abre mês/ano/intervalo),
   visão **Competência | Caixa**, botão de filtros (categoria, membro, conta, cartão) → chips removíveis.
2. **KPIs** (2×2 no celular, 4 colunas no desktop): Receitas, Despesas, Saldo do período, Taxa de economia.
   Cada um com selo de variação: seta + % + cor semântica (gasto subindo = coral; receita subindo = verde);
   taxa usa **p.p.**; previsto aparece em texto pequeno ("+ R$ 480 a receber").
3. **Saldo projetado** (cartão-herói): número grande + a conta que leva até ele (saldo hoje, + receitas
   previstas, − despesas previstas, − faturas a vencer).
4. **Posição**: saldo das contas, faturas em aberto, limite disponível (atalhos para as telas).
5. **O que chama atenção**: até 4 insights por regra (ícone + texto; alertas primeiro).
6. **Categorias** (barra segmentada até 5 + "Outras", lista ranqueada com 6 visíveis e "Mostrar mais") |
   **Próximos vencimentos** (chip de data; vencida = vermelho com ícone e texto).
7. **Evolução em 12 meses** (largura total).
8. **Comparação com a média** (barra = período, traço = média) | **Uso do limite** (medidor; ≥ 80% âmbar + ícone).
9. **Maiores gastos** | **Por membro** (só família com 2+ pessoas) | **Por cartão e conta**.

**Regras de gráfico** (seguimos o guia de dataviz):
- Um eixo só (nada de eixo Y duplo). Saldo e barras dividem a mesma escala em R$.
- Forma antes da cor: parte-do-todo com ≤ 6 partes = barra segmentada (não pizza/rosca); ranking = barras
  horizontais de **uma cor só**; uma razão contra um limite = medidor.
- A cor segue a entidade (categoria tem cor própria), nunca a posição no ranking. 7ª categoria em diante vira "Outras".
- Marcas finas, pontas arredondadas de 4 px, 2 px de espaço entre barras/segmentos, grade sólida e discreta.
- Legenda sempre que houver 2+ séries; rótulos diretos só onde ajudam.
- **Tooltip nunca é o único caminho**: todo gráfico tem o botão **Tabela**, e cada coluna do gráfico de
  evolução é um botão com nome acessível ("Novembro de 2026: receitas …").
- Área de toque = a coluna inteira (≥ 24 px), não o ponto.
- Animação: barras crescem (700 ms, *ease-out-expo*); **a primeira dobra não faz fade de opacidade**
  (elemento invisível atrasa o LCP). `prefers-reduced-motion` desliga tudo.
- Ao trocar filtro, o conteúdo anterior fica a 60% de opacidade até o novo chegar (sem piscar skeleton).
- "Ocultar valores": todo `<Money>` vira "R$ ••••"; eixos somem; tooltips e insights usam texto sem número.

**Estados**: skeleton por bloco (mesma forma do conteúdo, sem pulo); vazio com ícone + frase + ação
("Lançar agora"); "Ainda não há 3 meses de histórico para comparar".

## Metas e planejamento (Fase 4)
- **Anel de progresso** (`GoalRing`, SVG sem ids): cor da meta sobre `surface-2`; % no centro; rótulo
  acessível "Carro: 18% concluído". Grande no detalhe (132 px), médio no cartão (68 px), pequeno no painel.
- **Status de ritmo** (`PaceBadge`) sempre com **ícone + texto**: Adiantada (verde, foguete) · No ritmo (menta,
  velocímetro) · Atrasada N meses (âmbar, alerta) · Sem prazo / Sem ritmo ainda (neutro, relógio) · Concluída.
- **Cartão da meta**: anel + nome + prioridade → guardado "de" alvo → selo de ritmo → 3 números (Falta · Por mês
  até o prazo · Chega em) → rodapé com plano/ritmo e botão **Guardar** (zona do polegar). Pausada/arquivada a 75%.
- **Gráfico da meta**: um eixo em R$; **linha cheia** = guardado; **tracejada** = projeção (o tracejado aqui
  significa *estimativa* de propósito); linha fina neutra = ritmo ideal; linha do **Alvo**. Tabela alternativa.
- **Simulador "e se"**: resultado em `<output aria-live>`; nada é salvo; botão "Atual" volta aos valores reais.
- **Guardar para meta**: folha com segmento Guardar/Retirar, valor grande, grade de metas com mini-barra, conta
  e data em "Mais opções". Texto fixo: "Guardar não é despesa".
- **Celebração**: cartão "Meta concluída!" + confete curto (2,6 s); com `prefers-reduced-motion` só o cartão.
- **Planejamento**: número-herói "Sobra mensal realista" + a conta que leva até ela (Renda − Fixas − Variáveis),
  compromissos, alerta (âmbar com ícone, nunca só cor) e tabela de distribuição.
- Cores: o **violeta `savings`** identifica "guardado/metas" no app inteiro (KPI, botões, histórico).

## Assistente (Fase 5)
- **Bolhas**: usuário à direita (menta, `primary`); assistente à esquerda (`card` com borda; borda verde = gravado,
  âmbar = atenção, vermelha = erro). Texto com quebra de linha preservada.
- **Cartão de confirmação**: espaço de destino no topo; cada item com título, valor e linha "categoria · meio · data";
  **Confirmar** (ou "Confirmar tudo"), **Editar** (abre valor, categoria e data por item) e **Cancelar**. Aviso:
  "Se você trocar a categoria, eu lembro para as próximas vezes".
- **Opções** (perguntas): botões numerados "1. Inter", "2. Nubank" — o número também funciona por texto (WhatsApp).
- **Gravado**: lista com ✓ e botão **Desfazer**. Só a última leva de respostas é interativa.
- **Entrada**: campo de 48 px e fonte 16 px (sem zoom do iOS), botão enviar 48 px, sugestões em chips roláveis
  acima; fica fixa acima da barra inferior no celular.
- **Privacidade**: aviso recolhível no topo, com o que é enviado e o botão "Apagar histórico".
