/**
 * Chaves dos ícones de categoria. Ficam separadas dos componentes para o servidor
 * validar sem importar a biblioteca de ícones.
 * A ordem é a do seletor: vendas e comida primeiro (o público é pequeno negócio), depois custos fixos.
 */
export const CATEGORY_ICON_KEYS = [
  'storefront', 'shopping-cart', 'basket', 'cake', 'bread', 'coffee', 'fork-knife', 'cooking-pot',
  'package', 'truck', 'moped', 'gift', 't-shirt', 'scissors', 'laptop', 'wrench',
  'house', 'buildings', 'lightning', 'drop', 'wifi', 'phone', 'car', 'gas-pump',
  'users', 'briefcase', 'megaphone', 'receipt', 'calculator', 'credit-card', 'bank', 'coins',
  'hand-coins', 'piggy-bank', 'chart-line-up', 'first-aid', 'graduation-cap', 'paw-print', 'tag',
] as const

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number]

export const DEFAULT_CATEGORY_ICON: CategoryIconKey = 'tag'

/** Sugestão pelo nome, para quem cria a categoria sem escolher ícone. */
const HINTS: [RegExp, CategoryIconKey][] = [
  [/venda|balc[aã]o|loja/i, 'storefront'],
  [/encomenda|pedido/i, 'package'],
  [/delivery|entrega|ifood|motoboy/i, 'moped'],
  [/bolo|doce|confeit/i, 'cake'],
  [/p[aã]o|padaria/i, 'bread'],
  [/caf[eé]/i, 'coffee'],
  [/insumo|ingrediente|mercado|compra/i, 'basket'],
  [/aluguel|condom[ií]nio/i, 'house'],
  [/folha|sal[aá]rio|funcion[aá]rio|equipe/i, 'users'],
  [/luz|energia/i, 'lightning'],
  [/[aá]gua/i, 'drop'],
  [/internet|wi-?fi/i, 'wifi'],
  [/telefone|celular/i, 'phone'],
  [/embalage|caixa/i, 'package'],
  [/marketing|an[uú]ncio|propaganda|instagram/i, 'megaphone'],
  [/imposto|taxa|tributo|das\b/i, 'receipt'],
  [/contador|contabil/i, 'calculator'],
  [/cart[aã]o|fatura/i, 'credit-card'],
  [/banco|tarifa/i, 'bank'],
  [/combust[ií]vel|gasolina/i, 'gas-pump'],
  [/carro|ve[ií]culo|uber|transporte/i, 'car'],
  [/manuten[cç][aã]o|conserto/i, 'wrench'],
  [/investimento|rendimento/i, 'chart-line-up'],
  [/reserva|poupan[cç]a/i, 'piggy-bank'],
  [/sa[uú]de|farm[aá]cia/i, 'first-aid'],
  [/curso|educa/i, 'graduation-cap'],
]

export function suggestIcon(name: string): CategoryIconKey {
  return HINTS.find(([re]) => re.test(name))?.[1] ?? DEFAULT_CATEGORY_ICON
}
