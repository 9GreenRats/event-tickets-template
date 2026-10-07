-- event-tickets-template schema.
--
-- Must create exactly what the FastWeb launch verifies (TICKETS_TABLES +
-- event-images bucket), plus the rows the launch writes itself:
--   admin_config.admin_email      (single row, updated by the launch)
--   site_settings                 (site_name, tagline, description; row id = true)
--
-- The launch also seeds one event row + one General tier from the builder
-- answers. Everything else is managed in the site's /admin.

begin;

create table if not exists site_settings (
  id          boolean primary key default true,
  site_name   text not null default 'My Event',
  tagline     text not null default '',
  description text not null default '',
  constraint site_settings_single_row check (id = true)
);

insert into site_settings (id) values (true) on conflict (id) do nothing;

create table if not exists admin_config (
  id          boolean primary key default true,
  admin_email text,
  constraint admin_config_single_row check (id = true)
);

insert into admin_config (id) values (true) on conflict (id) do nothing;

create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  tagline     text not null default '',
  description text not null default '',
  venue       text not null default '',
  address     text not null default '',
  city        text not null default '',
  starts_at   timestamptz,
  doors_at    timestamptz,
  ends_at     timestamptz,
  status      text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- 'after_purchase' hides venue + address + map link from the public page;
  -- buyers see them on their ticket after paying.
  venue_reveal text not null default 'public' check (venue_reveal in ('public', 'after_purchase')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists ticket_tiers (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events (id) on delete cascade,
  name        text not null,
  description text not null default '',
  price_kobo  integer not null default 0 check (price_kobo >= 0),
  capacity    integer not null default 100 check (capacity >= 0),
  sold        integer not null default 0 check (sold >= 0),
  sort        integer not null default 0,
  status      text not null default 'active' check (status in ('active', 'hidden', 'soldout')),
  created_at  timestamptz not null default now()
);

create table if not exists ticket_orders (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references events (id) on delete cascade,
  tier_id            uuid references ticket_tiers (id) on delete set null,
  email              text,
  qty                integer not null default 1 check (qty >= 1 and qty <= 10),
  amount_kobo        integer not null default 0,
  paystack_reference text unique not null,
  ticket_code        text unique not null,
  status             text not null default 'pending' check (status in ('pending', 'paid')),
  created_at         timestamptz not null default now()
);

create index if not exists ticket_tiers_event_idx on ticket_tiers (event_id, sort);
create index if not exists ticket_orders_event_idx on ticket_orders (event_id, created_at desc);
create index if not exists ticket_orders_ref_idx on ticket_orders (paystack_reference);

alter table site_settings enable row level security;
alter table admin_config enable row level security;
alter table events enable row level security;
alter table ticket_tiers enable row level security;
alter table ticket_orders enable row level security;

-- Service role only. The anon key reads the published event page through
-- the app's server routes; no direct table access is granted.
drop policy if exists "Service role full access" on site_settings;
create policy "Service role full access" on site_settings
  for all using (auth.role() = 'service_role');
drop policy if exists "Service role full access" on admin_config;
create policy "Service role full access" on admin_config
  for all using (auth.role() = 'service_role');
drop policy if exists "Service role full access" on events;
create policy "Service role full access" on events
  for all using (auth.role() = 'service_role');
drop policy if exists "Service role full access" on ticket_tiers;
create policy "Service role full access" on ticket_tiers
  for all using (auth.role() = 'service_role');
drop policy if exists "Service role full access" on ticket_orders;
create policy "Service role full access" on ticket_orders
  for all using (auth.role() = 'service_role');

-- Pictures bucket. Created here; the launch verifies it by name.
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

commit;
