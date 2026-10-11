"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { presetRange, RANGE_LABELS, type RangePreset } from "@/lib/dates";

export type Period = { preset: RangePreset; start: string; end: string };

export function usePeriod(initial: RangePreset = "this_month") {
  const [period, setPeriod] = useState<Period>(() => ({ preset: initial, ...presetRange(initial)! }));
  return [period, setPeriod] as const;
}

export function PeriodPicker({
  value,
  onChange,
  presets = ["this_month", "last_month", "this_quarter", "this_year", "last_12_months", "all", "custom"],
}: {
  value: Period;
  onChange: (p: Period) => void;
  presets?: RangePreset[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
      <Select
        value={value.preset}
        onValueChange={(v) => {
          const preset = v as RangePreset;
          const range = presetRange(preset);
          onChange(range ? { preset, ...range } : { ...value, preset });
        }}
      >
        <SelectTrigger className="w-40" aria-label="Period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p} value={p}>
              {RANGE_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.preset === "custom" && (
        <>
          <Input type="date" aria-label="From" className="w-40" value={value.start} max={value.end} onChange={(e) => e.target.value && onChange({ ...value, start: e.target.value })} />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" aria-label="To" className="w-40" value={value.end} min={value.start} onChange={(e) => e.target.value && onChange({ ...value, end: e.target.value })} />
        </>
      )}
    </div>
  );
}
