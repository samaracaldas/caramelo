import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { users } from '@/db/schema'
import { currentUserId } from '@/lib/server/session'
import { receiptScanEnabled } from '@/lib/server/receipt'
import { AppShell } from './shell'

/** Valida a sessão no servidor: quem não está logado nem chega a ver o painel. */
export default async function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
  const userId = await currentUserId()
  if (!userId) redirect('/login')

  const db = await getDb()
  const [user] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId))
  if (!user) redirect('/login')

  return <AppShell user={{ ...user, receiptScan: receiptScanEnabled() }}>{children}</AppShell>
}
