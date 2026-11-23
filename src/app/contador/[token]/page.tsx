import type { Metadata } from 'next'
import Link from 'next/link'
import { and, eq, gte, lte } from 'drizzle-orm'
import { CaretLeft, CaretRight, DownloadSimple, Eye, LinkBreak } from '@phosphor-icons/react/ssr'
import { getDb } from '@/db'
import { transactions } from '@/db/schema'
import { resolveShare } from '@/lib/server/share'
import { findTransactions } from '@/lib/server/transactions'
import { formatDay, monthLabel, pluralize } from '@/lib/format'
import { Logo, Money } from '@/components/brand'
import { CategoryIcon } from '@/components/brand/category-icon'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { readPeriod, shiftMonth } from './period'

export const metadata: Metadata = { title: 'Fechamento para o contador', robots: { index: false, follow: false } }

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ mes?: string; ano?: string }> }

/**
 * O que o contador vê: fechamento do período em modo leitura, sem login.
 * Nada aqui altera dados; o link pode ser revogado a qualquer momento por quem criou.
 */
export default async function AccountantPage({ params, searchParams }: Props) {
  const [{ token }, query] = await Promise.all([params, searchParams])
  const db = await getDb()
  const share = await resolveShare(db, token)

  if (!share) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-secondary"><LinkBreak className="size-6" /></span>
          <h1 className="text-2xl font-normal tracking-[-0.03em]">Este link não está mais ativo</h1>
          <p className="text-sm text-muted-foreground">Ele pode ter expirado ou sido revogado. Peça um novo link para quem enviou.</p>
        </div>
      </main>
    )
  }

  const period = readPeriod(query)
  const rows = await findTransactions(db, and(
    eq(transactions.userId, share.userId),
    gte(transactions.date, period.start),
    lte(transactions.date, period.end),
  ))
  rows.sort((a, b) => a.date.localeCompare(b.date))

  const income = rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const byCategory = (type: 'income' | 'expense') => {
    const map = new Map<string, { name: string; icon: string; color: string; total: number; count: number }>()
    rows.filter((t) => t.type === type).forEach((t) => {
      const k = t.category.id
      const e = map.get(k) ?? { name: t.category.name, icon: t.category.icon, color: t.category.color, total: 0, count: 0 }
      e.total += t.amount
      e.count += 1
      map.set(k, e)
    })
    return [...map.values()].sort((a, b) => b.total - a.total)
  }

  const base = `/contador/${token}`
  const title = period.kind === 'year' ? `Ano de ${period.key}` : `${monthLabel(period.key.slice(5))} de ${period.key.slice(0, 4)}`
  const year = period.key.slice(0, 4)

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-8">
          <Logo />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <Eye className="size-3.5" />Somente leitura
          </span>
        </div>
      </header>

      <main className="@container mx-auto flex max-w-[1100px] flex-col gap-10 px-4 py-10 sm:px-8">
        <div className="flex flex-col gap-5 @3xl:flex-row @3xl:items-end @3xl:justify-between">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">{share.business}, acesso de {share.label}</p>
            <h1 className="text-[34px] font-normal leading-[1.1] tracking-[-0.035em] sm:text-[40px]">{title}</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Período">
            {period.kind === 'month' ? (
              <>
                <Link href={`${base}?mes=${shiftMonth(period.key, -1)}`} className={cn(buttonVariants({ variant: 'outline', size: 'icon' }))} aria-label="Mês anterior"><CaretLeft /></Link>
                <Link href={`${base}?mes=${shiftMonth(period.key, 1)}`} className={cn(buttonVariants({ variant: 'outline', size: 'icon' }))} aria-label="Próximo mês"><CaretRight /></Link>
                <Link href={`${base}?ano=${year}`} className={buttonVariants({ variant: 'outline' })}>Ver o ano de {year}</Link>
              </>
            ) : (
              <Link href={`${base}?mes=${year}-01`} className={buttonVariants({ variant: 'outline' })}>Ver mês a mês</Link>
            )}
            <a href={`${base}/csv?${period.kind === 'year' ? `ano=${year}` : `mes=${period.key}`}`} className={buttonVariants()}>
              <DownloadSimple weight="bold" />Baixar planilha
            </a>
          </nav>
        </div>

        <section aria-label="Resumo" className="grid overflow-hidden rounded-2xl border bg-card @2xl:grid-cols-3">
          {[
            { label: 'Entradas', node: <Money value={income} type="income" sup className="text-[26px] tracking-[-0.04em]" /> },
            { label: 'Saídas', node: <Money value={expense} type="expense" sup className="text-[26px] tracking-[-0.04em]" /> },
            { label: 'Resultado', node: <Money value={income - expense} sup className={cn('text-[26px] tracking-[-0.04em]', income - expense < 0 && 'text-expense')} /> },
          ].map((s, i) => (
            <div key={s.label} className={cn('flex flex-col gap-1.5 px-6 py-5', i > 0 && 'border-t @2xl:border-l @2xl:border-t-0')}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              {s.node}
            </div>
          ))}
        </section>

        <div className="grid gap-8 @3xl:grid-cols-2">
          {(['income', 'expense'] as const).map((type) => {
            const items = byCategory(type)
            return (
              <section key={type} className="flex flex-col gap-4">
                <h2 className="text-base font-medium">{type === 'income' ? 'Entradas por categoria' : 'Saídas por categoria'}</h2>
                {items.length === 0 ? (
                  <p className="rounded-2xl border border-dashed px-5 py-6 text-sm text-muted-foreground">Nada no período.</p>
                ) : (
                  <ul className="divide-y rounded-2xl border bg-card px-5">
                    {items.map((c) => (
                      <li key={c.name} className="flex items-center gap-3 py-3 text-sm">
                        <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                        <span className="min-w-0 flex-1 truncate">{c.name} <span className="text-xs text-muted-foreground">{pluralize(c.count, 'lançamento', 'lançamentos')}</span></span>
                        <Money value={c.total} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="text-base font-medium">Lançamentos <span className="text-sm font-normal text-muted-foreground">{rows.length}</span></h2>
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">Nenhum lançamento neste período.</p>
          ) : (
            <div className="@container overflow-hidden rounded-2xl border bg-card">
              <table className="w-full table-fixed text-sm">
                <thead className="hidden border-b text-left text-xs text-muted-foreground @2xl:table-header-group">
                  <tr>
                    <th scope="col" className="w-[110px] py-3 pl-6 font-normal">Data</th>
                    <th scope="col" className="py-3 font-normal">Descrição</th>
                    <th scope="col" className="hidden w-[180px] py-3 font-normal @3xl:table-cell">Categoria</th>
                    <th scope="col" className="hidden w-[140px] py-3 font-normal @4xl:table-cell">Conta</th>
                    <th scope="col" className="w-[140px] py-3 pr-6 text-right font-normal">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="border-b last:border-b-0">
                      <td className="money hidden py-3 pl-6 text-muted-foreground @2xl:table-cell">{formatDay(t.date)}</td>
                      <td className="py-3 pl-4 pr-3 @2xl:pl-0">
                        <span className="block truncate">{t.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          <span className="@2xl:hidden">{formatDay(t.date)}, </span>
                          <span className="@3xl:hidden">{t.category.name}{t.client ? ', ' : ''}</span>
                          {t.client?.name}
                        </span>
                      </td>
                      <td className="hidden truncate py-3 pr-3 text-muted-foreground @3xl:table-cell">{t.category.name}</td>
                      <td className="hidden truncate py-3 pr-3 text-muted-foreground @4xl:table-cell">{t.account?.name ?? 'Sem conta'}</td>
                      <td className="w-[124px] py-3 pr-4 text-right @2xl:w-auto @2xl:pr-6"><Money value={t.amount} type={t.type} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Gerado pelo Caramelo em {formatDay(new Date().toISOString().slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}. Os valores refletem o que foi lançado até agora.
        </p>
      </main>
    </div>
  )
}
