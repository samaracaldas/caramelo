'use client'

import { ArrowCounterClockwise, CheckCircle } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/brand'
import { CategoryIcon } from '@/components/brand/category-icon'
import { formatDay } from '@/lib/format'
import { dueLabel, frequencyLabel, type DueItem } from '@/lib/recurrence'
import { cn } from '@/lib/utils'
import type { IRecurrence } from '@/types'

/** Um vencimento: o que é, quando vence, quanto, e o botão para registrar (ou desfazer). */
export function DueRow({ item, onPay, onUndo, compact = false }: {
  item: DueItem<IRecurrence>
  onPay: (item: DueItem<IRecurrence>) => void
  onUndo?: (item: DueItem<IRecurrence>) => void
  compact?: boolean
}) {
  const { recurrence: r, status, payment } = item
  const isIncome = r.type === 'income'
  const paid = status === 'paid'

  return (
    <li className={cn('grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3', paid && 'opacity-60')}>
      <CategoryIcon icon={r.category?.icon} color={r.category?.color} />
      <div className="min-w-0">
        <p className="truncate text-sm">{r.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {paid && payment ? (
            <>{isIncome ? 'Recebido' : 'Pago'} em {formatDay(payment.date)}</>
          ) : (
            <>
              <span className={cn(status === 'overdue' && 'text-expense', status === 'today' && 'text-primary')}>
                {dueLabel(item.inDays, r.type)}
              </span>
              {!compact && <>, {formatDay(item.dueDate, { day: 'numeric', month: 'short' })}, {frequencyLabel(r).toLowerCase()}</>}
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <Money value={payment?.amount ?? r.amount} type={r.type} className="text-sm" />
        {paid ? (
          onUndo ? (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onUndo(item)} aria-label={`Desfazer registro de ${r.title}`}>
              <ArrowCounterClockwise /> <span className="hidden sm:inline">Desfazer</span>
            </Button>
          ) : (
            <CheckCircle weight="fill" className="size-5 text-income" aria-label="Registrado" />
          )
        ) : (
          <Button
            size="sm"
            variant={status === 'overdue' || status === 'today' ? 'default' : 'secondary'}
            onClick={() => onPay(item)}
            aria-label={`${isIncome ? 'Receber' : 'Pagar'} ${r.title}`}
          >
            {isIncome ? 'Receber' : 'Pagar'}
          </Button>
        )}
      </div>
    </li>
  )
}
