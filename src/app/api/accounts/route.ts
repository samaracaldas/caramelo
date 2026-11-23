import { and, asc, eq } from 'drizzle-orm'
import { accounts } from '@/db/schema'
import { fail, json, parseBody, withUser } from '@/lib/server/http'
import { accountSchema } from '@/lib/server/resources'

export const GET = withUser(async ({ db, userId }) =>
  json(await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(asc(accounts.name)))
)

export const POST = withUser(async ({ req, db, userId }) => {
  const parsed = await parseBody(req, accountSchema)
  if ('error' in parsed) return parsed.error

  const [exists] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.name, parsed.data.name)))
  if (exists) return fail('Já existe uma conta com esse nome')

  const [account] = await db.insert(accounts).values({ ...parsed.data, userId }).returning()
  return json(account, 201)
})
