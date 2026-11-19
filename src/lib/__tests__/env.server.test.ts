import { describe, expect, it } from "vitest";
import { cleanEnvValue, parseServerEnv } from "../env.server";

const TOKEN = "123456789:TEST_token_abcdefghijklmnopqrstuvwxyz0123";

describe("cleanEnvValue", () => {
  it("tira espaços e aspas em volta; vazio vira ausente", () => {
    expect(cleanEnvValue(`  "${TOKEN}" `)).toBe(TOKEN);
    expect(cleanEnvValue(`'${TOKEN}'`)).toBe(TOKEN);
    expect(cleanEnvValue("   ")).toBeUndefined();
    expect(cleanEnvValue(undefined)).toBeUndefined();
    expect(cleanEnvValue('"')).toBe('"');
  });
});

describe("parseServerEnv", () => {
  it("variáveis ausentes deixam o recurso desligado e usam os padrões", () => {
    const { env, status } = parseServerEnv({});
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(env.TELEGRAM_BOT_USERNAME).toBe("LarMaisBot");
    expect(status.TELEGRAM_BOT_TOKEN).toBe("ausente");
  });

  it("token colado com aspas no painel é aceito (regressão: Telegram 'não configurado')", () => {
    const { env, status } = parseServerEnv({ TELEGRAM_BOT_TOKEN: `"${TOKEN}"` });
    expect(env.TELEGRAM_BOT_TOKEN).toBe(TOKEN);
    expect(status.TELEGRAM_BOT_TOKEN).toBe("ok");
  });

  it("um valor com formato errado desliga só aquele recurso, sem derrubar os outros", () => {
    const { env, status } = parseServerEnv({
      TELEGRAM_BOT_TOKEN: "bot" + TOKEN, // prefixo "bot" copiado da URL da API
      CRON_SECRET: "x".repeat(32),
      TELEGRAM_BOT_USERNAME: "@LarMaisBot",
    });
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(status.TELEGRAM_BOT_TOKEN).toBe("inválido");
    expect(env.CRON_SECRET).toBe("x".repeat(32));
    expect(status.CRON_SECRET).toBe("ok");
    expect(env.TELEGRAM_BOT_USERNAME).toBe("LarMaisBot");
    expect(status.TELEGRAM_BOT_USERNAME).toBe("inválido");
  });

  it("o status nunca contém o valor", () => {
    const { status } = parseServerEnv({ TELEGRAM_BOT_TOKEN: TOKEN });
    expect(JSON.stringify(status)).not.toContain("TEST_token");
  });
});
