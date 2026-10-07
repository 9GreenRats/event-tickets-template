# event-tickets-template

Ticketed-event site launched by FastWeb (site kind `event`). Organizers run
any number of events: list page, per-event pages with tiers, Paystack
checkout, and a multi-event admin. Buyer money goes to the organizer's own
Paystack account — FastWeb never touches it.

## Publish as a template (owner, once) — DONE v1.0.0

1. ~~Push this directory as its own repository~~ — live at
   `9GreenRats/event-tickets-template`, public, tagged `v1.0.0`.
2. ~~Mark it as a Template Repository~~ — `is_template: true` confirmed via API.
3. On the FastWeb API: `TICKETS_TEMPLATE_REPO_*` unset means defaults
   (`9GreenRats/event-tickets-template`) — set them only to override.
   Preflight verified: readable, is-template, `0001_init.sql` present.

## Contract with the FastWeb launch

The launch writes these env vars into the client's Vercel project — the app
must read exactly these names:

| Var | Use |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser reads (event, tiers) |
| `SUPABASE_SERVICE_ROLE_KEY` | server routes only (orders, admin) |
| `ADMIN_EMAIL` | organizer login; also pinned into `admin_config` |
| `NEXT_PUBLIC_SITE_URL` | Paystack `callback_url` base |
| `NEXT_PUBLIC_SITE_KIND` | always `event` here |
| `DB_TABLE_SUFFIX` | `none` (unsuffixed tables) |
| `PAYMENT_PROVIDER` | `paystack` |
| `PAYSTACK_SECRET_KEY` | organizer's own key, added in builder Step 6 |
| `RESEND_API_KEY` / `EMAIL_FROM` | receipts (optional) |

`0001_init.sql` must create `site_settings` (`site_name, tagline,
description`, row `id = true`), `admin_config` (`admin_email`), `events`,
`ticket_tiers`, `ticket_orders`, and the `event-images` bucket — the launch
verifies all five tables and the bucket, and writes the admin email + site
identity itself.

## Sample content (design iteration, onboarding)

`supabase/seed-sample.sql` inserts two published SAMPLE events (one public
venue, one gated) with tiers in every state — sold out included. Run it in
the SQL editor after `0001_init.sql`. Every field is editable in `/admin`;
delete the rows when done. Events without a cover get deterministic
generated artwork (`src/lib/placeholder.ts`) until one is uploaded.

## Payments (organizer's own Paystack)

No relay involved: the organizer adds `<site>/api/webhook` in their own
Paystack dashboard (builder Step 6 shows the address). References are
`fw-tk-…`, `metadata.app = 'tickets'`.

## Develop

```bash
npm install
cp .env.example .env.local   # fill from a launched site's Vercel env
npm run dev
```
