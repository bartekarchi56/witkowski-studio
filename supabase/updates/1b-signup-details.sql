-- Timbro update 1, part B (October 2026): sign-up details (name, phone, address...).
-- Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

create or replace function owner_save_card(p_card jsonb) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare
  v_biz uuid := _my_business(); c cards; v_id text := lower(p_card->>'id');
begin
  if auth.uid() is null then raise exception 'Not logged in.' using errcode = '28000'; end if;
  if v_biz is null then
    v_biz := _new_business();
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

create or replace function admin_cards() returns jsonb
language plpgsql stable security definer set search_path = timbro
as $$
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can open the Studio.' using errcode = '42501'; end if;
  -- Each card comes with its owner's contact details, so you can get in touch.
  return coalesce((select jsonb_agg(_card_json(c, true) || jsonb_build_object('contact', jsonb_build_object(
      'name', b.contact_name, 'email', u.email, 'phone', b.phone, 'city', b.city, 'address', b.address, 'instagram', b.instagram))
    order by c.created_at)
    from cards c join businesses b on b.id = c.business_id left join auth.users u on u.id = b.owner_id), '[]'::jsonb);
end $$;

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
