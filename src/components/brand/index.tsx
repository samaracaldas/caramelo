'use client'

import { ArrowDownRight, ArrowUpRight, CaretLeft, CaretRight, Check, Dog, Minus } from '@phosphor-icons/react/ssr'
import { cn } from '@/lib/utils'
import { formatAmount, formatCurrency, MONTHS } from '@/lib/format'
import { SWATCHES } from '@/lib/palette'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/* ---------- marca ---------- */

/** O mascote: um vira-lata caramelo. Ícone Phosphor dentro do círculo da cor da marca. */
export function Mark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground', className)}>
      <Dog weight="fill" className="size-[62%]" />
    </span>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Mark />
      <span className="text-[19px] font-medium tracking-[-0.03em] text-foreground">caramelo</span>
    </span>
  )
}

/* ---------- dinheiro ---------- */

interface MoneyProps {
  value: number
  type?: 'income' | 'expense'
  /** mostra "R$" (padrão) ou só o número */
  symbol?: boolean
  /** centavos menores e elevados, para listas de saldos: o real inteiro é o que se lê primeiro */
  sup?: boolean
  className?: string
}

/** Entrada em hortelã com "+", saída em goiaba com "−". */
export function Money({ value, type, symbol = true, sup = false, className }: MoneyProps) {
  const text = symbol ? formatCurrency(value) : formatAmount(value)
  if (value === 0) type = undefined
  const sign = type === 'income' ? '+' : type === 'expense' ? '−' : ''
  const comma = text.lastIndexOf(',')
  return (
    <span className={cn('money whitespace-nowrap', type === 'income' && 'text-income', type === 'expense' && 'text-expense', className)}>
      {sign && <span aria-hidden>{sign}{' '}</span>}
      {sign && <span className="sr-only">{type === 'income' ? 'entrada de ' : 'saída de '}</span>}
      {sup && comma > 0 ? (
        <>
          {text.slice(0, comma)}
          <span className="ml-px align-[0.4em] text-[0.68em] opacity-70">{text.slice(comma)}</span>
        </>
      ) : text}
    </span>
  )
}

/** Valor grande, em peso normal: o número é o protagonista, não a caixa em volta. */
export function BigMoney({ value, className }: { value: number; className?: string }) {
  const [int, cents] = formatAmount(Math.abs(value)).split(',')
  return (
    <p className={cn('money flex items-baseline gap-1.5 font-normal leading-none tracking-[-0.045em]', value < 0 && 'text-expense', className)}>
      <span className="text-[0.42em] tracking-normal text-muted-foreground">{value < 0 ? '−R$' : 'R$'}</span>
      <span>{int}</span>
      <span className="-ml-1 self-start pt-[0.08em] text-[0.42em] tracking-normal text-muted-foreground">,{cents}</span>
    </p>
  )
}

/**
 * Variação contra o período anterior. `goodWhenUp` diz se subir é bom
 * (entradas) ou ruim (saídas), para pintar a seta da cor certa.
 */
export function Delta({ current, previous, goodWhenUp = true, label }: { current: number; previous: number; goodWhenUp?: boolean; label: string }) {
  if (previous === 0) return <span className="text-xs text-muted-foreground">Sem base em {label}</span>
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const flat = Math.abs(pct) < 0.5
  const up = pct > 0
  const good = flat ? undefined : up === goodWhenUp
  const Arrow = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5', good === true && 'bg-income/12 text-income', good === false && 'bg-expense/12 text-expense', good === undefined && 'bg-secondary')}>
        <Arrow weight="bold" className="size-3" />
        <span className="money">{Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: pct > -10 && pct < 10 ? 1 : 0 })}%</span>
      </span>
      vs {label}
    </span>
  )
}

interface BalanceCardProps {
  label: string
  value: number
  children?: React.ReactNode
  className?: string
}

