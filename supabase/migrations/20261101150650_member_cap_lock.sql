-- Phase 2 follow-up: the plan's collaborator cap must hold under concurrent acceptances.
-- Two invitations accepted at the same time could both see count = cap - 1 and both insert.
-- Locking the organization row serializes acceptances for that organization.
-- Rollback: re-create accept_invitation from 20261101145747_subscriptions.sql.

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
  -- Serialize acceptances per organization before counting members.
  perform 1 from public.organizations where id = v_inv.org_id for update;
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
