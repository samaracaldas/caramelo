import { and, asc, count, eq, max, min, sql } from 'drizzle-orm'
import { clients, transactions } from '@/db/schema'
import { fail, json, parseBody, withUser } from '@/lib/server/http'
import { clientSchema } from '@/lib/server/resources'

/**
 * Clientes com o histórico de compras já resumido pelo banco: quantas vezes compraram,
 * quanto somam, a primeira e a última compra. Só entradas contam como compra.
 */
export const GET = withUser(async ({ db, userId }) => {
  const [list, stats] = await Promise.all([
    db.select({ id: clients.id, name: clients.name, phone: clients.phone, notes: clients.notes, createdAt: clients.createdAt })
      .from(clients).where(eq(clients.userId, userId)).orderBy(asc(clients.name)),
    db.select({
      clientId: transactions.clientId,
      purchases: count(),
      total: sql<string>`sum(${transactions.amount})`,
      first: min(transactions.date),
      last: max(transactions.date),
    })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, 'income')))
      .groupBy(transactions.clientId),
  ])
  const by = new Map(stats.filter((s) => s.clientId).map((s) => [s.clientId!, s]))
  return json(list.map((c) => {
    const s = by.get(c.id)
    return { ...c, purchases: s?.purchases ?? 0, total: Number(s?.total ?? 0), firstPurchase: s?.first ?? null, lastPurchase: s?.last ?? null }
  }))
})

export const POST = withUser(async ({ req, db, userId }) => {
  const parsed = await parseBody(req, clientSchema)
  if ('error' in parsed) return parsed.error
  const { name, phone, notes } = parsed.data

  const [exists] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.userId, userId), eq(clients.name, name)))
  if (exists) return fail('Já existe um cliente com esse nome')

  const [client] = await db.insert(clients).values({ userId, name, phone: phone || null, notes: notes?.trim() || null }).returning()
  return json({ ...client, purchases: 0, total: 0, firstPurchase: null, lastPurchase: null }, 201)
})
