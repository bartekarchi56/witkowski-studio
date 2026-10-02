-- ============================================================================
-- Timbro database (Supabase / Postgres)
--
-- Run this once in Supabase: Dashboard → SQL Editor → paste → Run.
-- It is safe to run again: it replaces the functions and keeps your data.
--
-- Everything lives in its own schema, `timbro`, so it can share a Supabase
-- project with another app without touching that app's tables (`public`).
-- In Supabase: Project Settings → API (Data API) → Exposed schemas → add `timbro`.
--
-- Security model: nobody reads or writes the tables directly (row level
-- security is on with no policies). Everything goes through the functions
-- below, and each function checks who is calling:
--   • customers   prove who they are with the secret saved on their phone
--   • cashiers    use a token their phone got when the owner linked it
--   • owners      are logged in with Supabase Auth (email)
--   • designers   are owners listed in the `admins` table (Witkowski Design)
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists timbro;
set search_path = timbro, extensions;
-- New functions here are private until granted below.
alter default privileges in schema timbro revoke execute on functions from public;

-- ---------------------------------------------------------------- tables --

create table if not exists businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique,                 -- auth.users.id
  name        text not null default '',
  created_at  timestamptz not null default now()
);

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
alter table events     enable row level security;
alter table admins     enable row level security;

-- --------------------------------------------------------------- helpers --

create or replace function _hash(t text) returns text
language sql immutable set search_path = timbro, extensions
as $$ select encode(digest(t, 'sha256'), 'hex') $$;

-- Random code from an alphabet without look-alike characters (no 0/O, 1/I).
create or replace function _code(len int) returns text
language plpgsql volatile set search_path = timbro, extensions
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := gen_random_bytes(len);
  out text := '';
begin
  for i in 0 .. len - 1 loop
    out := out || substr(chars, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;

create or replace function _token() returns text
language sql volatile set search_path = timbro, extensions
as $$ select encode(gen_random_bytes(24), 'hex') $$;

create or replace function _is_admin() returns boolean
language sql stable security definer set search_path = timbro
as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

create or replace function _my_business() returns uuid
language sql stable security definer set search_path = timbro
as $$ select id from businesses where owner_id = auth.uid() $$;

-- The design keys the website uses (assets/js/store.js DESIGN_KEYS).
create or replace function _clean_design(d jsonb) returns jsonb
language sql immutable
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(coalesce(d, '{}'::jsonb))
  where key in ('style','color','ink','shape','mark','markText','empty','font','strip','tagline','icon','logo','stampImage','stripImage')
    and octet_length(value::text) < 1200000
$$;

-- A card as the website expects it (same shape as the browser demo).
create or replace function _card_json(c cards, with_review boolean default false) returns jsonb
language sql stable
as $$
  select c.design || jsonb_build_object(
    'id', c.id, 'business', c.business, 'city', c.city, 'type', c.type,
    'title', c.title, 'reward', c.reward, 'titleEn', c.title_en, 'rewardEn', c.reward_en,
    'stampsNeeded', c.stamps_needed, 'plan', c.plan,
    'createdAt', (extract(epoch from c.created_at) * 1000)::bigint,
    'updatedAt', (extract(epoch from c.updated_at) * 1000)::bigint
  ) || case when with_review and c.review is not null then jsonb_build_object('review', c.review) else '{}'::jsonb end
$$;

create or replace function _customer_json(m customers, history_limit int default 5) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', m.id, 'cardId', m.card_id, 'name', m.name, 'stamps', m.stamps, 'redeemed', m.redeemed,
    'joinedAt', (extract(epoch from m.joined_at) * 1000)::bigint,
    'lastVisit', (extract(epoch from m.last_visit) * 1000)::bigint,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('t', (extract(epoch from e.created_at) * 1000)::bigint, 'type', e.type, 'n', e.n) order by e.created_at)
      from (select * from events where customer_id = m.id order by created_at desc limit history_limit) e
    ), '[]'::jsonb)
  )
$$;

create or replace function _device(p_token text) returns devices
language plpgsql security definer set search_path = timbro
as $$
declare d devices;
begin
  select * into d from devices where token_hash = _hash(p_token);
  if not found then raise exception 'This phone is not linked to a café any more. Ask the owner to link it again.' using errcode = '28000'; end if;
  update devices set last_used = now() where id = d.id;
  return d;
end $$;

-- ------------------------------------------------------ customers (anon) --

create or replace function get_card(p_card_id text) returns jsonb
language sql stable security definer set search_path = timbro
as $$ select _card_json(c) from cards c where c.id = lower(p_card_id) $$;

