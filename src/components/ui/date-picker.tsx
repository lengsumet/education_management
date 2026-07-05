"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function parse(v?: string): Date | undefined {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function toStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

interface DatePickerProps {
  value: string; // yyyy-mm-dd (same as the old native <input type="date">)
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Themed date picker (Popover + react-day-picker) that replaces the native
 * <input type="date">. Shows Buddhist years (พ.ศ.) so it matches the rest of
 * the app; emits/accepts the same "yyyy-mm-dd" string the native input used.
 */
export function DatePicker({ value, onChange, placeholder = "เลือกวันที่", className, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parse(value);
  const label = selected
    ? `${selected.getDate()} ${TH_MONTHS_SHORT[selected.getMonth()]} ${selected.getFullYear() + 543}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-left transition-colors hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50",
            !selected && "text-slate-400",
            className
          )}
        >
          <span>{label}</span>
          <CalendarIcon size={16} className="text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div style={{ ["--rdp-accent-color" as any]: "var(--color-primary)", ["--rdp-accent-background-color" as any]: "var(--color-primary-light)" }}>
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              if (d) {
                onChange(toStr(d));
                setOpen(false);
              }
            }}
            showOutsideDays
            formatters={{
              formatCaption: (date) => `${TH_MONTHS_LONG[date.getMonth()]} ${date.getFullYear() + 543}`,
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
