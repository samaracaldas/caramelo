import { and, eq, sql } from 'drizzle-orm'
import { boxEntries, boxes } from '@/db/schema'
import { fail, isUuid, json, notFound, parseBody, withUser } from '@/lib/server/http'
import { boxEntrySchema } from '@/lib/server/resources'
import { moneySummary } from '@/lib/server/balances'
import { formatCurrency } from '@/lib/format'

type P = { id: string }

/**
 * Guardar ou retirar. Não deixa guardar mais do que está livre nem retirar mais
 * do que a caixinha tem: as duas coisas fariam o saldo livre mentir.
 */
export const POST = withUser<P>(async ({ req, db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Caixinha')
  const parsed = await parseBody(req, boxEntrySchema)
  if ('error' in parsed) return parsed.error
  const { kind, amount, date, note } = parsed.data

  const [box] = await db.select({ id: boxes.id }).from(boxes).where(and(eq(boxes.id, params.id), eq(boxes.userId, userId)))
  if (!box) return notFound('Caixinha')

  if (kind === 'deposit') {
    const { free } = await moneySummary(db, userId)
    if (amount > free) return fail(`Só ${formatCurrency(Math.max(free, 0))} estão livres para guardar agora`)
  } else {
    const [{ saved }] = await db.select({ saved: sql<string>`coalesce(sum(${boxEntries.amount}), 0)` }).from(boxEntries).where(eq(boxEntries.boxId, box.id))
    if (amount > Number(saved)) return fail(`A caixinha tem só ${formatCurrency(Number(saved))}`)
  }

  const [entry] = await db.insert(boxEntries).values({
    userId, boxId: box.id, amount: kind === 'deposit' ? amount : -amount, date, note: note?.trim() || null,
  }).returning()
  return json(entry, 201)
})
