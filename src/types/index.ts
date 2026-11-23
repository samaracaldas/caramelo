export type FlowType = 'income' | 'expense'

export interface IUser {
  id: string
  name: string
  email: string
}

export interface ICategory {
  id: string
  name: string
  type: FlowType
  color: string
  icon: string
  createdAt: string
}

export interface IAccount {
  id: string
  name: string
  type: 'cash' | 'bank' | 'card' | 'other'
  color: string
  initialBalance: number
  createdAt: string
}

type Ref<T> = Pick<T, Extract<keyof T, 'id' | 'name' | 'color' | 'type'>>

export interface ITransaction {
  id: string
  title: string
  amount: number
  type: FlowType
  category: Ref<ICategory> & { icon: string }
  account: Ref<IAccount> | null
  description: string | null
  /** AAAA-MM-DD */
  date: string
  /** pagamento de um vencimento de recorrência */
  recurrenceId: string | null
  dueDate: string | null
  clientId: string | null
  client: { id: string; name: string } | null
  createdAt: string
}

export interface IRecurrence {
  id: string
  title: string
  amount: number
  type: FlowType
  category: Ref<ICategory> & { icon: string }
  categoryId: string
  account: Ref<IAccount> | null
  accountId: string | null
  description: string | null
  frequency: 'weekly' | 'monthly' | 'yearly'
  startDate: string
  endDate: string | null
  createdAt: string
}

export interface IBox {
  id: string
  name: string
  icon: string
  color: string
  target: number | null
  targetDate: string | null
  saved: number
  createdAt: string
}

export interface IBoxEntry {
  id: string
  boxId: string
  /** positivo ao guardar, negativo ao retirar */
  amount: number
  date: string
  note: string | null
}

export interface IBoxesResponse {
  boxes: IBox[]
  entries: IBoxEntry[]
  /** saldo das contas */
  inAccounts: number
  inBoxes: number
  free: number
}

export interface IClient {
  id: string
  name: string
  phone: string | null
  notes: string | null
  /** quantas entradas (vendas) tiveram este cliente */
  purchases: number
  total: number
  firstPurchase: string | null
  lastPurchase: string | null
  createdAt: string
}
