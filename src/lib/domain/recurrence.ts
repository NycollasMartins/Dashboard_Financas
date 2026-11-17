import { addMonths, clampedDate, type ISODate } from "@/lib/dates";

/** Espelho de private.recurrence_dates (RN-14/15). */
export type Frequency = "weekly" | "monthly" | "yearly";

function toUTC(d: ISODate) {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}
function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10) as ISODate;
}
const DAY = 86_400_000;

export function recurrenceDates(
  r: { frequency: Frequency; dayOfMonth: number; startsOn: ISODate; endsOn?: ISODate | null },
  from: ISODate,
  to: ISODate,
): ISODate[] {
  const start = from > r.startsOn ? from : r.startsOn;
  const end = r.endsOn && r.endsOn < to ? r.endsOn : to;
  if (start > end) return [];
  const out: ISODate[] = [];

  if (r.frequency === "weekly") {
    const offset = Math.max(0, Math.ceil((toUTC(start) - toUTC(r.startsOn)) / DAY / 7)) * 7;
    for (let t = toUTC(r.startsOn) + offset * DAY; t <= toUTC(end); t += 7 * DAY) out.push(fromUTC(t));
    return out;
  }
  if (r.frequency === "monthly") {
    for (let m = `${start.slice(0, 7)}-01` as ISODate; m <= end; m = addMonths(m, 1)) {
      const [y, mo] = m.split("-").map(Number);
      const d = clampedDate(y, mo, r.dayOfMonth);
      if (d >= start && d <= end) out.push(d);
    }
    return out;
  }
  const month = Number(r.startsOn.slice(5, 7));
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) {
    const d = clampedDate(y, month, r.dayOfMonth);
    if (d >= start && d <= end) out.push(d);
  }
  return out;
}
