-- Timbro update 3 (October 2026): remembers when a café cancels (it runs until the period ends).
-- Paste in Supabase SQL Editor and Run. Safe to run again.
set search_path = timbro, extensions;

alter table businesses add column if not exists billing_canceling   boolean not null default false;  -- cancelled, ends at billing_period_end

create or replace function _billing_json(b businesses) returns jsonb
language sql stable
as $$
  select jsonb_build_object('status', b.billing_status, 'plan', b.billing_plan, 'interval', b.billing_interval,
    'periodEnd', (extract(epoch from b.billing_period_end) * 1000)::bigint, 'trialUsed', b.trial_used,
    'customer', b.stripe_customer is not null, 'canceling', b.billing_canceling)
$$;

drop function if exists stripe_sync(text, text, text, text, text, bigint);   -- older version without p_canceling

create or replace function stripe_sync(p_customer text, p_subscription text, p_status text, p_plan text, p_interval text, p_period_end bigint,
  p_canceling boolean default false)
returns uuid
language plpgsql security definer set search_path = timbro
as $$
declare v_biz uuid;
begin
  update businesses set stripe_subscription = p_subscription, billing_status = coalesce(p_status, ''),
    billing_plan = coalesce(p_plan, ''), billing_interval = coalesce(p_interval, ''),
    billing_period_end = case when p_period_end is null then null else to_timestamp(p_period_end) end,
    trial_used = trial_used or p_status is not null, billing_canceling = coalesce(p_canceling, false)
  where stripe_customer = p_customer returning id into v_biz;
  if v_biz is not null and p_status in ('trialing', 'active', 'past_due') and p_plan in ('start', 'plus', 'pro') then
    update cards set plan = p_plan where business_id = v_biz;
  end if;
  return v_biz;
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

grant usage on schema timbro to service_role;

grant execute on function stripe_business(uuid), stripe_set_customer(uuid, text),
  stripe_sync(text, text, text, text, text, bigint, boolean), stripe_is_admin(uuid) to service_role;
