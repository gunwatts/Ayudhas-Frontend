"use client";

import { ChevronLeft, ChevronRight, Donut, Rows3 } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { type CategoryDrill, CategoryTransactionsDialog } from "@/components/category-transactions";
import { ProgressBar, utilizationTone } from "@/components/common";
import { AnimatedMoney } from "@/components/motion";
import { formatMonth } from "@/lib/dates";
import { formatMoney, toNumber } from "@/lib/money";
import type { CategoryTotal, TrendPoint } from "@/lib/queries";
import { cn } from "@/lib/utils";

const SLOTS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"];
const OTHER = "var(--axis)";
const axisTick = { fill: "var(--axis)", fontSize: 11 };
const EASE = "ease-out" as const;

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");

/** Short month label; January (and the first point) also shows the year so long ranges stay unambiguous. */
function monthTick(m: string, i: number) {
  const [y, mm] = m.split("-");
  const short = formatMonth(m).split(" ")[0];
  return i === 0 || mm === "01" ? `${short} ’${y.slice(2)}` : short;
}

function TooltipBox({ title, rows, note }: { title: string; rows: { label: string; value: string; color: string; strong?: boolean }[]; note?: string }) {
  return (
    <div className="min-w-48 rounded-xl border bg-popover/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-md">
      <p className="mb-1.5 font-semibold text-popover-foreground">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="chart-swatch size-2 rounded-full" style={{ background: r.color }} aria-hidden />
            {r.label}
          </span>
          <span className={cn("num text-popover-foreground", r.strong ? "font-semibold" : "font-medium")}>{r.value}</span>
        </div>
      ))}
      {note && <p className="mt-1.5 border-t pt-1.5 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Soft rounded band behind the hovered month (replaces the default grey box). */
function CursorBand(props: { x?: number; y?: number; width?: number; height?: number }) {
  const { x = 0, y = 0, width = 0, height = 0 } = props;
  return <rect x={x + 2} y={y} width={Math.max(0, width - 4)} height={height} rx={10} fill="var(--foreground)" fillOpacity={0.045} />;
}

const SOURCE_NOTE: Record<string, string> = {
  income: "Salary from income recorded under Salary",
  set: "Salary set for the month",
  none: "No salary recorded for this month",
};

type SeriesKey = "salary" | "expenses" | "remaining";
const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "salary", label: "Salary", color: "var(--salary)" },
  { key: "expenses", label: "Spent", color: "var(--spend)" },
  { key: "remaining", label: "Remaining", color: "var(--remain)" },
];

/**
 * Salary vs expenses per month: two bars (salary received, money spent) and a line for what remained.
 * Hover for details; click a month (or use the arrows) to pin it in the summary below the chart.
 */
