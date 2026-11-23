'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, PencilSimple as Pencil, Trash as Trash2 } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAccounts, useTransactions } from '@/lib/hooks'
import { IAccount } from '@/types'
import api, { getErrorMessage } from '@/lib/api'
import { pluralize } from '@/lib/format'
import { SWATCHES } from '@/lib/palette'
import { BalanceCard, ColorPicker, EmptyNote, ErrorNote, ListSkeleton, Money, PageHeader } from '@/components/brand'

const ACCOUNT_TYPE_LABELS: Record<IAccount['type'], string> = {
  cash: 'Dinheiro em caixa',
  bank: 'Conta bancária',
  card: 'Cartão de crédito',
  other: 'Outra',
}

interface AccountFormData {
  name: string
  type: IAccount['type']
  color: string
  initialBalance: string
}

const EMPTY_FORM: AccountFormData = { name: '', type: 'bank', color: SWATCHES[0].value, initialBalance: '0' }

export default function AccountsPage() {
  const { accounts, loading, refetch } = useAccounts()
  const { transactions, refetch: refetchTransactions } = useTransactions()
  const router = useRouter()
  const openFromShortcut = useSearchParams().get('nova') === '1'
  const [isDialogOpen, setIsDialogOpen] = useState(openFromShortcut)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AccountFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<IAccount | null>(null)
  const [moveTo, setMoveTo] = useState('none')
  const [deleteError, setDeleteError] = useState('')

  const stats = useMemo(() => {
    const map: Record<string, { income: number; expense: number; balance: number; count: number }> = {}
    accounts.forEach((acc) => { map[acc.id] = { income: 0, expense: 0, balance: acc.initialBalance, count: 0 } })
    transactions.forEach((tx) => {
      const s = tx.account?.id ? map[tx.account.id] : undefined
      if (!s) return
      s.count += 1
      if (tx.type === 'income') { s.income += tx.amount; s.balance += tx.amount }
      else { s.expense += tx.amount; s.balance -= tx.amount }
    })
    return map
  }, [accounts, transactions])

  const totalBalance = Object.values(stats).reduce((sum, s) => sum + s.balance, 0)

  const openNew = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setIsDialogOpen(true)
  }

  // Atalho do painel: /accounts?nova=1 abre o formulário; depois limpa a URL
  useEffect(() => {
    if (openFromShortcut) router.replace('/accounts', { scroll: false })
  }, [openFromShortcut, router])

  const openEdit = (acc: IAccount) => {
    setEditingId(acc.id)
    setForm({ name: acc.name, type: acc.type, color: acc.color, initialBalance: acc.initialBalance.toString() })
    setFormError('')
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.name.trim().length < 2) return setFormError('Dê um nome com pelo menos 2 letras.')
    setFormError('')
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        color: form.color,
        initialBalance: parseFloat(form.initialBalance.replace(',', '.')) || 0,
      }
      if (editingId) await api.put(`/accounts/${editingId}`, payload)
      else await api.post('/accounts', payload)
      setIsDialogOpen(false)
      setEditingId(null)
      refetch()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Não foi possível salvar a conta.'))
    }
  }

  const askDelete = (acc: IAccount) => {
    setDeleteTarget(acc)
    setMoveTo('none')
    setDeleteError('')
  }

  const deleteCount = deleteTarget ? stats[deleteTarget.id]?.count ?? 0 : 0

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/accounts/${deleteTarget.id}`, { params: moveTo !== 'none' ? { moveTo } : undefined })
      setDeleteTarget(null)
      refetch()
      refetchTransactions()
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Não foi possível excluir a conta.'))
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Contas" description="Onde o dinheiro do negócio fica guardado: banco, caixa, cartão.">
        <Button onClick={openNew}><Plus />Nova conta</Button>
      </PageHeader>


      <BalanceCard label="Saldo somando todas as contas" value={totalBalance} className="rise">
        <span>{pluralize(accounts.length, 'conta', 'contas')}</span>
      </BalanceCard>

      {loading ? <ListSkeleton rows={3} /> : accounts.length === 0 ? (
        <EmptyNote className="py-14">
          <p>Nenhuma conta cadastrada. Comece pela conta do banco ou pelo caixa da loja.</p>
          <Button onClick={openNew} variant="outline" className="mt-4"><Plus />Cadastrar conta</Button>
        </EmptyNote>
      ) : (
        <ul className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
          {accounts.map((acc, i) => {
            const s = stats[acc.id]
            return (
              <li key={acc.id} className="rise group relative flex flex-col gap-5 overflow-hidden rounded-2xl border bg-card p-5" style={{ '--i': i } as React.CSSProperties}>
                {/* faixa da cor da conta, como a borda de um cartão */}
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: acc.color }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-medium text-[#0d0d10]" style={{ backgroundColor: acc.color }}>
                      {acc.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px]">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
                    </div>
                  </div>
                  <div className="-mr-2 -mt-1 flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => openEdit(acc)} aria-label={`Editar ${acc.name}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => askDelete(acc)} aria-label={`Excluir ${acc.name}`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo atual</p>
                  <Money value={s?.balance ?? 0} className={`text-[28px] tracking-[-0.04em] ${(s?.balance ?? 0) < 0 ? 'text-expense' : ''}`} />
                </div>
                <dl className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 px-3.5 py-3 text-xs">
                  <div><dt className="text-muted-foreground">Entradas</dt><dd><Money value={s?.income ?? 0} type="income" /></dd></div>
                  <div><dt className="text-muted-foreground">Saídas</dt><dd><Money value={s?.expense ?? 0} type="expense" /></dd></div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  {pluralize(s?.count ?? 0, 'transação', 'transações')}, saldo inicial de <Money value={acc.initialBalance} />
                </p>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave} className="flex flex-col gap-5" noValidate>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar conta' : 'Nova conta'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Altere o que precisar e salve.' : 'Cadastre um lugar onde o dinheiro entra ou sai.'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-name">Nome</Label>
              <Input id="acc-name" placeholder="Ex.: Conta PJ, Caixa da loja" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as IAccount['type'] })}>
                  <SelectTrigger className="w-full" aria-label="Tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ACCOUNT_TYPE_LABELS) as IAccount['type'][]).map((t) => (
                      <SelectItem key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="acc-initial">Saldo inicial (R$)</Label>
                <Input id="acc-initial" inputMode="decimal" className="money" placeholder="0,00" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cor</Label>
              <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} />
            </div>
            {formError && <ErrorNote>{formError}</ErrorNote>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar conta'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir a conta “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              {deleteCount === 0
                ? 'Nenhuma transação usa esta conta. Não dá para desfazer.'
                : `${pluralize(deleteCount, 'transação está', 'transações estão')} nesta conta. Elas continuam registradas; escolha onde ficam.`}
            </DialogDescription>
          </DialogHeader>
          {deleteCount > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Transações desta conta</Label>
              <Select value={moveTo} onValueChange={setMoveTo}>
                <SelectTrigger className="w-full" aria-label="Destino das transações"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ficam sem conta</SelectItem>
                  {accounts.filter((a) => a.id !== deleteTarget?.id).map((a) => (
                    <SelectItem key={a.id} value={a.id}>Mover para {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {deleteError && <ErrorNote>{deleteError}</ErrorNote>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
