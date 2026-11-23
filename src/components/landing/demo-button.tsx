'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CircleNotch } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/button'
import api, { getErrorMessage } from '@/lib/api'

/** Abre a conta de demonstração direto da landing, sem passar pelo formulário. */
export function DemoButton({ size = 'lg', className }: { size?: 'default' | 'lg'; className?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const open = async () => {
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/demo')
      router.push('/dashboard')
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível abrir a demonstração.'))
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex flex-col gap-2">
      <Button size={size} onClick={open} disabled={loading} className={`group ${className ?? ""}`}>
        Ver demonstração
        {loading ? <CircleNotch className="animate-spin" /> : <ArrowRight className="transition-transform group-hover:translate-x-0.5" />}
      </Button>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