export function SalaryExpensesChart({ data, height = 280 }: { data: TrendPoint[]; height?: number }) {
  const gid = safeId(useId());
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const rows = useMemo(
    () =>
      data.map((d, i) => ({
        month: d.month,
        tick: monthTick(d.month, i),
        salary: toNumber(d.salary),
        expenses: toNumber(d.expenses),
        remaining: toNumber(d.remaining),
        raw: d,
      })),
    [data],
  );
  const lastWithData = useMemo(() => {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].salary || rows[i].expenses) return i;
    return rows.length - 1;
  }, [rows]);
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked !== null && picked < rows.length ? picked : lastWithData;
  const sel = rows[selected];
  const hasNegative = rows.some((r) => r.remaining < 0);

  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">No months to show yet</p>;

  const toggle = (k: SeriesKey) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(k)) next.delete(k);
      else if (next.size < SERIES.length - 1) next.add(k);
      return next;
    });

  const pct = sel && sel.salary > 0 ? (sel.expenses / sel.salary) * 100 : null;

  return (
    <figure className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show or hide series">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={!hidden.has(s.key)}
            onClick={() => toggle(s.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              hidden.has(s.key) ? "text-muted-foreground opacity-60" : "bg-card text-foreground",
            )}
          >
            <span className={cn("chart-swatch size-2.5", s.key === "remaining" ? "h-0.5 w-3 rounded-full" : "rounded-full")} style={{ background: s.color }} aria-hidden />
            {s.label}
          </button>
        ))}
      </div>
      <div className="min-w-0" style={{ height }} role="img" aria-label="Monthly salary, spending and remaining money. Select a month for its summary; values are also listed in the table view.">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            barGap={3}
            barCategoryGap="22%"
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            onClick={(state: { activeTooltipIndex?: number | string | null; activeIndex?: number | string | null } | null) => {
              const raw = state?.activeTooltipIndex ?? state?.activeIndex;
              const i = raw === null || raw === undefined ? NaN : Number(raw);
              if (!Number.isNaN(i)) setPicked(i);
            }}
            style={{ cursor: "pointer" }}
          >
            <defs>
              <linearGradient id={`${gid}-sal`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--salary)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--salary)" stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id={`${gid}-exp`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--spend)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--spend)" stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="tick" tick={axisTick} axisLine={{ stroke: "var(--grid)" }} tickLine={false} interval="preserveStartEnd" minTickGap={8} tickMargin={8} />
            <YAxis
              tickFormatter={(v) => formatMoney(v, { compact: true })}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={60}
              domain={[(min: number) => Math.min(0, min), "auto"]}
            />
            {hasNegative && <ReferenceLine y={0} stroke="var(--axis)" strokeDasharray="4 4" />}
            <Tooltip
              cursor={<CursorBand />}
              wrapperStyle={{ outline: "none", zIndex: 10 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !p) return null;
                const spentPct = p.salary > 0 ? `${((p.expenses / p.salary) * 100).toFixed(0)}% of salary spent` : undefined;
                return (
                  <TooltipBox
                    title={formatMonth(p.month)}
                    rows={[
                      { label: "Salary", value: formatMoney(p.raw.salary), color: "var(--salary)" },
                      { label: "Spent", value: formatMoney(p.raw.expenses), color: "var(--spend)" },
                      { label: "Remaining", value: formatMoney(p.raw.remaining), color: "var(--remain)", strong: true },
                    ]}
                    note={[SOURCE_NOTE[p.raw.salary_source], spentPct].filter(Boolean).join(" · ")}
                  />
                );
              }}
            />
            <Bar dataKey="salary" name="Salary" fill={`url(#${gid}-sal)`} radius={[6, 6, 0, 0]} maxBarSize={22} hide={hidden.has("salary")} animationDuration={900} animationEasing={EASE}>
              {rows.map((r, i) => (
                <Cell key={r.month} fillOpacity={i === selected ? 1 : 0.55} />
              ))}
            </Bar>
            <Bar dataKey="expenses" name="Spent" fill={`url(#${gid}-exp)`} radius={[6, 6, 0, 0]} maxBarSize={22} hide={hidden.has("expenses")} animationDuration={900} animationBegin={120} animationEasing={EASE}>
              {rows.map((r, i) => (
                <Cell key={r.month} fillOpacity={i === selected ? 1 : 0.55} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="remaining"
              name="Remaining"
              stroke="var(--remain)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--card)", stroke: "var(--remain)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2, fill: "var(--remain)" }}
              hide={hidden.has("remaining")}
              animationDuration={1100}
              animationBegin={250}
              animationEasing={EASE}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {sel && (
        <div className="grid gap-3 rounded-xl border bg-card/60 p-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-5">
          <div className="flex items-center gap-1">
            <button type="button" className="grid size-7 place-items-center rounded-md hover:bg-muted disabled:opacity-40" onClick={() => setPicked(Math.max(0, selected - 1))} disabled={selected === 0} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </button>
            <p className="min-w-24 text-center text-sm font-semibold" aria-live="polite">{formatMonth(sel.month)}</p>
            <button type="button" className="grid size-7 place-items-center rounded-md hover:bg-muted disabled:opacity-40" onClick={() => setPicked(Math.min(rows.length - 1, selected + 1))} disabled={selected === rows.length - 1} aria-label="Next month">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid gap-2">
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Salary</dt>
                <dd className="truncate text-sm font-semibold text-salary sm:text-base"><AnimatedMoney value={sel.raw.salary} duration={500} /></dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Spent</dt>
                <dd className="truncate text-sm font-semibold sm:text-base"><AnimatedMoney value={sel.raw.expenses} duration={500} /></dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Remaining</dt>
                <dd className="truncate text-sm font-semibold sm:text-base"><AnimatedMoney value={sel.raw.remaining} tone="auto" duration={500} /></dd>
              </div>
            </dl>
            {pct === null ? (
              <p className="text-xs text-muted-foreground">{SOURCE_NOTE.none}</p>
            ) : (
              <div className="grid gap-1">
                <ProgressBar value={pct} tone={utilizationTone(pct)} label={`${formatMonth(sel.month)}: share of salary spent`} />
                <p className="text-[11px] text-muted-foreground">
                  {pct.toFixed(0)}% of salary spent · {SOURCE_NOTE[sel.raw.salary_source]}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </figure>
  );
}

type Slice = { name: string; value: number; raw: string; color: string; ids: (number | null)[] };

export type CompareRow = { key: string; label: string; a: string; b: string };

/**
 * Two figures side by side per month (or per project) with the difference as a line: income vs expenses,
 * salary vs expenses, business income vs costs. `rows` are in display order; amounts are API strings.
 */
export function CompareChart({
  rows,
  aLabel,
  bLabel,
  netLabel,
  aColor = "var(--salary)",
  bColor = "var(--spend)",
  height = 280,
  monthly = true,
  emptyLabel = "Nothing recorded for this view yet",
}: {
  rows: CompareRow[];
  aLabel: string;
  bLabel: string;
  netLabel: string;
  aColor?: string;
  bColor?: string;
  height?: number;
  /** Rows are months ("2026-10"): ticks are shortened and the tooltip shows the month name. */
  monthly?: boolean;
  emptyLabel?: string;
}) {
  const data = useMemo(
    () =>
      rows.map((r, i) => {
        const a = toNumber(r.a);
        const b = toNumber(r.b);
        return { ...r, tick: monthly ? monthTick(r.key, i) : r.label, av: a, bv: b, net: a - b };
      }),
    [rows, monthly],
  );
  const empty = data.every((d) => !d.av && !d.bv);
  if (!data.length || empty) return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  const hasNegative = data.some((d) => d.net < 0);
  const totalA = data.reduce((t, d) => t + d.av, 0);
  const totalB = data.reduce((t, d) => t + d.bv, 0);
  return (
    <figure className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {[
          { label: aLabel, color: aColor, value: totalA },
          { label: bLabel, color: bColor, value: totalB },
          { label: netLabel, color: "var(--remain)", value: totalA - totalB, line: true },
        ].map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className={cn("chart-swatch", s.line ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-full")} style={{ background: s.color }} aria-hidden />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="num font-medium">{formatMoney(s.value)}</span>
          </span>
        ))}
      </div>
      <div className="min-w-0" style={{ height }} role="img" aria-label={`${aLabel} and ${bLabel} compared, with ${netLabel.toLowerCase()} as a line.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} barGap={3} barCategoryGap="22%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="tick" tick={axisTick} axisLine={{ stroke: "var(--grid)" }} tickLine={false} interval="preserveStartEnd" minTickGap={8} tickMargin={8} />
            <YAxis tickFormatter={(v) => formatMoney(v, { compact: true })} tick={axisTick} axisLine={false} tickLine={false} width={60} domain={[(min: number) => Math.min(0, min), "auto"]} />
            {hasNegative && <ReferenceLine y={0} stroke="var(--axis)" strokeDasharray="4 4" />}
            <Tooltip
              cursor={<CursorBand />}
              wrapperStyle={{ outline: "none", zIndex: 10 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!active || !p) return null;
                return (
                  <TooltipBox
                    title={monthly ? formatMonth(p.key) : p.label}
                    rows={[
                      { label: aLabel, value: formatMoney(p.a), color: aColor },
                      { label: bLabel, value: formatMoney(p.b), color: bColor },
                      { label: netLabel, value: formatMoney(p.net), color: "var(--remain)", strong: true },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="av" name={aLabel} fill={aColor} fillOpacity={0.85} radius={[6, 6, 0, 0]} maxBarSize={22} animationDuration={800} animationEasing={EASE} />
            <Bar dataKey="bv" name={bLabel} fill={bColor} fillOpacity={0.85} radius={[6, 6, 0, 0]} maxBarSize={22} animationDuration={800} animationBegin={100} animationEasing={EASE} />
            <Line type="monotone" dataKey="net" name={netLabel} stroke="var(--remain)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--card)", stroke: "var(--remain)", strokeWidth: 2 }} animationDuration={1000} animationBegin={200} animationEasing={EASE} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function buildSlices(data: CategoryTotal[], max = 7): Slice[] {
  const positive = data.filter((d) => toNumber(d.total) > 0).sort((a, b) => toNumber(b.total) - toNumber(a.total));
  const top = positive.slice(0, max);
  const rest = positive.slice(max);
  const otherTotal = rest.reduce((s, d) => s + toNumber(d.total), 0);
  return [
    ...top.map((d, i) => ({ name: d.name, value: toNumber(d.total), raw: d.total, color: SLOTS[i % SLOTS.length], ids: [d.category_id] })),
    ...(rest.length ? [{ name: `Other (${rest.length} categories)`, value: otherTotal, raw: otherTotal.toFixed(2), color: OTHER, ids: rest.map((d) => d.category_id) }] : []),
  ];
}

const DOUBLE_TAP_MS = 400;

/**
 * Where the money went, by category. Two views of the same numbers: a donut for share, and ranked bars for
 * comparing amounts. The list beside the donut doubles as its table view; nothing is cut off at any width.
 * With `period`, double-clicking (or double-tapping) a category opens its transactions; Enter does it from the keyboard.
 */
export function CategoryBreakdown({
  data,
  emptyLabel = "No spending in this period",
  defaultView = "donut",
  period,
  kind = "expense",
}: {
  data: CategoryTotal[];
  emptyLabel?: string;
  defaultView?: "donut" | "bars";
  /** The date range `data` covers. Enables the transactions pop-up. */
  period?: { start: string; end: string };
  kind?: "expense" | "income";
}) {
  const [view, setView] = useState<"donut" | "bars">(defaultView);
  const [active, setActive] = useState<number | null>(null);
  const [drill, setDrill] = useState<CategoryDrill | null>(null);
  const lastTap = useRef<{ index: number; at: number } | null>(null);
  const slices = useMemo(() => buildSlices(data), [data]);
  const open = (i: number) => {
    const s = slices[i];
    if (period && s) setDrill({ name: s.name, color: s.color, categoryIds: s.ids, kind, start: period.start, end: period.end });
  };
  // Two clicks on the same category within DOUBLE_TAP_MS: works for a mouse double-click and a touch double-tap.
  const tap = (i: number, now: number) => {
    const last = lastTap.current;
    lastTap.current = { index: i, at: now };
    if (last && last.index === i && now - last.at < DOUBLE_TAP_MS) {
      lastTap.current = null;
      open(i);
    }
  };
  const rowProps = (i: number) =>
    period
      ? {
          onClick: (e: React.MouseEvent) => tap(i, e.timeStamp),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
              e.preventDefault();
              open(i);
            }
          },
          "aria-haspopup": "dialog" as const,
          title: "Double-click to see transactions",
        }
      : {};
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (!slices.length) return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  const focus = active !== null ? slices[active] : null;
  const max = Math.max(...slices.map((s) => s.value));

  return (
    <div className="@container grid min-w-0 grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {period ? <p className="text-xs text-muted-foreground">Double-click a category to see its transactions.</p> : <span />}
        <div className="inline-flex rounded-lg border bg-card/60 p-0.5" role="group" aria-label="Chart view">
          {(
            [
              ["donut", "Share", Donut],
              ["bars", "Ranking", Rows3],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors", view === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <Icon className="size-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      {view === "donut" ? (
        <div className="grid items-center gap-5 @[34rem]:grid-cols-[minmax(12rem,15rem)_1fr]">
          <div className="relative mx-auto aspect-square w-full max-w-60" role="img" aria-label="Spending by category donut chart; amounts are listed alongside.">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="66%"
                  outerRadius="92%"
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  cornerRadius={4}
                  stroke="none"
                  animationDuration={900}
                  animationEasing={EASE}
                  onMouseEnter={(_, i) => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onClick={period ? (_, i, e) => tap(i, e.timeStamp) : undefined}
                  style={period ? { cursor: "pointer" } : undefined}
                >
                  {slices.map((s, i) => (
                    <Cell key={s.name} fill={s.color} fillOpacity={active === null || active === i ? 1 : 0.3} style={{ transition: "fill-opacity 0.2s" }} />
                  ))}
                </Pie>
                {focus && (
                  <Pie data={slices} dataKey="value" innerRadius="93%" outerRadius="100%" paddingAngle={slices.length > 1 ? 2 : 0} cornerRadius={4} stroke="none" isAnimationActive={false} legendType="none" tooltipType="none">
                    {slices.map((s, i) => (
                      <Cell key={s.name} fill={i === active ? s.color : "transparent"} />
                    ))}
                  </Pie>
                )}
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
              <div className="grid min-w-0 gap-0.5">
                <p className="truncate text-[11px] text-muted-foreground" title={focus?.name}>{focus ? focus.name : "Total"}</p>
                <p className="num text-base font-semibold">{formatMoney(focus ? focus.value : total, { compact: (focus ? focus.value : total) >= 1e5 })}</p>
                {focus && <p className="num text-[11px] text-muted-foreground">{((focus.value / total) * 100).toFixed(1)}%</p>}
              </div>
            </div>
          </div>
          <ul className="grid gap-1 text-sm">
            {slices.map((s, i) => {
              const share = (s.value / total) * 100;
              return (
                <li key={s.name}>
                  <button
                    type="button"
                    className={cn("grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 rounded-lg px-2 py-1.5 text-left transition-colors select-none hover:bg-muted", active === i && "bg-muted")}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    {...rowProps(i)}
                  >
                    <span className="chart-swatch size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                    <span className="break-words leading-snug">{s.name}</span>
                    <span className="num text-right font-medium whitespace-nowrap">
                      {formatMoney(s.raw)} <span className="ml-1 text-xs font-normal text-muted-foreground">{share.toFixed(1)}%</span>
                    </span>
                    <span aria-hidden className="col-span-2 col-start-2 h-1 overflow-hidden rounded-full bg-muted">
                      <span className="animate-grow-x block h-full rounded-full" style={{ width: `${share}%`, background: s.color, animationDelay: `${i * 60}ms` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <ol className="grid gap-3" aria-label="Spending by category, largest first">
          {slices.map((s, i) => (
            <li key={s.name}>
              <button type="button" className="grid w-full gap-1.5 rounded-lg px-1 py-1 text-left transition-colors select-none hover:bg-muted/60" {...rowProps(i)}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="num w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="break-words">{s.name}</span>
                </span>
                <span className="num shrink-0 font-medium">
                  {formatMoney(s.raw)} <span className="ml-1 text-xs font-normal text-muted-foreground">{((s.value / total) * 100).toFixed(1)}%</span>
                </span>
              </div>
              <div className="ml-7 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="animate-grow-x h-full rounded-full" style={{ width: `${(s.value / max) * 100}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${s.color} 65%, transparent), ${s.color})`, animationDelay: `${i * 70}ms` }} />
              </div>
              </button>
            </li>
          ))}
        </ol>
      )}
      {period && <CategoryTransactionsDialog drill={drill} onOpenChange={(o) => !o && setDrill(null)} />}
    </div>
  );
}
