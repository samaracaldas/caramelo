import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, type Db } from '@/db'
import { currentUserId } from './session'

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status })
export const fail = (message: string, status = 400, extra?: Record<string, unknown>) =>
  NextResponse.json({ message, ...extra }, { status })

export const notFound = (what: string) => fail(`${what} não encontrada`, 404)

const uuid = z.uuid()
export const isUuid = (value: unknown): value is string => uuid.safeParse(value).success

/** Lê o corpo JSON e valida com Zod. Devolve os dados ou a resposta de erro pronta. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return { error: fail(parsed.error.issues[0]?.message ?? 'Dados inválidos') }
  return { data: parsed.data }
}

type Ctx<P> = { params: Promise<P> }
type Handler<P> = (args: { req: Request; db: Db; userId: string; params: P }) => Promise<Response>

/**
 * Envolve um route handler: exige sessão, entrega o banco e transforma erros
 * inesperados em 500 sem vazar detalhes internos.
 */
export function withUser<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: Request, ctx: Ctx<P>) => {
    const userId = await currentUserId()
    if (!userId) return fail('Não autorizado', 401)
    try {
      const [db, params] = await Promise.all([getDb(), ctx?.params ?? Promise.resolve({} as P)])
      return await handler({ req, db, userId, params })
    } catch (err) {
      console.error('[api]', err)
      return fail('Erro no servidor', 500)
    }
  }
}

/** Limite simples por instância (best effort em serverless) para frear força bruta no login. */
const hits = new Map<string, { count: number; resetAt: number }>()
export function rateLimited(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count += 1
  return entry.count > max
}
