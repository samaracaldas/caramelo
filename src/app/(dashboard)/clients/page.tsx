'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash, UserCircle, Users, WhatsappLogo } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyNote, ErrorNote, ListSkeleton, Money, PageHeader, Section } from '@/components/brand'
import { useClients } from '@/lib/hooks'
import api, { getErrorMessage } from '@/lib/api'
import { formatCurrency, pluralize, todayISO } from '@/lib/format'
import { clientInsight, GONE_AFTER_DAYS, sinceLabel, whatsappLink, type ClientStatus } from '@/lib/clients'
import { cn } from '@/lib/utils'
import type { IClient } from '@/types'
import { useSessionUser } from '../shell'

const STATUS: Record<ClientStatus, { label: string; className: string }> = {
  regular: { label: 'Fiel', className: 'bg-income/12 text-income' },
  active: { label: 'Ativo', className: 'bg-secondary text-foreground' },
  new: { label: 'Novo', className: 'bg-primary/15 text-primary' },
  once: { label: 'Uma compra', className: 'bg-secondary text-muted-foreground' },
  gone: { label: 'Sumiu', className: 'bg-expense/12 text-expense' },
  none: { label: 'Sem compras', className: 'bg-secondary text-muted-foreground' },
}

interface Form { name: string; phone: string; notes: string }
const EMPTY: Form = { name: '', phone: '', notes: '' }

// empresa é chamada pelo nome inteiro; pessoa, pelo primeiro nome
const BUSINESS = /^(buffet|caf[eé]|escola|restaurante|padaria|loja|empresa|bar|hotel|mercado|ateli[eê]|studio|est[uú]dio)/i
const greetName = (name: string) => (BUSINESS.test(name) ? name : name.split(' ')[0])

const initials = (name: string) => name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

