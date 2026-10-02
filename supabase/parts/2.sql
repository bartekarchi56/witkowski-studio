-- Timbro database, part 2 of 5. Run the parts in order.
set search_path = timbro, extensions;

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
