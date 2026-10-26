'use client';

import { useMemo, useState } from 'react';
import { formatGHS } from '@/lib/currency';

export interface SalesTrendPoint {
  date: string;
  totalPesewas: number;
  orderCount: number;
}

type TrendRange = 'daily' | 'monthly' | 'yearly';

const CHART_WIDTH = 640;
const CHART_HEIGHT = 240;
const CHART_LEFT = 64;
const CHART_RIGHT = 16;
const CHART_TOP = 20;
const CHART_BOTTOM = 44;
const TICK_COUNT = 4;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RANGE_LABELS: Record<TrendRange, { title: string; empty: string }> = {
  daily: { title: 'Order value by day · last 7 days', empty: 'No orders in the last 7 days.' },
  monthly: { title: 'Order value by day · last 30 days', empty: 'No orders in the last 30 days.' },
  yearly: { title: 'Order value by month · last 12 months', empty: 'No orders in the last 12 months.' },
};

function formatAxisValue(pesewas: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(pesewas / 100);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getRangePoints(points: SalesTrendPoint[], range: TrendRange): SalesTrendPoint[] {
  if (range === 'daily') return points.slice(-7);
  if (range === 'monthly') return points.slice(-30);

  const totalsByMonth = new Map<string, SalesTrendPoint>();
  for (const point of points) {
    const month = point.date.slice(0, 7);
    const total = totalsByMonth.get(month) ?? { date: `${month}-01`, totalPesewas: 0, orderCount: 0 };
    total.totalPesewas += point.totalPesewas;
    total.orderCount += point.orderCount;
    totalsByMonth.set(month, total);
  }

  const lastDate = points.at(-1)?.date;
  if (!lastDate) return [];
  const lastDay = new Date(`${lastDate}T00:00:00.000Z`);
  const startMonth = new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth() - 11, 1));
  const months: SalesTrendPoint[] = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const monthDate = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + offset, 1));
    const key = monthDate.toISOString().slice(0, 7);
    months.push(totalsByMonth.get(key) ?? { date: `${key}-01`, totalPesewas: 0, orderCount: 0 });
  }
  return months;
}

export default function SalesTrend({ points }: { points: SalesTrendPoint[] }) {
  const [range, setRange] = useState<TrendRange>('daily');
  const chartPoints = useMemo(() => getRangePoints(points, range), [points, range]);
  const plotWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const maxValue = Math.max(...chartPoints.map((point) => point.totalPesewas), 0);
  const scaleMax = maxValue > 0 ? maxValue * 1.15 : 1;
  const slotWidth = plotWidth / Math.max(chartPoints.length, 1);
  const barWidth = Math.min(range === 'yearly' ? 28 : 36, slotWidth * 0.48);
  const totalPesewas = chartPoints.reduce((total, point) => total + point.totalPesewas, 0);
  const totalOrders = chartPoints.reduce((total, point) => total + point.orderCount, 0);
  const description = chartPoints
    .map((point) => `${formatDate(point.date)}: ${formatGHS(point.totalPesewas)} from ${point.orderCount} orders`)
    .join('; ');

  return (
    <section className="mb-8 rounded-2xl border border-border-beige bg-surface-card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-ink">Sales trend</h2>
          <p className="mt-1 text-sm text-ink-muted">{RANGE_LABELS[range].title}</p>
        </div>
        <div className="text-right">
          <p className="font-serif text-xl font-semibold text-brand-green">{formatGHS(totalPesewas)}</p>
          <p className="text-xs text-ink-muted">{totalOrders} orders placed</p>
        </div>
      </div>

      <div className="mb-5 inline-flex rounded-xl border border-border-beige bg-surface-cream/70 p-1" role="group" aria-label="Sales chart range">
        {(['daily', 'monthly', 'yearly'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRange(option)}
            aria-pressed={range === option}
            className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green ${
              range === option ? 'bg-brand-green text-white shadow-sm' : 'text-ink-muted hover:bg-brand-green hover:text-white'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {totalOrders === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl bg-surface-cream/60 text-sm text-ink-muted">
          {RANGE_LABELS[range].empty}
        </div>
      ) : (
        <div className="w-full overflow-hidden">
          <svg
            className="block h-auto w-full"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={`Sales trend. ${description}. Total ${formatGHS(totalPesewas)} from ${totalOrders} orders.`}
          >
            <title>{`Sales trend: ${RANGE_LABELS[range].title}`}</title>
            {Array.from({ length: TICK_COUNT + 1 }, (_, index) => {
              const value = (scaleMax / TICK_COUNT) * index;
              const y = CHART_TOP + plotHeight - (plotHeight / TICK_COUNT) * index;
              return (
                <g key={index}>
                  <line
                    x1={CHART_LEFT}
                    x2={CHART_WIDTH - CHART_RIGHT}
                    y1={y}
                    y2={y}
                    stroke="var(--color-border-beige)"
                    strokeDasharray={index === 0 ? undefined : '4 5'}
                  />
                  <text
                    x={CHART_LEFT - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="var(--color-ink-muted)"
                    fontSize="11"
                  >
                    {formatAxisValue(value)}
                  </text>
                </g>
              );
            })}
            {chartPoints.map((point, index) => {
              const barHeight = (point.totalPesewas / scaleMax) * plotHeight;
              const x = CHART_LEFT + slotWidth * index + (slotWidth - barWidth) / 2;
              const y = CHART_TOP + plotHeight - barHeight;
              const date = new Date(`${point.date}T00:00:00.000Z`);
              const label =
                range === 'daily'
                  ? WEEKDAYS[date.getUTCDay()]
                  : range === 'monthly'
                    ? String(date.getUTCDate())
                    : MONTHS[date.getUTCMonth()];
              const showLabel = range !== 'monthly' || index % 5 === 0 || index === chartPoints.length - 1;

              return (
                <g key={point.date}>
                  <title>{`${formatDate(point.date)}: ${formatGHS(point.totalPesewas)} from ${point.orderCount} orders`}</title>
                  <rect
                    x={x}
                    y={point.totalPesewas > 0 ? y : CHART_TOP + plotHeight - 2}
                    width={barWidth}
                    height={point.totalPesewas > 0 ? Math.max(barHeight, 2) : 2}
                    rx="6"
                    fill="var(--color-brand-green)"
                    opacity={point.totalPesewas > 0 ? 0.82 : 0.16}
                  />
                  {showLabel && (
                    <text
                      x={CHART_LEFT + slotWidth * index + slotWidth / 2}
                      y={CHART_HEIGHT - 14}
                      textAnchor="middle"
                      fill="var(--color-ink-muted)"
                      fontSize="12"
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Based on order totals, including orders awaiting payment or approval.
      </p>
    </section>
  );
}