export default function ClientsPage() {
  const user = useSessionUser()
  const { clients, loading, refetch } = useClients()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<IClient | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const today = todayISO()

  const rows = useMemo(
    () => clients
      .map((c) => ({ ...c, insight: clientInsight(c, today) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    [clients, today]
  )
  const gone = rows.filter((r) => r.insight.status === 'gone').sort((a, b) => b.total - a.total)
  const buyers = rows.filter((r) => r.purchases > 0)
  const activeCount = buyers.filter((r) => (r.insight.daysSince ?? Infinity) <= GONE_AFTER_DAYS).length
  const ticket = buyers.length ? buyers.reduce((s, r) => s + r.total, 0) / buyers.reduce((s, r) => s + r.purchases, 0) : 0

  const business = user?.name ?? 'nossa loja'
  const message = (name: string) =>
    `Oi, ${greetName(name)}! Aqui é da ${business}. Faz um tempinho que você não aparece e sentimos sua falta. Posso te ajudar com alguma encomenda?`

  const openNew = () => { setEditing(null); setForm(EMPTY); setFormError(''); setConfirmDelete(false); setFormOpen(true) }
  const openEdit = (c: IClient) => {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone ?? '', notes: c.notes ?? '' })
    setFormError('')
    setConfirmDelete(false)
    setFormOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.name.trim().length < 2) return setFormError('Informe o nome, com pelo menos 2 letras.')
    setFormError('')
    try {
      const payload = { name: form.name.trim(), phone: form.phone.trim(), notes: form.notes }
      if (editing) await api.put(`/clients/${editing.id}`, payload)
      else await api.post('/clients', payload)
      setFormOpen(false)
      refetch()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Não foi possível salvar o cliente.'))
    }
  }

  const remove = async () => {
    if (!editing) return
    try {
      await api.delete(`/clients/${editing.id}`)
      setFormOpen(false)
      refetch()
    } catch (err) {
      setFormError(getErrorMessage(err, 'Não foi possível excluir.'))
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Clientes" description="Quem compra de você, com que frequência e quem parou de aparecer.">
        <Button onClick={openNew}><Plus weight="bold" />Novo cliente</Button>
      </PageHeader>

      {loading ? <ListSkeleton rows={5} /> : clients.length === 0 ? (
        <EmptyNote className="flex flex-col items-center gap-4 py-14">
          <span className="grid size-12 place-items-center rounded-full bg-secondary"><Users className="size-6" /></span>
          <p className="max-w-[46ch]">Cadastre quem compra de você e escolha o cliente ao registrar uma venda. Aqui você vai ver quem é fiel e quem sumiu.</p>
          <Button onClick={openNew} variant="outline"><Plus />Cadastrar o primeiro</Button>
        </EmptyNote>
      ) : (
        <>
          <section aria-label="Resumo" className="rise grid overflow-hidden rounded-2xl border bg-card @2xl:grid-cols-3">
            {[
              { label: 'Compraram nos últimos 60 dias', node: <span className="money text-[26px] tracking-[-0.04em]">{activeCount}</span>, note: `de ${pluralize(clients.length, 'cliente', 'clientes')}` },
              { label: 'Ticket médio', node: <Money value={ticket} sup className="text-[26px] tracking-[-0.04em]" />, note: 'por compra com cliente' },
              { label: 'Sumiram', node: <span className={cn('money text-[26px] tracking-[-0.04em]', gone.length > 0 && 'text-expense')}>{gone.length}</span>, note: 'compravam e pararam' },
            ].map((s, i) => (
              <div key={s.label} className={cn('flex flex-col gap-1.5 px-6 py-5', i > 0 && 'border-t @2xl:border-l @2xl:border-t-0')}>
                <span className="text-sm text-muted-foreground">{s.label}</span>
                {s.node}
                <span className="text-xs text-muted-foreground">{s.note}</span>
              </div>
            ))}
          </section>

          {/* O que dá para fazer hoje: chamar de volta quem sumiu */}
          {gone.length > 0 && (
            <Section title="Vale chamar de volta" aside={pluralize(gone.length, 'cliente', 'clientes')} className="rise [--i:1]">
              <ul className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
                {gone.map((c) => {
                  const link = c.phone ? whatsappLink(c.phone, message(c.name)) : null
                  return (
                    <li key={c.id} className="flex flex-col gap-4 rounded-2xl border border-expense/25 bg-card p-5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm">{initials(c.name)}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[15px]">{c.name}</p>
                          <p className="text-xs text-muted-foreground">Última compra {sinceLabel(c.insight.daysSince!)}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {pluralize(c.purchases, 'compra', 'compras')}
                        {c.insight.avgGap ? `, uma a cada ${Math.round(c.insight.avgGap)} dias` : ''}, somando{' '}
                        <Money value={c.total} className="text-foreground" />.
                      </p>
                      {link ? (
                        <Button asChild variant="secondary" size="sm" className="w-fit">
                          <a href={link} target="_blank" rel="noopener noreferrer"><WhatsappLogo weight="fill" className="text-income" />Chamar no WhatsApp</a>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => openEdit(c)}>Adicionar telefone</Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          <Section title="Todos os clientes" aside="ordenados por quanto compraram" className="rise [--i:2]">
            <div className="@container overflow-hidden rounded-2xl border bg-card">
              <table className="w-full table-fixed text-sm">
                <thead className="hidden border-b text-left text-xs text-muted-foreground @2xl:table-header-group">
                  <tr>
                    <th scope="col" className="py-3 pl-6 font-normal">Cliente</th>
                    <th scope="col" className="w-[110px] py-3 font-normal">Situação</th>
                    <th scope="col" className="hidden w-[130px] py-3 text-right font-normal @3xl:table-cell">Ticket médio</th>
                    <th scope="col" className="hidden w-[130px] py-3 font-normal @3xl:table-cell">Última compra</th>
                    <th scope="col" className="w-[140px] py-3 pr-6 text-right font-normal">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} onClick={() => openEdit(c)} className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-accent/60">
                      <td className="py-3 pl-4 pr-3 @2xl:pl-6">
                        <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(c) }} aria-label={`Editar ${c.name}`} className="flex w-full min-w-0 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs">{initials(c.name)}</span>
                          <span className="min-w-0">
                            <span className="block truncate">{c.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {pluralize(c.purchases, 'compra', 'compras')}{c.phone ? `, ${c.phone}` : ''}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="hidden py-3 pr-3 @2xl:table-cell">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs', STATUS[c.insight.status].className)}>{STATUS[c.insight.status].label}</span>
                      </td>
                      <td className="hidden py-3 pr-3 text-right @3xl:table-cell">{c.purchases ? <Money value={c.insight.ticket} className="text-muted-foreground" /> : null}</td>
                      <td className="hidden py-3 pr-3 text-muted-foreground @3xl:table-cell">{c.insight.daysSince !== null ? sinceLabel(c.insight.daysSince) : null}</td>
                      <td className="w-[124px] py-3 pr-4 text-right @2xl:w-auto @2xl:pr-6">
                        <Money value={c.total} />
                        <span className={cn('mt-1 block text-[11px] @2xl:hidden', STATUS[c.insight.status].className.split(' ').find((k) => k.startsWith('text-')))}>{STATUS[c.insight.status].label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} className="flex flex-col gap-5" noValidate>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary">
                  {form.name.trim() ? <span className="text-sm">{initials(form.name)}</span> : <UserCircle className="size-6 text-muted-foreground" />}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <DialogTitle>{editing ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
                  <DialogDescription>
                    {editing && editing.purchases > 0
                      ? `${pluralize(editing.purchases, 'compra', 'compras')}, ${formatCurrency(editing.total)} no total.`
                      : 'Pode ser pessoa ou empresa. Fornecedores também funcionam.'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="client-name">Nome</Label>
              <Input id="client-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="client-phone">WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input id="client-phone" type="tel" inputMode="tel" placeholder="(11) 98765-4321" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="client-notes">Observação <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea id="client-notes" rows={2} className="resize-none" placeholder="Preferências, alergias, aniversário" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {formError && <ErrorNote>{formError}</ErrorNote>}
            {confirmDelete && (
              <ErrorNote>As vendas deste cliente continuam registradas, só sem o nome. Clique em Excluir de novo para confirmar.</ErrorNote>
            )}
            <DialogFooter className="sm:justify-between">
              {editing ? (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}>
                  <Trash />Excluir
                </Button>
              ) : <span />}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button type="submit">{editing ? 'Salvar alterações' : 'Cadastrar cliente'}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
