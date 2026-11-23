'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ReceiptScan, type ReceiptResult } from '@/components/receipt-scan'
import { useSessionUser } from '../shell'
import { ArrowDownLeft, ArrowUpRight, CalendarBlank, MagnifyingGlass, Note, PencilSimple, Plus, Tag, Trash, UserCircle, Wallet } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { CategoryIcon } from '@/components/brand/category-icon'
import { useTransactions, useCategories, useAccounts, useClients } from '@/lib/hooks'
import { ITransaction } from '@/types'
import api, { getErrorMessage } from '@/lib/api'
import { amountInput, formatDay, parseAmount, pluralize, todayISO } from '@/lib/format'
import { FALLBACK_COLOR } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { EmptyNote, ErrorNote, ListSkeleton, Money, PageHeader, PeriodPicker, Segmented, Swatch, TypeToggle } from '@/components/brand'

interface TransactionFormData {
  title: string
  amount: string
  type: 'income' | 'expense'
  category: string
  account: string
  client: string
  date: string
  description: string
}

const PAGE_SIZE = 50
const NO_CLIENT = 'none'

const emptyForm = (type: 'income' | 'expense' = 'income'): TransactionFormData => ({
  title: '', amount: '', type, category: '', account: '', client: '', date: todayISO(), description: '',
})

const longDay = (day: string) => {
  const text = formatDay(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const TYPE_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'income', label: 'Entradas' },
  { value: 'expense', label: 'Saídas' },
] as const

