import { formatDay } from './format'

export interface CsvRow {
  date: string
  type: 'income' | 'expense'
  title: string
  amount: number
  description: string | null
  category?: { name: string } | null
  account?: { name: string } | null
  client?: { name: string } | null
}

/**
 * Texto entre aspas e protegido contra injeção de fórmula: no Excel, uma célula que começa
 * com = + - @ vira fórmula. O apóstrofo na frente faz o Excel tratar como texto.
 */
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

/** CSV com ponto e vírgula e BOM: abre certo no Excel brasileiro e no Google Planilhas. */
export function buildCSV(rows: CsvRow[]): string {
  const headers = ['Data', 'Tipo', 'Título', 'Categoria', 'Conta', 'Cliente ou fornecedor', 'Valor', 'Observação']
  const lines = rows.map((tx) => [
    formatDay(tx.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    tx.type === 'income' ? 'Entrada' : 'Saída',
    cell(tx.title),
    cell(tx.category?.name ?? ''),
    cell(tx.account?.name ?? ''),
    cell(tx.client?.name ?? ''),
    tx.amount.toFixed(2).replace('.', ','),
    cell(tx.description ?? ''),
  ].join(';'))
  return '﻿' + [headers.join(';'), ...lines].join('\n')
}
