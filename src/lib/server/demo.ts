import 'server-only'
import crypto from 'node:crypto'
import { count, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { accounts, boxEntries, boxes, categories, clients, recurrences, transactions, users } from '@/db/schema'

/**
 * Conta de demonstração: um ano de dados de uma confeitaria fictícia, guardados no
 * próprio Postgres (em serverless não existe memória compartilhada entre instâncias).
 * É recriada quando tem mais de 1 dia ou quando os visitantes apagam quase tudo.
 */
export const DEMO_EMAIL = 'demo@caramelo.app'
const RESET_AFTER_MS = 24 * 60 * 60 * 1000
const MIN_TRANSACTIONS = 40

function random(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

async function seed(db: Db) {
  const [user] = await db
    .insert(users)
    // hash aleatório: ninguém entra nesta conta por senha, só pelo botão
    .values({ name: 'Doce Caramelo Confeitaria', email: DEMO_EMAIL, passwordHash: `!demo-${crypto.randomUUID()}` })
    .returning({ id: users.id, name: users.name, email: users.email })
  const userId = user.id

  const acc = await db
    .insert(accounts)
    .values([
      { userId, name: 'Conta PJ', type: 'bank', color: '#a3bfff', initialBalance: 8200 },
      { userId, name: 'Caixa da loja', type: 'cash', color: '#8fe0b8', initialBalance: 450 },
      { userId, name: 'Cartão PJ', type: 'card', color: '#c9b4ff', initialBalance: 0 },
    ])
    .returning({ id: accounts.id, name: accounts.name })
  const A = { pj: acc[0].id, caixa: acc[1].id, cartao: acc[2].id }

  const catRows = [
    ['balcao', 'Vendas no balcão', 'income', '#8fe0b8', 'storefront'],
    ['encomendas', 'Encomendas', 'income', '#f2a541', 'cake'],
    ['delivery', 'Delivery', 'income', '#7fd3ec', 'moped'],
    ['insumos', 'Insumos', 'expense', '#ffb98a', 'basket'],
    ['aluguel', 'Aluguel', 'expense', '#c9b4ff', 'house'],
    ['folha', 'Folha', 'expense', '#a3bfff', 'users'],
    ['energia', 'Energia e água', 'expense', '#ffe27a', 'lightning'],
    ['embalagens', 'Embalagens', 'expense', '#b4b4bd', 'package'],
    ['marketing', 'Marketing', 'expense', '#fc94a6', 'megaphone'],
    ['servicos', 'Serviços', 'expense', '#c2d98f', 'calculator'],
  ] as const
  const cats = await db
    .insert(categories)
    .values(catRows.map(([, name, type, color, icon]) => ({ userId, name, type, color, icon })))
    .returning({ id: categories.id })
  const C = Object.fromEntries(catRows.map(([key, , type], i) => [key, { id: cats[i].id, type }])) as Record<
    (typeof catRows)[number][0],
    { id: string; type: 'income' | 'expense' }
  >

  const rnd = random(42)
  const today = new Date()
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const rows: (typeof transactions.$inferInsert)[] = []

  /* Recorrências: as quatro fixas do ano inteiro (já pagas no histórico) e duas recentes
     que mostram os estados da agenda: o contador atrasado há 3 dias e a internet vencendo em 2. */
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const firstMonth = (day: number) => iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, day)))
  const shifted = (days: number) => iso(new Date(end + days * 86_400_000))
  const recRows = [
    ['delivery', 'Repasse do delivery', 2500, 'delivery', firstMonth(5), 'Repasse quinzenal do app de entregas'],
    ['aluguel', 'Aluguel do ponto', 3200, 'aluguel', firstMonth(10), 'Contrato até dezembro do ano que vem'],
    ['luz', 'Conta de luz', 800, 'energia', firstMonth(12), null],
    ['salarios', 'Salários', 6400, 'folha', firstMonth(28), 'Duas confeiteiras e um atendente'],
    ['contador', 'Honorários do contador', 450, 'servicos', shifted(-3), null],
    ['internet', 'Internet da loja', 129.9, 'servicos', shifted(2), null],
  ] as const
  const recs = await db
    .insert(recurrences)
    .values(recRows.map(([, title, amount, c, startDate, description]) => ({
      userId, title, amount, type: C[c].type, categoryId: C[c].id, accountId: A.pj, frequency: 'monthly' as const, startDate, description,
    })))
    .returning({ id: recurrences.id })
  const R = Object.fromEntries(recRows.map(([key], i) => [key, recs[i].id])) as Record<(typeof recRows)[number][0], string>

  /* Clientes com histórias diferentes: o café que revende todo mês (fiel), o buffet que
     encomendava e parou (sumiu, para mostrar o "vale chamar de volta") e encomendas avulsas. */
  const cliRows = [
    ['cafe', 'Café Jardim Secreto', '(11) 97412-3086', 'Revende fatias de bolo; entrega toda semana'],
    ['buffet', 'Buffet Laços de Fita', '(11) 98815-2290', 'Bolos para festas infantis'],
    ['marina', 'Marina Okabe', '(11) 99637-4105', 'Casamento em março; alergia a nozes'],
    ['rafael', 'Rafael Nunes', null, null],
    ['celia', 'Dona Célia Prado', '(11) 3846-2017', 'Encomenda o bolo de aniversário da família'],
    ['escola', 'Escola Pequeno Príncipe', '(11) 2577-9134', 'Festa junina e formatura'],
  ] as const
  const cli = await db.insert(clients)
    .values(cliRows.map(([, name, phone, notes]) => ({ userId, name, phone, notes })))
    .returning({ id: clients.id })
  const K = Object.fromEntries(cliRows.map(([key], i) => [key, cli[i].id])) as Record<(typeof cliRows)[number][0], string>
  // quem fez a encomenda grande de cada mês, do mais antigo (11 meses atrás) ao atual
  const orderBy: (keyof typeof K)[] = ['buffet', 'buffet', 'buffet', 'buffet', 'buffet', 'buffet', 'buffet', 'marina', 'rafael', 'celia', 'escola', 'celia']

  for (let back = 11; back >= 0; back--) {
    const y = today.getUTCFullYear()
    const m = today.getUTCMonth() - back
    const growth = 1 + (11 - back) * 0.025
    const add = (d: number, title: string, amount: number, c: keyof typeof C, a: keyof typeof A, description?: string, rec?: keyof typeof R, client?: keyof typeof K) => {
      const day = new Date(Date.UTC(y, m, d))
      if (day.getTime() > end) return
      const date = iso(day)
      rows.push({
        userId, title, amount, type: C[c].type, categoryId: C[c].id, accountId: A[a], description, date,
        // pago no próprio vencimento
        ...(rec && { recurrenceId: R[rec], dueDate: date }),
        ...(client && { clientId: K[client] }),
      })
    }

    for (let d = 1; d <= 28; d += 3) {
      add(d, 'Vendas do balcão', Math.round((900 + rnd() * 700) * growth), 'balcao', d === 16 ? 'caixa' : 'pj', d === 16 ? 'Dinheiro do caixa' : 'Pix e maquininha')
    }
    const buyer = orderBy[11 - back]
    add(2, buyer === 'buffet' ? 'Bolos para festa (encomenda)' : 'Bolo de casamento (encomenda)', Math.round(800 + rnd() * 1600), 'encomendas', 'pj', 'Sinal de 50% pago na reserva', undefined, buyer)
    add(15, 'Revenda de fatias', Math.round((540 + rnd() * 220) * growth), 'encomendas', 'pj', 'Fatura mensal do café', undefined, 'cafe')
    add(5, 'Repasse do delivery', Math.round((2100 + rnd() * 900) * growth), 'delivery', 'pj', undefined, 'delivery')
    add(3, 'Farinha, ovos e manteiga', Math.round((2600 + rnd() * 900) * growth), 'insumos', 'pj')
    add(7, 'Chocolate e frutas', Math.round(700 + rnd() * 500), 'insumos', 'cartao')
    add(10, 'Aluguel do ponto', 3200, 'aluguel', 'pj', undefined, 'aluguel')
    add(12, 'Conta de luz', Math.round(650 + rnd() * 300), 'energia', 'pj', undefined, 'luz')
    add(28, 'Salários', 6400, 'folha', 'pj', undefined, 'salarios')
    if (m % 2 === 0) add(6, 'Caixas e fitas', Math.round(300 + rnd() * 250), 'embalagens', 'cartao')
    if (m % 3 === 0) add(8, 'Anúncio no Instagram', 250, 'marketing', 'cartao')
  }

  await db.insert(transactions).values(rows)

  // O app não tem transferências: o saldo inicial do cartão cobre as faturas do ano
  const cardSpend = rows.filter((r) => r.accountId === A.cartao).reduce((s, r) => s + r.amount, 0)
  await db.update(accounts).set({ initialBalance: cardSpend + 1850 }).where(eq(accounts.id, A.cartao))

  // Caixinhas: o 13º com prazo (mostra o ritmo semanal) e uma reserva sem meta
  const dec20 = iso(new Date(Date.UTC(today.getUTCFullYear(), 11, 20)))
  const bx = await db.insert(boxes).values([
    { userId, name: '13º dos funcionários', icon: 'users', color: '#a3bfff', target: 6400, targetDate: dec20 >= iso(today) ? dec20 : shifted(45) },
    { userId, name: 'Forno novo', icon: 'cooking-pot', color: '#f2a541', target: 12000 },
  ]).returning({ id: boxes.id })
  await db.insert(boxEntries).values([
    { userId, boxId: bx[0].id, amount: 1800, date: shifted(-40), note: 'Começo da reserva' },
    { userId, boxId: bx[0].id, amount: 1200, date: shifted(-12), note: 'Sobra de outubro' },
    { userId, boxId: bx[1].id, amount: 2500, date: shifted(-70), note: null },
  ])

  return user
}

/** Devolve o usuário de demonstração, recriando os dados se estiverem velhos ou quase vazios. */
export async function ensureDemoUser(db: Db) {
  const [existing] = await db
    .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))

  if (existing) {
    const fresh = Date.now() - existing.createdAt.getTime() < RESET_AFTER_MS
    const [{ total }] = await db.select({ total: count() }).from(transactions).where(eq(transactions.userId, existing.id))
    // demonstração criada antes das recorrências existirem também é refeita
    const [{ rules }] = await db.select({ rules: count() }).from(recurrences).where(eq(recurrences.userId, existing.id))
    const [{ people }] = await db.select({ people: count() }).from(clients).where(eq(clients.userId, existing.id))
    if (fresh && total >= MIN_TRANSACTIONS && rules > 0 && people > 0) return { id: existing.id, name: existing.name, email: existing.email }
    await db.delete(users).where(eq(users.id, existing.id)) // cascade apaga contas, categorias e transações
  }

  try {
    return await seed(db)
  } catch (err) {
    // dois visitantes ao mesmo tempo: o outro criou primeiro, usa o dele
    const [other] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.email, DEMO_EMAIL))
    if (other) return other
    throw err
  }
}
