-- ============================================================================
-- hrcd-rekap : tests/sql/00_harness.sql
-- Tiruan lingkungan Supabase untuk PostgreSQL polos, supaya migrasi bisa
-- diuji lokal tanpa Docker: schema auth + auth.uid() + peran anon /
-- authenticated / service_role.
--
-- auth.uid() Supabase membaca klaim JWT; tiruan ini membaca setting sesi
-- app.uid — tes berpindah identitas dengan:
--   set local app.uid = '<uuid>';  set local role authenticated;
-- ============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique
);

create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('app.uid', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant anon, authenticated, service_role to current_user;
