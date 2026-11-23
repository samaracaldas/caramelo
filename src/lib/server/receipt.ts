import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

/** A leitura de comprovante só existe quando há uma chave da Anthropic configurada. */
export const receiptScanEnabled = () => !!process.env.ANTHROPIC_API_KEY

export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const
export type ReceiptMediaType = (typeof RECEIPT_TYPES)[number]
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024

/** O que o modelo devolve. A saída estruturada garante esse formato; o servidor ainda confere os valores. */
const ReceiptSchema = z.object({
  isReceipt: z.boolean().describe('false se a imagem não for um comprovante, nota ou recibo de pagamento'),
  type: z.enum(['income', 'expense']).describe('income se o negócio RECEBEU o dinheiro; expense se o negócio PAGOU'),
  amount: z.number().nullable().describe('valor total em reais, como número (ex.: 1234.56)'),
  date: z.string().nullable().describe('data do pagamento no formato AAAA-MM-DD'),
  title: z.string().describe('descrição curta para o extrato, até 60 caracteres, em português'),
  counterparty: z.string().nullable().describe('nome de quem pagou (entrada) ou de quem recebeu (saída)'),
  categoryId: z.string().nullable().describe('id da categoria mais adequada da lista fornecida, ou null'),
  notes: z.string().nullable().describe('dado útil para a observação: forma de pagamento, número da nota, ID da transação Pix'),
  confidence: z.enum(['high', 'medium', 'low']).describe('quão legível e inequívoco estava o documento'),
})
export type ReceiptReading = z.infer<typeof ReceiptSchema>

const SYSTEM = `Você lê comprovantes financeiros de pequenos negócios brasileiros: comprovantes de Pix e de transferência, notas fiscais (NF-e, NFC-e, cupom), boletos pagos e recibos.

Extraia os dados para registrar uma transação no controle financeiro do negócio. Regras:
- Decida a direção pelo nome do negócio: se o negócio aparece como recebedor, é entrada (income); se aparece como pagador, ou se é uma nota de compra feita pelo negócio, é saída (expense). Na dúvida, prefira expense para notas fiscais de compra e income para Pix recebido.
- amount é o valor total pago, sem taxas separadas. Use ponto decimal.
- date é a data do pagamento ou emissão, em AAAA-MM-DD. Se o ano não aparecer, use o ano mais provável.
- title deve ser útil num extrato, por exemplo "Pix de Marina Okabe" ou "Compra no Atacadão". Não invente produtos.
- Escolha categoryId só entre os ids fornecidos e do mesmo tipo (income ou expense); se nenhum servir, use null.
- Nunca copie CPF, CNPJ completo, chaves Pix ou dados bancários para notes; um ID de transação ou número de nota pode.
- Se o documento não for um comprovante de pagamento, devolva isReceipt false e deixe os outros campos nulos ou vazios.`

// criado só na primeira leitura: sem chave configurada, o resto do app nem toca no SDK
let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic())

export async function readReceipt(input: {
  data: Buffer
  mediaType: ReceiptMediaType
  businessName: string
  categories: { id: string; name: string; type: 'income' | 'expense' }[]
  today: string
}): Promise<ReceiptReading> {
  const file: Anthropic.Beta.BetaContentBlockParam = input.mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.data.toString('base64') } }
    : { type: 'image', source: { type: 'base64', media_type: input.mediaType, data: input.data.toString('base64') } }

  const categoryList = input.categories.map((c) => `- ${c.id} | ${c.name} | ${c.type}`).join('\n')

  const response = await anthropic().beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 2000,
    // extração simples: pouco raciocínio basta e sai mais barato e rápido
    output_config: { effort: 'low', format: betaZodOutputFormat(ReceiptSchema) },
    // se o modelo recusar por política, a API tenta de novo num modelo alternativo dentro da mesma chamada
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        file,
        {
          type: 'text',
          text: `Negócio: ${input.businessName}\nHoje: ${input.today}\n\nCategorias disponíveis (id | nome | tipo):\n${categoryList || '(nenhuma)'}`,
        },
      ],
    }],
  })

  if (response.stop_reason === 'refusal') throw new ReceiptError('Não foi possível ler este arquivo.')
  if (!response.parsed_output) throw new ReceiptError('A leitura veio incompleta. Tente uma foto mais nítida.')
  return response.parsed_output
}

export class ReceiptError extends Error {}
