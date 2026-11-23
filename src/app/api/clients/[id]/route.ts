import { and, eq, ne } from 'drizzle-orm'
import { clients } from '@/db/schema'
import { fail, isUuid, json, notFound, parseBody, withUser } from '@/lib/server/http'
import { clientSchema } from '@/lib/server/resources'

type P = { id: string }
const owned = (id: string, userId: string) => and(eq(clients.id, id), eq(clients.userId, userId))

export const PUT = withUser<P>(async ({ req, db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Cliente')
  const parsed = await parseBody(req, clientSchema)
  if ('error' in parsed) return parsed.error
  const { name, phone, notes } = parsed.data

  const [clash] = await db.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.name, name), ne(clients.id, params.id)))
  if (clash) return fail('Já existe um cliente com esse nome')

  const [client] = await db.update(clients).set({ name, phone: phone || null, notes: notes?.trim() || null })
    .where(owned(params.id, userId)).returning()
  return client ? json(client) : notFound('Cliente')
})

/** Apaga o cadastro; as vendas continuam, só sem cliente (FK "on delete set null"). */
export const DELETE = withUser<P>(async ({ db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Cliente')
  const [deleted] = await db.delete(clients).where(owned(params.id, userId)).returning({ id: clients.id })
  return deleted ? json({ message: 'Cliente excluído' }) : notFound('Cliente')
})
