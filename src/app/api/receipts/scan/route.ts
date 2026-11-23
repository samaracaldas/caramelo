import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { categories, clients, users } from '@/db/schema'
import { fail, json, rateLimited, withUser } from '@/lib/server/http'
import { readReceipt, receiptScanEnabled, ReceiptError, RECEIPT_MAX_BYTES, RECEIPT_TYPES, type ReceiptMediaType } from '@/lib/server/receipt'

// leitura com modelo de visão pode levar alguns segundos
export const maxDuration = 60

const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/**
 * Recebe a foto (ou PDF) de um comprovante e devolve os campos para pré-preencher
 * uma transação. Não grava nada: quem confere e salva é a pessoa.
 */
export const POST = withUser(async ({ req, db, userId }) => {
  if (!receiptScanEnabled()) return fail('Leitura de comprovante não está configurada', 404)
  // cada leitura custa alguns centavos: um teto por usuário evita surpresa na fatura
  if (rateLimited(`receipt:${userId}`, 30, 60 * 60 * 1000)) return fail('Muitas leituras seguidas. Tente de novo em alguns minutos.', 429)

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return fail('Envie a foto ou o PDF do comprovante')
  if (!RECEIPT_TYPES.includes(file.type as ReceiptMediaType)) return fail('Use uma foto (JPG, PNG, WEBP) ou um PDF')
  if (file.size > RECEIPT_MAX_BYTES) return fail('Arquivo grande demais. O limite é 5 MB')

  const [[user], cats, people] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)),
    db.select({ id: categories.id, name: categories.name, type: categories.type }).from(categories).where(eq(categories.userId, userId)),
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.userId, userId)),
  ])

  const today = new Date().toISOString().slice(0, 10)
  let reading
  try {
    reading = await readReceipt({
      data: Buffer.from(await file.arrayBuffer()),
      mediaType: file.type as ReceiptMediaType,
      businessName: user?.name ?? 'o negócio',
      categories: cats,
      today,
    })
  } catch (err) {
    if (err instanceof ReceiptError) return fail(err.message, 422)
    if (err instanceof Anthropic.RateLimitError) return fail('O serviço de leitura está ocupado. Tente de novo em instantes.', 503)
    if (err instanceof Anthropic.APIError) {
      console.error('[receipt]', err.status, err.message)
      return fail('Não foi possível ler o comprovante agora.', 502)
    }
    throw err
  }

  if (!reading.isReceipt) return fail('Não parece um comprovante ou nota. Tente outra imagem.', 422)

  // O modelo segue o formato, mas os valores ainda são conferidos aqui
  const category = cats.find((c) => c.id === reading.categoryId && c.type === reading.type)
  const counterparty = reading.counterparty?.trim() || null
  const client = counterparty
    ? people.find((p) => norm(counterparty).includes(norm(p.name)) || norm(p.name).includes(norm(counterparty)))
    : undefined

  return json({
    type: reading.type,
    amount: reading.amount && reading.amount > 0 && reading.amount < 10_000_000_000 ? Math.round(reading.amount * 100) / 100 : null,
    date: isDay(reading.date) && reading.date <= today ? reading.date : null,
    title: reading.title.trim().slice(0, 120),
    counterparty,
    categoryId: category?.id ?? null,
    clientId: client?.id ?? null,
    notes: reading.notes?.trim().slice(0, 500) || null,
    confidence: reading.confidence,
  })
})
