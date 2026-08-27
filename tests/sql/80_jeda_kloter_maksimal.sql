-- ============================================================================
-- hrcd-rekap : tests/sql/80_jeda_kloter_maksimal.sql — migrasi 0118.
-- Jendela keberangkatan adalah BATAS ATAS, bukan perintah menyebar.
--
-- Dua kloter di jendela 07:00-10:00 pernah terbaca "07:00 dan 10:00", seolah
-- kloter kedua menunggu tiga jam di lapangan. Yang diuji di sini dua arah
-- sekaligus, karena "maksimal" gampang sekali berubah jadi "selalu":
--
--   sedikit kloter -> jeda DIBATASI, kloter terakhir jauh sebelum ujung
--   banyak kloter  -> jeda apa adanya, kloter terakhir TEPAT di ujung
--
-- Konfigurasi edisi diubah di dalam transaksi lalu di-rollback, jadi tes ini
-- tidak meninggalkan jejak pada edisi uji.
-- ============================================================================

\echo '--- 80. jeda maksimal antar kloter'
\set ON_ERROR_STOP on

begin;

do $blok$
declare
  v_mulai time; v_jam text; v_jam2 text;
begin
  select jam_mulai_berangkat into v_mulai from edisi where is_active;

  update edisi set jam_mulai_berangkat = '07:00', jam_batas_berangkat = '10:00',
                   interval_berangkat_menit = 5, kloter_dasar = 2, kloter_maks = 2
   where is_active;

  select to_char(perkiraan_berangkat_kloter(1) at time zone 'Asia/Jakarta', 'HH24:MI')
    into v_jam;
  select to_char(perkiraan_berangkat_kloter(2) at time zone 'Asia/Jakarta', 'HH24:MI')
    into v_jam2;
  assert v_jam = '07:00', format('80.1 GAGAL: K1 berangkat %s, seharusnya 07:00', v_jam);
  assert v_jam2 = '07:05',
    format('80.1 GAGAL: dua kloter, K2 diperkirakan %s — seharusnya 07:05, '
           'bukan dilempar ke ujung jendela', v_jam2);

  -- 80.2 Banyak kloter: jedanya sudah di bawah batas, jadi batas itu tidak
  --      boleh menyentuh apa pun. 61 kloter -> tepat 3 menit, dan K61 tepat
  --      di ujung jendela.
  update edisi set kloter_dasar = 61, kloter_maks = 61 where is_active;
  select to_char(perkiraan_berangkat_kloter(61) at time zone 'Asia/Jakarta', 'HH24:MI')
    into v_jam;
  assert v_jam = '10:00',
    format('80.2 GAGAL: 61 kloter, K61 diperkirakan %s — batas jeda ikut '
           'memendekkan yang sudah rapat', v_jam);
  select to_char(perkiraan_berangkat_kloter(2) at time zone 'Asia/Jakarta', 'HH24:MI')
    into v_jam;
  assert v_jam = '07:03', format('80.2 GAGAL: K2 %s, seharusnya 07:03', v_jam);

  -- 80.3 Tidak ada kloter yang diperkirakan berangkat SESUDAH jendela habis,
  --      berapa pun jumlah kloternya. Itu jaminan pasal 10.1 yang tersisa
  --      sesudah jendelanya jadi batas atas.
  update edisi set kloter_dasar = 52, kloter_maks = 52 where is_active;
  assert (select perkiraan_berangkat_kloter(52))
       <= ((select tanggal_lomba + jam_batas_berangkat from edisi where is_active)
           at time zone 'Asia/Jakarta'),
    '80.3 GAGAL: kloter terakhir melewati ujung jendela';

  -- 80.4 Satu kloter: tidak ada jeda sama sekali, dan tidak ada pembagian
  --      dengan nol.
  update edisi set kloter_dasar = 1, kloter_maks = 1 where is_active;
  select to_char(perkiraan_berangkat_kloter(1) at time zone 'Asia/Jakarta', 'HH24:MI')
    into v_jam;
  assert v_jam = '07:00', format('80.4 GAGAL: satu kloter berangkat %s', v_jam);

  raise notice '80 OK — jendela jadi batas atas, dan yang rapat tidak ikut dipendekkan.';
end;
$blok$;

rollback;

select '80_jeda_kloter_maksimal OK' as hasil;
