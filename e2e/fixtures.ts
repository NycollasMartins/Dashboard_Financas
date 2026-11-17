/** Usuários criados pelo supabase/seed.sql (somente ambiente local/CI). */
export const USERS = {
  ana: { email: "ana@teste.local", password: "Teste12345", name: "Ana Teste" },
  bruno: { email: "bruno@teste.local", password: "Teste12345", name: "Bruno Teste" },
} as const;

export const isMobile = (projectName: string) => /Mobile/.test(projectName);
