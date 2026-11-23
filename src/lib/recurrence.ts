/**
 * Vencimentos de recorrências. Código puro (sem banco, sem React): o servidor usa para validar
 * um pagamento e o navegador usa para montar a agenda e a previsão de saldo.
 * Datas sempre como 'AAAA-MM-DD', calculadas em UTC para não escorregar de dia por fuso.
 */

export type Frequency = 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceRule {
  frequency: Frequency
  /** primeiro vencimento */
  startDate: string
  endDate?: string | null
}

const parse = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return { y, m: m - 1, d }
}
const fmt = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m, d))
  return date.toISOString().slice(0, 10)
}
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

export const addDays = (day: string, n: number) => {
  const { y, m, d } = parse(day)
  return fmt(y, m, d + n)
}

/** Diferença em dias entre duas datas (b - a). */
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86_400_000)
const ymd = (day: string): [number, number, number] => {
  const { y, m, d } = parse(day)
  return [y, m, d]
}

/** O k-ésimo vencimento da regra (k = 0 é o primeiro). Dia 31 vira o último dia em meses curtos. */
function nth(rule: RecurrenceRule, k: number): string {
  const s = parse(rule.startDate)
  if (rule.frequency === 'weekly') return fmt(s.y, s.m, s.d + 7 * k)
  if (rule.frequency === 'monthly') {
    const y = s.y + Math.floor((s.m + k) / 12)
    const m = (s.m + k) % 12
    return fmt(y, m, Math.min(s.d, daysInMonth(y, m)))
  }
  const y = s.y + k
  return fmt(y, s.m, Math.min(s.d, daysInMonth(y, s.m)))
}

/** Vencimentos entre `from` e `to` (inclusive). */
export function occurrences(rule: RecurrenceRule, from: string, to: string): string[] {
  const out: string[] = []
  const last = rule.endDate && rule.endDate < to ? rule.endDate : to
  if (last < rule.startDate) return out

  // pula direto para perto de `from` em vez de andar desde o início
  let k = 0
  if (from > rule.startDate) {
    const gap = daysBetween(rule.startDate, from)
    k = Math.max(0, rule.frequency === 'weekly' ? Math.floor(gap / 7) : rule.frequency === 'monthly' ? Math.floor(gap / 31) : Math.floor(gap / 366))
  }
  for (; ; k++) {
    const day = nth(rule, k)
    if (day > last) break
    if (day >= from) out.push(day)
  }
  return out
}

export const isOccurrence = (rule: RecurrenceRule, day: string) => occurrences(rule, day, day).length === 1

/** Próximo vencimento a partir de `today` (inclusive), ou null se a regra já terminou. */
export function nextOccurrence(rule: RecurrenceRule, today: string): string | null {
  return occurrences(rule, today, addDays(today, 400))[0] ?? null
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** "Todo dia 10", "Toda segunda", "Todo ano em 15/03". */
export function frequencyLabel(rule: RecurrenceRule): string {
  const s = parse(rule.startDate)
  if (rule.frequency === 'weekly') {
    const wd = new Date(Date.UTC(s.y, s.m, s.d)).getUTCDay()
    return `${wd === 0 || wd === 6 ? 'Todo' : 'Toda'} ${WEEKDAYS[wd]}`
  }
  if (rule.frequency === 'monthly') return `Todo dia ${s.d}`
  return `Todo ano em ${String(s.d).padStart(2, '0')}/${String(s.m + 1).padStart(2, '0')}`
}

/* ---------- agenda ---------- */

export interface AgendaRecurrence extends RecurrenceRule {
  id: string
  amount: number
  type: 'income' | 'expense'
  accountId: string | null
}

export interface AgendaTransaction {
  id: string
  recurrenceId: string | null
  dueDate: string | null
  amount: number
  date: string
}

export type DueStatus = 'paid' | 'overdue' | 'today' | 'soon' | 'later'

export interface DueItem<R extends AgendaRecurrence = AgendaRecurrence> {
  recurrence: R
  dueDate: string
  status: DueStatus
  /** dias até o vencimento (negativo = atrasado) */
  inDays: number
  payment?: AgendaTransaction
}

export const OVERDUE_LOOKBACK_DAYS = 60
export const SOON_DAYS = 7

/**
 * Vencimentos de `today - 60 dias` até `today + horizon`, cada um com seu estado.
 * Pagos antigos (antes do mês atual) saem da lista: já viraram histórico em Transações.
 */
export function buildAgenda<R extends AgendaRecurrence>(
  recurrences: R[],
  transactions: AgendaTransaction[],
  today: string,
  horizon = 30
): DueItem<R>[] {
  const paid = new Map<string, AgendaTransaction>()
  transactions.forEach((t) => {
    if (t.recurrenceId && t.dueDate) paid.set(`${t.recurrenceId}|${t.dueDate}`, t)
  })
  const monthStart = today.slice(0, 8) + '01'
  const from = addDays(today, -OVERDUE_LOOKBACK_DAYS)
  const to = addDays(today, horizon)

  const items: DueItem<R>[] = []
  recurrences.forEach((r) => {
    occurrences(r, from, to).forEach((dueDate) => {
      const payment = paid.get(`${r.id}|${dueDate}`)
      const inDays = daysBetween(today, dueDate)
      if (payment && dueDate < monthStart) return
      const status: DueStatus = payment ? 'paid' : inDays < 0 ? 'overdue' : inDays === 0 ? 'today' : inDays <= SOON_DAYS ? 'soon' : 'later'
      items.push({ recurrence: r, dueDate, status, inDays, payment })
    })
  })
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.recurrence.amount - b.recurrence.amount)
}

/**
 * Quanto cada dia futuro muda o saldo das contas, se tudo que está em aberto for pago no
 * vencimento. Atrasados entram hoje. Recorrências sem conta não mexem em saldo de conta.
 */
export function forecastDeltas(agenda: DueItem[], today: string): Map<string, number> {
  const deltas = new Map<string, number>()
  agenda.forEach((item) => {
    if (item.status === 'paid' || !item.recurrence.accountId) return
    const day = item.dueDate < today ? today : item.dueDate
    const signed = item.recurrence.type === 'income' ? item.recurrence.amount : -item.recurrence.amount
    deltas.set(day, (deltas.get(day) ?? 0) + signed)
  })
  return deltas
}

/** "vence hoje", "vence amanhã", "vence em 5 dias", "venceu há 3 dias". */
export function dueLabel(inDays: number, type: 'income' | 'expense'): string {
  const verb = type === 'income' ? ['entra', 'entrou'] : ['vence', 'venceu']
  if (inDays === 0) return `${verb[0]} hoje`
  if (inDays === 1) return `${verb[0]} amanhã`
  if (inDays > 1) return `${verb[0]} em ${inDays} dias`
  if (inDays === -1) return type === 'income' ? 'era para ontem' : 'venceu ontem'
  return type === 'income' ? `atrasado há ${-inDays} dias` : `${verb[1]} há ${-inDays} dias`
}

/** Saldo dia a dia a partir de hoje, aplicando as variações previstas. Índice 0 é hoje. */
export function projectBalance(start: number, deltas: Map<string, number>, today: string, days: number) {
  const out: { day: string; balance: number }[] = []
  let running = start
  for (let i = 0; i <= days; i++) {
    const day = addDays(today, i)
    running += deltas.get(day) ?? 0
    out.push({ day, balance: running })
  }
  return out
}
