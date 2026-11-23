import { and, eq, ne } from 'drizzle-orm'
import { accounts, recurrences, transactions } from '@/db/schema'
import { fail, isUuid, json, notFound, parseBody, withUser } from '@/lib/server/http'
import { accountSchema } from '@/lib/server/resources'

type P = { id: string }

export const PUT = withUser<P>(async ({ req, db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Conta')
  const parsed = await parseBody(req, accountSchema)
  if ('error' in parsed) return parsed.error

  const [clash] = await db.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.name, parsed.data.name), ne(accounts.id, params.id)))
  if (clash) return fail('Já existe uma conta com esse nome')

  const [account] = await db.update(accounts).set(parsed.data)
    .where(and(eq(accounts.id, params.id), eq(accounts.userId, userId))).returning()
  return account ? json(account) : notFound('Conta')
})

/**
 * Conta é opcional na transação. Com ?moveTo=<id> as transações vão para outra conta;
 * sem ele, ficam sem conta (a FK "on delete set null" cuida disso).
 */
export const DELETE = withUser<P>(async ({ req, db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Conta')
  const owned = and(eq(accounts.id, params.id), eq(accounts.userId, userId))
  const [account] = await db.select({ id: accounts.id }).from(accounts).where(owned)
  if (!account) return notFound('Conta')

  const moveTo = new URL(req.url).searchParams.get('moveTo')
  if (moveTo) {
    const [target] = isUuid(moveTo)
      ? await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, moveTo), eq(accounts.userId, userId)))
      : []
    if (!target || target.id === account.id) return fail('Conta de destino inválida')
    await db.update(transactions).set({ accountId: target.id })
      .where(and(eq(transactions.accountId, account.id), eq(transactions.userId, userId)))
    await db.update(recurrences).set({ accountId: target.id })
      .where(and(eq(recurrences.accountId, account.id), eq(recurrences.userId, userId)))
  }

  await db.delete(accounts).where(owned)
  return json({ message: 'Conta excluída' })
})
