'use client'

import { useMemo, useState } from 'react'
import { PencilSimple, Plus, Repeat, Trash } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyNote, ErrorNote, ListSkeleton, Money, PageHeader, Section, Segmented, TypeToggle } from '@/components/brand'
import { CategoryIcon } from '@/components/brand/category-icon'
import { DueRow } from '@/components/recurring/due-row'
import { PayDialog } from '@/components/recurring/pay-dialog'
import { useAccounts, useCategories, useRecurrences, useTransactions } from '@/lib/hooks'
import api, { getErrorMessage } from '@/lib/api'
import { amountInput, formatDay, parseAmount, pluralize, todayISO } from '@/lib/format'
import { addDays, buildAgenda, frequencyLabel, nextOccurrence, type DueItem, type Frequency } from '@/lib/recurrence'
import { cn } from '@/lib/utils'
import type { IRecurrence } from '@/types'

const NO_ACCOUNT = 'none'
const HORIZON = 30

const FREQUENCIES = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'yearly', label: 'Anual' },
] as const

interface FormData {
  title: string
  amount: string
  type: 'income' | 'expense'
  category: string
  account: string
  frequency: Frequency
  startDate: string
  endDate: string
  description: string
}

const emptyForm = (): FormData => ({
  title: '', amount: '', type: 'expense', category: '', account: NO_ACCOUNT,
  frequency: 'monthly', startDate: todayISO(), endDate: '', description: '',
})

