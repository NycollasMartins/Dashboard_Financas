"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true só no navegador, após a hidratação (evita mismatch com o HTML do servidor). */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
