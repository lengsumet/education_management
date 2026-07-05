"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AppSelectOption {
  value: string;
  label: React.ReactNode;
}

interface AppSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Themed dropdown that drops in for a native <select>. Uses the Radix Select
 * (select.tsx) so the OPEN menu matches the app theme instead of the browser
 * default. Radix forbids an empty-string item value, so options with value ""
 * are treated as the placeholder and filtered out of the menu.
 */
export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  disabled,
}: AppSelectProps) {
  const items = options.filter((o) => o.value !== "");
  const empty = options.find((o) => o.value === "");
  const ph = placeholder ?? (typeof empty?.label === "string" ? empty.label : undefined);

  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={ph} />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
