-- Timbro database, part 2 of 5. Run the parts in order.
set search_path = timbro, extensions;

alter table events     enable row level security;

alter table admins     enable row level security;

create or replace function _hash(t text) returns text
language sql immutable set search_path = timbro, extensions
as $$ select encode(digest(t, 'sha256'), 'hex') $$;

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

create or replace function _profile() returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select coalesce(
    (select jsonb_build_object('name', contact_name, 'business', name, 'type', kind, 'city', city,
       'address', address, 'phone', phone, 'instagram', instagram) from businesses where owner_id = auth.uid()),
    (select jsonb_build_object('name', left(m->>'name', 60), 'business', left(m->>'business', 40), 'type', left(m->>'type', 20),
       'city', left(m->>'city', 40), 'address', left(m->>'address', 100), 'phone', left(m->>'phone', 30), 'instagram', left(m->>'instagram', 40))
     from (select coalesce(raw_user_meta_data, '{}'::jsonb) m from auth.users where id = auth.uid()) u),
    '{}'::jsonb)
$$;

create or replace function _new_business() returns uuid
language plpgsql security definer set search_path = timbro
as $$
declare p jsonb := _profile(); v uuid;
begin
  insert into businesses (owner_id, name, contact_name, phone, city, address, instagram, kind)
  values (auth.uid(), coalesce(p->>'business', ''), coalesce(p->>'name', ''), coalesce(p->>'phone', ''), coalesce(p->>'city', ''),
          coalesce(p->>'address', ''), coalesce(p->>'instagram', ''), coalesce(p->>'type', ''))
  on conflict (owner_id) do update set owner_id = excluded.owner_id
  returning id into v;
  return v;
end $$;

create or replace function _clean_design(d jsonb) returns jsonb
language sql immutable
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(coalesce(d, '{}'::jsonb))
  where key in ('style','color','ink','shape','mark','markText','empty','font','strip','tagline','icon','logo','stampImage','stripImage')
    and octet_length(value::text) < 1200000
$$;

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