export default function RecurringPage() {
  const { recurrences, loading, refetch } = useRecurrences()
  const { transactions, loading: loadingTx, refetch: refetchTransactions } = useTransactions()
  const { categories } = useCategories()
  const { accounts } = useAccounts()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState<DueItem<IRecurrence> | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IRecurrence | null>(null)
  const [error, setError] = useState('')

  const today = todayISO()
  const agenda = useMemo(() => buildAgenda(recurrences, transactions, today, HORIZON), [recurrences, transactions, today])

  const groups = useMemo(() => [
    { key: 'overdue', title: 'Atrasadas', items: agenda.filter((i) => i.status === 'overdue') },
    { key: 'soon', title: 'Hoje e próximos 7 dias', items: agenda.filter((i) => i.status === 'today' || i.status === 'soon') },
    { key: 'later', title: `Até ${formatDay(addDays(today, HORIZON), { day: 'numeric', month: 'long' })}`, items: agenda.filter((i) => i.status === 'later') },
    { key: 'paid', title: 'Registradas este mês', items: agenda.filter((i) => i.status === 'paid').reverse() },
  ].filter((g) => g.items.length > 0), [agenda, today])

  const open = agenda.filter((i) => i.status !== 'paid')
  const sum = (list: typeof agenda, type: 'income' | 'expense') => list.filter((i) => i.recurrence.type === type).reduce((s, i) => s + i.recurrence.amount, 0)
  const overdue = open.filter((i) => i.status === 'overdue')
  const week = open.filter((i) => i.status !== 'later')

  const refresh = () => { refetch(); refetchTransactions() }
  const formCategories = categories.filter((c) => c.type === form.type)

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm())
    setFormError('')
    setIsFormOpen(true)
  }

  const openEdit = (r: IRecurrence) => {
    setEditingId(r.id)
    setForm({
      title: r.title, amount: amountInput(r.amount), type: r.type, category: r.categoryId,
      account: r.accountId ?? NO_ACCOUNT, frequency: r.frequency, startDate: r.startDate,
      endDate: r.endDate ?? '', description: r.description ?? '',
    })
    setFormError('')
    setIsFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseAmount(form.amount)
    if (form.title.trim().length < 2) return setFormError('Descreva a recorrência com pelo menos 2 letras.')
    if (!Number.isFinite(amount) || amount <= 0) return setFormError('Informe um valor maior que zero, por exemplo 150,00.')
    if (!form.category) return setFormError('Escolha uma categoria.')
    if (!form.startDate) return setFormError('Informe o primeiro vencimento.')
    if (form.endDate && form.endDate < form.startDate) return setFormError('A data final precisa ser depois do primeiro vencimento.')

    setFormError('')
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(), amount, type: form.type, category: form.category,
        account: form.account === NO_ACCOUNT ? '' : form.account, frequency: form.frequency,
        startDate: form.startDate, endDate: form.endDate || null, description: form.description,
      }
      if (editingId) await api.put(`/recurrences/${editingId}`, payload)
      else await api.post('/recurrences', payload)
      setIsFormOpen(false)
      refetch()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Não foi possível salvar a recorrência.'))
    } finally {
      setSaving(false)
    }
  }

  const handleUndo = async (item: DueItem<IRecurrence>) => {
    if (!item.payment) return
    try {
      await api.delete(`/transactions/${item.payment.id}`)
      refetchTransactions()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível desfazer.'))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/recurrences/${deleteTarget.id}`)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setDeleteTarget(null)
      setError(getErrorMessage(err, 'Não foi possível excluir a recorrência.'))
    }
  }

  const isLoading = loading || loadingTx

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Recorrentes" description="Aluguel, salários, assinaturas: cadastre uma vez e acompanhe cada vencimento.">
        <Button onClick={openNew}><Plus weight="bold" />Nova recorrência</Button>
      </PageHeader>

      {error && <ErrorNote>{error}</ErrorNote>}

      {isLoading ? <ListSkeleton rows={5} /> : recurrences.length === 0 ? (
        <EmptyNote className="flex flex-col items-center gap-4 py-14">
          <span className="grid size-12 place-items-center rounded-full bg-secondary"><Repeat className="size-6" /></span>
          <p className="max-w-[44ch]">
            Nada recorrente ainda. Comece pelo que se repete todo mês, como o aluguel, a folha ou a internet.
          </p>
          <Button onClick={openNew} variant="outline"><Plus />Cadastrar a primeira</Button>
        </EmptyNote>
      ) : (
        <>
          {/* Resumo do que está em aberto */}
          <section aria-label="Resumo dos vencimentos" className="rise grid overflow-hidden rounded-2xl border bg-card @2xl:grid-cols-3">
            {[
              { label: 'Atrasado', value: sum(overdue, 'expense'), note: pluralize(overdue.filter((i) => i.recurrence.type === 'expense').length, 'conta', 'contas'), alert: overdue.length > 0 },
              { label: 'A pagar em 7 dias', value: sum(week.filter((i) => i.status !== 'overdue'), 'expense'), note: 'inclui hoje' },
              { label: `A receber em ${HORIZON} dias`, value: sum(open, 'income'), note: pluralize(open.filter((i) => i.recurrence.type === 'income').length, 'entrada prevista', 'entradas previstas') },
            ].map((s, i) => (
              <div key={s.label} className={cn('flex flex-col gap-1.5 px-6 py-5', i > 0 && 'border-t @2xl:border-l @2xl:border-t-0')}>
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <Money value={s.value} sup className={cn('text-[26px] tracking-[-0.04em]', s.alert && 'text-expense')} />
                <span className="text-xs text-muted-foreground">{s.note}</span>
              </div>
            ))}
          </section>

          {/* Agenda */}
          <div className="rise grid gap-8 [--i:1] @3xl:grid-cols-2">
            {groups.map((g) => (
              <Section key={g.key} title={g.title} aside={pluralize(g.items.length, 'vencimento', 'vencimentos')}>
                <ul className="divide-y rounded-2xl border bg-card px-5">
                  {g.items.map((item) => (
                    <DueRow key={`${item.recurrence.id}|${item.dueDate}`} item={item} onPay={setPaying} onUndo={handleUndo} />
                  ))}
                </ul>
              </Section>
            ))}
            {groups.every((g) => g.key === 'paid') && (
              <EmptyNote className="@3xl:col-span-2">Nada em aberto nos próximos {HORIZON} dias.</EmptyNote>
            )}
          </div>

          {/* As regras */}
          <Section title="Todas as recorrências" aside={pluralize(recurrences.length, 'recorrência', 'recorrências')} className="rise [--i:2]">
            <ul className="overflow-hidden rounded-2xl border bg-card">
              {recurrences.map((r) => {
                const next = nextOccurrence(r, today)
                return (
                  <li key={r.id} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5">
                    <CategoryIcon icon={r.category?.icon} color={r.category?.color} />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {frequencyLabel(r)}
                        {r.account && `, ${r.account.name}`}
                        {next ? `, próximo em ${formatDay(next, { day: 'numeric', month: 'short' })}` : ', encerrada'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Money value={r.amount} type={r.type} className="text-sm" />
                      <div className="flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => openEdit(r)} aria-label={`Editar ${r.title}`}>
                          <PencilSimple className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(r)} aria-label={`Excluir ${r.title}`}>
                          <Trash className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Section>
        </>
      )}

      <PayDialog item={paying} accounts={accounts} onClose={() => setPaying(null)} onPaid={refresh} />

      {/* Nova / editar */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={handleSave} className="flex flex-col gap-5" noValidate>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar recorrência' : 'Nova recorrência'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Vale para os próximos vencimentos. Os já registrados não mudam.' : 'Algo que se repete: aluguel, salários, internet, uma mensalidade que você recebe.'}
              </DialogDescription>
            </DialogHeader>

            <TypeToggle value={form.type} onChange={(type) => setForm({ ...form, type, category: '' })} />

            <div className="flex flex-col gap-2">
              <Label htmlFor="rec-title">Descrição</Label>
              <Input id="rec-title" placeholder={form.type === 'income' ? 'Ex.: Mensalidade do cliente' : 'Ex.: Aluguel do ponto'} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-amount">Valor previsto (R$)</Label>
                <Input id="rec-amount" inputMode="decimal" placeholder="0,00" className="money" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-start">Primeiro vencimento</Label>
                <Input id="rec-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Repete</Label>
              <Segmented value={form.frequency} options={FREQUENCIES} onChange={(frequency) => setForm({ ...form, frequency })} label="Frequência" className="w-full" />
              {form.startDate && (
                <p className="text-xs text-muted-foreground">{frequencyLabel({ frequency: form.frequency, startDate: form.startDate })}</p>
              )}
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
              <div className="flex flex-col gap-2">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="w-full" aria-label="Categoria"><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    {formCategories.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        Nenhuma categoria de {form.type === 'income' ? 'entrada' : 'saída'}. Crie uma em Categorias.
                      </p>
                    )}
                    {formCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Conta</Label>
                <Select value={form.account} onValueChange={(v) => setForm({ ...form, account: v })}>
                  <SelectTrigger className="w-full" aria-label="Conta"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACCOUNT}>Sem conta</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="rec-end">Termina em <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input id="rec-end" type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              <p className="text-xs text-muted-foreground">Deixe em branco se não tem data para acabar.</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="rec-notes">Observação <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea id="rec-notes" rows={2} className="resize-none" placeholder="Contrato, forma de pagamento, contato" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            {formError && <ErrorNote>{formError}</ErrorNote>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{editingId ? 'Salvar alterações' : 'Criar recorrência'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir “{deleteTarget?.title}”?</DialogTitle>
            <DialogDescription>Os próximos vencimentos somem. O que já foi registrado continua em Transações.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir recorrência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
