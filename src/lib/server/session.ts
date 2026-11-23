import 'server-only'
import { cookies } from 'next/headers'
import { jwtVerify, SignJWT } from 'jose'

export const SESSION_COOKIE = 'caramelo_session'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 dias

function secret() {
  const value = process.env.JWT_SECRET
  if (!value) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET não definida.')
    return new TextEncoder().encode('caramelo-dev-secret-nao-use-em-producao')
  }
  return new TextEncoder().encode(value)
}

/**
 * Sessão em JWT dentro de cookie httpOnly. Front e API estão no mesmo domínio,
 * então o cookie é first-party (SameSite=Lax) e funciona em Safari, Firefox e aba anônima.
 */
export async function startSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function endSession() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

/** Id do usuário logado ou null. Só verifica a assinatura: não toca no banco. */
export async function currentUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    return payload.sub ?? null
  } catch {
    return null
  }
}
