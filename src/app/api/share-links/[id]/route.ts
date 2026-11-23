import { and, eq, isNull } from 'drizzle-orm'
import { shareLinks } from '@/db/schema'
import { isUuid, json, notFound, withUser } from '@/lib/server/http'

/** Revoga: o link para de funcionar na hora, mas fica no histórico. */
export const DELETE = withUser<{ id: string }>(async ({ db, userId, params }) => {
  if (!isUuid(params.id)) return notFound('Link')
  const [revoked] = await db.update(shareLinks).set({ revokedAt: new Date() })
    .where(and(eq(shareLinks.id, params.id), eq(shareLinks.userId, userId), isNull(shareLinks.revokedAt)))
    .returning({ id: shareLinks.id })
  return revoked ? json({ message: 'Link revogado' }) : notFound('Link')
})
