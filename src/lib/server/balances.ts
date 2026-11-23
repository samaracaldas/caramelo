import 'server-only'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import { accounts, boxEntries, transactions } from '@/db/schema'

/**
 * Dinheiro do usuário, somado no próprio Postgres (três agregações, nenhuma lista):
 * - inAccounts: saldo inicial das contas + tudo que entrou e saiu delas
 * - inBoxes: o que está separado em caixinhas
 * - free: o que sobra para usar
 */
export async function moneySummary(db: Db, userId: string) {
  const [[initial], [moved], [boxed]] = await Promise.all([
    db.select({ v: sql<string>`coalesce(sum(${accounts.initialBalance}), 0)` }).from(accounts).where(eq(accounts.userId, userId)),
    db
      .select({ v: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else -${transactions.amount} end), 0)` })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), isNotNull(transactions.accountId))),
    db.select({ v: sql<string>`coalesce(sum(${boxEntries.amount}), 0)` }).from(boxEntries).where(eq(boxEntries.userId, userId)),
  ])
  const inAccounts = round(Number(initial.v) + Number(moved.v))
  const inBoxes = round(Number(boxed.v))
  return { inAccounts, inBoxes, free: round(inAccounts - inBoxes) }
}

const round = (n: number) => Math.round(n * 100) / 100
