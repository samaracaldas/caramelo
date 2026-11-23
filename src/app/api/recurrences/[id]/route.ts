import { recurrences } from '@/db/schema'
import { fail, isUuid, json, notFound, parseBody, withUser } from '@/lib/server/http'
import { recurrenceSchema } from '@/lib/server/resources'
import { checkReferences } from '@/lib/server/transactions'
import { findRecurrences, ownedRecurrence } from '@/lib/server/recurrences'

type P = { id: string }

/** Edita a regra. Pagamentos já feitos continuam ligados aos vencimentos em que foram pagos. */
export const PUT = withUser<P>(async ({ req, db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Recorrência')
  const parsed = await parseBody(req, recurrenceSchema)
  if ('error' in parsed) return parsed.error
  const { category, account, description, endDate, ...rest } = parsed.data

  const refError = await checkReferences(db, userId, { category, account, type: rest.type })
  if (refError) return fail(refError)

  const where = ownedRecurrence(params.id, userId)
  const [updated] = await db.update(recurrences).set({
    ...rest,
    categoryId: category,
    accountId: account || null,
    description: description?.trim() || null,
    endDate: endDate || null,
  }).where(where).returning({ id: recurrences.id })
  if (!updated) return notFound('Recorrência')

  const [recurrence] = await findRecurrences(db, where)
  return json(recurrence)
})

/** Apaga só a regra: as transações já pagas ficam no histórico (a FK vira null). */
export const DELETE = withUser<P>(async ({ db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Recorrência')
  const [deleted] = await db.delete(recurrences).where(ownedRecurrence(params.id, userId)).returning({ id: recurrences.id })
  return deleted ? json({ message: 'Recorrência excluída' }) : notFound('Recorrência')
})
