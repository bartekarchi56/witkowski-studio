-- Timbro database, part 4 of 5. Run the parts in order.
set search_path = timbro, extensions;

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

create or replace function admin_cards() returns jsonb
language plpgsql stable security definer set search_path = timbro
as $$
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can open the Studio.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(_card_json(c, true) order by c.created_at) from cards c), '[]'::jsonb);
end $$;

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
