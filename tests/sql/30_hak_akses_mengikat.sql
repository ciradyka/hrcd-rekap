-- ============================================================================
-- hrcd-rekap : tests/sql/30_hak_akses_mengikat.sql
-- Centang di layar Akun benar-benar jadi pagar (migrasi 0064).
--
-- KENAPA TES 25 TIDAK CUKUP
--
-- Tes 25 memeriksa `boleh('pembayaran')` mengembalikan true untuk akun
-- registrasi. Itu menguji FUNGSINYA, bukan pintunya. Selama policy dan RPC
-- masih membandingkan `peran()` dengan nama peran, `boleh()` boleh benar
-- sepenuhnya sementara layarnya tetap lumpuh — dan itulah yang terjadi antara
-- 0058 dan 0064: tes 25 hijau, setiap peran selain admin tidak bisa apa-apa.
--
-- CARA TES INI MEMBUKTIKANNYA
--
-- Panggilan yang SAMA PERSIS dijalankan dua kali oleh akun yang sama. Yang
-- berubah hanya satu baris di `akun_hak` — persis yang dilakukan centang di
-- layar Akun. Kalau pesan galatnya berubah dari "kode pembayaran tidak
-- dikenal" (lolos penjaga, gagal di isinya) jadi "tidak berhak: pembayaran",
-- berarti centang itulah yang menahannya. Kalau tidak berubah, pagarnya tidak
-- ada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RPC: mencabut centang menutup pintunya.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_registrasi uuid := '00000000-0000-0000-0000-0000000000b1';
  v_pesan      text;
begin
  perform set_config('app.uid', v_registrasi::text, true);

  -- Masih tercentang: penjaganya lolos, yang menolak adalah kodenya.
  begin
    perform verifikasi_pembayaran('TIDAK-ADA-KODE-INI', 250000, 'tunai');
    assert false, 'kode karangan seharusnya ditolak';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%kode pembayaran tidak dikenal%',
         format('penjaga seharusnya sudah lolos, galatnya justru: %s', v_pesan);

  -- Cabut satu centang. Ini yang dilakukan admin di layar Akun.
  delete from akun_hak where user_id = v_registrasi and fitur = 'pembayaran';

  -- Panggilan yang sama persis.
  begin
    perform verifikasi_pembayaran('TIDAK-ADA-KODE-INI', 250000, 'tunai');
    assert false, 'seharusnya ditolak penjaga';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%tidak berhak: pembayaran%',
         format('centang seharusnya jadi pagarnya, galatnya: %s', v_pesan);

  -- Kembalikan.
  insert into akun_hak (user_id, fitur) values (v_registrasi, 'pembayaran')
  on conflict do nothing;
end $blok$;

-- ---------------------------------------------------------------------------
-- 2. Juri pos bisa bekerja — inilah yang lumpuh antara 0058 dan 0064.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_juri  uuid := '00000000-0000-0000-0000-000000000001';
  v_pesan text;
begin
  perform set_config('app.uid', v_juri::text, true);

  -- Nomor dada karangan: penjaganya harus sudah lewat, jadi yang menolak
  -- adalah nomornya. Sebelum 0064 galatnya "hanya operator pos / admin" —
  -- juri pos tidak pernah sampai ke barisnya sendiri.
  -- simpan_nilai_massal MENGUMPULKAN galat per baris, tidak melempar; jadi
  -- yang diperiksa bukan "ia gagal", melainkan "ia tidak gagal karena hak".
  begin
    perform simpan_nilai_massal(
      jsonb_build_array(jsonb_build_object(
        'nomor_dada', 999, 'kode', 'apa_saja', 'nilai_1', 1)),
      'manual');
    v_pesan := '(lolos tanpa galat)';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan not like '%hanya operator pos%',
         format('juri pos seharusnya lolos penjaga, galatnya: %s', v_pesan);
  assert v_pesan not like '%tidak berhak%',
         format('juri pos punya centang pos, galatnya: %s', v_pesan);

  -- Dan posnya tetap posnya sendiri: p_pos yang disebut sengaja diabaikan.
  -- Ini yang dulu dijaga `peran() = 'operator_pos'`; sekarang dijaga
  -- `pos_saya() is not null`, dan hasilnya harus sama.
  begin
    perform simpan_nilai_massal(
      jsonb_build_array(jsonb_build_object(
        'nomor_dada', 999, 'kode', 'apa_saja', 'nilai_1', 1)),
      'manual', 5::smallint);
    v_pesan := '(lolos tanpa galat)';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan not like '%tidak berhak%',
         'menyebut p_pos tidak boleh membuat juri pos ditolak';

  -- Cabut centang pos: sekarang tertutup.
  delete from akun_hak where user_id = v_juri and fitur = 'pos';
  begin
    perform simpan_nilai_massal(
      jsonb_build_array(jsonb_build_object(
        'nomor_dada', 999, 'kode', 'apa_saja', 'nilai_1', 1)),
      'manual');
    v_pesan := '(lolos tanpa galat)';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%tidak berhak: pos%',
         format('centang pos seharusnya jadi pagarnya, galatnya: %s', v_pesan);

  insert into akun_hak (user_id, fitur) values (v_juri, 'pos')
  on conflict do nothing;
end $blok$;

-- ---------------------------------------------------------------------------
-- 3. Policy juga, bukan cuma RPC. Yang dijaga di sini RLS-nya: baris yang
--    terbaca, bukan galat yang muncul.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_registrasi uuid := '00000000-0000-0000-0000-0000000000b1';
  v_sebelum    int;
  v_sesudah    int;
begin
  set local role authenticated;
  perform set_config('app.uid', v_registrasi::text, true);
  select count(*) into v_sebelum from pendaftaran;

  reset role;
  delete from akun_hak
   where user_id = v_registrasi
     and fitur in ('pendaftaran','pembayaran','daftar_ulang','cetak_kloter','pengaturan');

  set local role authenticated;
  perform set_config('app.uid', v_registrasi::text, true);
  select count(*) into v_sesudah from pendaftaran;

  reset role;
  insert into akun_hak (user_id, fitur)
  select v_registrasi, unnest(array['pendaftaran','pembayaran','daftar_ulang','cetak_kloter'])
  on conflict do nothing;

  assert v_sebelum > 0, 'fixture kosong — tes ini tidak menguji apa pun';
  assert v_sesudah = 0,
         format('tanpa centang seharusnya nol baris terbaca, terbaca %s', v_sesudah);
end $blok$;

-- ---------------------------------------------------------------------------
-- 4. Tidak ada lagi yang menyebut nama peran yang sudah tidak ada.
--
--    Memindai katalog, bukan berkas migrasi: yang dijaga adalah apa yang
--    BENAR-BENAR terpasang. Satu saja yang lolos berarti satu layar lumpuh.
-- ---------------------------------------------------------------------------
do $blok$
declare r record; v_n int := 0;
begin
  for r in
    select 'policy'::text as jenis,
           schemaname || '.' || tablename || '.' || policyname as nama
      from pg_policies
     where coalesce(qual, '') || coalesce(with_check, '') ~ '''meja''|''operator_pos'''
    union all
    select 'fungsi', p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosrc ~ '''meja''|''operator_pos'''
       and p.proname <> 'paket_peran'
  loop
    v_n := v_n + 1;
    raise notice '30: MASIH menyebut peran lama — % %', r.jenis, r.nama;
  end loop;
  assert v_n = 0, format('%s objek masih menyebut peran lama', v_n);
end $blok$;

\echo '30 hak akses mengikat: LULUS'
