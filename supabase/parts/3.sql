-- Timbro database, part 3 of 5. Run the parts in order.
set search_path = timbro, extensions;

create or replace function get_my_card(p_code text, p_secret text) returns jsonb
language sql stable security definer set search_path = timbro
as $$
  select jsonb_build_object('customer', _customer_json(m), 'card', _card_json(c))
  from customers m join cards c on c.id = m.card_id
  where m.id = upper(p_code) and m.secret_hash = _hash(p_secret)
$$;

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
