'use client'

import { useState } from 'react'
import { CircleNotch } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorNote } from '@/components/brand'
import { CategoryIcon } from '@/components/brand/category-icon'
import api, { getErrorMessage } from '@/lib/api'
import { amountInput, formatDay, parseAmount, todayISO } from '@/lib/format'
import type { DueItem } from '@/lib/recurrence'
import type { IAccount, IRecurrence } from '@/types'

const NO_ACCOUNT = 'none'

/**
 * Confirma o pagamento (ou recebimento) de um vencimento. O valor vem preenchido com o
 * previsto, mas dá para trocar: a conta de luz nunca vem igual.
 */
export function PayDialog({ item, accounts, onClose, onPaid }: {
  item: DueItem<IRecurrence> | null
  accounts: IAccount[]
  onClose: () => void
  onPaid: () => void
}) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* key: o formulário recomeça a cada vencimento escolhido */}
        {item && <PayForm key={`${item.recurrence.id}|${item.dueDate}`} item={item} accounts={accounts} onClose={onClose} onPaid={onPaid} />}
      </DialogContent>
    </Dialog>
  )
}

function PayForm({ item, accounts, onClose, onPaid }: { item: DueItem<IRecurrence>; accounts: IAccount[]; onClose: () => void; onPaid: () => void }) {
  const { recurrence: r, dueDate } = item
  const isIncome = r.type === 'income'
  const [amount, setAmount] = useState(amountInput(r.amount))
  const [date, setDate] = useState(todayISO())
  const [account, setAccount] = useState(r.accountId ?? NO_ACCOUNT)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('Informe um valor maior que zero, por exemplo 150,00.')
    if (!date) return setError('Informe a data.')
    setError('')
    setSaving(true)
    try {
      await api.post(`/recurrences/${r.id}/pay`, { dueDate, date, amount: value, account: account === NO_ACCOUNT ? '' : account })
      onPaid()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível registrar.'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <CategoryIcon icon={r.category?.icon} color={r.category?.color} />
          <div className="min-w-0 flex-1 text-left">
            <DialogTitle className="truncate">{isIncome ? 'Registrar recebimento' : 'Registrar pagamento'}</DialogTitle>
            <DialogDescription className="truncate">
              {r.title}, vencimento em {formatDay(dueDate, { day: 'numeric', month: 'long' })}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pay-amount">Valor (R$)</Label>
          <Input id="pay-amount" inputMode="decimal" className="money" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pay-date">{isIncome ? 'Recebido em' : 'Pago em'}</Label>
          <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Conta</Label>
        <Select value={account} onValueChange={setAccount}>
          <SelectTrigger className="w-full" aria-label="Conta"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ACCOUNT}>Sem conta</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={saving}>
          {saving && <CircleNotch className="animate-spin" />}
          {isIncome ? 'Confirmar recebimento' : 'Confirmar pagamento'}
        </Button>
      </DialogFooter>
    </form>
  )
}
