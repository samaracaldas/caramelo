/**
 * Aplica as migrations da pasta drizzle/ no Neon. Roda antes do build na Vercel.
 * Sem DATABASE_URL não faz nada: em desenvolvimento o PGlite migra sozinho na primeira query.
 */
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

const url = process.env.DATABASE_URL
if (!url) {
  console.log('[migrate] DATABASE_URL ausente, pulando (PGlite migra sozinho em dev).')
  process.exit(0)
}

migrate(drizzle(neon(url)), { migrationsFolder: 'drizzle' })
  .then(() => console.log('[migrate] Banco atualizado.'))
  .catch((err) => {
    console.error('[migrate] Falhou:', err)
    process.exit(1)
  })
