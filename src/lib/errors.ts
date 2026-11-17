/**
 * Tradução de erros técnicos para mensagens amigáveis em pt-BR.
 * Nunca devolvemos ao usuário mensagens cruas de banco que não escrevemos.
 */

type MaybeError = { code?: string; message?: string; status?: number } | null | undefined;

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
  user_already_exists: "Já existe uma conta com este e-mail.",
  email_exists: "Já existe uma conta com este e-mail.",
  weak_password: "Senha fraca. Use pelo menos 8 caracteres, com letras e números.",
  same_password: "A nova senha precisa ser diferente da atual.",
  over_email_send_rate_limit: "Muitos e-mails enviados. Aguarde alguns minutos e tente de novo.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  email_address_invalid: "E-mail inválido.",
  session_not_found: "Sua sessão expirou. Entre novamente.",
  otp_expired: "O link expirou. Solicite um novo.",
};

export function authErrorMessage(error: MaybeError): string {
  if (error?.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code];
  if (error?.status === 429) return AUTH_MESSAGES.over_request_rate_limit;
  return "Não foi possível concluir. Tente novamente em instantes.";
}

/**
 * Erros das nossas funções SQL usam SQLSTATEs específicos e mensagens já em
 * pt-BR (ver migrations). Só esses são repassados; o resto vira genérico.
 */
const SAFE_DB_CODES = new Set(["22023", "42501", "23505", "54000", "23514", "28000"]);

export function dbErrorMessage(error: MaybeError, fallback = "Não foi possível concluir a operação."): string {
  if (!error) return fallback;
  if (error.code && SAFE_DB_CODES.has(error.code) && error.message && !/policy|permission denied/i.test(error.message)) {
    return error.message;
  }
  if (error.code === "42501") return "Você não tem permissão para fazer isso.";
  if (error.code === "23505") return "Já existe um registro com esses dados.";
  return fallback;
}
