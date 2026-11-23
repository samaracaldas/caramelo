import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DownloadSimple, GithubLogo } from '@phosphor-icons/react/ssr'
import { currentUserId } from '@/lib/server/session'
import { BalanceCard, Logo, Mark, Money, SpendStack } from '@/components/brand'
import { CategoryIcon } from '@/components/brand/category-icon'
import { Button } from '@/components/ui/button'
import { DemoButton } from '@/components/landing/demo-button'

/* Dados de exemplo da prévia (os mesmos tipos de lançamento da conta de demonstração). */
const SAMPLE_SPEND = [
  { name: 'Folha', value: 6400, color: '#a3bfff' },
  { name: 'Aluguel', value: 3200, color: '#c9b4ff' },
  { name: 'Insumos', value: 3870, color: '#ffb98a' },
  { name: 'Energia e água', value: 812, color: '#ffe27a' },
  { name: 'Embalagens', value: 431, color: '#b4b4bd' },
]
const SAMPLE_ROWS = [
  { title: 'Bolo de casamento (encomenda)', meta: 'Encomendas, Conta PJ', amount: 1980, type: 'income' as const, color: '#f2a541', icon: 'cake' },
  { title: 'Farinha, ovos e manteiga', meta: 'Insumos, Conta PJ', amount: 3184, type: 'expense' as const, color: '#ffb98a', icon: 'basket' },
  { title: 'Repasse do delivery', meta: 'Delivery, Conta PJ', amount: 2765, type: 'income' as const, color: '#7fd3ec', icon: 'moped' },
]

function Row({ title, meta, amount, type, color, icon }: (typeof SAMPLE_ROWS)[number]) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
      <CategoryIcon icon={icon} color={color} />
      <span className="min-w-0">
        <span className="block truncate text-sm">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      <Money value={amount} type={type} className="text-sm" />
    </li>
  )
}

export default async function Home() {
  if (await currentUserId()) redirect('/dashboard')

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-4 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Conta">
          <Button asChild variant="ghost"><Link href="/login">Entrar</Link></Button>
          <Button asChild variant="secondary"><Link href="/login?modo=cadastro">Criar conta</Link></Button>
        </nav>
      </header>

      <main>
        {/* Hero: mensagem à esquerda, o próprio produto à direita */}
        <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-20 pt-10 sm:px-8 md:pt-16 lg:min-h-[calc(100dvh-72px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:pb-24 lg:pt-0">
          <div className="flex flex-col items-start gap-7">
            <h1 className="rise max-w-[13ch] text-[44px] font-normal leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-[68px]">
              O dinheiro do seu negócio, sem mistério.
            </h1>
            <p className="rise max-w-[40ch] text-lg leading-relaxed text-muted-foreground [--i:1]">
              Entradas, saídas e contas num lugar só, com o saldo certo no fim do mês.
            </p>
            <div className="rise flex flex-wrap items-start gap-3 [--i:2]">
              <DemoButton />
              <Button asChild size="lg" variant="outline"><Link href="/login?modo=cadastro">Criar conta</Link></Button>
            </div>
          </div>

          {/* Prévia montada com os componentes reais do app, com dados de exemplo */}
          <div className="rise relative [--i:3]" aria-label="Prévia do painel com dados de exemplo">
            <div className="flex flex-col gap-4 rounded-[28px] border bg-card/60 p-4 sm:p-5">
              <BalanceCard label="Saldo de novembro" value={4218.37} className="bg-background">
                <span>Entrou <Money value={18931.6} type="income" /></span>
                <span>Saiu <Money value={14713.23} type="expense" /></span>
              </BalanceCard>
              <div className="rounded-2xl border bg-background px-5 py-5">
                <p className="mb-4 text-sm text-muted-foreground">Para onde foi o dinheiro</p>
                <SpendStack items={SAMPLE_SPEND} total={SAMPLE_SPEND.reduce((s, i) => s + i.value, 0)} empty="" legend={false} />
                <ul className="mt-3">{SAMPLE_ROWS.slice(0, 2).map((r) => <Row key={r.title} {...r} />)}</ul>
              </div>
            </div>
          </div>
        </section>

        {/* Bento: três recursos, três tamanhos, três fundos */}
        <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-8 lg:py-28">
          <h2 className="max-w-[18ch] text-4xl font-normal leading-[1.05] tracking-[-0.04em] sm:text-5xl">
            Tudo que o fechamento do mês pede.
          </h2>

          <div className="mt-12 grid gap-4 md:grid-cols-6 md:grid-rows-[auto_auto]">
            <article className="flex flex-col justify-between gap-8 rounded-[28px] border bg-card p-7 md:col-span-4 md:row-span-2">
              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-normal tracking-[-0.03em]">Extrato por dia</h3>
                <p className="max-w-[44ch] text-muted-foreground">Cada venda e cada conta paga, agrupadas como no app do banco, com busca e filtros.</p>
              </div>
              <div className="rounded-2xl border bg-background px-5 py-2">
                <p className="flex justify-between border-b py-2.5 text-xs text-muted-foreground">
                  <span className="text-foreground">Terça-feira, 5 de novembro</span>
                  <span>Saldo do dia <Money value={1561} className="text-foreground" /></span>
                </p>
                <ul>{SAMPLE_ROWS.map((r) => <Row key={r.title} {...r} />)}</ul>
              </div>
            </article>

            <article className="flex flex-col gap-6 rounded-[28px] bg-primary p-7 text-primary-foreground md:col-span-2">
              <Mark className="size-11 bg-primary-foreground text-primary" />
              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-normal tracking-[-0.03em]">Pronto em segundos</h3>
                <p className="text-primary-foreground/75">Nada de servidor dormindo. Entrou, carregou.</p>
              </div>
            </article>

            <article className="flex flex-col gap-6 rounded-[28px] border bg-[linear-gradient(160deg,color-mix(in_srgb,var(--income)_14%,var(--card)),var(--card)_70%)] p-7 md:col-span-2">
              <span className="grid size-11 place-items-center rounded-full bg-secondary"><DownloadSimple className="size-5" /></span>
              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-normal tracking-[-0.03em]">Planilha em um clique</h3>
                <p className="text-muted-foreground">Exporte o mês ou o ano em CSV, pronto para o Excel e para o contador.</p>
              </div>
            </article>
          </div>
        </section>

        {/* Chamada final */}
        <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[28px] border bg-card p-8 sm:p-12 md:flex-row md:items-center">
            <div className="flex flex-col gap-3">
              <h2 className="text-3xl font-normal tracking-[-0.035em] sm:text-4xl">Veja com dados de verdade.</h2>
              <p className="max-w-[48ch] text-muted-foreground">Um ano de uma confeitaria fictícia, pronto para explorar. Sem cadastro.</p>
            </div>
            <DemoButton />
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1200px] flex-col gap-4 border-t px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Logo />
        <a
          href="https://github.com/samaracaldas"
          className="inline-flex items-center gap-2 rounded-full outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <GithubLogo className="size-4" />
          Projeto de portfólio de Samara Caldas
        </a>
      </footer>
    </div>
  )
}
