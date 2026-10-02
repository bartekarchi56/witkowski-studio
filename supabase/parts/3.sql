-- Timbro database, part 3 of 5. Run the parts in order.
set search_path = timbro, extensions;

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
