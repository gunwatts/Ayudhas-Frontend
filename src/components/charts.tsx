"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMonth } from "@/lib/dates";
import { formatMoney, toNumber } from "@/lib/money";
import type { CategoryTotal, TrendPoint } from "@/lib/queries";

const SLOTS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)"];
const OTHER = "var(--axis)";

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color: string }[] }) {
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-popover-foreground">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="chart-swatch size-2 rounded-sm" style={{ background: r.color }} aria-hidden />
            {r.label}
          </span>
          <span className="num font-medium text-popover-foreground">{formatMoney(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="chart-swatch size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const axisTick = { fill: "var(--axis)", fontSize: 11 };

/** Income vs expenses per month — two series, one axis. */
export function CashflowChart({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  const rows = data.map((d) => ({ month: d.month, income: toNumber(d.income), expenses: toNumber(d.expenses), raw: d }));
  return (
    <figure className="grid gap-3">
      <Legend items={[{ label: "Income", color: "var(--chart-1)" }, { label: "Expenses", color: "var(--chart-2)" }]} />
      <div style={{ height }} role="img" aria-label="Monthly income and expenses bar chart. Values are listed in the table view.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
            <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m).split(" ")[0]} tick={axisTick} axisLine={{ stroke: "var(--grid)" }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v) => formatMoney(v, { compact: true })} tick={axisTick} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !p) return null;
                return (
                  <TooltipBox
                    title={formatMonth(p.month)}
                    rows={[
                      { label: "Income", value: p.raw.income, color: "var(--chart-1)" },
                      { label: "Expenses", value: p.raw.expenses, color: "var(--chart-2)" },
                      { label: "Net", value: p.raw.net, color: "transparent" },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="income" name="Income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="expenses" name="Expenses" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Share of spending by category: donut + labelled list (the list doubles as the table view). */
export function CategoryBreakdown({ data, emptyLabel = "No spending in this period" }: { data: CategoryTotal[]; emptyLabel?: string }) {
  const positive = data.filter((d) => toNumber(d.total) > 0);
  const top = positive.slice(0, 7);
  const rest = positive.slice(7);
  const otherTotal = rest.reduce((s, d) => s + toNumber(d.total), 0);
  const slices = [
    ...top.map((d, i) => ({ name: d.name, value: toNumber(d.total), raw: d.total, color: SLOTS[i] })),
    ...(rest.length ? [{ name: `Other (${rest.length})`, value: otherTotal, raw: otherTotal.toFixed(2), color: OTHER }] : []),
  ];
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (!slices.length) return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto size-[180px]" role="img" aria-label="Spending by category donut chart; values listed alongside.">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={slices.length > 1 ? 1.5 : 0} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof slices)[number] | undefined;
                if (!active || !p) return null;
                return <TooltipBox title={p.name} rows={[{ label: `${((p.value / total) * 100).toFixed(1)}% of total`, value: String(p.raw), color: p.color }]} />;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="num text-sm font-semibold">{formatMoney(total, { compact: total >= 1e5 })}</p>
          </div>
        </div>
      </div>
      <ul className="grid gap-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.name} className="grid grid-cols-[auto_1fr_auto_3.5rem] items-center gap-2">
            <span className="chart-swatch size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="truncate">{s.name}</span>
            <span className="num font-medium">{formatMoney(s.raw)}</span>
            <span className="num text-right text-xs text-muted-foreground">{((s.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Single-series monthly bars (e.g. spending trend for one category). */
export function MonthlyBars({ data, label, height = 200 }: { data: { month: string; value: string }[]; label: string; height?: number }) {
  const rows = data.map((d) => ({ ...d, n: toNumber(d.value) }));
  return (
    <div style={{ height }} role="img" aria-label={`${label} by month`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m).split(" ")[0]} tick={axisTick} axisLine={{ stroke: "var(--grid)" }} tickLine={false} />
          <YAxis tickFormatter={(v) => formatMoney(v, { compact: true })} tick={axisTick} axisLine={false} tickLine={false} width={56} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !p) return null;
              return <TooltipBox title={formatMonth(p.month)} rows={[{ label, value: p.value, color: "var(--chart-1)" }]} />;
            }}
          />
          <Bar dataKey="n" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
