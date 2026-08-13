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

-- ---------------------------------------------------------------------------
-- uji_dada — meniru petugas meja yang MENGETIK nomor dada (migrasi 0011).
--
-- Sejak nomor dada tidak lagi diterbitkan sistem, setiap pemanggilan
-- daftar_ulang_batch harus membawa pasangan regu -> nomor. Di lapangan
-- angkanya berasal dari kain fisik; di tes kita pilih nomor terkecil yang
-- masih tersedia, supaya angka yang muncul di assertion tetap sama seperti
-- sebelum manual — yang diuji adalah aturannya, bukan selera petugas.
-- ---------------------------------------------------------------------------
create function uji_dada(p_kode text) returns jsonb language sql as $$
  with menunggu as (
    select r.id, row_number() over (order by r.nama_regu, r.id) as urut
    from regu r
    join pendaftaran d on d.id = r.pendaftaran_id
    where d.kode_pembayaran = p_kode and not r.batal and r.nomor_dada is null
  ),
  tersedia as (
    select s.nomor, row_number() over (order by s.nomor) as urut
    from nomor_dada_stok s
    where not exists (select 1 from regu x where x.nomor_dada = s.nomor)
      and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'regu_id', m.id, 'nomor_dada', t.nomor) order by t.nomor), '[]'::jsonb)
  from menunggu m
  join tersedia t on t.urut = m.urut;
$$;
grant execute on function uji_dada(text) to authenticated, service_role;
