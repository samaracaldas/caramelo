'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, LinkSimple, Plus, Prohibit } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyNote, ErrorNote, ListSkeleton, PageHeader, Section, Segmented } from '@/components/brand'
import api, { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ShareLink {
  id: string
  label: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

const EXPIRY = [
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '365', label: '1 ano' },
  { value: 'never', label: 'Sem prazo' },
] as const

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })

function statusOf(l: ShareLink) {
  if (l.revokedAt) return { label: `Revogado em ${day(l.revokedAt)}`, active: false }
  if (l.expiresAt && new Date(l.expiresAt).getTime() < Date.now()) return { label: `Expirou em ${day(l.expiresAt)}`, active: false }
  return { label: l.expiresAt ? `Vale até ${day(l.expiresAt)}` : 'Sem prazo', active: true }
}

export default function AccountantPage() {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [expiry, setExpiry] = useState<(typeof EXPIRY)[number]['value']>('90')
  const [error, setError] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<ShareLink | null>(null)

  const load = async () => {
    try {
      setLinks((await api.get('/share-links')).data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (label.trim().length < 2) return setError('Dê um nome ao link, por exemplo o do escritório.')
    setError('')
    try {
      const res = await api.post('/share-links', { label: label.trim(), expiresInDays: expiry === 'never' ? null : Number(expiry) })
      setCreated(`${window.location.origin}${res.data.path}`)
      setCopied(false)
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível criar o link.'))
    }
  }

  const copy = async () => {
    if (!created) return
    await navigator.clipboard.writeText(created).catch(() => {})
    setCopied(true)
  }

  const closeDialog = () => {
    setOpen(false)
    setCreated(null)
    setLabel('')
    setExpiry('90')
  }

  const revoke = async () => {
    if (!revoking) return
    await api.delete(`/share-links/${revoking.id}`).catch(() => {})
    setRevoking(null)
    load()
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Contador" description="Um link só de leitura para o seu contador ver o fechamento e baixar a planilha, sem senha.">
        <Button onClick={() => setOpen(true)}><Plus weight="bold" />Novo link</Button>
      </PageHeader>

      <ul className="grid gap-4 text-sm @3xl:grid-cols-3">
        {[
          ['O que o contador vê', 'Entradas, saídas e resultado do mês ou do ano, por categoria, e cada lançamento.'],
          ['O que ele não faz', 'Não edita, não apaga e não vê suas contas por dentro. Só lê e baixa a planilha.'],
          ['Você controla', 'O link aparece uma vez só. Dá para ver quando foi usado e revogar na hora.'],
        ].map(([title, body]) => (
          <li key={title} className="flex flex-col gap-1.5 rounded-2xl border bg-card px-5 py-4">
            <span>{title}</span>
            <span className="text-muted-foreground">{body}</span>
          </li>
        ))}
      </ul>

      <Section title="Links criados">
        {loading ? <ListSkeleton rows={2} /> : links.length === 0 ? (
          <EmptyNote>Nenhum link ainda. Crie um e mande para o seu contador pelo WhatsApp ou e-mail.</EmptyNote>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card px-5">
            {links.map((l) => {
              const s = statusOf(l)
              return (
                <li key={l.id} className={cn('flex items-center gap-3 py-3', !s.active && 'opacity-60')}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary"><LinkSimple className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{l.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.label}, {l.lastUsedAt ? `aberto pela última vez em ${day(l.lastUsedAt)}` : 'ainda não foi aberto'}
                    </p>
                  </div>
                  {s.active && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setRevoking(l)}>
                      <Prohibit />Revogar
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-md">
          {created ? (
            <div className="flex flex-col gap-5">
              <DialogHeader>
                <DialogTitle>Link criado</DialogTitle>
                <DialogDescription>Copie agora: por segurança ele não aparece de novo. Se perder, é só criar outro.</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                <Input readOnly value={created} aria-label="Link para o contador" onFocus={(e) => e.currentTarget.select()} className="money text-xs" />
                <Button onClick={copy} variant={copied ? 'secondary' : 'default'} className="shrink-0">
                  {copied ? <><Check weight="bold" />Copiado</> : <><Copy />Copiar</>}
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={create} className="flex flex-col gap-5" noValidate>
              <DialogHeader>
                <DialogTitle>Novo link para o contador</DialogTitle>
                <DialogDescription>Quem tiver o link vê o fechamento em modo leitura.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="share-label">Para quem é</Label>
                <Input id="share-label" placeholder="Ex.: Escritório Contábil Silva" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Validade</Label>
                <Segmented value={expiry} options={EXPIRY} onChange={setExpiry} label="Validade" className="w-full" />
              </div>
              {error && <ErrorNote>{error}</ErrorNote>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit">Criar link</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!revoking} onOpenChange={(o) => !o && setRevoking(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revogar o link de “{revoking?.label}”?</DialogTitle>
            <DialogDescription>Ele para de funcionar na hora. Para dar acesso de novo, crie outro link.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={revoke}>Revogar link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
