/** Leitura do comportamento de cada cliente a partir do histórico de compras. Código puro. */
import { daysBetween } from './recurrence'

export interface ClientLike {
  purchases: number
  total: number
  firstPurchase: string | null
  lastPurchase: string | null
}

export type ClientStatus = 'none' | 'new' | 'once' | 'regular' | 'active' | 'gone'

export const GONE_AFTER_DAYS = 60

export function clientInsight(c: ClientLike, today: string) {
  if (!c.lastPurchase || c.purchases === 0) return { status: 'none' as ClientStatus, ticket: 0, daysSince: null, avgGap: null }
  const daysSince = daysBetween(c.lastPurchase, today)
  const avgGap = c.purchases > 1 && c.firstPurchase ? daysBetween(c.firstPurchase, c.lastPurchase) / (c.purchases - 1) : null
  const ticket = c.total / c.purchases
  // "sumiu" é relativo ao ritmo do próprio cliente: quem compra toda semana some antes de quem compra por trimestre
  const goneAfter = Math.max(GONE_AFTER_DAYS, avgGap ? avgGap * 3 : 0)
  let status: ClientStatus
  if (c.purchases >= 2 && daysSince > goneAfter) status = 'gone'
  else if (c.purchases === 1) status = daysSince <= GONE_AFTER_DAYS ? 'new' : 'once'
  else if (c.purchases >= 3 && avgGap !== null && daysSince <= Math.max(30, avgGap * 2)) status = 'regular'
  else status = 'active'
  return { status, ticket, daysSince, avgGap }
}

/** Link do WhatsApp com mensagem pronta. Só números; DDI 55 quando o número parece brasileiro. */
export function whatsappLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const full = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`
}

export function sinceLabel(days: number): string {
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days} dias`
  const months = Math.round(days / 30)
  return months === 1 ? 'há 1 mês' : `há ${months} meses`
}
