'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleNotch, Eye, EyeSlash, Dog } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorNote } from '@/components/brand'
import api, { getErrorMessage } from '@/lib/api'

type Mode = 'login' | 'register'

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<'form' | 'demo' | null>(null)

  const authenticate = async (kind: 'form' | 'demo', request: () => Promise<unknown>, fallback: string) => {
    setError('')
    setLoading(kind)
    try {
      await request()
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(getErrorMessage(err, fallback))
      setLoading(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'register') {
      if (name.trim().length < 2) return setError('Informe seu nome, com pelo menos 2 letras.')
      if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
      return authenticate('form', () => api.post('/auth/register', { name: name.trim(), email, password }), 'Não foi possível criar a conta.')
    }
    return authenticate('form', () => api.post('/auth/login', { email, password }), 'Não foi possível entrar. Confira o e-mail e a senha.')
  }

  const handleDemo = () => authenticate('demo', () => api.post('/auth/demo'), 'Não foi possível abrir a demonstração.')

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
    setPassword('')
  }

  const isLogin = mode === 'login'

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[34px] font-normal leading-tight tracking-[-0.035em]">{isLogin ? 'Entrar' : 'Criar conta'}</h1>
        <p className="text-sm text-muted-foreground">
          {isLogin ? 'Use o e-mail e a senha da sua conta.' : 'Leva menos de um minuto.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {!isLogin && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12" required />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="voce@seunegocio.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-12"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              aria-describedby={isLogin ? undefined : 'password-hint'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              className="h-12 pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {!isLogin && <p id="password-hint" className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>}
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button type="submit" size="lg" className="mt-2" disabled={loading !== null}>
          {loading === 'form' && <CircleNotch className="animate-spin" />}
          {isLogin ? 'Entrar' : 'Criar conta'}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {isLogin ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
        <button
          type="button"
          onClick={switchMode}
          className="rounded text-foreground underline decoration-primary decoration-2 underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {isLogin ? 'Criar conta' : 'Entrar'}
        </button>
      </p>

      <div className="flex flex-col gap-3 border-t pt-7">
        <Button type="button" variant="outline" size="lg" onClick={handleDemo} disabled={loading !== null}>
          {loading === 'demo' ? <CircleNotch className="animate-spin" /> : <Dog />}
          Ver demonstração
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Um ano de dados de uma confeitaria fictícia, sem cadastro. Os dados voltam ao original todo dia.
        </p>
      </div>
    </>
  )
}
