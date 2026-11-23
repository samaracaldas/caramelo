import 'server-only'
import { z } from 'zod'
import { CATEGORY_ICON_KEYS } from '@/lib/category-icon-keys'

const name = z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(60, 'Nome muito longo')
const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Cor inválida')

export const accountSchema = z.object({
  name,
  type: z.enum(['cash', 'bank', 'card', 'other']),
  color,
  initialBalance: z.number().finite().default(0),
})

export const categorySchema = z.object({
  name,
  type: z.enum(['income', 'expense']),
  color,
  icon: z.enum(CATEGORY_ICON_KEYS, 'Ícone inválido').default('tag'),
})

export const transactionSchema = z.object({
  title: z.string().trim().min(2, 'Título deve ter pelo menos 2 caracteres').max(120, 'Título muito longo'),
  amount: z.number().positive('Valor deve ser positivo').max(9_999_999_999, 'Valor muito alto'),
  type: z.enum(['income', 'expense']),
  category: z.uuid('Categoria obrigatória'),
  account: z.union([z.uuid('Conta inválida'), z.literal('')]).optional(),
  description: z.string().max(1000, 'Observação muito longa').optional(),
  date: z.iso.date('Data inválida'),
  client: z.union([z.uuid('Cliente inválido'), z.literal('')]).optional(),
})

export const clientSchema = z.object({
  name,
  phone: z.string().trim().max(30, 'Telefone muito longo').optional(),
  notes: z.string().max(500, 'Observação muito longa').optional(),
})

export const recurrenceSchema = transactionSchema
  .omit({ date: true, client: true })
  .extend({
    frequency: z.enum(['weekly', 'monthly', 'yearly']),
    startDate: z.iso.date('Informe o primeiro vencimento'),
    endDate: z.union([z.iso.date('Data final inválida'), z.literal(''), z.null()]).optional(),
  })
  .refine((r) => !r.endDate || r.endDate >= r.startDate, { message: 'A data final precisa ser depois do primeiro vencimento', path: ['endDate'] })

export const boxSchema = z
  .object({
    name,
    icon: z.enum(CATEGORY_ICON_KEYS, 'Ícone inválido').default('piggy-bank'),
    color,
    target: z.number().positive('A meta precisa ser maior que zero').max(9_999_999_999).nullable().optional(),
    targetDate: z.union([z.iso.date('Data inválida'), z.literal(''), z.null()]).optional(),
  })
  .refine((b) => !b.targetDate || b.target, { message: 'Para ter prazo, defina também o valor da meta', path: ['targetDate'] })

export const boxEntrySchema = z.object({
  kind: z.enum(['deposit', 'withdraw']),
  amount: z.number().positive('Valor deve ser positivo').max(9_999_999_999, 'Valor muito alto'),
  date: z.iso.date('Data inválida'),
  note: z.string().max(200, 'Observação muito longa').optional(),
})

/** Registrar o pagamento (ou recebimento) de um vencimento. Valor e conta podem diferir do previsto. */
export const paymentSchema = z.object({
  dueDate: z.iso.date('Vencimento inválido'),
  date: z.iso.date('Data inválida'),
  amount: z.number().positive('Valor deve ser positivo').max(9_999_999_999, 'Valor muito alto'),
  account: z.union([z.uuid('Conta inválida'), z.literal('')]).optional(),
})