create or replace function join_card(p_card_id text, p_name text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare
  v_code text; v_secret text := _token();
begin
  if not exists (select 1 from cards where id = lower(p_card_id)) then
    raise exception 'This card no longer exists.' using errcode = 'P0002';
  end if;
  loop
    v_code := _code(6);
    exit when not exists (select 1 from customers where id = v_code);
  end loop;
  insert into customers (id, card_id, name, secret_hash)
  values (v_code, lower(p_card_id), coalesce(nullif(left(trim(p_name), 30), ''), 'Guest'), _hash(v_secret));
  insert into events (customer_id, type) values (v_code, 'joined');
  return jsonb_build_object('id', v_code, 'secret', v_secret);
end $$;

create or replace function get_my_card(p_code text, p_secret text) returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c))
  from customers m join cards c on c.id = m.card_id
  where m.id = upper(p_code) and m.secret_hash = _hash(p_secret)
$$;

-- -------------------------------------------------------- cashiers (anon) --

create or replace function device_link(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare
  v_biz uuid; v_token text := _token(); v_name text;
begin
  delete from link_codes where expires_at < now();
  delete from link_codes where code = upper(trim(p_code)) returning business_id into v_biz;
  if v_biz is null then raise exception 'This code has expired or was already used. Ask the owner for a new one.' using errcode = '28000'; end if;
  insert into devices (business_id, name, token_hash) values (v_biz, coalesce(nullif(left(trim(p_name), 40), ''), 'Cassa'), _hash(v_token));
  select name into v_name from businesses where id = v_biz;
  return jsonb_build_object('token', v_token, 'business', v_name);
end $$;

create or replace function stamper_lookup(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare d devices := _device(p_token); r jsonb;
begin
  select jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c)) into r
  from customers m join cards c on c.id = m.card_id
  where m.id = upper(trim(p_code)) and c.business_id = d.business_id;
  return r;   -- null: no card with this code at this café
end $$;

create or replace function stamper_stamp(p_token text, p_code text, p_delta int) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare d devices := _device(p_token); m customers; c cards; v_next int;
begin
  select m2.* into m from customers m2 join cards c2 on c2.id = m2.card_id
  where m2.id = upper(trim(p_code)) and c2.business_id = d.business_id for update of m2;
  if not found then raise exception 'No customer with that code.' using errcode = 'P0002'; end if;
  select * into c from cards where id = m.card_id;
  v_next := greatest(0, least(c.stamps_needed, m.stamps + sign(p_delta)::int));
  if v_next <> m.stamps then
    update customers set stamps = v_next, last_visit = now() where id = m.id returning * into m;
    insert into events (customer_id, device_id, type, n) values (m.id, d.id, case when p_delta > 0 then 'stamp' else 'unstamp' end, 1);
  end if;
  return jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c));
end $$;

create or replace function stamper_redeem(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare d devices := _device(p_token); m customers; c cards;
begin
  select m2.* into m from customers m2 join cards c2 on c2.id = m2.card_id
  where m2.id = upper(trim(p_code)) and c2.business_id = d.business_id for update of m2;
  if not found then raise exception 'No customer with that code.' using errcode = 'P0002'; end if;
  select * into c from cards where id = m.card_id;
  if m.stamps < c.stamps_needed then raise exception 'This card is not full yet.' using errcode = 'P0001'; end if;
  update customers set stamps = 0, redeemed = redeemed + 1, last_visit = now() where id = m.id returning * into m;
  insert into events (customer_id, device_id, type) values (m.id, d.id, 'redeem');
  return jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c));
end $$;

-- ------------------------------------------------- owners (authenticated) --

-- Everything the dashboard needs: the owner's cards, customers and phones.
create or replace function owner_data() returns jsonb
language plpgsql stable security definer set search_path = timbro
as $$
declare v_biz uuid := _my_business();
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  return jsonb_build_object(
    'isAdmin', _is_admin(),
    'cards', coalesce((select jsonb_agg(_card_json(c, true) order by c.created_at) from cards c where c.business_id = v_biz), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(_customer_json(m, 200)) from customers m join cards c on c.id = m.card_id where c.business_id = v_biz), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'lastUsed', (extract(epoch from d.last_used) * 1000)::bigint) order by d.created_at) from devices d where d.business_id = v_biz), '[]'::jsonb)
  );
end $$;

