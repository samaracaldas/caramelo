import { and, eq, gte, lte, type SQL } from 'drizzle-orm'
import { transactions } from '@/db/schema'
import { fail, isUuid, json, parseBody, withUser } from '@/lib/server/http'
import { transactionSchema } from '@/lib/server/resources'
import { checkReferences, findTransactions } from '@/lib/server/transactions'

const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

export const GET = withUser(async ({ req, db, userId }) => {
  const q = new URL(req.url).searchParams
  const filters: SQL[] = [eq(transactions.userId, userId)]

  const type = q.get('type')
  if (type === 'income' || type === 'expense') filters.push(eq(transactions.type, type))
  const category = q.get('category')
  if (isUuid(category)) filters.push(eq(transactions.categoryId, category))
  const startDate = q.get('startDate')
  if (isDay(startDate)) filters.push(gte(transactions.date, startDate))
  const endDate = q.get('endDate')
  if (isDay(endDate)) filters.push(lte(transactions.date, endDate))

  return json(await findTransactions(db, and(...filters)))
})

export const POST = withUser(async ({ req, db, userId }) => {
  const parsed = await parseBody(req, transactionSchema)
  if ('error' in parsed) return parsed.error
  const { category, account, client, description, ...rest } = parsed.data

  const refError = await checkReferences(db, userId, { category, account, client, type: rest.type })
  if (refError) return fail(refError)

  const [created] = await db.insert(transactions).values({
    ...rest,
    userId,
    categoryId: category,
    accountId: account || null,
    clientId: client || null,
    description: description?.trim() || null,
  }).returning({ id: transactions.id })

  const [transaction] = await findTransactions(db, eq(transactions.id, created.id))
  return json(transaction, 201)
})
