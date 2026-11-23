import { transactions } from '@/db/schema'
import { fail, isUuid, json, notFound, parseBody, withUser } from '@/lib/server/http'
import { transactionSchema } from '@/lib/server/resources'
import { checkReferences, findTransactions, ownedTransaction } from '@/lib/server/transactions'

type P = { id: string }

export const GET = withUser<P>(async ({ db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Transação')
  const [transaction] = await findTransactions(db, ownedTransaction(params.id, userId))
  return transaction ? json(transaction) : notFound('Transação')
})

export const PUT = withUser<P>(async ({ req, db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Transação')
  const parsed = await parseBody(req, transactionSchema.partial())
  if ('error' in parsed) return parsed.error
  const { category, account, client, description, ...rest } = parsed.data

  const where = ownedTransaction(params.id, userId)
  const [current] = await db.select({ type: transactions.type, categoryId: transactions.categoryId }).from(transactions).where(where)
  if (!current) return notFound('Transação')

  const refError = await checkReferences(db, userId, {
    // mudou só o tipo? a categoria atual precisa continuar compatível
    category: category ?? (rest.type ? current.categoryId : undefined),
    account,
    client,
    type: rest.type ?? current.type,
  })
  if (refError) return fail(refError)

  await db.update(transactions).set({
    ...rest,
    ...(category !== undefined && { categoryId: category }),
    ...(account !== undefined && { accountId: account || null }),
    ...(client !== undefined && { clientId: client || null }),
    ...(description !== undefined && { description: description.trim() || null }),
  }).where(where)

  const [transaction] = await findTransactions(db, where)
  return json(transaction)
})

export const DELETE = withUser<P>(async ({ db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Transação')
  const [deleted] = await db.delete(transactions).where(ownedTransaction(params.id, userId)).returning({ id: transactions.id })
  return deleted ? json({ message: 'Transação excluída' }) : notFound('Transação')
})
