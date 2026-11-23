import { and, eq, ne } from 'drizzle-orm'
import { boxes } from '@/db/schema'
import { fail, isUuid, json, notFound, parseBody, withUser } from '@/lib/server/http'
import { boxSchema } from '@/lib/server/resources'

type P = { id: string }
const owned = (id: string, userId: string) => and(eq(boxes.id, id), eq(boxes.userId, userId))

export const PUT = withUser<P>(async ({ req, db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Caixinha')
  const parsed = await parseBody(req, boxSchema)
  if ('error' in parsed) return parsed.error
  const { targetDate, target, ...rest } = parsed.data

  const [clash] = await db.select({ id: boxes.id }).from(boxes)
    .where(and(eq(boxes.userId, userId), eq(boxes.name, rest.name), ne(boxes.id, params.id)))
  if (clash) return fail('Já existe uma caixinha com esse nome')

  const [box] = await db.update(boxes).set({ ...rest, target: target ?? null, targetDate: targetDate || null })
    .where(owned(params.id, userId)).returning()
  return box ? json(box) : notFound('Caixinha')
})

/** Apagar a caixinha devolve o que estava nela para o saldo livre (o dinheiro nunca saiu das contas). */
export const DELETE = withUser<P>(async ({ db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Caixinha')
  const [deleted] = await db.delete(boxes).where(owned(params.id, userId)).returning({ id: boxes.id })
  return deleted ? json({ message: 'Caixinha excluída' }) : notFound('Caixinha')
})
