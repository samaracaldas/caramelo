/** Período pedido na URL (?mes=AAAA-MM ou ?ano=AAAA), com o mês atual como padrão. */
export function readPeriod(params: { mes?: string; ano?: string }) {
  const now = new Date()
  if (params.ano && /^\d{4}$/.test(params.ano)) {
    const y = Number(params.ano)
    return { kind: 'year' as const, key: params.ano, start: `${y}-01-01`, end: `${y}-12-31` }
  }
  const valid = params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes)
  const key = valid ? params.mes! : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [y, m] = key.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { kind: 'month' as const, key, start: `${key}-01`, end: `${key}-${String(last).padStart(2, '0')}` }
}

export const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
