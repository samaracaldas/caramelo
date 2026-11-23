'use client'

import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatDay } from '@/lib/format'

export interface BalancePoint {
  /** AAAA-MM-DD */
  day: string
  /** saldo real ao fim do dia (passado e hoje) */
  balance?: number
  /** saldo previsto se as recorrências forem pagas no vencimento (hoje e futuro) */
  forecast?: number
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: BalancePoint }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const isForecast = p.balance === undefined
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-xl shadow-black/20">
      <p className="text-muted-foreground">
        {formatDay(p.day, { day: 'numeric', month: 'short', year: 'numeric' })}
        {isForecast && ', previsto'}
      </p>
      <p className="money mt-0.5 text-sm">{formatCurrency(p.balance ?? p.forecast ?? 0)}</p>
    </div>
  )
}

/**
 * Saldo somado das contas ao fim de cada dia: linha caramelo cheia no que já aconteceu,
 * pontilhada no que as recorrências prometem para os próximos dias.
 */
export function BalanceChart({ data, today, height = 180 }: { data: BalancePoint[]; today?: string; height?: number }) {
  const values = data.flatMap((d) => [d.balance, d.forecast]).filter((v): v is number => v !== undefined)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min) * 0.15 || Math.abs(max) * 0.1 || 1
  const hasForecast = data.some((d) => d.forecast !== undefined && d.balance === undefined)
  const ticks = data.length > 2
    ? [data[0].day, hasForecast && today ? today : data[Math.floor(data.length / 2)].day, data[data.length - 1].day]
    : undefined

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          ticks={ticks}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickFormatter={(d: string) => (d === today && hasForecast ? 'Hoje' : formatDay(d, { day: 'numeric', month: 'short' }))}
        />
        <YAxis hide domain={[min - pad, max + pad]} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
        {hasForecast && today && <ReferenceLine x={today} stroke="var(--border)" strokeDasharray="2 3" />}
        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#balance-fill)"
          connectNulls={false}
          activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
        {hasForecast && (
          <Line
            type="stepAfter"
            dataKey="forecast"
            stroke="var(--primary)"
            strokeOpacity={0.7}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--card)', stroke: 'var(--primary)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
