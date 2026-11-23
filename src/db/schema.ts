import { relations } from 'drizzle-orm'
import { date, index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const flowType = pgEnum('flow_type', ['income', 'expense'])
export const accountType = pgEnum('account_type', ['cash', 'bank', 'card', 'other'])

/** numeric(12,2) lido como number: dinheiro exato no banco, número simples no JS. */
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: 'number' })

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  ...timestamps,
})

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: accountType('type').notNull().default('bank'),
    color: text('color').notNull(),
    initialBalance: money('initial_balance').notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('accounts_user_name_idx').on(t.userId, t.name)]
)

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: flowType('type').notNull(),
    color: text('color').notNull(),
    // chave de um ícone da lista curada em src/lib/category-icon-keys.ts
    icon: text('icon').notNull().default('tag'),
    ...timestamps,
  },
  (t) => [uniqueIndex('categories_user_name_idx').on(t.userId, t.name)]
)

export const frequency = pgEnum('frequency', ['weekly', 'monthly', 'yearly'])

/**
 * Regra de algo que se repete (aluguel, salários, assinatura). Os vencimentos não são
 * gravados: saem da regra (src/lib/recurrence.ts). Um vencimento está pago quando existe
 * uma transação com este recurrenceId e aquele dueDate.
 */
export const recurrences = pgTable(
  'recurrences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // valor previsto; o pagamento pode registrar outro (a conta de luz varia)
    amount: money('amount').notNull(),
    type: flowType('type').notNull(),
    categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'no action' }),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    description: text('description'),
    frequency: frequency('frequency').notNull().default('monthly'),
    // primeiro vencimento; dele saem o dia do mês, o dia da semana ou a data do ano
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    ...timestamps,
  },
  (t) => [index('recurrences_user_idx').on(t.userId)]
)

/** Clientes (ou fornecedores) que aparecem nas transações. */
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [uniqueIndex('clients_user_name_idx').on(t.userId, t.name)]
)

/**
 * Caixinhas: envelopes virtuais dentro do saldo das contas ("13º", "Imposto do trimestre").
 * Não movem dinheiro entre contas: só separam uma parte. O saldo de cada uma é a soma
 * das entradas (positivas ao guardar, negativas ao retirar).
 */
export const boxes = pgTable(
  'boxes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon').notNull().default('piggy-bank'),
    color: text('color').notNull(),
    target: money('target'),
    targetDate: date('target_date', { mode: 'string' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('boxes_user_name_idx').on(t.userId, t.name)]
)

export const boxEntries = pgTable(
  'box_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    boxId: uuid('box_id').notNull().references(() => boxes.id, { onDelete: 'cascade' }),
    amount: money('amount').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('box_entries_box_idx').on(t.boxId)]
)

/**
 * Links só de leitura para o contador. Guardamos o hash do token, nunca o token:
 * quem lê o banco não consegue montar o link.
 */
export const shareLinks = pgTable('share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  label: text('label').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    amount: money('amount').notNull(),
    type: flowType('type').notNull(),
    // categoria é obrigatória; a exclusão segura move as transações antes (o banco recusa apagar uma categoria em uso)
    categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'no action' }),
    // conta é opcional; apagar a conta deixa a transação sem conta
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    description: text('description'),
    date: date('date', { mode: 'string' }).notNull(),
    // pagamento de um vencimento de recorrência; apagar a regra mantém o histórico
    recurrenceId: uuid('recurrence_id').references(() => recurrences.id, { onDelete: 'set null' }),
    dueDate: date('due_date', { mode: 'string' }),
    // cliente ou fornecedor; apagar o cadastro mantém a transação
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('transactions_user_date_idx').on(t.userId, t.date),
    // o mesmo vencimento não pode ser pago duas vezes
    uniqueIndex('transactions_recurrence_due_idx').on(t.recurrenceId, t.dueDate),
  ]
)

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  client: one(clients, { fields: [transactions.clientId], references: [clients.id] }),
}))

export const recurrencesRelations = relations(recurrences, ({ one }) => ({
  category: one(categories, { fields: [recurrences.categoryId], references: [categories.id] }),
  account: one(accounts, { fields: [recurrences.accountId], references: [accounts.id] }),
}))
