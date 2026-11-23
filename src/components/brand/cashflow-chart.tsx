'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/format'

export interface CashflowPoint {
  label: string
  income: number
  expense: number
}

// As cores vêm dos tokens, então o gráfico acompanha o tema claro/escuro sem JS.
const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-geist)' }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const income = payload.find((p) => p.dataKey === 'income')?.value ?? 0
  const expense = payload.find((p) => p.dataKey === 'expense')?.value ?? 0
  return (
    <div className="min-w-44 rounded-xl border bg-popover px-3.5 py-2.5 text-xs shadow-xl shadow-black/20">
      <p className="mb-1.5 font-medium">{label}</p>
      <p className="flex justify-between gap-4"><span className="text-muted-foreground">Entradas</span><span className="money text-income">{formatCurrency(income)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-muted-foreground">Saídas</span><span className="money text-expense">{formatCurrency(expense)}</span></p>
      <p className="mt-1.5 flex justify-between gap-4 border-t pt-1.5 font-medium"><span>Saldo</span><span className="money">{formatCurrency(income - expense)}</span></p>
    </div>
  )
}

export function CashflowChart({ data, height = 240 }: { data: CashflowPoint[]; height?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barGap={3} barCategoryGap="24%" margin={{ top: 4, right: 0, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS}
            width={44}
            tickFormatter={(v: number) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`)}
          />
          <Tooltip cursor={{ fill: 'var(--accent)', radius: 8 }} content={<ChartTooltip />} />
          <Bar dataKey="income" name="Entradas" fill="var(--income)" radius={[6, 6, 6, 6]} isAnimationActive={false} />
          <Bar dataKey="expense" name="Saídas" fill="var(--expense)" radius={[6, 6, 6, 6]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-income" />Entradas</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-expense" />Saídas</span>
      </div>
    </div>
  )
}
