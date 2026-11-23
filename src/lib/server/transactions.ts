import 'server-only'
import { and, eq, type SQL } from 'drizzle-orm'
import type { Db } from '@/db'
import { accounts, categories, clients, transactions } from '@/db/schema'

const ref = { columns: { id: true, name: true, color: true, type: true } } as const

/** Transações com categoria, conta e cliente já juntados (um único SELECT com JOIN lateral). */
export function findTransactions(db: Db, where: SQL | undefined) {
  return db.query.transactions.findMany({
    where,
    with: {
      category: { columns: { ...ref.columns, icon: true } },
      account: ref,
      client: { columns: { id: true, name: true } },
    },
    columns: { userId: false },
    orderBy: (t, { desc }) => [desc(t.date), desc(t.createdAt)],
  })
}

/**
 * Garante que categoria, conta e cliente existem e pertencem ao usuário logado,
 * e que o tipo da categoria bate com o tipo da transação.
 */
export async function checkReferences(
  db: Db,
  userId: string,
  refs: { category?: string; account?: string; client?: string; type?: 'income' | 'expense' }
): Promise<string | null> {
  if (refs.category !== undefined) {
    const [category] = await db.select({ type: categories.type }).from(categories)
      .where(and(eq(categories.id, refs.category), eq(categories.userId, userId)))
    if (!category) return 'Categoria não encontrada'
    if (refs.type && category.type !== refs.type) return 'A categoria não é do mesmo tipo da transação'
  }

  if (refs.account) {
    const [account] = await db.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.id, refs.account), eq(accounts.userId, userId)))
    if (!account) return 'Conta não encontrada'
  }

  if (refs.client) {
    const [client] = await db.select({ id: clients.id }).from(clients)
      .where(and(eq(clients.id, refs.client), eq(clients.userId, userId)))
    if (!client) return 'Cliente não encontrado'
  }

  return null
}

export const ownedTransaction = (id: string, userId: string) => and(eq(transactions.id, id), eq(transactions.userId, userId))
