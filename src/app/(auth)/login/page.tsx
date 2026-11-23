import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUserId } from '@/lib/server/session'
import { Logo } from '@/components/brand'
import { AuthForm } from './auth-form'

export const metadata: Metadata = { title: 'Entrar' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  if (await currentUserId()) redirect('/dashboard')
  const { modo } = await searchParams

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r bg-card px-14 py-12 lg:flex">
        <Link href="/" className="w-fit rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <div className="flex max-w-md flex-col gap-5">
          <p className="text-[44px] font-normal leading-[1.05] tracking-[-0.04em]">
            Quanto entrou, quanto saiu e onde está cada real.
          </p>
          <p className="max-w-[46ch] text-base leading-relaxed text-muted-foreground">
            Registre vendas e despesas, separe por conta e categoria e feche o mês com o saldo certo.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Feito para pequenos negócios.</p>
        {/* o caramelo da marca, como um sol se pondo atrás do texto */}
        <span aria-hidden className="pointer-events-none absolute -bottom-40 -right-32 size-[420px] rounded-full bg-primary/15 blur-3xl" />
      </aside>

      <main className="flex justify-center px-4 py-10 sm:px-10 lg:items-center">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <Link href="/" className="w-fit lg:hidden"><Logo /></Link>
          <AuthForm initialMode={modo === 'cadastro' ? 'register' : 'login'} />
        </div>
      </main>
    </div>
  )
}
