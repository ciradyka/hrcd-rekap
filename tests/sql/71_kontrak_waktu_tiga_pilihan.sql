-- ============================================================================
-- hrcd-rekap : tests/sql/71_kontrak_waktu_tiga_pilihan.sql
-- Tiga pilihan kontrak, pintu tulisnya mengikuti tabelnya, dan pagar 0109
-- benar-benar menahan.
--
-- Bagian 71.3 memanggil berkas 0109 yang SAMA PERSIS dengan yang dijalankan
-- ke produksi, dua kali: sekali dalam keadaan yang harus ditolaknya, sekali
-- dalam keadaan yang harus dikerjakannya. Menyalin syarat penjaganya ke sini
-- lalu memeriksa salinannya akan lulus selamanya — termasuk pada hari
-- seseorang menghapus penjaga aslinya. Panggilan kedua yang berhasil menutup
-- celah terakhir: berkas yang salah ketik juga gagal, dan juga tidak mengubah
-- apa pun.
-- ============================================================================

\set ON_ERROR_STOP on

select set_config('app.uid', (select user_id::text from akun_panitia
                              where peran = 'admin' and is_active limit 1), false);

-- ---------------------------------------------------------------------------
-- 71.1 dan 71.2 tidak menyentuh apa pun di luar dirinya.
-- ---------------------------------------------------------------------------
begin;

-- 71.1 Ketiganya, berurutan, dan tidak ada yang keempat.
do $$
declare v_isi text;
begin
  select string_agg(format('%s=%s', label, menit), ', ' order by sort_order)
    into v_isi
  from kontrak_opsi where edisi = edisi_aktif();
  assert v_isi = '3 jam=180, 3,5 jam=210, 4 jam=240',
    format('71.1: pilihan kontrak [%s]', coalesce(v_isi, 'kosong'));
end $$;

-- 71.2 Jalur tulis mengikuti TABELNYA, bukan daftar yang ditulis di kode.
--      Dropdown di layar bisa disunting dari devtools dalam sepuluh detik;
--      yang menegakkan harus konfirmasi_kontrak().
do $$
declare
  v_regu    uuid;
  v_ditolak boolean := false;
begin
  select r.id into v_regu
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled and d.status = 'lunas'
    and r.kloter_nomor is not null
    and not exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
  limit 1;

  if v_regu is null then
    raise notice '71.2 dilewati: tidak ada regu berkloter yang belum berangkat.';
    return;
  end if;

  perform konfirmasi_kontrak(v_regu, 180::smallint);
  assert (select kontrak_menit from regu where id = v_regu) = 180,
    '71.2: kontrak 3 jam ditolak padahal ia salah satu dari tiga pilihan';

  begin
    perform konfirmasi_kontrak(v_regu, 270::smallint);
  exception when others then
    v_ditolak := true;
  end;
  assert v_ditolak,
    '71.2: kontrak 4,5 jam masih diterima padahal sudah bukan pilihan edisi ini';
  assert (select kontrak_menit from regu where id = v_regu) = 180,
    '71.2: penolakan tetap mengubah kontrak yang sudah tersimpan';
end $$;

rollback;

-- ---------------------------------------------------------------------------
-- 71.3 PAGAR KONTRAK YATIM.
--
--      Sengaja TIDAK di dalam transaksi: berkas 0109 harus melihat keadaan
--      ini sudah tersimpan, dan galatnya sendiri membatalkan transaksi apa
--      pun yang sedang berjalan — jadi rollback bukan alat yang tersedia di
--      sini. Dibersihkan dengan tangan di 71.5.
--
--      Pilihannya dikembalikan ke bentuk LAMA lebih dulu. Tanpa itu,
--      "pilihannya tidak berubah" sesudah panggilan yang gagal tidak
--      membuktikan apa-apa — ia sudah bernilai target sejak awal.
-- ---------------------------------------------------------------------------
do $$
declare v_regu uuid;
begin
  delete from kontrak_opsi where edisi = edisi_aktif();
  insert into kontrak_opsi (edisi, label, menit, sort_order) values
    (edisi_aktif(), '3,5 jam', 210, 1),
    (edisi_aktif(), '4 jam',   240, 2),
    (edisi_aktif(), '4,5 jam', 270, 3);

  select r.id into v_regu from regu r where not r.is_cancelled limit 1;
  update regu set kontrak_menit = 270 where id = v_regu;
end $$;

-- Galat yang DIHARAPKAN. run.sh memakai ON_ERROR_STOP, jadi ia dimatikan
-- sebentar — persis pola tes 15 untuk 0036.
\set ON_ERROR_STOP off
\ir ../../supabase/migrations/0109_kontrak_waktu_tiga_pilihan.sql
\set ON_ERROR_STOP on

-- 71.4 Yang gagal TIDAK boleh mengubah setengah-setengah.
do $$
declare v_isi text;
begin
  select string_agg(format('%s=%s', label, menit), ', ' order by sort_order)
    into v_isi
  from kontrak_opsi where edisi = edisi_aktif();
  assert v_isi = '3,5 jam=210, 4 jam=240, 4,5 jam=270',
    format('71.4: 0109 tetap mengubah pilihan padahal ada kontrak yatim — [%s]',
           coalesce(v_isi, 'kosong'));
end $$;

-- 71.5 Kontraknya dibetulkan, lalu berkas yang SAMA harus berhasil.
do $$
begin
  update regu set kontrak_menit = 240 where kontrak_menit = 270;
end $$;

\ir ../../supabase/migrations/0109_kontrak_waktu_tiga_pilihan.sql

do $$
declare v_isi text;
begin
  select string_agg(format('%s=%s', label, menit), ', ' order by sort_order)
    into v_isi
  from kontrak_opsi where edisi = edisi_aktif();
  assert v_isi = '3 jam=180, 3,5 jam=210, 4 jam=240',
    format('71.5: 0109 tidak mengerjakan tugasnya sesudah kontrak yatim '
           'dibetulkan — [%s]', coalesce(v_isi, 'kosong'));
end $$;

select '71_kontrak_waktu_tiga_pilihan OK' as hasil;
