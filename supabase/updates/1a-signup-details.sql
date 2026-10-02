-- Timbro update 1, part A (October 2026): sign-up details (name, phone, address...).
-- Paste in Supabase SQL Editor and Run. Safe to run again. Then run 1b.
set search_path = timbro, extensions;

alter table businesses add column if not exists contact_name text not null default '';
alter table businesses add column if not exists phone        text not null default '';
alter table businesses add column if not exists city         text not null default '';
alter table businesses add column if not exists address      text not null default '';
alter table businesses add column if not exists instagram    text not null default '';
alter table businesses add column if not exists kind         text not null default '';

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

-- Creates the logged-in owner's café, filled in with their sign-up details.
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

create or replace function owner_data() returns jsonb
language plpgsql stable security definer set search_path = timbro
as $$
declare v_biz uuid := _my_business();
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  return jsonb_build_object(
    'isAdmin', _is_admin(),
    'profile', _profile(),
    'cards', coalesce((select jsonb_agg(_card_json(c, true) order by c.created_at) from cards c where c.business_id = v_biz), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(_customer_json(m, 200)) from customers m join cards c on c.id = m.card_id where c.business_id = v_biz), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'lastUsed', (extract(epoch from d.last_used) * 1000)::bigint) order by d.created_at) from devices d where d.business_id = v_biz), '[]'::jsonb)
  );
end $$;
