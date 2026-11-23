import { and, count, eq, ne } from 'drizzle-orm'
import { categories, recurrences, transactions } from '@/db/schema'
import { fail, isUuid, json, notFound, parseBody, withUser } from '@/lib/server/http'
import { categorySchema } from '@/lib/server/resources'

type P = { id: string }

export const PUT = withUser<P>(async ({ req, db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Categoria')
  const parsed = await parseBody(req, categorySchema)
  if ('error' in parsed) return parsed.error

  const owned = and(eq(categories.id, params.id), eq(categories.userId, userId))
  const [current] = await db.select({ type: categories.type }).from(categories).where(owned)
  if (!current) return notFound('Categoria')

  const [clash] = await db.select({ id: categories.id }).from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, parsed.data.name), ne(categories.id, params.id)))
  if (clash) return fail('Já existe uma categoria com esse nome')

  // trocar o tipo deixaria transações de entrada numa categoria de saída
  if (parsed.data.type !== current.type) {
    const [{ used }] = await db.select({ used: count() }).from(transactions).where(eq(transactions.categoryId, params.id))
    const [{ rules }] = await db.select({ rules: count() }).from(recurrences).where(eq(recurrences.categoryId, params.id))
    if (used > 0 || rules > 0) return fail('Esta categoria já está em uso; não dá para trocar entre entrada e saída')
  }

  const [category] = await db.update(categories).set(parsed.data).where(owned).returning()
  return json(category)
})

/**
 * Toda transação precisa de categoria. Se a categoria estiver em uso, é preciso
 * informar ?moveTo=<id> com outra categoria do mesmo tipo para receber as transações.
 */
export const DELETE = withUser<P>(async ({ req, db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Categoria')
  const owned = and(eq(categories.id, params.id), eq(categories.userId, userId))
  const [category] = await db.select({ id: categories.id, type: categories.type }).from(categories).where(owned)
  if (!category) return notFound('Categoria')

  const [{ inUse }] = await db.select({ inUse: count() }).from(transactions)
    .where(and(eq(transactions.categoryId, category.id), eq(transactions.userId, userId)))
  const [{ rules }] = await db.select({ rules: count() }).from(recurrences)
    .where(and(eq(recurrences.categoryId, category.id), eq(recurrences.userId, userId)))

  if (inUse > 0 || rules > 0) {
    const moveTo = new URL(req.url).searchParams.get('moveTo')
    if (!moveTo) {
      const parts = [
        inUse > 0 && `${inUse} ${inUse === 1 ? 'transação' : 'transações'}`,
        rules > 0 && `${rules} ${rules === 1 ? 'recorrência' : 'recorrências'}`,
      ].filter(Boolean).join(' e ')
      return fail(`Esta categoria tem ${parts}. Escolha a categoria que vai recebê-las.`, 409, { count: inUse, recurrences: rules })
    }
    const [target] = isUuid(moveTo)
      ? await db.select({ id: categories.id, type: categories.type }).from(categories).where(and(eq(categories.id, moveTo), eq(categories.userId, userId)))
      : []
    if (!target || target.id === category.id) return fail('Categoria de destino inválida')
    if (target.type !== category.type) return fail('A categoria de destino precisa ser do mesmo tipo')
    await db.update(transactions).set({ categoryId: target.id })
      .where(and(eq(transactions.categoryId, category.id), eq(transactions.userId, userId)))
    await db.update(recurrences).set({ categoryId: target.id })
      .where(and(eq(recurrences.categoryId, category.id), eq(recurrences.userId, userId)))
  }

  await db.delete(categories).where(owned)
  return json({ message: 'Categoria excluída', moved: inUse })
})
