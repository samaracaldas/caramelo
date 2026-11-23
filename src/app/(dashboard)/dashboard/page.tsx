'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, DownloadSimple, Plus } from '@phosphor-icons/react/ssr'
import { CategoryIcon } from '@/components/brand/category-icon'
import { useTransactions, useAccounts, useBoxes, useRecurrences } from '@/lib/hooks'
import { addDays, buildAgenda, forecastDeltas, type DueItem } from '@/lib/recurrence'
import { DueRow } from '@/components/recurring/due-row'
import { PayDialog } from '@/components/recurring/pay-dialog'
import type { IRecurrence } from '@/types'
import { formatDay, monthLabel, pluralize } from '@/lib/format'
import { FALLBACK_COLOR } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { BigMoney, Delta, EmptyNote, Money, PeriodPicker, Section, Segmented, Skeleton, SpendStack, Swatch } from '@/components/brand'
import { BalanceChart, type BalancePoint } from '@/components/brand/balance-chart'
import { useSessionUser } from '../shell'

const NOW = new Date()
const CURRENT_YEAR = NOW.getFullYear()
const CURRENT_MONTH = String(NOW.getMonth() + 1).padStart(2, '0')

const FORECAST_DAYS = 30

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const RANGES = [
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '365', label: '12 meses' },
] as const
type Range = (typeof RANGES)[number]['value']

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

const QUICK_ACTIONS = [
  { label: 'Nova entrada', href: '/transactions?nova=entrada', icon: ArrowDownLeft },
  { label: 'Nova saída', href: '/transactions?nova=saida', icon: ArrowUpRight },
  { label: 'Nova conta', href: '/accounts?nova=1', icon: Plus },
  { label: 'Exportar planilha', href: '/reports#exportar', icon: DownloadSimple },
]

