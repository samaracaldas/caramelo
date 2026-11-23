'use client'

import { createContext, useContext, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowsLeftRight, Briefcase, ChartBar, List, PiggyBank, Repeat, SignOut, SquaresFour, Tag, Users, Wallet, X } from '@phosphor-icons/react/ssr'
import type { Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand'
import api from '@/lib/api'

type SessionUser = { name: string; email: string; /** leitura de comprovante disponível (há chave da Anthropic) */ receiptScan?: boolean }
const UserContext = createContext<SessionUser | null>(null)
/** Usuário logado, já validado no servidor pelo layout. */
export const useSessionUser = () => useContext(UserContext)

// Agrupado por intenção: o dinheiro do dia a dia em cima, organização e fechamento embaixo.
const NAV_GROUPS: { title: string; items: { label: string; href: string; icon: Icon }[] }[] = [
  {
    title: 'Dinheiro',
    items: [
      { label: 'Painel', href: '/dashboard', icon: SquaresFour },
      { label: 'Transações', href: '/transactions', icon: ArrowsLeftRight },
      { label: 'Recorrentes', href: '/recurring', icon: Repeat },
      { label: 'Contas', href: '/accounts', icon: Wallet },
      { label: 'Caixinhas', href: '/boxes', icon: PiggyBank },
    ],
  },
  {
    title: 'Organização',
    items: [
      { label: 'Clientes', href: '/clients', icon: Users },
      { label: 'Categorias', href: '/categories', icon: Tag },
      { label: 'Relatórios', href: '/reports', icon: ChartBar },
      { label: 'Contador', href: '/accountant', icon: Briefcase },
    ],
  },
]

function Nav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Principal" className="flex flex-1 flex-col gap-6 px-3 py-2">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="px-4 pb-1 text-xs text-muted-foreground/80">{group.title}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ label, href, icon: ItemIcon }) => {
              const active = pathname === href
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-10 items-center gap-3 rounded-full px-4 text-[14px] text-muted-foreground outline-none transition-colors',
                      'hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      active && 'bg-accent text-foreground'
                    )}
                  >
                    <ItemIcon weight={active ? 'fill' : 'regular'} className={cn('size-[18px]', active && 'text-primary')} />
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function UserBlock({ name, email, onLogout }: { name: string; email: string; onLogout: () => void }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="m-3 flex items-center gap-3 rounded-2xl border bg-background/40 p-2.5 pl-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium">{initials}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{email}</span>
      </span>
      <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={onLogout} aria-label="Sair" title="Sair">
        <SignOut />
      </Button>
    </div>
  )
}

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="px-6 pb-5 pt-6">
          <Logo />
        </div>
        <Nav pathname={pathname} />
        <UserBlock {...user} onLogout={handleLogout} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in-0" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-card animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between px-6 pb-5 pt-5">
              <Logo />
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
                <X />
              </Button>
            </div>
            <Nav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <UserBlock {...user} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Logo />
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <List />
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="@container mx-auto w-full max-w-[1160px] px-4 py-7 sm:px-8 sm:py-10">
            <UserContext.Provider value={user}>{children}</UserContext.Provider>
          </div>
        </main>
      </div>
    </div>
  )
}
