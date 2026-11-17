import { z } from "zod";

export const emailSchema = z
  .string({ error: "Informe o e-mail." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "E-mail inválido." }).max(254, { error: "E-mail muito longo." }));

/** Espelha a política do Supabase (config.toml: mínimo 8, letras e números). */
export const passwordSchema = z
  .string({ error: "Informe a senha." })
  .min(8, { error: "A senha precisa ter pelo menos 8 caracteres." })
  .max(72, { error: "A senha pode ter no máximo 72 caracteres." })
  .regex(/[A-Za-z]/, { error: "A senha precisa ter pelo menos uma letra." })
  .regex(/\d/, { error: "A senha precisa ter pelo menos um número." });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Informe a senha." }).max(72),
  next: z.string().max(500).optional(),
});

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "Informe seu nome." })
    .max(120, { error: "Nome muito longo." }),
  email: emailSchema,
  password: passwordSchema,
  next: z.string().max(500).optional(),
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    error: "As senhas não conferem.",
    path: ["confirm"],
  });
