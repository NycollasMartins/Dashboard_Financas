/** Formato padrão de retorno das Server Actions usadas com useActionState. */
export type ActionState<TData = undefined> = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  data?: TData;
  /** Valores enviados (sem senhas), para repopular o formulário após erro. */
  values?: Record<string, string>;
  /** Muda a cada submit; permite ao cliente reagir (toast) mesmo com mensagem repetida. */
  at?: number;
};

/** Estado inicial compatível com qualquer ActionState<T>. */
export const idleState: ActionState<never> = { status: "idle" };

export function ok<T = undefined>(message?: string, data?: T): ActionState<T> {
  return { status: "success", message, data, at: Date.now() };
}

export function fail<T = undefined>(
  message: string,
  fieldErrors?: Record<string, string[] | undefined>,
  values?: Record<string, string>,
): ActionState<T> {
  return { status: "error", message, fieldErrors, values: values && withoutSecrets(values), at: Date.now() };
}

function withoutSecrets(values: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!/password|confirm|token/i.test(k)) out[k] = v;
  }
  return out;
}
