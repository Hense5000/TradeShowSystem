# Trade Show System

A multi-tenant web app: every customer company gets its own **account** that
its users log in to. Inside an account users are invited, given a role and
keep the company profile up to date; billing and features follow in the next steps.

## Kort fortalt (dansk)

- Hver kunde er en **konto** (i koden hedder det `Organization`). En bruger kan være med i flere konti.
- Roller: **Owner** (alt, inkl. betaling), **Admin** (brugere, profil, funktioner), **Member** (bruger systemet).
- Brugere inviteres med et link, som en admin kopierer og sender. Automatisk e-mail kommer senere.
- **Exhibition centers** (og senere messer, arrangører og udstillere) er én fælles liste for alle konti. Alle kan se den; kun e-mails i `PLATFORM_ADMIN_EMAILS` kan rette i den.
- **Feature control** (menuen "Super admin") ses kun af e-mails i `PLATFORM_ADMIN_EMAILS`. Her oprettes kommende funktioner. De starter slukket (skjult for kunder) og kan tændes for udvalgte konti eller for alle.
- **AI trade show finder** (Feature control → AI trade show finder): læser events-siden (Local events URL) for de messecentre, der er sat flueben ved, ca. én gang om måneden, og foreslår nye messer. Forslagene kommer på en godkendelsesliste; intet kommer på messelisten, før en super admin godkender det. Kræver `ANTHROPIC_API_KEY` og `CRON_SECRET` i Vercel.
- Kortoplysninger gemmes aldrig hos os. De ligger i Stripe, og vi gemmer kun Stripes id'er.

## Status

| Step | What | State |
| --- | --- | --- |
| 1 | Login, accounts, users with roles, invitations | ✅ done |
| 2 | Company profile and primary contact, approved design applied | ✅ done |
| – | Shared directory: exhibition centers (list, search, add, edit, CSV import) | ✅ done |
| – | Shared directory: exhibition organizers (same features) | ✅ done |
| – | Shared directory: trade shows (status follows the dates) | ✅ done |
| – | Shared directory: exhibitors per trade show; trade shows linked to their exhibition center | ✅ done |
| – | Super admin feature control: add upcoming features, switch them on for selected accounts or everyone | ✅ done |
| – | AI trade show finder: reads chosen centers' events pages monthly and suggests new trade shows for approval | ✅ this version |
| 3 | Stripe: payment methods, subscriptions, invoices, webhooks | data model ready |
| 4 | Selectable features | data model ready |

## Design

Approved in September 2026: white left sidebar with the current page as a solid
blue pill, light grey page, white cards, and the logo blue (`#287bbf`) as the only
accent colour. Green, amber and red are only used for small status badges. The
tokens live in `src/app/globals.css`; logo files are in `public/brand`.

## Tech

- [Next.js](https://nextjs.org) 16 (App Router, server actions) + TypeScript
- PostgreSQL via [Prisma](https://www.prisma.io)
- [Auth.js](https://authjs.dev) (email + password, signed-cookie sessions)
- Tailwind CSS
- Stripe (from step 3)

## Run it locally

You need Node.js 22 and Docker (for the database).

```bash
cp .env.example .env          # then set AUTH_SECRET: npx auth secret
docker compose up -d          # starts PostgreSQL
npm install
npm run db:migrate            # creates the tables
npm run db:seed               # adds example features
npm run dev                   # http://localhost:3000
```

Other commands: `npm test`, `npm run typecheck`, `npm run build`, `npm run db:studio` (browse the database).

## How it fits together

```
prisma/schema.prisma        data model (users, accounts, roles, invitations, contacts, features, Stripe mirrors)
src/auth.ts                 login configuration
src/lib/tenant.ts           requireUser / requireMembership: every account page goes through these
src/lib/permissions.ts      who may do what (pure functions, unit tested)
src/app/signup, login       sign up (creates an account + owner) and log in
src/app/accounts            list of your accounts, create another
src/app/a/[slug]            inside one account: overview and users
src/app/invite/[token]      accept an invitation
```

**Tenant isolation.** Account URLs look like `/a/<slug>`. Every page and
action under it calls `requireMembership(slug)`, which returns 404 unless the
signed-in user is a member, and every query is filtered by that account's id.

**AI trade show finder.** A Vercel cron job (`vercel.json`) calls
`/api/cron/show-finder` daily with `CRON_SECRET`. When the finder is switched
on, it checks each chosen center that is due: on its own day of the month
(`showsCheckDay`, caught up the next day if that run didn't reach it), or,
without a day, when its last check is four weeks old. Admins can also check a
single center right away from the list. For each center it it
downloads the events page, turns it into plain text (`src/lib/show-finder.ts`)
and asks Claude for the trade shows on it (`src/lib/show-finder-run.ts`).
Shows that match a known show or an earlier suggestion (same name ignoring
years, start within two weeks) are skipped; the rest become `SuggestedShow`
rows that a platform admin approves or rejects. Pages that only render their
events with JavaScript can't be read this way and show an error on the page.

**Invitations.** The link contains a random token; only its SHA-256 hash is
stored. Links expire after 7 days, work once, and only for the invited email.
Re-inviting the same email withdraws the previous link.

**Roles.** An account always keeps at least one owner. Admins can invite and
manage admins and members, but cannot touch owners or create new ones.

**Stripe (coming).** Card data never touches this app: payment methods are
added through Stripe Checkout / Customer Portal, and webhooks keep the
`Subscription` and `Invoice` tables in sync. `StripeEvent` records handled
webhook events so repeats are ignored.

## Deploy (Vercel + Neon)

1. Import the GitHub repo in Vercel.
2. Under **Storage**, add a **Neon** Postgres database and connect it to the
   project. This sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`
   (direct, used for migrations) automatically.
3. Under **Settings → Environment Variables**, add `AUTH_SECRET`
   (generate one with `npx auth secret` or `openssl rand -base64 32`).
4. Redeploy. Vercel runs `npm run vercel-build`, which applies database
   migrations (`prisma migrate deploy`) before building.

`APP_URL` is optional on Vercel; invitation links fall back to the project's
production domain. Add it once you use your own domain.