export default function TransactionsPage() {
  const { transactions, loading, refetch } = useTransactions()
  const { categories } = useCategories()
  const { accounts } = useAccounts()
  const { clients } = useClients()
  const user = useSessionUser()
  const [scanned, setScanned] = useState<ReceiptResult | null>(null)

  const router = useRouter()
  const nova = useSearchParams().get('nova')
  const shortcut = nova === 'entrada' ? 'income' : nova === 'saida' ? 'expense' : null

  const [isDialogOpen, setIsDialogOpen] = useState(shortcut !== null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TransactionFormData>(() => emptyForm(shortcut ?? 'income'))
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState<string>('all')
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ITransaction | null>(null)
  const [error, setError] = useState('')

  const selected = transactions.find((t) => t.id === selectedId) ?? null

  // Atalhos do painel: /transactions?nova=entrada|saida abre o formulário; depois limpa a URL
  useEffect(() => {
    if (shortcut) router.replace('/transactions', { scroll: false })
  }, [shortcut, router])

  const years = useMemo(() => Array.from(new Set(transactions.map((t) => Number(t.date.substring(0, 4))))), [transactions])
  const formCategories = categories.filter((c) => c.type === form.type)

  const filtered = useMemo(() => {
    const prefix = month === 'all' ? `${year}` : `${year}-${month}`
    const q = search.trim().toLowerCase()
    return transactions.filter((t) => {
      if (!t.date.startsWith(prefix)) return false
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterAccount !== 'all' && t.account?.id !== filterAccount) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        (t.client?.name ?? '').toLowerCase().includes(q) ||
        t.category?.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [transactions, filterType, year, month, filterAccount, search])

  // filtro novo começa do topo
  useEffect(() => setVisible(PAGE_SIZE), [filterType, year, month, filterAccount, search])

  const totals = useMemo(() => ({
    income: filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    expense: filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  }), [filtered])

  const rows = filtered.slice(0, visible)
  const isFiltering = search !== '' || filterType !== 'all' || month !== 'all' || filterAccount !== 'all'

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm())
    setFormError('')
    setScanned(null)
    setIsDialogOpen(true)
  }

  // Comprovante lido: preenche só o que veio; o que faltou fica como estava para a pessoa completar
  const applyReceipt = (r: ReceiptResult) => {
    setForm((prev) => ({
      ...prev,
      type: r.type,
      title: r.title || prev.title,
      amount: r.amount ? amountInput(r.amount) : prev.amount,
      date: r.date ?? prev.date,
      category: r.categoryId ?? (r.type === prev.type ? prev.category : ''),
      client: r.clientId ?? prev.client,
      description: r.notes ?? prev.description,
    }))
    setScanned(r)
    setFormError('')
  }

  const openEdit = (tx: ITransaction) => {
    setSelectedId(null)
    setEditingId(tx.id)
    setForm({
      title: tx.title,
      amount: amountInput(tx.amount),
      type: tx.type,
      category: tx.category?.id ?? '',
      account: tx.account?.id ?? '',
      client: tx.client?.id ?? '',
      date: tx.date,
      description: tx.description ?? '',
    })
    setFormError('')
    setIsDialogOpen(true)
  }

  const askDelete = (tx: ITransaction) => {
    setSelectedId(null)
    setDeleteTarget(tx)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseAmount(form.amount)
    if (form.title.trim().length < 2) return setFormError('Descreva a transação com pelo menos 2 letras.')
    if (!Number.isFinite(amount) || amount <= 0) return setFormError('Informe um valor maior que zero, por exemplo 150,00.')
    if (!form.category) return setFormError('Escolha uma categoria.')
    if (!form.date) return setFormError('Informe a data.')

    setFormError('')
    setSaving(true)
    try {
      const payload = { ...form, title: form.title.trim(), amount }
      if (editingId) await api.put(`/transactions/${editingId}`, payload)
      else await api.post('/transactions', payload)
      setIsDialogOpen(false)
      setEditingId(null)
      refetch()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Não foi possível salvar a transação.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/transactions/${deleteTarget.id}`)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setDeleteTarget(null)
      setError(getErrorMessage(err, 'Não foi possível excluir a transação.'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Transações">
        <Button onClick={openNew}><Plus weight="bold" />Nova transação</Button>
      </PageHeader>

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Filtros */}
      <div className="flex flex-col gap-3 @4xl:flex-row @4xl:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por descrição, cliente ou categoria"
            aria-label="Buscar transações"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={filterType} options={TYPE_FILTERS} onChange={setFilterType} label="Tipo" />
          <PeriodPicker year={year} years={years} onYear={setYear} month={month} onMonth={setMonth} />
          <Select value={filterAccount} onValueChange={setFilterAccount}>
            <SelectTrigger className="h-10 w-44 rounded-full px-4" aria-label="Conta"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo do que está filtrado */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>{pluralize(filtered.length, 'transação', 'transações')}</span>
          <span className="inline-flex items-center gap-1.5"><ArrowDownLeft weight="bold" className="size-3.5 text-income" />Entrou <Money value={totals.income} className="text-foreground" /></span>
          <span className="inline-flex items-center gap-1.5"><ArrowUpRight weight="bold" className="size-3.5 text-expense" />Saiu <Money value={totals.expense} className="text-foreground" /></span>
        </div>
      )}

      {/* Extrato */}
      {loading ? <ListSkeleton rows={8} /> : filtered.length === 0 ? (
        <EmptyNote className="py-14">
          <p>{isFiltering ? 'Nenhuma transação com esses filtros.' : 'Nenhuma transação registrada ainda.'}</p>
          {!isFiltering && <Button onClick={openNew} variant="outline" className="mt-4"><Plus />Registrar a primeira</Button>}
        </EmptyNote>
      ) : (
        <div className="@container overflow-hidden rounded-2xl border bg-card">
          <table className="w-full table-fixed text-sm">
            <thead className="hidden border-b text-left text-xs text-muted-foreground @lg:table-header-group">
              <tr>
                <th scope="col" className="w-[116px] py-3 pl-6 font-normal">Data</th>
                <th scope="col" className="py-3 font-normal">Descrição</th>
                <th scope="col" className="hidden w-[190px] py-3 font-normal @3xl:table-cell">Categoria</th>
                <th scope="col" className="hidden w-[140px] py-3 font-normal @4xl:table-cell">Conta</th>
                <th scope="col" className="w-[150px] py-3 pr-6 text-right font-normal">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelectedId(tx.id)}
                  className={cn(
                    'cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent/60',
                    selectedId === tx.id && 'bg-accent'
                  )}
                >
                  <td className="money hidden whitespace-nowrap py-3.5 pl-6 pr-4 text-muted-foreground @lg:table-cell">{formatDay(tx.date, { day: '2-digit', month: 'short' })}</td>
                  <td className="py-3 pl-4 pr-3 @lg:pl-0">
                    {/* o botão dentro da célula dá foco e Enter pelo teclado; o clique na linha toda é atalho para mouse */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedId(tx.id) }}
                      aria-label={`Ver detalhes: ${tx.title}`}
                      className="flex w-full min-w-0 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <CategoryIcon icon={tx.category?.icon} color={tx.category?.color} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">{tx.title}</span>
                          {tx.description && <Note className="size-3.5 shrink-0 text-muted-foreground" aria-label="Tem observação" />}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground @3xl:hidden">
                          <span className="@lg:hidden">{formatDay(tx.date)}, </span>{tx.category?.name ?? 'Sem categoria'}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="hidden py-3 pr-3 @3xl:table-cell">
                    <span className="inline-flex max-w-[180px] items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs">
                      <Swatch color={tx.category?.color ?? FALLBACK_COLOR} />
                      <span className="truncate">{tx.category?.name ?? 'Sem categoria'}</span>
                    </span>
                  </td>
                  <td className="hidden truncate py-3 pr-3 text-muted-foreground @4xl:table-cell">{tx.account?.name ?? 'Sem conta'}</td>
                  <td className="w-[124px] py-3 pr-4 text-right @lg:w-auto @lg:pr-6">
                    <Money value={tx.amount} type={tx.type} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > visible && (
            <div className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
              <span>Mostrando {visible} de {filtered.length}</span>
              <Button variant="ghost" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>Mostrar mais {Math.min(PAGE_SIZE, filtered.length - visible)}</Button>
            </div>
          )}
        </div>
      )}

      {/* Detalhe da transação */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent>
          {selected && (
            <>
              <div className="flex flex-col gap-6 border-b px-7 pb-7 pt-8">
                <span className={cn('grid size-11 place-items-center rounded-full', selected.type === 'income' ? 'bg-income/15 text-income' : 'bg-expense/15 text-expense')}>
                  {selected.type === 'income' ? <ArrowDownLeft weight="bold" className="size-5" /> : <ArrowUpRight weight="bold" className="size-5" />}
                </span>
                <div className="flex flex-col gap-2">
                  <SheetDescription>{selected.type === 'income' ? 'Entrada' : 'Saída'}</SheetDescription>
                  <Money value={selected.amount} type={selected.type} sup className="text-[40px] leading-none tracking-[-0.045em]" />
                  <SheetTitle className="mt-1">{selected.title}</SheetTitle>
                </div>
              </div>

              <dl className="flex flex-1 flex-col gap-5 overflow-y-auto px-7 py-7 text-sm">
                <div className="flex gap-3">
                  <CalendarBlank className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div><dt className="text-xs text-muted-foreground">Data</dt><dd>{longDay(selected.date)}</dd></div>
                </div>
                <div className="flex gap-3">
                  <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Categoria</dt>
                    <dd className="flex items-center gap-2"><CategoryIcon icon={selected.category?.icon} color={selected.category?.color} size="sm" />{selected.category?.name ?? 'Sem categoria'}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div><dt className="text-xs text-muted-foreground">Conta</dt><dd>{selected.account?.name ?? 'Sem conta'}</dd></div>
                </div>
                {selected.client && (
                  <div className="flex gap-3">
                    <UserCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div><dt className="text-xs text-muted-foreground">{selected.type === 'income' ? 'Cliente' : 'Fornecedor'}</dt><dd>{selected.client.name}</dd></div>
                  </div>
                )}
                <div className="flex gap-3">
                  <Note className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Observação</dt>
                    <dd className={cn('whitespace-pre-wrap', !selected.description && 'text-muted-foreground')}>{selected.description || 'Nenhuma'}</dd>
                  </div>
                </div>
              </dl>

              <div className="flex gap-2 border-t px-7 py-5">
                <Button className="flex-1" onClick={() => openEdit(selected)}><PencilSimple />Editar</Button>
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => askDelete(selected)}><Trash />Excluir</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Nova / editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={handleSave} className="flex flex-col gap-5" noValidate>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar transação' : 'Nova transação'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Altere o que precisar e salve.' : 'Registre uma venda, um pagamento ou qualquer movimento de dinheiro.'}
              </DialogDescription>
            </DialogHeader>

            {!editingId && user?.receiptScan && <ReceiptScan onResult={applyReceipt} />}

            {scanned && !editingId && (
              <p className={cn(
                'rounded-xl px-3.5 py-2.5 text-xs',
                scanned.confidence === 'low' ? 'bg-expense/10 text-expense' : 'bg-primary/10 text-foreground'
              )}>
                {scanned.confidence === 'low'
                  ? 'O comprovante estava difícil de ler. Confira cada campo antes de salvar.'
                  : 'Preenchido a partir do comprovante. Confira antes de salvar.'}
                {scanned.counterparty && !scanned.clientId && ` ${scanned.type === 'income' ? 'Pagador' : 'Recebedor'}: ${scanned.counterparty} (não está em Clientes).`}
                {!scanned.amount && ' O valor não foi encontrado.'}
              </p>
            )}

            <TypeToggle value={form.type} onChange={(type) => setForm({ ...form, type, category: '' })} />

            <div className="flex flex-col gap-2">
              <Label htmlFor="tx-title">Descrição</Label>
              <Input id="tx-title" placeholder={form.type === 'income' ? 'Ex.: Venda de bolos' : 'Ex.: Conta de luz'} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="tx-amount">Valor (R$)</Label>
                <Input id="tx-amount" inputMode="decimal" placeholder="0,00" className="money" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tx-date">Data</Label>
                <Input id="tx-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
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
                    {formCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Conta</Label>
                <Select value={form.account} onValueChange={(v) => setForm({ ...form, account: v })}>
                  <SelectTrigger className="w-full" aria-label="Conta"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{form.type === 'income' ? 'Cliente' : 'Fornecedor'} <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Select value={form.client || NO_CLIENT} onValueChange={(v) => setForm({ ...form, client: v === NO_CLIENT ? '' : v })}>
                <SelectTrigger className="w-full" aria-label={form.type === 'income' ? 'Cliente' : 'Fornecedor'}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>Nenhum</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {clients.length === 0 && <p className="text-xs text-muted-foreground">Cadastre clientes na página Clientes para acompanhar quem compra.</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="tx-notes">Observação <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea id="tx-notes" rows={2} className="resize-none" placeholder="Forma de pagamento, nota fiscal" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            {formError && <ErrorNote>{formError}</ErrorNote>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{editingId ? 'Salvar alterações' : 'Registrar transação'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir esta transação?</DialogTitle>
            <DialogDescription>
              {deleteTarget && <>“{deleteTarget.title}”, de <Money value={deleteTarget.amount} />. Não dá para desfazer.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir transação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
