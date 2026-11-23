import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { users } from '@/db/schema'
import { fail, json, parseBody, rateLimited } from '@/lib/server/http'
import { startSession } from '@/lib/server/session'

const schema = z.object({
  email: z.email('E-mail inválido').trim().toLowerCase(),
  password: z.string().min(1, 'Senha obrigatória'),
})

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema)
  if ('error' in parsed) return parsed.error
  const { email, password } = parsed.data

  // por e-mail, para quem divide o mesmo IP (escritório, 4G) não se bloquear
  if (rateLimited(`login:${email}`, 10, 15 * 60 * 1000)) return fail('Muitas tentativas. Espere alguns minutos.', 429)

  const db = await getDb()
  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return fail('E-mail ou senha incorretos')

  await startSession(user.id)
  return json({ user: { id: user.id, name: user.name, email: user.email } })
}
