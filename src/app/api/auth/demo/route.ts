import { getDb } from '@/db'
import { fail, json } from '@/lib/server/http'
import { ensureDemoUser } from '@/lib/server/demo'
import { startSession } from '@/lib/server/session'

export async function POST() {
  if (process.env.DEMO_LOGIN === 'false') return fail('Conta de demonstração desativada', 404)
  try {
    const user = await ensureDemoUser(await getDb())
    await startSession(user.id)
    return json({ user })
  } catch (err) {
    console.error('[demo]', err)
    return fail('Não foi possível abrir a demonstração', 500)
  }
}
