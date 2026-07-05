/**
 * Schedule / day-of-week utilities.
 *
 * The Prisma DayOfWeek enum stores values as MON, TUE, WED, THU, FRI, SAT, SUN.
 * The original makeup-class API mapped days using lowercase full names
 * ("monday", "tuesday", ...), which never matched the enum, so every student
 * schedule row rendered as "ไม่ระบุ". This helper is the single source of
 * truth for turning an enum value into a Thai day label.
 */

const THAI_DAY_BY_ENUM: Record<string, string> = {
  MON: "จันทร์",
  TUE: "อังคาร",
  WED: "พุธ",
  THU: "พฤหัสบดี",
  FRI: "ศุกร์",
  SAT: "เสาร์",
  SUN: "อาทิตย์",
};

const THAI_DAY_BY_INDEX: Record<number, string> = {
  0: "อาทิตย์",
  1: "จันทร์",
  2: "อังคาร",
  3: "พุธ",
  4: "พฤหัสบดี",
  5: "ศุกร์",
  6: "เสาร์",
};

/** Map a DayOfWeek enum value (MON/TUE/...) to a Thai day label. */
export function thaiDayFromEnum(day?: string | null): string {
  if (!day) return "ไม่ระบุ";
  return THAI_DAY_BY_ENUM[day.toUpperCase()] || day;
}

/** Map a JS Date().getDay() index (0=Sun) to a Thai day label. */
export function thaiDayFromDateIndex(index: number): string {
  return THAI_DAY_BY_INDEX[index] ?? "ไม่ระบุ";
}

/** Map a JS Date to a Thai day label. */
export function thaiDayFromDate(date: Date): string {
  return thaiDayFromDateIndex(date.getDay());
}

/** Format a stored Time value (Prisma @db.Time -> Date) as HH:mm. */
export function formatTime(value?: Date | string | null): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
