/** Formato padrão de retorno das Server Actions usadas com useActionState. */
export type ActionState<TData = undefined> = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  data?: TData;
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
): ActionState<T> {
  return { status: "error", message, fieldErrors, at: Date.now() };
}
