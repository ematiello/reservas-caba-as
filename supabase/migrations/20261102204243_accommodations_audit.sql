-- Owners read their own activity (S4 of odd/tasks/gestion-propietario-superadmin.md): properties,
-- categories and units now land in the audit log like bookings and rates do. Media rows are not
-- audited (their files are the change; a row per photo adds noise, not accountability).
-- Additive. Rollback: drop the three triggers below.
create trigger properties_audit after insert or update or delete on public.properties
  for each row execute function private.audit_row();
create trigger unit_categories_audit after insert or update or delete on public.unit_categories
  for each row execute function private.audit_row();
create trigger units_audit after insert or update or delete on public.units
  for each row execute function private.audit_row();
