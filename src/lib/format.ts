export const MONTHS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
]

export const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const plain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatCurrency = (value: number) => brl.format(value)

/** Valor sem "R$", para colunas em que o símbolo se repetiria. */
export const formatAmount = (value: number) => plain.format(value)

export const formatCompact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(value)

export const monthLabel = (month: string) => MONTHS.find((m) => m.value === month)?.label ?? ''

/** Datas chegam como AAAA-MM-DD; montamos a data local para não mudar de dia por fuso. */
export const formatDay = (iso: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' }) => {
  const [y, m, d] = iso.substring(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', opts)
}

export const pluralize = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`

/** Hoje no fuso de quem está usando, como AAAA-MM-DD. */
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Aceita "1.234,56", "1234,56" e "1234.56". */
export const parseAmount = (raw: string) => {
  const s = raw.trim()
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return Number(normalized)
}

/** 1234.5 vira "1234,50" para preencher campos de valor. */
export const amountInput = (value: number) => value.toFixed(2).replace('.', ',')
