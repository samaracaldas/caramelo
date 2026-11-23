import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { users } from '@/db/schema'
import { fail, json, parseBody, rateLimited } from '@/lib/server/http'
import { startSession } from '@/lib/server/session'

const schema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.email('E-mail inválido').trim().toLowerCase(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(72, 'Senha muito longa'),
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (rateLimited(`register:${ip}`, 10, 60 * 60 * 1000)) return fail('Muitos cadastros seguidos. Tente mais tarde.', 429)

  const parsed = await parseBody(req, schema)
  if ('error' in parsed) return parsed.error
  const { name, email, password } = parsed.data

  const db = await getDb()
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (taken) return fail('E-mail já cadastrado')

  const passwordHash = await bcrypt.hash(password, 10)
  const [user] = await db.insert(users).values({ name, email, passwordHash }).returning({ id: users.id, name: users.name, email: users.email })

  await startSession(user.id)
  return json({ user }, 201)
}
