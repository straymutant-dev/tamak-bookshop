<!-- STRAYMUTANT.DEV — Tamak Bookshop -->
# Tamak Bookshop

Retail and wholesale bookstore platform for **Tamak Bookshop, Kasoa, Ghana**: a public storefront, a vendor (wholesale) portal, and a staff/admin back-office with a counter POS.

Built by **STRAYMUTANT.DEV**.

| Site | URL | Audience |
|---|---|---|
| Customer site | `https://tamakbookshop.com` | Visitors, clients, vendors |
| Admin portal | `https://admin.tamakbookshop.com` | Staff and admins |

Both are served by **one Next.js deployment**. `src/lib/supabase/middleware.ts` reads the hostname and decides what each one shows.

---

## Stack

- **Next.js** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS v4** with custom brand tokens
- **Supabase**: Postgres, Auth, Storage, Row Level Security (`@supabase/ssr`)
- **Dexie** (IndexedDB) for the offline POS cache (scaffolded, not wired yet)
- **pnpm** as the package manager

## Getting started

```bash
pnpm install
pnpm dev
```

- Customer site: <http://localhost:3000>
- Admin portal: <http://admin.localhost:3000> (no hosts-file edit needed in Chrome, Edge or Firefox)

> On Windows, stop `pnpm dev` before moving or renaming files. The dev server locks watched files.

### Environment variables