-- Create or update a card's texts. Design and plan are not changed here.
create or replace function owner_save_card(p_card jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare
  v_biz uuid := _my_business(); c cards; v_id text := lower(p_card->>'id');
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  if v_biz is null then
    insert into businesses (owner_id, name) values (auth.uid(), coalesce(p_card->>'business', '')) returning id into v_biz;
  end if;
  select * into c from cards where id = v_id;
  if found and c.business_id <> v_biz then raise exception 'This card belongs to another café.' using errcode = '42501'; end if;
  if not found then
    insert into cards (id, business_id, design) values (v_id, v_biz, _clean_design(p_card->'design'));
  end if;
  update cards set
    business = left(coalesce(p_card->>'business', business), 40),
    city = left(coalesce(p_card->>'city', city), 40),
    type = left(coalesce(p_card->>'type', type), 20),
    title = left(coalesce(p_card->>'title', title), 40),
    reward = left(coalesce(p_card->>'reward', reward), 60),
    title_en = left(coalesce(p_card->>'titleEn', title_en), 40),
    reward_en = left(coalesce(p_card->>'rewardEn', reward_en), 60),
    stamps_needed = greatest(3, least(20, coalesce((p_card->>'stampsNeeded')::int, stamps_needed))),
    updated_at = now()
  where id = v_id returning * into c;
  update businesses set name = c.business where id = v_biz;   -- the name the till phones show
  return _card_json(c, true);
end $$;

-- Start plan: propose a new design. Plus/Pro: ask for a change in words.
create or replace function owner_send_design(p_card_id text, p_kind text, p_design jsonb, p_note text, p_images jsonb, p_links jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  select * into c from cards where id = lower(p_card_id) and business_id = _my_business();
  if not found then raise exception 'Card not found.' using errcode = 'P0002'; end if;
  if jsonb_array_length(coalesce(p_images, '[]')) > 8 then raise exception 'Up to 8 images.'; end if;
  update cards set review = jsonb_build_object(
    'status', 'pending',
    'kind', case when p_kind = 'request' then 'request' else 'proposal' end,
    'design', case when p_kind = 'request' then '{}'::jsonb else _clean_design(p_design) end,
    'note', left(coalesce(p_note, ''), 2000),
    'images', coalesce(p_images, '[]'::jsonb),
    'links', coalesce(p_links, '[]'::jsonb),
    'sentAt', (extract(epoch from now()) * 1000)::bigint,
    'reply', '')
  where id = c.id returning * into c;
  return _card_json(c, true);
end $$;

-- A one-time code (valid 15 minutes) to link a cashier's phone.
create or replace function owner_link_code() returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare v_biz uuid := _my_business(); v_code text;
begin
  if v_biz is null then raise exception 'Create your card first.' using errcode = 'P0002'; end if;
  delete from link_codes where business_id = v_biz or expires_at < now();
  v_code := _code(8);
  insert into link_codes (code, business_id, expires_at) values (v_code, v_biz, now() + interval '15 minutes');
  return jsonb_build_object('code', v_code, 'expiresAt', (extract(epoch from now() + interval '15 minutes') * 1000)::bigint);
end $$;

create or replace function owner_remove_device(p_device_id uuid) returns void
language sql security definer set search_path = timbro
as $$ delete from devices where id = p_device_id and business_id = _my_business() $$;

-- ------------------------------------------- Witkowski Design (admins) --

create or replace function admin_cards() returns jsonb
language plpgsql stable security definer set search_path = timbro
as $$
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can open the Studio.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(_card_json(c, true) order by c.created_at) from cards c), '[]'::jsonb);
end $$;

-- Publish a design (approving a proposal, or the designer's own work).
create or replace function admin_publish(p_card_id text, p_design jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can publish designs.' using errcode = '42501'; end if;
  update cards set design = design || _clean_design(p_design),
    review = jsonb_build_object('status', 'approved', 'at', (extract(epoch from now()) * 1000)::bigint, 'reply', ''),
    updated_at = now()
  where id = lower(p_card_id) returning * into c;
  return _card_json(c, true);
end $$;

create or replace function admin_ask_changes(p_card_id text, p_reply text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can reply.' using errcode = '42501'; end if;
  update cards set review = coalesce(review, '{}'::jsonb) || jsonb_build_object('status', 'changes', 'reply', left(coalesce(p_reply, ''), 2000), 'at', (extract(epoch from now()) * 1000)::bigint)
  where id = lower(p_card_id) returning * into c;
  return _card_json(c, true);
end $$;

-- Plans come from the subscription; until payments exist the designer sets them.
create or replace function admin_set_plan(p_card_id text, p_plan text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can change plans.' using errcode = '42501'; end if;
  update cards set plan = p_plan where id = lower(p_card_id) returning * into c;
  return _card_json(c, true);
end $$;

-- ----------------------------------------------------------- permissions --

-- Only inside the timbro schema: other apps in this project are not touched.
grant usage on schema timbro to anon, authenticated;
revoke all on all tables in schema timbro from anon, authenticated;
revoke execute on all functions in schema timbro from public, anon, authenticated;

grant execute on function get_card(text), join_card(text, text), get_my_card(text, text),
  device_link(text, text), stamper_lookup(text, text), stamper_stamp(text, text, int), stamper_redeem(text, text)
  to anon, authenticated;

grant execute on function owner_data(), owner_save_card(jsonb), owner_send_design(text, text, jsonb, text, jsonb, jsonb),
  owner_link_code(), owner_remove_device(uuid),
  admin_cards(), admin_publish(text, jsonb), admin_ask_changes(text, text), admin_set_plan(text, text)
  to authenticated;

-- ---------------------------------------------------------- after setup --
-- Make your own account a designer (run once, after signing up on the site):
--   insert into timbro.admins (user_id) select id from auth.users where email = 'you@example.com';
