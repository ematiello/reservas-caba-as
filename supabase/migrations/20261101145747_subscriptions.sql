-- Phase 2: plans, subscriptions, manual payments, grace days, discounts, lifecycle with pg_cron,
-- and suspension through org_is_active(). Plan prices and limits are data the platform admin
-- creates in /admin (D22). Trial days default to 7 (product rule, docs/01); grace days start at
-- a provisional 0 until the commercial decision, and both are editable in /admin (D22).
-- Forward-only; rollback = unschedule the cron job, restore the Phase 1 versions of org_is_active,
-- review_organization and accept_invitation, then drop the new objects in reverse order.

-- ---------------------------------------------------------------- extensions
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------- types
create type public.subscription_status as enum ('trial', 'active', 'past_due', 'suspended', 'cancelled');
create type public.payment_method as enum ('cash', 'transfer', 'mercadopago', 'other');

-- ---------------------------------------------------------------- tables
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 60),
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'ARS' check (currency = 'ARS'),
  -- null = unlimited
  max_units integer check (max_units is null or max_units > 0),
  max_members integer check (max_members is null or max_members > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Single row with the platform-wide defaults the admin edits.
create table public.platform_settings (
  id boolean primary key default true check (id),
  trial_days integer not null default 7 check (trial_days between 1 and 90),
  -- Provisional value until the commercial decision; editable in /admin.
  default_grace_days integer not null default 0 check (default_grace_days between 0 and 60),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings default values;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  plan_id uuid references public.plans (id),
  status public.subscription_status not null default 'trial',
  trial_ends_at date,
  current_period_start date not null,
  -- Exclusive: the account is paid up to the day before current_period_end.
  current_period_end date not null,
  grace_days integer not null check (grace_days between 0 and 60),
  discount_pct numeric(5, 2) check (discount_pct > 0 and discount_pct <= 100),
  discount_cents bigint check (discount_cents > 0),
  discount_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start),
  check (discount_pct is null or discount_cents is null),
  check (discount_until is null or discount_pct is not null or discount_cents is not null)
);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);
create index subscriptions_status_period_idx on public.subscriptions (status, current_period_end);

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'ARS' check (currency = 'ARS'),
  method public.payment_method not null,
  paid_at date not null,
  period_start date not null,
  period_end date not null,
  recorded_by uuid references auth.users (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  check (period_end > period_start)
);
create index subscription_payments_org_id_idx on public.subscription_payments (org_id, paid_at desc);
create index subscription_payments_subscription_id_idx on public.subscription_payments (subscription_id);

-- ---------------------------------------------------------------- helpers
-- Subscription dates are local to Argentina.
create function private.today_ar()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Active = approved organization with a live subscription. The date is checked too, so a lapsed
-- account is read-only even before the daily lifecycle job runs.
create or replace function private.org_is_active(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.organizations o
      join public.subscriptions s on s.org_id = o.id
     where o.id = p_org
       and o.status = 'active'
       and s.status in ('trial', 'active', 'past_due')
       and private.today_ar() < s.current_period_end + s.grace_days
  );
$$;

-- True when the organization's plan caps collaborators and the cap is already reached.
create function private.org_member_limit_reached(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.max_members <= (select count(*) from public.memberships m where m.org_id = p_org)
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
     where s.org_id = p_org and p.max_members is not null
  ), false);
$$;

