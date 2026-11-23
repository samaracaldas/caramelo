import { and, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '@/db'
import { transactions } from '@/db/schema'
import { resolveShare } from '@/lib/server/share'
import { findTransactions } from '@/lib/server/transactions'
import { buildCSV } from '@/lib/csv'
import { readPeriod } from '../period'

/** Planilha do período para o contador. Mesmo formato da exportação em Relatórios. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = await getDb()
  const share = await resolveShare(db, token)
  if (!share) return new Response('Link inválido ou revogado', { status: 404 })

  const q = new URL(req.url).searchParams
  const period = readPeriod({ mes: q.get('mes') ?? undefined, ano: q.get('ano') ?? undefined })
  const rows = await findTransactions(db, and(
    eq(transactions.userId, share.userId),
    gte(transactions.date, period.start),
    lte(transactions.date, period.end),
  ))
  rows.sort((a, b) => a.date.localeCompare(b.date))

  return new Response(buildCSV(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="caramelo-${period.key}.csv"`,
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex',
    },
  })
}
