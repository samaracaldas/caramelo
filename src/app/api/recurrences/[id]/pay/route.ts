import { and, eq } from 'drizzle-orm'
import { recurrences, transactions } from '@/db/schema'
import { fail, isUuid, json, notFound, parseBody, withUser } from '@/lib/server/http'
import { paymentSchema } from '@/lib/server/resources'
import { checkReferences, findTransactions } from '@/lib/server/transactions'
import { ownedRecurrence } from '@/lib/server/recurrences'
import { isOccurrence } from '@/lib/recurrence'

type P = { id: string }

/**
 * Registra o pagamento de um vencimento: cria uma transação comum ligada a ele.
 * Desfazer é excluir essa transação (rota normal de transações).
 */
export const POST = withUser<P>(async ({ req, db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Recorrência')
  const parsed = await parseBody(req, paymentSchema)
  if ('error' in parsed) return parsed.error
  const { dueDate, date, amount, account } = parsed.data

  const [rule] = await db.select().from(recurrences).where(ownedRecurrence(params.id, userId))
  if (!rule) return notFound('Recorrência')
  if (!isOccurrence(rule, dueDate)) return fail('Essa data não é um vencimento desta recorrência')

  const accountId = account === undefined ? rule.accountId : account || null
  if (accountId) {
    const refError = await checkReferences(db, userId, { account: accountId })
    if (refError) return fail(refError)
  }

  const [already] = await db.select({ id: transactions.id }).from(transactions)
    .where(and(eq(transactions.recurrenceId, rule.id), eq(transactions.dueDate, dueDate)))
  if (already) return fail('Esse vencimento já foi registrado', 409)

  try {
    const [created] = await db.insert(transactions).values({
      userId,
      title: rule.title,
      amount,
      type: rule.type,
      categoryId: rule.categoryId,
      accountId,
      description: rule.description,
      date,
      recurrenceId: rule.id,
      dueDate,
    }).returning({ id: transactions.id })
    const [transaction] = await findTransactions(db, eq(transactions.id, created.id))
    return json(transaction, 201)
  } catch (err) {
    // dois cliques ao mesmo tempo: o índice único segura o segundo
    if (String((err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code) === '23505') {
      return fail('Esse vencimento já foi registrado', 409)
    }
    throw err
  }
})
