import { describe, expect, it } from "vitest";
import { recurrenceDates } from "@/lib/domain/recurrence";

describe("recurrenceDates (RN-14/15)", () => {
  it("mensal dia 31 → último dia nos meses curtos", () => {
    expect(
      recurrenceDates({ frequency: "monthly", dayOfMonth: 31, startsOn: "2027-01-01" }, "2027-01-01", "2027-04-30"),
    ).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });
  it("respeita início e fim", () => {
    expect(
      recurrenceDates(
        { frequency: "monthly", dayOfMonth: 5, startsOn: "2026-11-10", endsOn: "2027-02-01" },
        "2026-01-01",
        "2027-12-31",
      ),
    ).toEqual(["2026-12-05", "2027-01-05"]);
  });
  it("semanal a partir do dia de início", () => {
    expect(recurrenceDates({ frequency: "weekly", dayOfMonth: 1, startsOn: "2027-01-04" }, "2027-01-01", "2027-01-31")).toEqual([
      "2027-01-04",
      "2027-01-11",
      "2027-01-18",
      "2027-01-25",
    ]);
  });
  it("semanal retomando no meio do caminho", () => {
    expect(recurrenceDates({ frequency: "weekly", dayOfMonth: 1, startsOn: "2027-01-04" }, "2027-01-12", "2027-01-20")).toEqual([
      "2027-01-18",
    ]);
  });
  it("anual em 29/02", () => {
    expect(recurrenceDates({ frequency: "yearly", dayOfMonth: 29, startsOn: "2028-02-29" }, "2028-01-01", "2030-12-31")).toEqual([
      "2028-02-29",
      "2029-02-28",
      "2030-02-28",
    ]);
  });
  it("vazio quando o intervalo é anterior ao início", () => {
    expect(recurrenceDates({ frequency: "monthly", dayOfMonth: 1, startsOn: "2027-01-01" }, "2026-01-01", "2026-12-31")).toEqual([]);
  });
});
