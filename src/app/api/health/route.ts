import { sql } from 'drizzle-orm'
import { getDb } from '@/db'

export async function GET() {
  const started = performance.now()
  try {
    const db = await getDb()
    await db.execute(sql`select 1`)
    return Response.json({ status: 'ok', db: 'connected', ms: Math.round(performance.now() - started) })
  } catch {
    return Response.json({ status: 'degraded', db: 'unreachable' }, { status: 503 })
  }
}
