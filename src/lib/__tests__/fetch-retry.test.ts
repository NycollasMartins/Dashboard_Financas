import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithClockSkewRetry } from "@/lib/supabase/fetch-with-clock-skew-retry";

const skew = () =>
  new Response(JSON.stringify({ code: "PGRST303", message: "JWT issued at future" }), { status: 401 });

describe("fetchWithClockSkewRetry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("repete uma vez quando o JWT parece 'do futuro'", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(skew()).mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const promise = fetchWithClockSkewRetry("http://x");
    await vi.runAllTimersAsync();
    expect(await (await promise).text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("não repete outros 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"code":"PGRST301"}', { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchWithClockSkewRetry("http://x")).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
