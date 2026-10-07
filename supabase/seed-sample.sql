-- Sample content for design iteration and organizer onboarding.
--
-- Run in the Supabase SQL editor AFTER 0001_init.sql. Everything is
-- SAMPLE-prefixed and draft-safe: flip an event to published to see it.
-- Delete any row when done — the admin console manages all of this.
-- Every field below is editable in /admin (event copy, tiers, prices,
-- reveal setting, cover upload).

begin;

-- Event 1: public venue, mixed tiers (one sold out to show the state).
insert into events (slug, title, tagline, description, venue, address, city, starts_at, doors_at, status, venue_reveal)
values (
  'sample-founders-mixer',
  'Sample Founders Mixer',
  'An evening for builders, operators and the curious.',
  'Three hours of demos, sharp conversations and good music.' || chr(10) || chr(10) ||
  '• 5 live demos from local startups' || chr(10) ||
  '• Founder speed-meet at 7pm' || chr(10) ||
  '• Food, drinks and an after-mix DJ set' || chr(10) || chr(10) ||
  'Come solo — leave with collaborators. Edit every word of this page in /admin: title, tagline, description bullets, venue, dates and tiers.',
  'The Nest Hub',
  '14 Adeola Odeku Street, Victoria Island',
  'Lagos',
  now() + interval '21 days',
  now() + interval '21 days' - interval '1 hour',
  'published',
  'public'
)
on conflict (slug) do nothing;

insert into ticket_tiers (event_id, name, description, price_kobo, capacity, sold, sort, status)
select id, t.name, t.description, t.price_kobo, t.capacity, t.sold, t.sort, t.status
from events e,
(values
  ('Early Bird', 'First 50 seats. Same night, better price.', 500000, 50, 31, 0, 'active'),
  ('General', 'Main floor access, demos plus mixer.', 1000000, 150, 42, 1, 'active'),
  ('Backstage', 'Green-room access plus founders dinner.', 2500000, 20, 20, 2, 'soldout')
) as t(name, description, price_kobo, capacity, sold, sort, status)
where e.slug = 'sample-founders-mixer'
  and not exists (select 1 from ticket_tiers where event_id = e.id);

-- Event 2: gated venue, free tier (shows reveal-after-purchase + claim flow).
insert into events (slug, title, tagline, description, venue, address, city, starts_at, doors_at, status, venue_reveal)
values (
  'sample-secret-sessions',
  'Sample Secret Sessions',
  'A private listening night. Location revealed with your ticket.',
  'An intimate evening of unreleased music and conversation.' || chr(10) || chr(10) ||
  '• Unreleased tracks, played loud' || chr(10) ||
  '• Q&A with the artists' || chr(10) ||
  '• Small room, limited seats' || chr(10) || chr(10) ||
  'The venue stays hidden until you hold a ticket. Flip Venue reveal to public in /admin to compare.',
  'The Bunker',
  '7 Hidden Close, Yaba',
  'Lagos',
  now() + interval '35 days',
  now() + interval '35 days' - interval '1 hour',
  'published',
  'after_purchase'
)
on conflict (slug) do nothing;

insert into ticket_tiers (event_id, name, description, price_kobo, capacity, sold, sort, status)
select id, t.name, t.description, t.price_kobo, t.capacity, t.sold, t.sort, t.status
from events e,
(values
  ('Entry', 'One seat in the room.', 0, 40, 12, 0, 'active'),
  ('Front Row', 'First three rows plus a drink.', 1500000, 12, 3, 1, 'active')
) as t(name, description, price_kobo, capacity, sold, sort, status)
where e.slug = 'sample-secret-sessions'
  and not exists (select 1 from ticket_tiers where event_id = e.id);

commit;