export default function DashboardPage() {
  const user = useSessionUser()
  const { transactions, loading, refetch: refetchTransactions } = useTransactions()
  const { accounts, loading: loadingAccounts } = useAccounts()
  const { recurrences } = useRecurrences()
  const { inBoxes } = useBoxes()
  const [paying, setPaying] = useState<DueItem<IRecurrence> | null>(null)

  const [range, setRange] = useState<Range>('30')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [month, setMonth] = useState<string>(CURRENT_MONTH)

  const years = useMemo(() => Array.from(new Set(transactions.map((t) => Number(t.date.substring(0, 4))))), [transactions])

  /* ---------- saldo em caixa e sua linha no tempo ---------- */

  const accountBalances = useMemo(
    () => accounts
      .map((acc) => {
        const moved = transactions
          .filter((t) => t.account?.id === acc.id)
          .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
        return { ...acc, balance: acc.initialBalance + moved }
      })
      .sort((a, b) => b.balance - a.balance),
    [accounts, transactions]
  )
  const totalNow = accountBalances.reduce((s, a) => s + a.balance, 0)

  /* ---------- recorrências: o que vence e quanto isso move o saldo ---------- */

  const todayKey = iso(NOW)
  const agenda = useMemo(() => buildAgenda(recurrences, transactions, todayKey, FORECAST_DAYS), [recurrences, transactions, todayKey])
  const forecast = useMemo(() => forecastDeltas(agenda, todayKey), [agenda, todayKey])
  const openDue = agenda.filter((i) => i.status !== 'paid')
  const overdueCount = openDue.filter((i) => i.status === 'overdue').length
  const dueSoon = openDue.filter((i) => i.status !== 'later')

  const { series, rangeIn, rangeOut, forecastEnd } = useMemo(() => {
    const days = Number(range)
    const start = new Date(NOW)
    start.setDate(start.getDate() - days + 1)
    const startDay = iso(start)
    const today = iso(NOW)

    // Volta no tempo a partir do saldo de hoje, desfazendo o que entrou e saiu depois de cada dia
    const net = new Map<string, number>()
    let rangeIn = 0
    let rangeOut = 0
    transactions.forEach((t) => {
      if (t.date >= startDay && t.date <= today) {
        if (t.type === 'income') rangeIn += t.amount
        else rangeOut += t.amount
      }
      if (!t.account) return
      net.set(t.date, (net.get(t.date) ?? 0) + (t.type === 'income' ? t.amount : -t.amount))
    })
    const future = [...net].filter(([d]) => d > today).reduce((s, [, v]) => s + v, 0)

    const series: BalancePoint[] = []
    const todayBalance = totalNow - future
    let balance = todayBalance
    const cursor = new Date(NOW)
    for (let i = 0; i < days; i++) {
      const day = iso(cursor)
      series.push({ day, balance })
      balance -= net.get(day) ?? 0
      cursor.setDate(cursor.getDate() - 1)
    }
    series.reverse()

    // Para frente: o que as recorrências em aberto prometem (atrasadas entram hoje)
    let forecastEnd: number | null = null
    if (forecast.size > 0) {
      let running = todayBalance + (forecast.get(today) ?? 0)
      series[series.length - 1].forecast = running
      for (let i = 1; i <= FORECAST_DAYS; i++) {
        const day = addDays(today, i)
        running += forecast.get(day) ?? 0
        series.push({ day, forecast: running })
      }
      forecastEnd = running
    }
    return { series, rangeIn, rangeOut, forecastEnd }
  }, [transactions, totalNow, range, forecast])

  /* ---------- mês escolhido contra o anterior ---------- */

  const prevDate = new Date(year, Number(month) - 2, 1)
  const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const monthKey = `${year}-${month}`
  // Mês em andamento: compara com os mesmos dias do mês anterior, não com o mês fechado inteiro
  const isCurrentMonth = monthKey === `${CURRENT_YEAR}-${CURRENT_MONTH}`
  const cutoff = isCurrentMonth ? String(NOW.getDate()).padStart(2, '0') : '31'
  const prevLabel = `${isCurrentMonth ? `1 a ${NOW.getDate()} de ` : ''}${monthLabel(prevKey.slice(5)).toLowerCase()}`

  const sums = (prefix: string) => {
    const list = transactions.filter((t) => t.date.startsWith(prefix) && t.date.slice(8, 10) <= cutoff)
    const income = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { list, income, expense, result: income - expense }
  }
  const current = useMemo(() => sums(monthKey), [transactions, monthKey, cutoff]) // eslint-disable-line react-hooks/exhaustive-deps
  const previous = useMemo(() => sums(prevKey), [transactions, prevKey, cutoff]) // eslint-disable-line react-hooks/exhaustive-deps

  const spend = useMemo(() => {
    const by: Record<string, { name: string; value: number; color: string }> = {}
    current.list.filter((t) => t.type === 'expense').forEach((t) => {
      const key = t.category?.id ?? 'none'
      by[key] ??= { name: t.category?.name ?? 'Sem categoria', value: 0, color: t.category?.color ?? FALLBACK_COLOR }
      by[key].value += t.amount
    })
    return Object.values(by).sort((a, b) => b.value - a.value)
  }, [current])

  const recent = useMemo(() => [...transactions].slice(0, 6), [transactions])
  const firstName = user?.name.split(' ')[0]

  return (
    <div className="flex flex-col gap-10">
      {/* Saudação e atalhos */}
      <div className="flex flex-col gap-5">
        <h1 className="text-[32px] font-normal leading-[1.1] tracking-[-0.035em] sm:text-[38px]">
          <span suppressHydrationWarning>{greeting()}</span>{firstName ? `, ${firstName}` : ''}
        </h1>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          {QUICK_ACTIONS.map(({ label, href, icon: ActionIcon }, i) => (
            <Link key={href} href={href} className={cn(buttonVariants({ variant: i === 0 ? 'default' : 'secondary', size: 'sm' }), 'h-9 shrink-0')}>
              <ActionIcon weight="bold" />{label}
            </Link>
          ))}
        </div>
      </div>

      {/* Saldo em caixa + contas */}
      <div className="rise grid gap-4 @4xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-5 rounded-2xl border bg-card px-6 pb-4 pt-6" aria-label="Saldo em caixa">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Saldo em caixa</p>
              {loading || loadingAccounts ? <Skeleton className="h-12 w-56" /> : <BigMoney value={totalNow} className="text-[clamp(2.25rem,5vw,3.25rem)]" />}
              {inBoxes > 0 && !loading && (
                <Link href="/boxes" className="w-fit rounded-full text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  Livre <Money value={totalNow - inBoxes} className="text-foreground" />, com <Money value={inBoxes} /> em caixinhas
                </Link>
              )}
            </div>
            <Segmented value={range} options={RANGES} onChange={setRange} label="Período do gráfico" className="h-9" />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ArrowDownLeft className="size-3.5 text-income" weight="bold" />
              Entrou <Money value={rangeIn} className="text-foreground" />
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-expense" weight="bold" />
              Saiu <Money value={rangeOut} className="text-foreground" />
            </span>
            {forecastEnd !== null && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="w-4 border-t-2 border-dashed border-primary/70" />
                Previsto em {formatDay(addDays(todayKey, FORECAST_DAYS), { day: 'numeric', month: 'short' })}{' '}
                <Money value={forecastEnd} className={forecastEnd < 0 ? 'text-expense' : 'text-foreground'} />
              </span>
            )}
          </div>
          {loading || loadingAccounts ? <Skeleton className="h-[170px]" /> : <BalanceChart data={series} today={todayKey} height={170} />}
        </section>

        <section className="flex flex-col rounded-2xl border bg-card px-6 py-6" aria-label="Saldo por conta">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm text-muted-foreground">Contas</h2>
            <span className="text-xs text-muted-foreground">{pluralize(accounts.length, 'conta', 'contas')}</span>
          </div>
          {loadingAccounts || loading ? (
            <div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-5" />)}</div>
          ) : accountBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cadastre uma conta para ver o saldo de cada uma.</p>
          ) : (
            <ul className="flex flex-1 flex-col gap-1">
              {accountBalances.slice(0, 5).map((acc) => (
                <li key={acc.id} className="flex items-center gap-3 py-2 text-sm">
                  <Swatch color={acc.color} />
                  <span className="min-w-0 flex-1 truncate">{acc.name}</span>
                  <Money value={acc.balance} sup className={acc.balance < 0 ? 'text-expense' : ''} />
                </li>
              ))}
            </ul>
          )}
          <Link href="/accounts" className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Ver contas <ArrowRight className="size-3.5" />
          </Link>
        </section>
      </div>

      {/* Vencimentos das recorrências */}
      <Section
        title="Próximos vencimentos"
        className="rise [--i:1]"
        aside={
          <Link href="/recurring" className="inline-flex items-center gap-1 hover:text-foreground">
            {overdueCount > 0 && <span className="mr-2 rounded-full bg-expense/12 px-2 py-0.5 text-expense">{pluralize(overdueCount, 'atrasada', 'atrasadas')}</span>}
            Ver recorrentes <ArrowRight className="size-3" />
          </Link>
        }
      >
        {recurrences.length === 0 ? (
          <EmptyNote className="py-6">
            Cadastre o que se repete, como aluguel e salários, para ver aqui o que vence e a previsão do saldo.{' '}
            <Link href="/recurring" className="text-foreground underline decoration-primary decoration-2 underline-offset-4">Cadastrar recorrência</Link>
          </EmptyNote>
        ) : dueSoon.length === 0 ? (
          <EmptyNote className="py-6">Nada vence nos próximos 7 dias.</EmptyNote>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card px-5">
            {dueSoon.slice(0, 4).map((item) => (
              <DueRow key={`${item.recurrence.id}|${item.dueDate}`} item={item} onPay={setPaying} compact />
            ))}
          </ul>
        )}
      </Section>

      <PayDialog item={paying} accounts={accounts} onClose={() => setPaying(null)} onPaid={refetchTransactions} />

      {/* O mês, comparado com o anterior */}
      <section className="rise flex flex-col gap-4 [--i:2]" aria-label={`Resumo de ${monthLabel(month).toLowerCase()}`}>
        <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
          <h2 className="text-base font-medium tracking-[-0.01em]">{monthLabel(month)} de {year}</h2>
          <PeriodPicker year={year} years={years} onYear={setYear} month={month} onMonth={setMonth} allowAllMonths={false} />
        </div>
        <div className="grid overflow-hidden rounded-2xl border bg-card @2xl:grid-cols-3">
          {[
            { label: 'Entradas', value: current.income, prev: previous.income, type: 'income' as const, goodWhenUp: true },
            { label: 'Saídas', value: current.expense, prev: previous.expense, type: 'expense' as const, goodWhenUp: false },
            { label: 'Resultado', value: current.result, prev: previous.result, type: undefined, goodWhenUp: true },
          ].map((s, i) => (
            <div key={s.label} className={cn('flex flex-col gap-2 px-6 py-5', i > 0 && 'border-t @2xl:border-l @2xl:border-t-0')}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              {loading ? <Skeleton className="h-8 w-36" /> : (
                <Money value={s.value} sup className={cn('text-[26px] tracking-[-0.04em]', s.type === undefined && s.value < 0 && 'text-expense')} />
              )}
              {!loading && <Delta current={s.value} previous={s.prev} goodWhenUp={s.goodWhenUp} label={prevLabel} />}
            </div>
          ))}
        </div>
      </section>

      <div className="rise grid gap-10 [--i:3] @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="Para onde foi o dinheiro" aside={<Money value={current.expense} />}>
          {loading ? <Skeleton className="h-3 rounded-full" /> : <SpendStack items={spend} total={current.expense} empty="Nenhuma saída registrada neste mês." />}
        </Section>

        <Section
          title="Últimas transações"
          aside={<Link href="/transactions" className="inline-flex items-center gap-1 hover:text-foreground">Ver todas <ArrowRight className="size-3" /></Link>}
        >
          {loading ? (
            <div className="flex flex-col gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : recent.length === 0 ? (
            <EmptyNote>
              Nada lançado ainda.{' '}
              <Link href="/transactions?nova=entrada" className="text-foreground underline decoration-primary decoration-2 underline-offset-4">Registrar transação</Link>
            </EmptyNote>
          ) : (
            <ul className="flex flex-col">
              {recent.map((tx) => (
                <li key={tx.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                  <CategoryIcon icon={tx.category?.icon} color={tx.category?.color} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{tx.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <span className="money">{formatDay(tx.date)}</span>, {tx.category?.name ?? 'Sem categoria'}
                    </span>
                  </span>
                  <Money value={tx.amount} type={tx.type} className="text-sm" />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
