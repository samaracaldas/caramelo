import { and, asc, eq } from 'drizzle-orm'
import { categories } from '@/db/schema'
import { fail, json, parseBody, withUser } from '@/lib/server/http'
import { categorySchema } from '@/lib/server/resources'

export const GET = withUser(async ({ db, userId }) =>
  json(await db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.name)))
)

export const POST = withUser(async ({ req, db, userId }) => {
  const parsed = await parseBody(req, categorySchema)
  if ('error' in parsed) return parsed.error

  const [exists] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.userId, userId), eq(categories.name, parsed.data.name)))
  if (exists) return fail('Já existe uma categoria com esse nome')

  const [category] = await db.insert(categories).values({ ...parsed.data, userId }).returning()
  return json(category, 201)
})
