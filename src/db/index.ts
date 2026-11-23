import 'server-only'
import { mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

export type Db = NeonHttpDatabase<typeof schema>

/**
 * Produção: Neon pelo driver HTTP. Cada query é um fetch, sem pool nem handshake TCP,
 * então funciona bem em funções serverless da Vercel e não tem "servidor dormindo".
 *
 * Desenvolvimento sem DATABASE_URL: PGlite, um Postgres de verdade compilado para WASM,
 * gravado em ~/.caramelo/pglite (fora do projeto). Mesmo SQL, mesmas migrations, zero instalação.
 */
const globalForDb = globalThis as unknown as { caramelo?: Promise<Db> }

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL
  if (url) return drizzleNeon(neon(url), { schema })

  // LOCAL_DB=1 permite testar o build de produção (next start) com o PGlite local
  if (process.env.NODE_ENV === 'production' && process.env.LOCAL_DB !== '1') {
    throw new Error('DATABASE_URL não definida. Configure a connection string do Neon.')
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  // Fora da pasta do projeto de propósito: se o projeto estiver no OneDrive/Dropbox, a sincronização
  // mexe nos arquivos com o banco aberto e o corrompe. PGLITE_DIR troca o local se precisar.
  const dir = process.env.PGLITE_DIR || path.join(os.homedir(), '.caramelo', 'pglite')
  await mkdir(dir, { recursive: true })
  const client = new PGlite(dir)
  try {
    await client.waitReady
  } catch (err) {
    // Acontece quando o servidor de dev é derrubado no meio de uma escrita: o PGlite não se recupera sozinho
    throw new Error(
      `O banco local em ${dir} não abriu (provavelmente o servidor foi encerrado no meio de uma gravação). ` +
      'Pare o "npm run dev", renomeie ou apague a pasta do banco local e rode de novo: a conta de demonstração é recriada sozinha.',
      { cause: err }
    )
  }
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  // a API do Drizzle é a mesma nos dois drivers; o tipo do Neon serve para ambos
  return db as unknown as Db
}

export function getDb(): Promise<Db> {
  globalForDb.caramelo ??= connect().catch((err) => {
    globalForDb.caramelo = undefined
    throw err
  })
  return globalForDb.caramelo
}

export { schema }
