# Pocketbook

Personal bookkeeping for web, iPhone, and Android. Built with Next.js and Turso, ready for Vercel. Mobile delivery is an installable web app (PWA), not an App Store or Play Store binary.

## Local development

Run `npm install` and `npm run dev`. Without database configuration, development uses `bookkeeping.db`, a local SQLite database. New accounts start with an empty ledger; the public preview and interactive demo use the supplied example without saving it.

## Production

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the linked Vercel project, then run `vercel --prod`. Production on Vercel requires Turso and never falls back to a local file. Tables are created additively on first database use. Do not commit credentials.

Password recovery uses a question and a private answer. Signed-in users can set both in Profile; answers are stored as salted scrypt hashes. Accounts without a personal question use the default admin recovery question. Set `ADMIN_RECOVERY_PASSWORD_HASH` in each deployment environment to enable that fallback. Generate it with the same salted scrypt format as account passwords (`salt:hash`), using the admin recovery password normalized to lowercase and trimmed. Keep this value secret and do not commit it. Successful recovery signs out existing sessions.

Each account owns its transactions and receipts. Amounts are stored as integer centavos, displayed in PHP. Cash on bank is lifetime credit minus debit, assuming a zero opening balance; record an opening balance as income if needed. Filters affect ledger rows and exported totals, while summary cards remain lifetime totals. Subscription entries record payments, not automatic billing or renewal schedules.

Receipts accept JPG, PNG, WebP, and PDF up to 2 MB and are stored in Turso with authenticated downloads. Passwords use salted scrypt; sessions use random tokens stored as hashes with 30-day expiration. Authentication attempts are limited by email. Email verification is not included in this version.

## Mobile

On iPhone use Safari → Share → Add to Home Screen. On Android use Chrome → Install app. HTTPS is required outside localhost. Data is shared across devices using the same account. Network access is required; the service worker shows an offline page without caching private records.

## Checks

`npm run typecheck`, `npm test`, `npm run build`.
