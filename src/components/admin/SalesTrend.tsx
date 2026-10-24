import { formatGHS } from '@/lib/currency';

export interface SalesTrendPoint {
  date: string;
  totalPesewas: number;
  orderCount: number;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 240;
const CHART_LEFT = 64;
const CHART_RIGHT = 16;
const CHART_TOP = 20;
const CHART_BOTTOM = 44;
const TICK_COUNT = 4;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatAxisValue(pesewas: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(pesewas / 100);
}

export default function SalesTrend({ points }: { points: SalesTrendPoint[] }) {
  const plotWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const maxValue = Math.max(...points.map((point) => point.totalPesewas), 0);
  const scaleMax = maxValue > 0 ? maxValue * 1.15 : 1;
  const slotWidth = plotWidth / points.length;
  const barWidth = Math.min(36, slotWidth * 0.48);
  const totalPesewas = points.reduce((total, point) => total + point.totalPesewas, 0);
  const totalOrders = points.reduce((total, point) => total + point.orderCount, 0);
  const description = points
    .map((point) => {
      const date = new Date(`${point.date}T00:00:00.000Z`).toLocaleDateString('en-GH', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      });
      return `${date}: ${formatGHS(point.totalPesewas)} from ${point.orderCount} orders`;
    })
    .join('; ');

  return (
    <section className="mb-8 rounded-2xl border border-border-beige bg-surface-card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-ink">Sales trend</h2>
          <p className="mt-1 text-sm text-ink-muted">Order value by day · last 7 days</p>
        </div>
        <div className="text-right">
          <p className="font-serif text-xl font-semibold text-brand-green">{formatGHS(totalPesewas)}</p>
          <p className="text-xs text-ink-muted">{totalOrders} orders placed</p>
        </div>
      </div>

      {totalOrders === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl bg-surface-cream/60 text-sm text-ink-muted">
          No orders in the last 7 days.
        </div>
      ) : (
        <div className="w-full overflow-hidden">
          <svg
            className="block h-auto w-full"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={`Sales trend for the last seven days. ${description}. Total ${formatGHS(totalPesewas)} from ${totalOrders} orders.`}
          >
            <title>Order value by day for the last 7 days</title>
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
            {points.map((point, index) => {
              const barHeight = (point.totalPesewas / scaleMax) * plotHeight;
              const x = CHART_LEFT + slotWidth * index + (slotWidth - barWidth) / 2;
              const y = CHART_TOP + plotHeight - barHeight;
              const day = WEEKDAYS[new Date(`${point.date}T00:00:00.000Z`).getUTCDay()];

              return (
                <g key={point.date}>
                  <rect
                    x={x}
                    y={point.totalPesewas > 0 ? y : CHART_TOP + plotHeight - 2}
                    width={barWidth}
                    height={point.totalPesewas > 0 ? Math.max(barHeight, 2) : 2}
                    rx="6"
                    fill="var(--color-brand-green)"
                    opacity={point.totalPesewas > 0 ? 0.82 : 0.16}
                  />
                  <text
                    x={CHART_LEFT + slotWidth * index + slotWidth / 2}
                    y={CHART_HEIGHT - 14}
                    textAnchor="middle"
                    fill="var(--color-ink-muted)"
                    fontSize="12"
                  >
                    {day}
                  </text>
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
