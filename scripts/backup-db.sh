#!/usr/bin/env bash
# =============================================================================
# Backup do banco do Lar+ (Supabase) — gratuito, feito por você no seu Mac.
#   pnpm backup:prod    → projeto VINCULADO (produção). Pede a senha do banco e uma
#                         frase-senha para criptografar (nenhuma das duas aparece na tela).
#   pnpm backup:local   → banco local (para testar o script).
# Gera backups/AAAA-MM-DD_HHMM-<alvo>.tar.gz.enc (AES-256, criptografado) e apaga as
# cópias abertas. Guarda os 8 mais recentes. Restaurar: docs/setup-manual.md §M.
# Precisa do Docker aberto (o pg_dump do CLI roda no Docker, compatível com o Postgres 17).
# =============================================================================
set -euo pipefail
TARGET="${1:-local}"
cd "$(dirname "$0")/.."
git check-ignore -q backups/ || { echo "✗ backups/ não está no .gitignore — abortando."; exit 1; }
docker info >/dev/null 2>&1 || { echo "✗ Docker fechado. Abra o Docker Desktop e rode de novo."; exit 1; }

case "$TARGET" in
  local) FLAG=(--local) ;;
  prod)
    [ -f supabase/.temp/project-ref ] || { echo "✗ Projeto não vinculado (rode supabase link)."; exit 1; }
    FLAG=(--linked)
    if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
      read -r -s -p "Senha do banco de PRODUÇÃO (não aparece): " SUPABASE_DB_PASSWORD; echo
      export SUPABASE_DB_PASSWORD
    fi ;;
  *) echo "uso: backup-db.sh local|prod"; exit 1 ;;
esac

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  read -r -s -p "Frase-senha do backup (guarde no gerenciador de senhas): " BACKUP_PASSPHRASE; echo
  read -r -s -p "Repita a frase-senha: " CONFIRM; echo
  [ "$BACKUP_PASSPHRASE" = "$CONFIRM" ] || { echo "✗ As frases não conferem."; exit 1; }
fi
[ ${#BACKUP_PASSPHRASE} -ge 12 ] || { echo "✗ Use uma frase-senha com 12+ caracteres."; exit 1; }
export BACKUP_PASSPHRASE

STAMP="$(date +%Y-%m-%d_%H%M)-$TARGET"
WORK="backups/$STAMP"
umask 077
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

echo "→ papéis (roles)";            supabase db dump "${FLAG[@]}" --role-only -f "$WORK/roles.sql" >/dev/null
echo "→ estrutura (schema)";        supabase db dump "${FLAG[@]}" -f "$WORK/schema.sql" >/dev/null
echo "→ dados do app (public…)";    supabase db dump "${FLAG[@]}" --data-only --use-copy -f "$WORK/data.sql" >/dev/null
echo "→ dados de login (auth)";     supabase db dump "${FLAG[@]}" --data-only --use-copy -s auth -f "$WORK/auth.sql" >/dev/null

tar -czf - -C backups "$STAMP" | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -pass env:BACKUP_PASSPHRASE -out "backups/$STAMP.tar.gz.enc"
chmod 600 "backups/$STAMP.tar.gz.enc"

# Mantém os 8 mais recentes deste alvo.
ls -1t backups/*-"$TARGET".tar.gz.enc 2>/dev/null | tail -n +9 | xargs -r rm -f
echo "✓ backups/$STAMP.tar.gz.enc ($(du -h "backups/$STAMP.tar.gz.enc" | cut -f1)) — copie para um lugar fora deste Mac (ver §M)."
