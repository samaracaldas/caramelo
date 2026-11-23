'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, CheckCircle, PencilSimple, PiggyBank, Plus, Trash, WarningCircle } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ColorPicker, EmptyNote, ErrorNote, ListSkeleton, Money, PageHeader, Section, Segmented } from '@/components/brand'
import { CategoryIcon, IconPicker } from '@/components/brand/category-icon'
import { useBoxes, useRecurrences, useTransactions } from '@/lib/hooks'
import api, { getErrorMessage } from '@/lib/api'
import { amountInput, formatCurrency, formatDay, parseAmount, pluralize, todayISO } from '@/lib/format'
import { buildAgenda, forecastDeltas, projectBalance } from '@/lib/recurrence'
import { pace, plannedSavings } from '@/lib/boxes'
import { SWATCHES } from '@/lib/palette'
import { cn } from '@/lib/utils'
import type { IBox } from '@/types'

const HORIZON = 30

interface BoxForm { name: string; icon: string; color: string; target: string; targetDate: string }
const emptyBox = (): BoxForm => ({ name: '', icon: 'piggy-bank', color: SWATCHES[3].value, target: '', targetDate: '' })

type EntryKind = 'deposit' | 'withdraw'
const KINDS = [
  { value: 'deposit', label: 'Guardar' },
  { value: 'withdraw', label: 'Retirar' },
] as const

function paceText(box: IBox, today: string) {
  const p = pace(box, today)
  switch (p.kind) {
    case 'free': return 'Sem meta: guarde quando sobrar'
    case 'done': return 'Meta atingida'
    case 'no-date': return `Faltam ${formatCurrency(p.remaining)}`
    case 'late': return `O prazo passou e faltam ${formatCurrency(p.remaining)}`
    case 'on-track': return `Guarde ${formatCurrency(p.perWeek)} por semana até ${formatDay(box.targetDate!, { day: 'numeric', month: 'short' })}`
  }
}

