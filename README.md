# Caramelo

Financial management for small businesses: income, expenses, accounts and categories, with the right balance at the end of the month. A rebuild of FinancesFlow with a new identity and a much faster stack.

Click **Ver demonstração** to explore a year of data from a fictional bakery without signing up.

## Why the rebuild

FinancesFlow took 30 to 60 seconds to log in. The cause was not MongoDB queries but the infrastructure: the Express API ran on Render's free tier, which sleeps after 15 minutes, and MongoDB Atlas M0 also pauses. Every first visit waited for a server to boot.

Caramelo removes the separate server entirely:

| | FinancesFlow | Caramelo |
|---|---|---|
| API | Express on Render (sleeps) | Next.js route handlers on Vercel |
| Database | MongoDB Atlas M0 + Mongoose | Neon Postgres + Drizzle ORM |
| DB driver | TCP connection pool | HTTP (one fetch per query, built for serverless) |
| Cold start | up to ~60 s | Neon wakes in ~0.5 s |
| Login (warm) | ~1 s | ~70 ms locally |

## Stack

- **Next.js 16** (App Router): pages and API in one deploy
- **Neon Postgres** via `@neondatabase/serverless` HTTP driver
- **Drizzle ORM**: typed schema, SQL migrations in `drizzle/`
- **PGlite** in development: real Postgres compiled to WASM, so `npm run dev` works with zero setup
- **jose + bcryptjs**: JWT session in an httpOnly, first-party cookie
- **Zod 4**: validation on every endpoint
- **Tailwind CSS 4**, Radix primitives, **Phosphor** icons, **Recharts**, **Geist** typeface

## Features

- **Dashboard**: cash balance as a line over time with a 30-day forecast, month-over-month comparison, upcoming bills and quick actions.
- **Transactions**: ledger table with filters, a detail side panel, and an optional client or supplier on each entry.
- **Recurring bills**: rent, payroll, subscriptions. Register once, pay each due date in one click, see what is overdue.
- **Caixinhas (savings envelopes)**: set money aside for a goal ("13th salary", "new oven") without moving it between accounts. Shows the free balance and a weekly pace that is checked against the forecast.
- **Clients**: purchase history per client, average ticket, loyal vs. gone quiet, and a one-tap WhatsApp message to win back clients who stopped buying.
- **Accountant link**: a read-only, no-login link with the month or year close and a CSV download. Only a hash of the token is stored; links can expire and be revoked.
- **Read a receipt** (optional): photograph a Pix receipt, invoice or paid bill and Claude fills in the transaction for you to review. Enabled only when `ANTHROPIC_API_KEY` is set.
- **Accounts, categories with icons, reports and CSV export.**

## Visual identity

Two references, each for a different job:

- **Pierre** (Brazilian personal finance app) sets the mood: near-black background, Geist at regular weight for large numbers, pill-shaped controls, pastel colors for categories.
- **Mercury** (business banking) sets the structure: a greeting with quick actions, the cash balance as a line over time, small cents set as superscript, month-over-month deltas, a ledger-style transactions table and a side panel for details.

A single accent ties it together: caramel, the color of the mascot, a *vira-lata caramelo*. Light mode follows the system preference with the same hierarchy. Tokens live in `src/app/globals.css`.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without `DATABASE_URL`, data is stored in `~/.caramelo/pglite` (outside the project, so OneDrive or Dropbox sync cannot corrupt it; override with `PGLITE_DIR`) and migrations run on the first request.

If the local database ever fails to open ("PGlite failed to initialize"), the dev server was probably killed mid-write. Stop it, rename or delete `~/.caramelo/pglite` and start again; the demo account is recreated automatically.

To try the production build locally without Neon: `npm run build`, then start it with `LOCAL_DB=1 JWT_SECRET=anything npx next start`. Stop `npm run dev` first: PGlite allows only one process per data folder.

## Deploying (Vercel + Neon)