export function BalanceCard({ label, value, children, className }: BalanceCardProps) {
  return (
    <section className={cn('flex flex-col justify-between gap-6 rounded-2xl border bg-card px-6 py-6 sm:px-7', className)} aria-label={label}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <BigMoney value={value} className="text-[clamp(2.5rem,6vw,3.75rem)]" />
      {children && <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">{children}</div>}
    </section>
  )
}

/* ---------- barra empilhada ---------- */

export interface StackItem {
  name: string
  value: number
  color: string
}

/** Uma barra só, dividida por categoria, com legenda em porcentagem. */
export function SpendStack({ items, total, empty, legend = true }: { items: StackItem[]; total: number; empty: string; legend?: boolean }) {
  if (items.length === 0 || total <= 0) {
    return <EmptyNote>{empty}</EmptyNote>
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 gap-[3px] overflow-hidden rounded-full" role="img" aria-label={items.map((i) => `${i.name} ${Math.round((i.value / total) * 100)}%`).join(', ')}>
        {items.map((item) => (
          <div key={item.name} className="first:rounded-l-full last:rounded-r-full" style={{ flexGrow: item.value, backgroundColor: item.color }} title={`${item.name}: ${formatCurrency(item.value)}`} />
        ))}
      </div>
      {legend && (
        <ul className="flex flex-wrap gap-2 text-[13px]">
          {items.map((item) => (
            <li key={item.name} className="flex items-center gap-2 rounded-full border px-3 py-1">
              <Swatch color={item.color} />
              <span>{item.name}</span>
              <span className="money text-xs text-muted-foreground">{Math.round((item.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-0', className)} style={{ backgroundColor: color }} />
}

/* ---------- cabeçalho de página ---------- */

export function PageHeader({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 @3xl:flex-row @3xl:items-end @3xl:justify-between">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-normal leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[38px]">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/* ---------- seção sem caixa ---------- */

export function Section({ title, aside, children, className, id }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('flex min-w-0 flex-col gap-4', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-medium tracking-[-0.01em] text-foreground">{title}</h2>
        {aside && <div className="text-xs text-muted-foreground">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

/* ---------- estados ---------- */

export function EmptyNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground', className)}>{children}</div>
}

/** Placeholder com o formato do conteúdo final, enquanto os dados chegam. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-muted motion-reduce:animate-none', className)} />
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
      {children}
    </p>
  )
}

/* ---------- período ---------- */

interface PeriodPickerProps {
  year: number
  years: number[]
  onYear: (y: number) => void
  month: string
  onMonth: (m: string) => void
  allowAllMonths?: boolean
}

export function PeriodPicker({ year, years, onYear, month, onMonth, allowAllMonths = true }: PeriodPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 items-center rounded-full border bg-surface">
        <Button variant="ghost" size="icon" className="size-10 rounded-full" onClick={() => onYear(year - 1)} aria-label="Ano anterior">
          <CaretLeft />
        </Button>
        <Select value={String(year)} onValueChange={(v) => onYear(Number(v))}>
          <SelectTrigger className="money h-10 w-[78px] justify-center gap-1 rounded-none border-0 bg-transparent px-1 shadow-none [&>svg]:hidden" aria-label="Ano">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from(new Set([...years, year])).sort((a, b) => b - a).map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="size-10 rounded-full" onClick={() => onYear(year + 1)} aria-label="Próximo ano">
          <CaretRight />
        </Button>
      </div>
      <Select value={month} onValueChange={onMonth}>
        <SelectTrigger className="h-10 w-40 rounded-full px-4" aria-label="Mês">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowAllMonths && <SelectItem value="all">Ano inteiro</SelectItem>}
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/* ---------- seletor de cor ---------- */

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const current = SWATCHES.find((c) => c.value.toLowerCase() === value.toLowerCase())
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
        {SWATCHES.map((c) => {
          const selected = c.value.toLowerCase() === value.toLowerCase()
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.label}
              title={c.label}
              onClick={() => onChange(c.value)}
              className={cn(
                'grid size-9 place-items-center rounded-full text-[#0d0d10] outline-none ring-1 ring-black/10 transition-transform active:scale-95 dark:ring-0',
                'focus-visible:ring-[3px] focus-visible:ring-ring/60',
                selected && 'ring-2 ring-foreground ring-offset-2 ring-offset-popover dark:ring-2'
              )}
              style={{ backgroundColor: c.value }}
            >
              {selected && <Check weight="bold" className="size-4" />}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{current?.label ?? 'Cor personalizada'}</p>
    </div>
  )
}

/* ---------- controles segmentados ---------- */

interface Segment<T extends string> { value: T; label: string }

export function Segmented<T extends string>({ value, options, onChange, label, className }: { value: T; options: readonly Segment<T>[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div className={cn('flex h-10 rounded-full border bg-surface p-1', className)} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 whitespace-nowrap rounded-full px-3.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
            value === o.value && 'bg-foreground text-background hover:text-background'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const FLOW = [
  { value: 'income', label: 'Entrada' },
  { value: 'expense', label: 'Saída' },
] as const

export function TypeToggle({ value, onChange }: { value: 'income' | 'expense'; onChange: (v: 'income' | 'expense') => void }) {
  return <Segmented value={value} options={FLOW} onChange={onChange} label="Tipo" className="w-full" />
}

/** Lista "fantasma" no formato das linhas reais, enquanto carrega. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
