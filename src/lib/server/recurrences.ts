import 'server-only'
import { and, eq, type SQL } from 'drizzle-orm'
import type { Db } from '@/db'
import { recurrences } from '@/db/schema'

const ref = { columns: { id: true, name: true, color: true, type: true } } as const

/** Recorrências com categoria (e ícone) e conta já juntadas, no mesmo formato das transações. */
export function findRecurrences(db: Db, where: SQL | undefined, orderBy?: SQL[]) {
  return db.query.recurrences.findMany({
    where,
    with: { category: { columns: { ...ref.columns, icon: true } }, account: ref },
    columns: { userId: false },
    ...(orderBy && { orderBy }),
  })
}

export const ownedRecurrence = (id: string, userId: string) => and(eq(recurrences.id, id), eq(recurrences.userId, userId))