Copy `.env.example` to `.env.local` in the project root and fill it in (never commit `.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # SECRET: server only
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=<generate with: openssl rand -base64 32>
```

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public by design; protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS. Never prefix with `NEXT_PUBLIC_`, never import into client components |
| `NEXT_PUBLIC_SITE_URL` | Used in signup-confirmation and invite email links. Baked in at build time, so redeploy after changing it |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | Public hCaptcha site key. Add it to Vercel for production |
| `CRON_SECRET` | Server-only secret for the protected weekly cache maintenance endpoint. Generate with `openssl rand -base64 32` and add it to Vercel |

Restart the dev server after editing `.env.local`.

### Scripts

```bash
pnpm dev      # development server
pnpm build    # production build (run before deploying; catches type errors)
pnpm start    # serve the production build
pnpm lint
```

## Project structure

```
src/
├── middleware.ts               # entry: calls updateSession()
├── app/
│   ├── (storefront)/           # /, /store, /store/cart, /store/track
│   ├── (auth)/                 # /auth/*, /admin-login
│   ├── (admin)/admin/…         # dashboard, inventory, pos, orders, approvals,
│   │                           # repayments,vendors, staff, team, activity
│   ├── account/                # client dashboard, orders, settings
│   ├── vendor/                 # vendor dashboard, wholesale cart
│   ├── about/
│   └── api/orders/track/
├── components/                 # admin/, store/, ui/
└── lib/
    ├── supabase/               # client.ts, server.ts, middleware.ts
    ├── actions/                # shared server actions
    ├── offline/db.ts           # Dexie (not wired yet)
    ├── cart/, currency.ts, orderStatus.ts, types.ts, database.types.ts
supabase/migrations/            # 01 … 22, the database history
```

Folders in parentheses are Next.js route groups: they organise code and layouts and do not appear in URLs.

## Roles

| Role | Access |
|---|---|
| `client` | Storefront, order tracking, own account |
| `vendor` | Wholesale prices and credit orders (after admin approval, within credit limit) |
| `staff` | POS, orders, approvals, repayments, inventory is view-only |
| `admin` | All staff screens plus catalog editing, vendors, staff invites, activity log |
| super admin | `admin` with `profiles.is_super_admin = true`; can also invite and demote admins |

`role` and `is_super_admin` can only be changed by a server action using the service-role key (enforced by a database trigger).

### Creating the first super admin

1. Supabase Dashboard → Authentication → Users → **Add user** (tick *Auto Confirm User*).
2. In the SQL Editor:

```sql
update public.profiles
set role = 'admin', is_super_admin = true
where id = (select id from auth.users where email = 'YOUR-EMAIL');
```

3. Sign in at <http://admin.localhost:3000/login>, then use `/team` and `/staff` to invite others.

## Database

Migrations live in `supabase/migrations` and are applied in numeric order. They describe the live project; do not edit an applied migration. Every schema change is a **new** numbered file.

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <project-ref>
pnpm dlx supabase db push
pnpm dlx supabase gen types typescript --linked > src/lib/database.types.ts
```

`src/lib/database.types.ts` is the source of truth for table and column names. Regenerate it after every migration, and use it instead of guessing names.

## Conventions

- Every first-party source file starts with `// STRAYMUTANT.DEV — Tamak Bookshop`.
- Money is **integer pesewas** (GHS × 100). Format only at the display edge with `lib/currency.ts`.
- Never trust prices, stock, or roles sent from the browser. Re-check on the server.
- Privileged actions write a row to `audit_logs`.
- After any Supabase write, make sure it actually changed a row. RLS can deny a write without raising an error.
- Use `<Link>` or `<button>` for navigation and actions.

## Deployment

Hosting is **Vercel** (one project, three domains: `tamakbookshop.com`, `www`, and `admin`) with Supabase as the backend. Step-by-step instructions, including DNS, Supabase URL settings, SMTP and email templates, are in `docs/04-DEPLOYMENT-AND-DOMAIN.md`.

## Performance and security

Supabase public book-cover images use Next.js image optimization with responsive AVIF/WebP output and a seven-day optimized-image cache. New cover uploads use unique storage paths so updated covers do not reuse an old optimized image.

`next.config.ts` applies the site-wide Content Security Policy and browser security headers. The policy allows the integrations currently used by the app: Supabase, hCaptcha and Vercel Analytics. Review and update it whenever a new external service is introduced.

The production build script explicitly uses Webpack (`next build --webpack`) so the Vercel Analytics Next.js entrypoint resolves consistently in the current Next.js toolchain.

### hCaptcha setup

The app renders hCaptcha on sign-in, registration, password-reset, and account-security forms. Supabase Auth validates the submitted token using the hCaptcha secret; the secret belongs in Supabase only, not in this app or Vercel.

1. In the hCaptcha dashboard, create or open the site and allow each hostname you use: local development (`localhost`), `tamakbookshop.vercel.app`, and your production domains (`tamakbookshop.com`, `www.tamakbookshop.com`, and `admin.tamakbookshop.com`).
2. Set `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` to the site's **Sitekey** in `.env.local` for local work and in Vercel for every deployed environment that serves the site. This is a public key.
3. In Supabase, open **Authentication → Protection**, enable CAPTCHA protection, choose **hCaptcha**, and enter the site's **Secret key**. Save the setting. Do not put this secret in a `NEXT_PUBLIC_` variable.
4. Restart the local dev server after changing `.env.local`. Deploy after adding the Vercel environment variable and Supabase provider setting.
5. Test login, signup and password recovery locally and on the deployed hostname. The hCaptcha sitekey must allow the hostname being tested, and the secret configured in Supabase must belong to that same hCaptcha site.

If a CAPTCHA secret is ever exposed in a screenshot, chat, source file, or browser code, rotate it in hCaptcha immediately and replace it in Supabase.

## Cookie and storage behaviour

The site uses essential browser storage for authentication, cart operation, security checks and the cookie notice itself. It does not use advertising or optional analytics cookies and therefore does not require a separate cookie-acceptance choice before essential functionality can be used.

The Privacy Policy describes the browser storage and third-party security services used by the platform. Optional tracking, analytics or advertising services must be added and consented separately if they are introduced later.

## Weekly cache maintenance

`vercel.json` schedules `/api/maintenance/cache-refresh` every Sunday at `23:00 UTC`.

The maintenance endpoint first checks the public `/`, `/store`, `/about`, `/terms` and `/privacy` routes. If all routes respond successfully, it revalidates those routes and the root layout in Next.js. This refreshes the deployed CDN/Next.js cache without clearing users' browser data, browser storage, Supabase sessions, carts, orders or uploaded files.

Before deployment, configure `CRON_SECRET` as a server-only Vercel environment variable. Vercel sends the secret as a bearer token to the protected endpoint. Cache maintenance is only activated when the deployed health checks succeed.

## Documentation

Keep these in a `docs/` folder:

| File | Contents |
|---|---|
| `TAMAK-BOOKSHOP-PRODUCTION.md` | Status record: what is built, open problems, unfinished work |
| `01-PROJECT-OVERVIEW.md` | What the system is and where it stands |
| `02-ARCHITECTURE.md` | Routing, auth flows, database, known issues |
| `03-LOCAL-SETUP.md` | Running locally, env vars, migrations, first admin |
| `04-DEPLOYMENT-AND-DOMAIN.md` | Domain purchase, Vercel, `admin.` subdomain, email |
| `05-ROADMAP-AND-CHECKLISTS.md` | Pre-launch fixes, remaining work, test plan, launch checklist |

## Status

Core features are built: authentication and roles, catalog and inventory, storefront checkout, vendor credit flow, POS with receipt printing, orders, approvals, repayments, staff and admin management, and audit logging.

Not started: returns UI, offline POS sync, credit sales at the POS, online payments, and order notifications.

Not yet deployed. See `docs/05-ROADMAP-AND-CHECKLISTS.md` for the fixes required before launch.