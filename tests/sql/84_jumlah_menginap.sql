-- ============================================================================
-- hrcd-rekap : tests/sql/84_jumlah_menginap.sql — migrasi 0124.
--
-- Kotak di form berhenti menghitung pendamping saja dan menghitung TOTAL yang
-- menginap. Yang diuji di sini bukan labelnya melainkan akibatnya, karena
-- akibatnya tidak menimbulkan galat apa pun:
--
--   `susun_barak()` dulu memesan `regu aktif x 5 + angka itu`. Kalau rumusnya
--   tidak ikut diubah, peserta terhitung DUA KALI dan pembagian barak memesan
--   hampir dua kali lipat ruangan. Semuanya berjalan mulus sampai malam
--   sebelum lomba, saat ruangannya kurang.
--
-- Karena itu yang diperiksa adalah JUMLAH ORANG yang benar-benar ditempatkan,
-- bukan definisi fungsinya. Definisi bisa terbaca benar dan tetap salah.
--
-- Seluruhnya di-rollback.
-- ============================================================================

\echo '--- 84. total yang menginap, bukan jumlah pendamping'
\set ON_ERROR_STOP on

do $blok$
declare
  v_kode   text;
  v_id     uuid;
  v_orang  int;
  v_uid    uuid;
begin
  -- susun_barak() dipagari `boleh('pengaturan')`, jadi tesnya harus MENEMPATI
  -- kursi admin — bukan memanggilnya sebagai superuser tanpa identitas, yang
  -- akan lulus tanpa pernah menyentuh pagarnya. Akun admin uji dari 01_seed.
  v_uid := '00000000-0000-0000-0000-00000000000a';
  assert exists (select 1 from akun_panitia where user_id = v_uid),
    '84 GAGAL: akun admin uji tidak ada — tes ini tidak menempati kursi apa pun';
  perform set_config('app.uid', v_uid::text, true);

  -- Empat regu, dan angka menginap 23: dua puluh peserta ditambah tiga
  -- pembina, persis seperti yang akan diketik pembina di form baru.
  v_kode := (submit_pendaftaran('SMP Uji Menginap', 'Jl. Uji', true, '081200000084',
              (select jsonb_agg(jsonb_build_object(
                 'nama_regu', format('Menginap %s', chr(64 + i)),
                 'nama_ketua', 'Ketua Uji',
                 'golongan', 'penegak_pa'))
               from generate_series(1, 4) i),
              23::smallint, gen_random_uuid(), 'Uji',
              'tunai', null)) ->> 'kode_pembayaran';

  select id into v_id from pendaftaran where kode_pembayaran = v_kode;
  assert (select jumlah_menginap from pendaftaran where id = v_id) = 23,
    '84.1 GAGAL: angka menginap tidak tersimpan apa adanya';

  update pendaftaran set status = 'lunas' where id = v_id;

  -- Ruangan yang cukup lapang supaya yang diuji pembagiannya, bukan kapasitas.
  insert into room (name, capacity) values ('UJI 84 A', 200)
  on conflict do nothing;

  perform susun_barak();

  select coalesce(sum(jumlah_orang), 0) into v_orang
  from penempatan_barak where pendaftaran_id = v_id;

  -- 43 = 4 regu x 5 + 23, angka yang keluar kalau rumus lamanya dibiarkan.
  assert v_orang <> 43,
    '84.2 GAGAL: peserta dihitung dua kali — susun_barak() masih menambahkan '
    'regu x 5 di atas angka yang sudah memuat peserta';
  assert v_orang = 23,
    format('84.2 GAGAL: %s orang ditempatkan, seharusnya 23 — angka yang '
           'diketik sekolah, apa adanya', v_orang);

  -- 84.3 Yang mengubahnya di meja ikut berganti nama, dan bentuk lamanya
  -- benar-benar hilang. Dua nama untuk satu perbuatan adalah cara separuh
  -- kode memanggil yang tidak lagi diperbaiki.
  perform ubah_jumlah_menginap(v_kode, 30::smallint);
  assert (select jumlah_menginap from pendaftaran where id = v_id) = 30,
    '84.3 GAGAL: ubah_jumlah_menginap tidak mengubah angkanya';
  assert not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ubah_pendamping'),
    '84.3 GAGAL: ubah_pendamping masih ada';

  raise exception 'ROLLBACK UJI 84';
exception when others then
  if sqlerrm <> 'ROLLBACK UJI 84' then raise; end if;
end;
$blok$;

\echo '    84 LULUS'
