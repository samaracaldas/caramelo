import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { boxEntries, boxes } from '@/db/schema'
import { fail, json, parseBody, withUser } from '@/lib/server/http'
import { boxSchema } from '@/lib/server/resources'
import { moneySummary } from '@/lib/server/balances'

/** Caixinhas com o saldo de cada uma, as últimas movimentações e o resumo do dinheiro livre. */
export const GET = withUser(async ({ db, userId }) => {
  const [list, sums, entries, summary] = await Promise.all([
    db
      .select({
        id: boxes.id, name: boxes.name, icon: boxes.icon, color: boxes.color,
        target: boxes.target, targetDate: boxes.targetDate, createdAt: boxes.createdAt,
      })
      .from(boxes)
      .where(eq(boxes.userId, userId))
      .orderBy(asc(boxes.createdAt)),
    db
      .select({ boxId: boxEntries.boxId, saved: sql<string>`sum(${boxEntries.amount})` })
      .from(boxEntries)
      .where(eq(boxEntries.userId, userId))
      .groupBy(boxEntries.boxId),
    db
      .select({ id: boxEntries.id, boxId: boxEntries.boxId, amount: boxEntries.amount, date: boxEntries.date, note: boxEntries.note })
      .from(boxEntries)
      .where(eq(boxEntries.userId, userId))
      .orderBy(desc(boxEntries.date), desc(boxEntries.createdAt))
      .limit(200),
    moneySummary(db, userId),
  ])
  const savedBy = new Map(sums.map((s) => [s.boxId, Number(s.saved)]))
  return json({ boxes: list.map((b) => ({ ...b, saved: savedBy.get(b.id) ?? 0 })), entries, ...summary })
})

export const POST = withUser(async ({ req, db, userId }) => {
  const parsed = await parseBody(req, boxSchema)
  if ('error' in parsed) return parsed.error
  const { targetDate, target, ...rest } = parsed.data

  const [exists] = await db.select({ id: boxes.id }).from(boxes).where(and(eq(boxes.userId, userId), eq(boxes.name, rest.name)))
  if (exists) return fail('Já existe uma caixinha com esse nome')

  const [box] = await db.insert(boxes).values({ ...rest, userId, target: target ?? null, targetDate: targetDate || null }).returning()
  return json({ ...box, saved: 0 }, 201)
})