revoke execute on function private.today_ar(), private.touch_updated_at(),
  private.org_member_limit_reached(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- triggers
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function private.touch_updated_at();
create trigger platform_settings_touch before update on public.platform_settings
  for each row execute function private.touch_updated_at();

create trigger plans_audit after insert or update or delete on public.plans
  for each row execute function private.audit_row();
create trigger platform_settings_audit after update on public.platform_settings
  for each row execute function private.audit_row();
create trigger subscriptions_audit after insert or update or delete on public.subscriptions
  for each row execute function private.audit_row();
create trigger subscription_payments_audit after insert or update or delete on public.subscription_payments
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------- backfill
-- Organizations approved during Phase 1 start a trial now, so they do not become read-only.
insert into public.subscriptions (org_id, status, trial_ends_at, current_period_start, current_period_end, grace_days)
select o.id, 'trial', private.today_ar() + s.trial_days, private.today_ar(), private.today_ar() + s.trial_days,
       s.default_grace_days
  from public.organizations o
 cross join public.platform_settings s
 where o.status = 'active';

-- ---------------------------------------------------------------- RPCs
-- Superadmin review. Approving starts the trial; the plan is optional and can be assigned later.
drop function public.review_organization(uuid, boolean);
create function public.review_organization(p_org uuid, p_approve boolean, p_plan uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.platform_settings;
  v_today date := private.today_ar();
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_approve and p_plan is not null
     and not exists (select 1 from public.plans where id = p_plan and is_active) then
    raise exception 'plan not found or inactive' using errcode = 'P0002';
  end if;
  update public.organizations
     set status = case when p_approve then 'active'::public.org_status else 'rejected'::public.org_status end,
         approved_at = case when p_approve then now() end,
         approved_by = case when p_approve then (select auth.uid()) end
   where id = p_org and status = 'pending_approval';
  if not found then
    raise exception 'organization not found or not pending' using errcode = 'P0002';
  end if;
  if p_approve then
    select * into v_settings from public.platform_settings;
    insert into public.subscriptions
      (org_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, grace_days)
    values
      (p_org, p_plan, 'trial', v_today + v_settings.trial_days, v_today, v_today + v_settings.trial_days,
       v_settings.default_grace_days)
    on conflict (org_id) do nothing;
  end if;
end;
$$;

-- Manual payment recorded by the Superadmin. Monthly periods by anniversary: an account still in
-- good standing on the payment date continues from the end of its current period; a lapsed one
-- (suspended, cancelled, or past its grace days) restarts on the payment date. Reactivates.
create function public.record_subscription_payment(
  p_org uuid,
  p_amount_cents bigint,
  p_method public.payment_method,
  p_paid_at date,
  p_months integer default 1,
  p_notes text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.subscriptions;
  v_start date;
  v_end date;
  v_payment uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  if p_months is null or p_months not between 1 and 24 then
    raise exception 'months must be between 1 and 24' using errcode = '22023';
  end if;
  if p_paid_at is null or p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'invalid payment' using errcode = '22023';
  end if;

  select * into v_sub from public.subscriptions where org_id = p_org for update;
  if not found then
    raise exception 'subscription not found' using errcode = 'P0002';
  end if;

  if v_sub.status in ('trial', 'active', 'past_due')
     and p_paid_at < v_sub.current_period_end + v_sub.grace_days then
    v_start := v_sub.current_period_end;
  else
    v_start := p_paid_at;
  end if;
  v_end := (v_start + make_interval(months => p_months))::date;

  update public.subscriptions
     set status = 'active', current_period_start = v_start, current_period_end = v_end
   where id = v_sub.id;

  insert into public.subscription_payments
    (org_id, subscription_id, amount_cents, method, paid_at, period_start, period_end, recorded_by, notes)
  values
    (p_org, v_sub.id, p_amount_cents, p_method, p_paid_at, v_start, v_end, (select auth.uid()),
     nullif(trim(p_notes), ''))
  returning id into v_payment;
  return v_payment;
end;
$$;

-- Manual suspension by the Superadmin. Data is kept; a payment reactivates the account.
create function public.suspend_subscription(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin required' using errcode = '42501';
  end if;
  update public.subscriptions set status = 'suspended'
   where org_id = p_org and status in ('trial', 'active', 'past_due');
  if not found then
    raise exception 'subscription not found or not live' using errcode = 'P0002';
  end if;
end;
$$;

-- Daily job (pg_cron). Idempotent. p_today lets tests simulate dates; only service_role may call it.
create function public.run_subscription_lifecycle(p_today date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, private.today_ar());
  v_past_due integer;
  v_suspended integer;
begin
  update public.subscriptions set status = 'past_due'
   where status in ('trial', 'active') and v_today >= current_period_end;
  get diagnostics v_past_due = row_count;

  update public.subscriptions set status = 'suspended'
   where status = 'past_due' and v_today >= current_period_end + grace_days;
  get diagnostics v_suspended = row_count;

  return jsonb_build_object('past_due', v_past_due, 'suspended', v_suspended);
end;
$$;

-- Whether the caller's organization accepts writes (for read-only banners). Members and the
-- Superadmin only; anyone else gets false.
create function public.org_access_active(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (p_org in (select private.user_org_ids()) or private.is_platform_admin())
     and private.org_is_active(p_org);
$$;

-- Accepts an invitation link. Same as Phase 1 plus the plan's collaborator cap.
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitations;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select * into v_inv from public.invitations
   where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
     and accepted_at is null and revoked_at is null and expires_at > now()
   for update;
  if not found or not private.org_is_active(v_inv.org_id) then
    raise exception 'invalid or expired invitation' using errcode = 'P0002';
  end if;
  if not exists (
       select 1 from public.memberships where org_id = v_inv.org_id and user_id = (select auth.uid())
     ) and private.org_member_limit_reached(v_inv.org_id) then
    raise exception 'member limit reached' using errcode = 'P0001';
  end if;
  -- Never downgrade an existing member.
  insert into public.memberships (org_id, user_id, role)
  values (v_inv.org_id, (select auth.uid()), v_inv.role)
  on conflict (org_id, user_id) do nothing;
  update public.invitations set accepted_by = (select auth.uid()), accepted_at = now() where id = v_inv.id;
  return v_inv.org_id;
end;
$$;

revoke execute on function public.review_organization(uuid, boolean, uuid),
  public.record_subscription_payment(uuid, bigint, public.payment_method, date, integer, text),
  public.suspend_subscription(uuid),
  public.run_subscription_lifecycle(date),
  public.org_access_active(uuid)
  from public, anon, authenticated;
grant execute on function public.review_organization(uuid, boolean, uuid),
  public.record_subscription_payment(uuid, bigint, public.payment_method, date, integer, text),
  public.suspend_subscription(uuid),
  public.org_access_active(uuid)
  to authenticated;
grant execute on function public.run_subscription_lifecycle(date) to service_role;

-- ---------------------------------------------------------------- privileges
revoke all on public.plans, public.platform_settings, public.subscriptions, public.subscription_payments
  from anon, authenticated;

grant select on public.plans to anon, authenticated;
grant insert (name, price_cents, max_units, max_members, is_active) on public.plans to authenticated;
grant update (name, price_cents, max_units, max_members, is_active) on public.plans to authenticated;
grant select, update (trial_days, default_grace_days) on public.platform_settings to authenticated;
grant select on public.subscriptions, public.subscription_payments to authenticated;
-- Status and periods change only through the RPCs above.
grant update (plan_id, grace_days, discount_pct, discount_cents, discount_until)
  on public.subscriptions to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.plans enable row level security;
alter table public.platform_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

create policy plans_select_anon on public.plans
  for select to anon using (is_active);
create policy plans_select on public.plans
  for select to authenticated using (is_active or private.is_platform_admin());
create policy plans_insert on public.plans
  for insert to authenticated with check (private.is_platform_admin());
create policy plans_update on public.plans
  for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

create policy platform_settings_select on public.platform_settings
  for select to authenticated using (true);
create policy platform_settings_update on public.platform_settings
  for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

create policy subscriptions_select on public.subscriptions
  for select to authenticated using (
    private.has_org_role(org_id, array['owner']::public.member_role[]) or private.is_platform_admin()
  );
create policy subscriptions_update on public.subscriptions
  for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

create policy subscription_payments_select on public.subscription_payments
  for select to authenticated using (
    private.has_org_role(org_id, array['owner']::public.member_role[]) or private.is_platform_admin()
  );
-- subscription_payments: no write policies or grants; only record_subscription_payment inserts.

-- ---------------------------------------------------------------- schedule
-- 03:00 in Argentina (UTC-3) = 06:00 UTC. cron.schedule with an existing name replaces the job.
select cron.schedule('subscription-lifecycle', '0 6 * * *', $$select public.run_subscription_lifecycle()$$);
