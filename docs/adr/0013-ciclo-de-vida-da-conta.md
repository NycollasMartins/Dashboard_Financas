# ADR-0013 · Troca de e-mail, transferência de posse e exclusão de conta

**Status:** Aceita · **Decisor:** Arquiteto + Analista

## Decisão
- **Troca de e-mail**: exige senha atual; Supabase com `double_confirm_changes` envia link aos **dois**
  endereços; só muda após as duas confirmações.
- **Transferir posse** (`transfer_workspace_ownership`): só o dono, só para um membro; o novo dono vira
  admin; o antigo continua admin. `owner_id` segue imutável fora dessa função (flag local na transação).
- **Excluir conta** (`delete_my_account`): exige senha + digitar "EXCLUIR".
  - **Bloqueada** se o usuário for dono de família com outros membros (`get_account_deletion_blockers`).
  - Apaga: espaço individual, famílias em que está sozinho, vínculos de canal, sessões.
  - **Anonimiza** o que fica nas famílias de outras pessoas: `created_by`, `updated_by`, `member_user_id`
    viram NULL (os valores continuam, para não quebrar as contas da família).
