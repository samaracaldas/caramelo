import 'server-only'
import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { shareLinks, users } from '@/db/schema'

/** 24 bytes aleatórios em base64url: 32 caracteres, impossível de adivinhar. */
export const newToken = () => crypto.randomBytes(24).toString('base64url')

/** Só o hash vai para o banco. Quem lê o banco não consegue montar o link. */
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

/**
 * Resolve um token de link de contador: devolve o dono e o link se estiver válido
 * (existe, não foi revogado, não expirou) e registra o uso.
 */
export async function resolveShare(db: Db, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const [row] = await db
    .select({ id: shareLinks.id, userId: shareLinks.userId, label: shareLinks.label, expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt, business: users.name })
    .from(shareLinks)
    .innerJoin(users, eq(users.id, shareLinks.userId))
    .where(eq(shareLinks.tokenHash, hashToken(token)))
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt.getTime() < Date.now())) return null
  await db.update(shareLinks).set({ lastUsedAt: new Date() }).where(eq(shareLinks.id, row.id))
  return row
}
