-- Phase 3 follow-up: the amenities catalog is edited only by the platform admin, and platform
-- admin operations are audited. Rollback: drop trigger amenities_audit on public.amenities.
create trigger amenities_audit after insert or update or delete on public.amenities
  for each row execute function private.audit_row();