export default function BoxesPage() {
  const { boxes, entries, inAccounts, inBoxes, free, loading, refetch } = useBoxes()
  const { recurrences } = useRecurrences()
  const { transactions } = useTransactions()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BoxForm>(emptyBox)
  const [formError, setFormError] = useState('')

  const [entryBox, setEntryBox] = useState<IBox | null>(null)
  const [entryKind, setEntryKind] = useState<EntryKind>('deposit')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryNote, setEntryNote] = useState('')
  const [entryError, setEntryError] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<IBox | null>(null)
  const today = todayISO()

  /*
   * O teste de realidade: pagando as recorrências no vencimento e guardando no ritmo
   * sugerido, qual o menor saldo livre dos próximos 30 dias?
   */
  const outlook = useMemo(() => {
    if (loading) return null
    const deltas = forecastDeltas(buildAgenda(recurrences, transactions, today, HORIZON), today)
    plannedSavings(boxes, today, HORIZON).forEach((v, day) => deltas.set(day, (deltas.get(day) ?? 0) + v))
    if (deltas.size === 0) return null
    const days = projectBalance(free, deltas, today, HORIZON)
    return days.reduce((low, d) => (d.balance < low.balance ? d : low), days[0])
  }, [loading, recurrences, transactions, boxes, free, today])

  const boxById = useMemo(() => new Map(boxes.map((b) => [b.id, b])), [boxes])

  const openNew = () => { setEditingId(null); setForm(emptyBox()); setFormError(''); setFormOpen(true) }
  const openEdit = (b: IBox) => {
    setEditingId(b.id)
    setForm({ name: b.name, icon: b.icon, color: b.color, target: b.target ? amountInput(b.target) : '', targetDate: b.targetDate ?? '' })
    setFormError('')
    setFormOpen(true)
  }

  const saveBox = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.name.trim().length < 2) return setFormError('Dê um nome com pelo menos 2 letras.')
    const target = form.target.trim() ? parseAmount(form.target) : null
    if (target !== null && (!Number.isFinite(target) || target <= 0)) return setFormError('A meta precisa ser um valor maior que zero.')
    if (form.targetDate && !target) return setFormError('Para ter prazo, defina também o valor da meta.')
    setFormError('')
    try {
      const payload = { name: form.name.trim(), icon: form.icon, color: form.color, target, targetDate: form.targetDate || null }
      if (editingId) await api.put(`/boxes/${editingId}`, payload)
      else await api.post('/boxes', payload)
      setFormOpen(false)
      refetch()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Não foi possível salvar a caixinha.'))
    }
  }

  const openEntry = (b: IBox, kind: EntryKind) => {
    const p = pace(b, today)
    setEntryBox(b)
    setEntryKind(kind)
    setEntryAmount(kind === 'deposit' && p.kind === 'on-track' ? amountInput(Math.min(p.perWeek, Math.max(free, 0))) : '')
    setEntryNote('')
    setEntryError('')
  }

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entryBox) return
    const amount = parseAmount(entryAmount)
    if (!Number.isFinite(amount) || amount <= 0) return setEntryError('Informe um valor maior que zero, por exemplo 150,00.')
    setEntryError('')
    setSaving(true)
    try {
      await api.post(`/boxes/${entryBox.id}/entries`, { kind: entryKind, amount, date: today, note: entryNote })
      setEntryBox(null)
      refetch()
    } catch (err) {
      setEntryError(getErrorMessage(err, 'Não foi possível registrar.'))
    } finally {
      setSaving(false)
    }
  }

  const deleteBox = async () => {
    if (!deleteTarget) return
    await api.delete(`/boxes/${deleteTarget.id}`).catch(() => {})
    setDeleteTarget(null)
    refetch()
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Caixinhas" description="Separe o dinheiro por destino, sem tirar das contas.">
        <Button onClick={openNew}><Plus weight="bold" />Nova caixinha</Button>
      </PageHeader>

      {/* Quanto é de verdade livre */}
      <section aria-label="Resumo" className="rise grid overflow-hidden rounded-2xl border bg-card @2xl:grid-cols-3">
        {[
          { label: 'Em caixa', value: inAccounts, note: 'soma das contas' },
          { label: 'Nas caixinhas', value: inBoxes, note: pluralize(boxes.length, 'caixinha', 'caixinhas') },
          { label: 'Livre para usar', value: free, note: 'em caixa menos o separado', strong: true },
        ].map((s, i) => (
          <div key={s.label} className={cn('flex flex-col gap-1.5 px-6 py-5', i > 0 && 'border-t @2xl:border-l @2xl:border-t-0')}>
            <span className="text-sm text-muted-foreground">{s.label}</span>
            {loading ? <div className="h-8 w-36 animate-pulse rounded-lg bg-muted" /> : (
              <Money value={s.value} sup className={cn('text-[26px] tracking-[-0.04em]', s.strong && s.value < 0 && 'text-expense', !s.strong && 'text-muted-foreground')} />
            )}
            <span className="text-xs text-muted-foreground">{s.note}</span>
          </div>
        ))}
      </section>

      {outlook && (
        <p className={cn(
          'rise flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm [--i:1]',
          outlook.balance < 0 ? 'border-expense/30 bg-expense/8' : 'bg-card'
        )}>
          {outlook.balance < 0
            ? <WarningCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-expense" />
            : <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-income" />}
          <span>
            Pagando as recorrências e guardando no ritmo sugerido, o menor saldo livre dos próximos {HORIZON} dias é{' '}
            <Money value={outlook.balance} className={outlook.balance < 0 ? 'text-expense' : 'text-foreground'} />,{' '}
            em {formatDay(outlook.day, { day: 'numeric', month: 'long' })}.
            {outlook.balance < 0 && ' Vale guardar menos por semana ou adiar algum prazo.'}
          </span>
        </p>
      )}

      {loading ? <ListSkeleton rows={3} /> : boxes.length === 0 ? (
        <EmptyNote className="flex flex-col items-center gap-4 py-14">
          <span className="grid size-12 place-items-center rounded-full bg-secondary"><PiggyBank className="size-6" /></span>
          <p className="max-w-[46ch]">Nenhuma caixinha ainda. Comece por algo que sempre aperta: o 13º dos funcionários, o imposto do trimestre ou uma reforma.</p>
          <Button onClick={openNew} variant="outline"><Plus />Criar a primeira</Button>
        </EmptyNote>
      ) : (
        <ul className="rise grid gap-4 [--i:2] @xl:grid-cols-2 @4xl:grid-cols-3">
          {boxes.map((b) => {
            const pct = b.target ? Math.min(100, (b.saved / b.target) * 100) : null
            const p = pace(b, today)
            return (
              <li key={b.id} className="group flex flex-col gap-5 rounded-2xl border bg-card p-5" style={{ '--c': b.color } as React.CSSProperties}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <CategoryIcon icon={b.icon} color={b.color} />
                    <p className="truncate text-[15px]">{b.name}</p>
                  </div>
                  <div className="-mr-2 -mt-1 flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => openEdit(b)} aria-label={`Editar ${b.name}`}><PencilSimple className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(b)} aria-label={`Excluir ${b.name}`}><Trash className="size-3.5" /></Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="flex items-baseline gap-1.5">
                    <Money value={b.saved} sup className="text-[28px] tracking-[-0.04em]" />
                    {b.target && <span className="text-sm text-muted-foreground">de {formatCurrency(b.target)}</span>}
                  </p>
                  {pct !== null && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${Math.round(pct)}% da meta`}>
                      <div className="h-full rounded-full bg-[var(--c)] transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  <p className={cn('text-xs', p.kind === 'late' ? 'text-expense' : p.kind === 'done' ? 'text-income' : 'text-muted-foreground')}>
                    {paceText(b, today)}
                  </p>
                </div>

                <div className="mt-auto flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => openEntry(b, 'deposit')}><ArrowDown weight="bold" />Guardar</Button>
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => openEntry(b, 'withdraw')} disabled={b.saved <= 0}><ArrowUp weight="bold" />Retirar</Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {entries.length > 0 && (
        <Section title="Movimentações recentes" className="rise [--i:3]">
          <ul className="divide-y rounded-2xl border bg-card px-5">
            {entries.slice(0, 8).map((e) => {
              const b = boxById.get(e.boxId)
              return (
                <li key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <CategoryIcon icon={b?.icon} color={b?.color} />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{e.amount > 0 ? 'Guardado em' : 'Retirado de'} {b?.name ?? 'caixinha'}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatDay(e.date)}{e.note ? `, ${e.note}` : ''}</p>
                  </div>
                  <Money value={Math.abs(e.amount)} className={e.amount > 0 ? 'text-foreground' : 'text-muted-foreground'} />
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {/* Nova / editar caixinha */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <form onSubmit={saveBox} className="flex flex-col gap-5" noValidate>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar caixinha' : 'Nova caixinha'}</DialogTitle>
              <DialogDescription>O dinheiro continua na conta; a caixinha só marca que ele tem destino.</DialogDescription>
            </DialogHeader>
            <div className="flex items-end gap-3">
              <CategoryIcon icon={form.icon} color={form.color} size="lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="box-name">Nome</Label>
                <Input id="box-name" placeholder="Ex.: 13º dos funcionários" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="box-target">Meta (R$) <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Input id="box-target" inputMode="decimal" placeholder="0,00" className="money" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="box-date">Prazo <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Input id="box-date" type="date" min={today} value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Ícone</Label>
              <IconPicker value={form.icon} color={form.color} onChange={(icon) => setForm({ ...form, icon })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Cor</Label>
              <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} />
            </div>
            {formError && <ErrorNote>{formError}</ErrorNote>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Salvar alterações' : 'Criar caixinha'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Guardar / retirar */}
      <Dialog open={!!entryBox} onOpenChange={(o) => !o && setEntryBox(null)}>
        <DialogContent className="sm:max-w-sm">
          {entryBox && (
            <form onSubmit={saveEntry} className="flex flex-col gap-5" noValidate>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <CategoryIcon icon={entryBox.icon} color={entryBox.color} />
                  <div className="min-w-0 flex-1 text-left">
                    <DialogTitle className="truncate">{entryBox.name}</DialogTitle>
                    <DialogDescription>
                      {entryKind === 'deposit' ? <>Livre para guardar: {formatCurrency(Math.max(free, 0))}</> : <>Na caixinha: {formatCurrency(entryBox.saved)}</>}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <Segmented value={entryKind} options={KINDS} onChange={(k) => { setEntryKind(k); setEntryError('') }} label="Movimento" className="w-full" />
              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-amount">Valor (R$)</Label>
                <Input id="entry-amount" inputMode="decimal" placeholder="0,00" className="money" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} autoFocus />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-note">Observação <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Input id="entry-note" placeholder={entryKind === 'deposit' ? 'Ex.: sobra das vendas da semana' : 'Ex.: pagamento da primeira parcela'} value={entryNote} onChange={(e) => setEntryNote(e.target.value)} />
              </div>
              {entryError && <ErrorNote>{entryError}</ErrorNote>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEntryBox(null)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{entryKind === 'deposit' ? 'Guardar' : 'Retirar'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget.saved > 0
                ? `Os ${formatCurrency(deleteTarget.saved)} guardados voltam para o saldo livre. O dinheiro nunca saiu das contas.`
                : 'A caixinha está vazia.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteBox}>Excluir caixinha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
