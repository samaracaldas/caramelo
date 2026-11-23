import { asc, eq } from 'drizzle-orm'
import { recurrences } from '@/db/schema'
import { fail, json, parseBody, withUser } from '@/lib/server/http'
import { recurrenceSchema } from '@/lib/server/resources'
import { checkReferences } from '@/lib/server/transactions'
import { findRecurrences } from '@/lib/server/recurrences'

export const GET = withUser(async ({ db, userId }) =>
  json(await findRecurrences(db, eq(recurrences.userId, userId), [asc(recurrences.startDate)]))
)

export const POST = withUser(async ({ req, db, userId }) => {
  const parsed = await parseBody(req, recurrenceSchema)
  if ('error' in parsed) return parsed.error
  const { category, account, description, endDate, ...rest } = parsed.data

  const refError = await checkReferences(db, userId, { category, account, type: rest.type })
  if (refError) return fail(refError)

  const [created] = await db.insert(recurrences).values({
    ...rest,
    userId,
    categoryId: category,
    accountId: account || null,
    description: description?.trim() || null,
    endDate: endDate || null,
  }).returning({ id: recurrences.id })

  const [recurrence] = await findRecurrences(db, eq(recurrences.id, created.id))
  return json(recurrence, 201)
})
