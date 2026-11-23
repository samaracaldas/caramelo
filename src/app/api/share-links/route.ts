import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { shareLinks } from '@/db/schema'
import { json, parseBody, withUser } from '@/lib/server/http'
import { hashToken, newToken } from '@/lib/server/share'

/** Lista os links (nunca o token: ele não está guardado). */
export const GET = withUser(async ({ db, userId }) =>
  json(await db
    .select({ id: shareLinks.id, label: shareLinks.label, expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt, lastUsedAt: shareLinks.lastUsedAt, createdAt: shareLinks.createdAt })
    .from(shareLinks).where(eq(shareLinks.userId, userId)).orderBy(desc(shareLinks.createdAt)))
)

const schema = z.object({
  label: z.string().trim().min(2, 'Dê um nome ao link, por exemplo o do escritório').max(80, 'Nome muito longo'),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]),
})

/** Cria o link e devolve o token uma única vez. */
export const POST = withUser(async ({ req, db, userId }) => {
  const parsed = await parseBody(req, schema)
  if ('error' in parsed) return parsed.error
  const { label, expiresInDays } = parsed.data

  const token = newToken()
  const [link] = await db.insert(shareLinks).values({
    userId,
    label,
    tokenHash: hashToken(token),
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
  }).returning({ id: shareLinks.id, label: shareLinks.label, expiresAt: shareLinks.expiresAt, createdAt: shareLinks.createdAt })

  return json({ ...link, path: `/contador/${token}` }, 201)
})