1. Create a project on [neon.tech](https://neon.tech) (region `sa-east-1`, São Paulo, to stay close to users) and copy the connection string.
2. Import this repository on Vercel and set the environment variables:
   - `DATABASE_URL`: the Neon connection string
   - `JWT_SECRET`: a long random string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `ANTHROPIC_API_KEY` (optional): turns on receipt reading
3. Set the Vercel Functions region to `gru1` (São Paulo), next to the database.
4. Deploy. `npm run build` applies pending migrations before building.

Tip: Vercel's Neon integration (Storage tab) creates the database and the `DATABASE_URL` variable for you.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (PGlite if there is no `DATABASE_URL`) |
| `npm run build` | Migrates Neon, then builds |
| `npm run db:generate` | Creates a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Applies migrations to Neon |
| `npm run db:studio` | Opens Drizzle Studio |

## Key decisions

- **Session check on the server**: the dashboard layout verifies the JWT before rendering, so logged-out users never see a flash of the app.
- **Ownership checks**: a transaction can only reference the user's own category and account, and the category type must match.
- **Safe deletes**: deleting a category in use requires moving its transactions (`?moveTo=`); the database itself refuses to delete a category still referenced. Deleting an account moves its transactions or leaves them without an account (`ON DELETE SET NULL`).
- **Money as `numeric(12,2)`**: exact in the database, plain numbers in JavaScript.
- **Recurring bills without a scheduler**: a recurrence stores only its rule (frequency, first due date, optional end). Due dates are computed on the fly by pure functions in `src/lib/recurrence.ts`, shared by server and browser. A due date counts as paid when a transaction exists with that `recurrenceId` and `dueDate`, and a unique index on that pair prevents paying it twice. Undoing a payment is deleting that transaction. No cron job, which suits serverless.
- **Balance forecast**: the dashboard projects the next 30 days by applying open due dates to today's balance (overdue ones land today), drawn as a dashed line after the real one.
- **Container queries for layout**: pages react to the width of the content area, not the window, so they hold up with the sidebar open in a narrow browser.
- **Receipt reading with structured output**: `src/lib/server/receipt.ts` sends the image (or PDF) to `claude-opus-5-5` at `low` effort with a Zod schema as the output format, so the reply is validated JSON. The server still checks every value (category must belong to the user and match the type, date not in the future, amount positive) and matches the payer to an existing client. Nothing is saved until the person reviews the form. A per-user limit (30 per hour) caps spend; one reading costs roughly one US cent. Server-side refusal fallback is enabled (`fallbacks: "default"`).
- **Savings envelopes are virtual**: a box only marks part of the balance as reserved. The server refuses to reserve more than is free or withdraw more than a box holds, so the free balance never lies.
- **CSV safe for Excel**: cells starting with `=`, `+`, `-` or `@` are prefixed so a malicious transaction title cannot run as a formula on the accountant's computer.
- **Demo account in Postgres**: serverless functions share no memory, so the demo lives in the database and is re-seeded daily or when visitors delete most of it.

## API

```
GET    /api/health
POST   /api/auth/register | /login | /demo | /logout
GET    /api/auth/me
GET    /api/transactions?type=&category=&startDate=&endDate=
POST   /api/transactions
GET    /api/transactions/:id
PUT    /api/transactions/:id
DELETE /api/transactions/:id
GET    /api/categories          POST /api/categories
PUT    /api/categories/:id      DELETE /api/categories/:id?moveTo=
GET    /api/accounts            POST /api/accounts
PUT    /api/accounts/:id        DELETE /api/accounts/:id?moveTo=
GET    /api/recurrences         POST /api/recurrences
PUT    /api/recurrences/:id     DELETE /api/recurrences/:id
POST   /api/recurrences/:id/pay   { dueDate, date, amount, account? }
GET    /api/clients             POST /api/clients
PUT    /api/clients/:id         DELETE /api/clients/:id
GET    /api/boxes               POST /api/boxes
PUT    /api/boxes/:id           DELETE /api/boxes/:id
POST   /api/boxes/:id/entries   { kind: deposit|withdraw, amount, date, note? }
GET    /api/share-links         POST /api/share-links
DELETE /api/share-links/:id     (revoke)
POST   /api/receipts/scan       multipart file (image or PDF, max 5 MB)

GET    /contador/:token         read-only close for the accountant (?mes=AAAA-MM or ?ano=AAAA)
GET    /contador/:token/csv     same period as CSV
```

## Author

**Samara Caldas** · [LinkedIn](https://linkedin.com/in/samaracaldas) · [GitHub](https://github.com/samaracaldas)
