"use client";

import { useMemo } from "react";

export interface TimetableItem {
  day: string; // Full Thai day name, e.g. "จันทร์"
  time: string; // "HH:MM - HH:MM"
  code: string;
  name: string;
  room?: string;
  instructor?: string;
}

interface WeeklyTimetableProps {
  items: TimetableItem[];
}

const DAY_ORDER = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

// Deterministic per-course color so the same course keeps its color across the grid.
const PALETTE = [
  "bg-blue-100 border-blue-300 text-blue-800",
  "bg-green-100 border-green-300 text-green-800",
  "bg-purple-100 border-purple-300 text-purple-800",
  "bg-amber-100 border-amber-300 text-amber-800",
  "bg-pink-100 border-pink-300 text-pink-800",
  "bg-teal-100 border-teal-300 text-teal-800",
  "bg-indigo-100 border-indigo-300 text-indigo-800",
  "bg-rose-100 border-rose-300 text-rose-800",
];

function colorFor(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

// "HH:MM" -> minutes since midnight, or null if unparseable.
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function parseSlot(time: string): { start: number; end: number } | null {
  const parts = time.split("-");
  if (parts.length !== 2) return null;
  const start = toMinutes(parts[0]);
  const end = toMinutes(parts[1]);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

interface Placed extends TimetableItem {
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

const PX_PER_MIN = 1.1;

export function WeeklyTimetable({ items }: WeeklyTimetableProps) {
  const { days, placedByDay, unscheduled, startMin, endMin, hours } = useMemo(() => {
    const scheduled: (TimetableItem & { start: number; end: number })[] = [];
    const unsched: TimetableItem[] = [];

    for (const item of items) {
      const slot = parseSlot(item.time);
      if (!slot || !DAY_ORDER.includes(item.day)) {
        unsched.push(item);
      } else {
        scheduled.push({ ...item, start: slot.start, end: slot.end });
      }
    }

    // Only show days that actually have classes; keep canonical order.
    const activeDays = DAY_ORDER.filter((d) => scheduled.some((s) => s.day === d));

    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const s of scheduled) {
      minStart = Math.min(minStart, s.start);
      maxEnd = Math.max(maxEnd, s.end);
    }
    if (!isFinite(minStart)) {
      minStart = 8 * 60;
      maxEnd = 18 * 60;
    }
    // Snap to whole hours for a clean axis.
    const gridStart = Math.floor(minStart / 60) * 60;
    const gridEnd = Math.ceil(maxEnd / 60) * 60;

    // Lane-packing per day so overlapping classes sit side by side.
    const byDay = new Map<string, Placed[]>();
    for (const day of activeDays) {
      const dayItems = scheduled
        .filter((s) => s.day === day)
        .sort((a, b) => a.start - b.start);

      const laneEnds: number[] = []; // end-minute of the last class in each lane
      const placed: Placed[] = [];
      for (const it of dayItems) {
        let lane = laneEnds.findIndex((endM) => endM <= it.start);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(it.end);
        } else {
          laneEnds[lane] = it.end;
        }
        placed.push({ ...it, lane, lanes: 1 });
      }
      const laneCount = laneEnds.length;
      placed.forEach((p) => (p.lanes = laneCount));
      byDay.set(day, placed);
    }

    const hourLabels: number[] = [];
    for (let h = gridStart; h <= gridEnd; h += 60) hourLabels.push(h);

    return {
      days: activeDays,
      placedByDay: byDay,
      unscheduled: unsched,
      startMin: gridStart,
      endMin: gridEnd,
      hours: hourLabels,
    };
  }, [items]);

  const gridHeight = (endMin - startMin) * PX_PER_MIN;
  const fmtHour = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  if (days.length === 0 && unscheduled.length === 0) {
    return <div className="text-center py-8 text-slate-500">ยังไม่มีตารางเรียน</div>;
  }

  return (
    <div className="space-y-4">
      {days.length > 0 && (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Day headers */}
            <div className="flex border-b border-slate-200">
              <div className="w-14 shrink-0" />
              {days.map((day) => (
                <div
                  key={day}
                  className="flex-1 text-center py-2 font-semibold text-slate-900 text-sm border-l border-slate-200"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Grid body */}
            <div className="flex" style={{ height: gridHeight }}>
              {/* Time gutter */}
              <div className="w-14 shrink-0 relative">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute right-1 -translate-y-1/2 text-xs text-slate-400"
                    style={{ top: (h - startMin) * PX_PER_MIN }}
                  >
                    {fmtHour(h)}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day) => (
                <div key={day} className="flex-1 relative border-l border-slate-200">
                  {/* Hour gridlines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-slate-100"
                      style={{ top: (h - startMin) * PX_PER_MIN }}
                    />
                  ))}
                  {/* Class blocks */}
                  {(placedByDay.get(day) || []).map((p, idx) => {
                    const top = (p.start - startMin) * PX_PER_MIN;
                    const height = (p.end - p.start) * PX_PER_MIN;
                    const widthPct = 100 / p.lanes;
                    return (
                      <div
                        key={idx}
                        className={`absolute rounded-md border px-1.5 py-1 overflow-hidden ${colorFor(p.code)}`}
                        style={{
                          top: top + 1,
                          height: height - 2,
                          left: `calc(${p.lane * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                        title={`${p.code} ${p.name}\n${p.time}${p.room ? `\nห้อง ${p.room}` : ""}${p.instructor ? `\n${p.instructor}` : ""}`}
                      >
                        <p className="text-[11px] font-bold font-mono leading-tight truncate">{p.code}</p>
                        <p className="text-[10px] leading-tight line-clamp-2">{p.name}</p>
                        <p className="text-[10px] leading-tight opacity-80">{p.time}</p>
                        {p.room && <p className="text-[10px] leading-tight opacity-80 truncate">🏫 {p.room}</p>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="border-t border-slate-200 pt-3">
          <p className="text-xs font-medium text-slate-500 mb-2">ไม่ระบุวัน/เวลาเรียน</p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((u, idx) => (
              <span key={idx} className="text-xs px-2 py-1 bg-slate-100 rounded border border-slate-200">
                <span className="font-mono font-bold text-primary">{u.code}</span> {u.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
