-- A refund is money going out: like voiding a payment, only an owner or admin records it. Operators
-- keep recording deposits and payments (CLAUDE.md: operators handle no sensitive payments).
drop policy booking_payments_insert on public.booking_payments;

create policy booking_payments_insert on public.booking_payments for insert to authenticated
  with check (
    private.can_operate_org(org_id)
    and (kind <> 'refund' or private.can_manage_org(org_id))
  );
