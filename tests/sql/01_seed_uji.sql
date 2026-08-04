-- ============================================================================
-- hrcd-rekap : tests/sql/01_seed_uji.sql
-- Akun uji + data contoh yang dipakai seluruh berkas tes.
-- ============================================================================

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin.ciradyka@uji.local'),
  ('00000000-0000-0000-0000-000000000001', 'pos1hrcd37@uji.local'),
  ('00000000-0000-0000-0000-000000000002', 'pos2hrcd37@uji.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'meja1hrcd37@uji.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'meja2hrcd37@uji.local'),
  ('00000000-0000-0000-0000-0000000000ff', 'nonaktif@uji.local');

insert into akun_panitia (user_id, username, peran, pos, aktif) values
  ('00000000-0000-0000-0000-00000000000a', 'admin.ciradyka', 'admin',        null, true),
  ('00000000-0000-0000-0000-000000000001', 'pos1hrcd37',     'operator_pos', 1,    true),
  ('00000000-0000-0000-0000-000000000002', 'pos2hrcd37',     'operator_pos', 2,    true),
  ('00000000-0000-0000-0000-0000000000b1', 'meja1hrcd37',    'meja',         null, true),
  ('00000000-0000-0000-0000-0000000000b2', 'meja2hrcd37',    'meja',         null, true),
  ('00000000-0000-0000-0000-0000000000ff', 'lama_hrcd36',    'meja',         null, false);
