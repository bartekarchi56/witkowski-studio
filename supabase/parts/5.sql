-- Timbro database, part 5 of 5. Run the parts in order.
set search_path = timbro, extensions;

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

create or replace function admin_set_plan(p_card_id text, p_plan text) returns jsonb
language plpgsql security definer set search_path = timbro
as $$
declare c cards;
begin
  if not _is_admin() then raise exception 'Only Witkowski Design can change plans.' using errcode = '42501'; end if;
  update cards set plan = p_plan where id = lower(p_card_id) returning * into c;
  return _card_json(c, true);
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
