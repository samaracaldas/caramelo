import { eq } from 'drizzle-orm'
import { users } from '@/db/schema'
import { fail, json, withUser } from '@/lib/server/http'

export const GET = withUser(async ({ db, userId }) => {
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, userId))
  return user ? json(user) : fail('Usuário não encontrado', 401)
})
