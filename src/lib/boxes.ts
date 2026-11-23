/** Ritmo das caixinhas: quanto falta, quanto guardar por semana e se o prazo ainda dá. Código puro. */
import { addDays, daysBetween } from './recurrence'

export interface BoxLike {
  saved: number
  target: number | null
  targetDate: string | null
}

export type Pace =
  | { kind: 'free' }
  | { kind: 'done' }
  | { kind: 'no-date'; remaining: number }
  | { kind: 'late'; remaining: number }
  | { kind: 'on-track'; remaining: number; perWeek: number; weeks: number }

export function pace(box: BoxLike, today: string): Pace {
  if (!box.target) return { kind: 'free' }
  const remaining = Math.max(0, box.target - box.saved)
  if (remaining === 0) return { kind: 'done' }
  if (!box.targetDate) return { kind: 'no-date', remaining }
  const days = daysBetween(today, box.targetDate)
  if (days < 0) return { kind: 'late', remaining }
  const weeks = Math.max(1, Math.ceil(days / 7))
  return { kind: 'on-track', remaining, perWeek: Math.ceil((remaining / weeks) * 100) / 100, weeks }
}

/**
 * Datas em que cada caixinha "puxa" dinheiro se a pessoa seguir o ritmo sugerido:
 * uma parcela por semana, a partir de hoje, até o prazo. Serve para a previsão de saldo livre.
 */
export function plannedSavings(boxesList: BoxLike[], today: string, horizon: number): Map<string, number> {
  const out = new Map<string, number>()
  boxesList.forEach((b) => {
    const p = pace(b, today)
    if (p.kind !== 'on-track') return
    for (let w = 0; w < p.weeks; w++) {
      const day = addDays(today, w * 7)
      if (daysBetween(today, day) > horizon) break
      out.set(day, (out.get(day) ?? 0) - p.perWeek)
    }
  })
  return out
}
