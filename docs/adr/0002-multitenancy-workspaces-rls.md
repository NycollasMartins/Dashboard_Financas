# ADR-0002 · Multi-tenancy por workspace com RLS e FKs compostas

**Status:** Aceita · **Decisor:** Arquiteto

## Contexto
O usuário precisa de um espaço **individual** isolado e de espaços **familiares** compartilhados,
alternando entre eles. O isolamento deve ser garantido **no banco**.

## Decisão
1. Um único conceito, **workspace** (`personal` | `household`). Todo dado financeiro tem `workspace_id`.
2. `workspace_members(workspace_id, user_id, role)` define acesso. Papéis: `admin`, `member`.
3. RLS em todas as tabelas, usando helpers `SECURITY DEFINER` no schema `private`
   (`my_workspace_ids()`, `is_admin()`), chamados como `(select ...)` para o Postgres cachear por consulta.
4. **FKs compostas** `(id, workspace_id)` entre tabelas do domínio: referências entre espaços são
   impossíveis mesmo para quem burlar a aplicação.
5. Operações com regras (criar família, convidar, aceitar) são **RPCs** com checagens explícitas.
6. O espaço ativo é salvo em `profiles.last_workspace_id` (vale entre dispositivos e é validado pela RLS).

## Alternativas
- **Tabelas separadas para pessoal e família**: duplicaria telas, queries e regras. Rejeitado.
- **Filtrar só na aplicação**: um bug vazaria dados da família para terceiros. Rejeitado.
- **Espaço ativo em cookie**: não sincroniza entre celular e computador. Rejeitado.

## Consequências
- ✅ Mesma UI para os dois tipos de espaço; adicionar pais/irmão = convidar.
- ✅ Testes pgTAP provam o isolamento (59 asserções).
- ⚠️ Toda tabela nova **precisa** de `workspace_id`, RLS e testes. Checklist no `CLAUDE.md`.
