'use client'

import { useRef, useState } from 'react'
import { Camera, CircleNotch, Sparkle } from '@phosphor-icons/react/ssr'
import api, { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface ReceiptResult {
  type: 'income' | 'expense'
  amount: number | null
  date: string | null
  title: string
  counterparty: string | null
  categoryId: string | null
  clientId: string | null
  notes: string | null
  confidence: 'high' | 'medium' | 'low'
}

/**
 * "Ler comprovante": a pessoa escolhe a foto do Pix ou da nota (a câmera do celular também
 * aparece como opção) e o formulário é preenchido. Nada é salvo sem ela conferir.
 */
export function ReceiptScan({ onResult }: { onResult: (r: ReceiptResult) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'reading'>('idle')
  const [error, setError] = useState('')

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setState('reading')
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await api.post('/receipts/scan', body, { timeout: 60_000 })
      onResult(res.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível ler o comprovante.'))
    } finally {
      setState('idle')
      if (input.current) input.current.value = ''
    }
  }

  const reading = state === 'reading'
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={reading}
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-left outline-none transition-colors',
          'hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-wait',
          reading && 'border-primary/60 bg-primary/5'
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          {reading ? <CircleNotch className="size-5 animate-spin" /> : <Camera weight="fill" className="size-5" />}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm">
            {reading ? 'Lendo o comprovante' : 'Ler comprovante'}
            {!reading && <Sparkle weight="fill" className="size-3.5 text-primary" />}
          </span>
          <span className="block text-xs text-muted-foreground">
            {reading ? 'Leva alguns segundos.' : 'Foto ou print do Pix, nota fiscal ou boleto pago. Preenche o formulário para você conferir.'}
          </span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="Escolher comprovante"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
