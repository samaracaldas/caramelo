'use client'

import { createElement } from 'react'
import {
  Bank, Basket, Bread, Briefcase, Buildings, Cake, Calculator, Car, ChartLineUp, Coffee, Coins, CookingPot,
  CreditCard, Drop, FirstAid, ForkKnife, GasPump, Gift, GraduationCap, HandCoins, House, Laptop, Lightning,
  Megaphone, Moped, Package, PawPrint, Phone, PiggyBank, Receipt, Scissors, ShoppingCart, Storefront, Tag,
  TShirt, Truck, Users, WifiHigh, Wrench,
} from '@phosphor-icons/react/ssr'
import type { Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { FALLBACK_COLOR } from '@/lib/palette'
import { CATEGORY_ICON_KEYS, DEFAULT_CATEGORY_ICON, type CategoryIconKey } from '@/lib/category-icon-keys'

export const CATEGORY_ICONS: Record<CategoryIconKey, { icon: Icon; label: string }> = {
  storefront: { icon: Storefront, label: 'Loja' },
  'shopping-cart': { icon: ShoppingCart, label: 'Carrinho' },
  basket: { icon: Basket, label: 'Cesta de compras' },
  cake: { icon: Cake, label: 'Bolo' },
  bread: { icon: Bread, label: 'Pão' },
  coffee: { icon: Coffee, label: 'Café' },
  'fork-knife': { icon: ForkKnife, label: 'Refeição' },
  'cooking-pot': { icon: CookingPot, label: 'Cozinha' },
  package: { icon: Package, label: 'Pacote' },
  truck: { icon: Truck, label: 'Caminhão' },
  moped: { icon: Moped, label: 'Moto de entrega' },
  gift: { icon: Gift, label: 'Presente' },
  't-shirt': { icon: TShirt, label: 'Roupa' },
  scissors: { icon: Scissors, label: 'Tesoura' },
  laptop: { icon: Laptop, label: 'Computador' },
  wrench: { icon: Wrench, label: 'Ferramenta' },
  house: { icon: House, label: 'Casa' },
  buildings: { icon: Buildings, label: 'Prédio' },
  lightning: { icon: Lightning, label: 'Energia' },
  drop: { icon: Drop, label: 'Água' },
  wifi: { icon: WifiHigh, label: 'Internet' },
  phone: { icon: Phone, label: 'Telefone' },
  car: { icon: Car, label: 'Carro' },
  'gas-pump': { icon: GasPump, label: 'Combustível' },
  users: { icon: Users, label: 'Pessoas' },
  briefcase: { icon: Briefcase, label: 'Trabalho' },
  megaphone: { icon: Megaphone, label: 'Divulgação' },
  receipt: { icon: Receipt, label: 'Nota fiscal' },
  calculator: { icon: Calculator, label: 'Contas' },
  'credit-card': { icon: CreditCard, label: 'Cartão' },
  bank: { icon: Bank, label: 'Banco' },
  coins: { icon: Coins, label: 'Moedas' },
  'hand-coins': { icon: HandCoins, label: 'Pagamento recebido' },
  'piggy-bank': { icon: PiggyBank, label: 'Cofrinho' },
  'chart-line-up': { icon: ChartLineUp, label: 'Investimento' },
  'first-aid': { icon: FirstAid, label: 'Saúde' },
  'graduation-cap': { icon: GraduationCap, label: 'Educação' },
  'paw-print': { icon: PawPrint, label: 'Pet' },
  tag: { icon: Tag, label: 'Etiqueta' },
}

const iconFor = (key?: string | null) =>
  CATEGORY_ICONS[(key && key in CATEGORY_ICONS ? key : DEFAULT_CATEGORY_ICON) as CategoryIconKey].icon

/**
 * O "avatar" da categoria. No escuro: fundo tingido e ícone na cor da categoria.
 * No claro: o pastel sólido com ícone escuro, porque pastel sobre branco não tem contraste.
 */
export function CategoryIcon({ icon, color, size = 'md', className }: { icon?: string | null; color?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ '--c': color ?? FALLBACK_COLOR } as React.CSSProperties}
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-[var(--c)] text-[#0d0d10]',
        'dark:bg-[color-mix(in_srgb,var(--c)_16%,transparent)] dark:text-[var(--c)]',
        size === 'sm' && 'size-5 [&_svg]:size-3',
        size === 'md' && 'size-9 [&_svg]:size-[18px]',
        size === 'lg' && 'size-12 [&_svg]:size-6',
        className
      )}
    >
      {createElement(iconFor(icon), { weight: 'fill' })}
    </span>
  )
}

/** Grade de ícones para o formulário de categoria. */
export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (key: CategoryIconKey) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Ícone">
        {CATEGORY_ICON_KEYS.map((key) => {
          const { icon: Glyph, label } = CATEGORY_ICONS[key]
          const selected = key === value
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              onClick={() => onChange(key)}
              style={{ '--c': color } as React.CSSProperties}
              className={cn(
                'grid aspect-square place-items-center rounded-full text-muted-foreground outline-none transition-[background-color,color,transform] active:scale-95',
                'hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60',
                selected && 'bg-[var(--c)] text-[#0d0d10] hover:bg-[var(--c)] hover:text-[#0d0d10]'
              )}
            >
              <Glyph weight={selected ? 'fill' : 'regular'} className="size-[18px]" />
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{CATEGORY_ICONS[value as CategoryIconKey]?.label ?? 'Etiqueta'}</p>
    </div>
  )
}
