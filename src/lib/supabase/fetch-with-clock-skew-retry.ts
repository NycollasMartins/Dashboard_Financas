/**
 * O PostgREST atualiza seu relógio interno ~1x por segundo. Logo após o Supabase
 * Auth emitir um JWT novo (login, troca de senha, refresh), a primeira consulta
 * pode ser recusada com PGRST303 "JWT issued at future". Esperar ~1s e repetir
 * UMA vez resolve. Qualquer outro erro passa direto.
 */
export async function fetchWithClockSkewRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const body = await response.clone().text();
  if (!body.includes("PGRST303") || !body.includes("issued at future")) return response;

  await new Promise((resolve) => setTimeout(resolve, 1100));
  return fetch(input, init);
}
