-- Timbro database, part 1 of 5. Run the parts in order.
create extension if not exists pgcrypto with schema extensions;

create schema if not exists timbro;

set search_path = timbro, extensions;

alter default privileges in schema timbro revoke execute on functions from public;

create table if not exists businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique,                 -- auth.users.id
  name        text not null default '',
  created_at  timestamptz not null default now()
);

alter table businesses add column if not exists contact_name text not null default '';

alter table businesses add column if not exists phone        text not null default '';

alter table businesses add column if not exists city         text not null default '';

alter table businesses add column if not exists address      text not null default '';

alter table businesses add column if not exists instagram    text not null default '';

alter table businesses add column if not exists kind         text not null default '';

create table if not exists cards (
  id             text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  business_id    uuid not null references businesses(id) on delete cascade,
  business       text not null default '',
  city           text not null default '',
  type           text not null default 'caffe',
  title          text not null default '',
  reward         text not null default '',
  title_en       text not null default '',
  reward_en      text not null default '',
  stamps_needed  int  not null default 10 check (stamps_needed between 3 and 20),
  design         jsonb not null default '{}'::jsonb,  -- colours, stamp, logo… (see DESIGN_KEYS)
  plan           text not null default 'start' check (plan in ('start','plus','pro')),
  review         jsonb,                               -- design proposal / request / reply
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists customers (
  id           text primary key check (id ~ '^[A-Z0-9]{6}$'),   -- the code under the QR
  card_id      text not null references cards(id) on delete cascade,
  name         text not null default 'Guest',
  secret_hash  text not null,                                   -- sha256 of the phone's secret
  stamps       int  not null default 0,
  redeemed     int  not null default 0,
  joined_at    timestamptz not null default now(),
  last_visit   timestamptz
);

create index if not exists customers_card on customers(card_id);

create table if not exists devices (                           -- cashiers' phones
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  name         text not null default '',
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used    timestamptz
);

create table if not exists link_codes (                        -- one-time codes to link a phone
  code         text primary key,
  business_id  uuid not null references businesses(id) on delete cascade,
  expires_at   timestamptz not null
);

create table if not exists events (
  id           bigint generated always as identity primary key,
  customer_id  text not null references customers(id) on delete cascade,
  device_id    uuid references devices(id) on delete set null,
  type         text not null check (type in ('joined','stamp','unstamp','redeem')),
  n            int  not null default 1,
  created_at   timestamptz not null default now()
);

create index if not exists events_customer on events(customer_id, created_at);

create table if not exists admins (user_id uuid primary key);   -- Witkowski Design accounts

alter table businesses enable row level security;

alter table cards      enable row level security;

alter table customers  enable row level security;

alter table devices    enable row level security;

alter table link_codes enable row level security;
