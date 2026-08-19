-- ============================================================================
-- hrcd-rekap : 0083_tanggal_lomba_29_agustus_2026.sql
--
-- HRCD XXXVII DIADAKAN 29 AGUSTUS 2026.
--
-- ---------------------------------------------------------------------------
-- APA YANG SALAH SEBELUM INI
--
-- `edisi` diisi pertama kali dari seed dengan tahun 2027 dan tanggal
-- 2027-02-21 — angka contoh dari masa perancangan, waktu tanggalnya memang
-- belum ditentukan. Angka itu tidak pernah diperbaiki, dan sampai hari ini
-- produksi masih menyimpannya.
--
-- ---------------------------------------------------------------------------
-- KENAPA INI BUKAN SEKADAR ANGKA DI KARTU
--
-- `tanggal_lomba` bukan hiasan: ia ALAS PERKIRAAN JAM BERANGKAT. Kolom
-- `perkiraan_berangkat` di `v_keberangkatan` dan `v_daftar_kloter` dihitung
-- sebagai `(tanggal_lomba + jam_mulai_berangkat) at time zone Asia/Jakarta`
-- ditambah jarak antar kloter. Dengan tanggal Februari 2027, seluruh
-- perkiraan itu jatuh pada hari yang salah — dan kertas barak yang dicetak
-- untuk dibagikan ke pembina ikut menyandang tanggal itu.
--
-- Yang membuatnya berbahaya: JAM-nya tetap benar. "07:00", "07:04", "07:08"
-- terbaca persis seperti yang diharapkan, jadi tidak ada satu pun yang
-- terlihat rusak di layar sampai ada yang memperhatikan tanggalnya. Bagian 10
-- rancangan menyandarkan seluruh pagi pada perkiraan ini; alasnya harus benar.
--
-- Penalti TIDAK dihitung dari sini — itu `kloter.jam_berangkat`, yang diketik
-- pencatat dari jam sungguhan (bagian 10.6). Jadi nilai yang sudah tersimpan
-- tidak bergerak sedikit pun karena migrasi ini. Yang berubah cuma perkiraan
-- dan tanggal yang tercetak.
--
-- ---------------------------------------------------------------------------
-- SEED DAN TES SENGAJA TIDAK IKUT DIUBAH
--
-- `supabase/seed.sql` dan tes 03-05 masih menyebut 2027-02-21, dan itu benar:
-- `tests/run.sh` MEMUTAR ULANG sejarahnya, jadi seed adalah keadaan awal yang
-- memang pernah begitu, dan tes yang berjalan sebelum berkas ini memang hidup
-- di dunia itu. Mengubah seed berarti mengubah jam berangkat yang dipatok
-- ketiga tes tadi, tanpa satu pun manfaat. Berkas ini berjalan di UJUNG
-- rangkaian, dan tes 46 sesudahnya yang menjaga hasilnya.
--
-- Yang IKUT diubah di commit yang sama cuma dua skrip di supabase/checks/
-- yang menulis tanggalnya dengan tangan — mereka bukan bagian dari
-- pemutaran ulang, melainkan alat yang dijalankan orang hari ini.
-- ============================================================================

update edisi
set tahun         = 2026,
    tanggal_lomba = date '2026-08-29'
where nomor = 37;

do $blok$
declare
  v_tanggal date;
  v_tahun   smallint;
  v_mulai   time;
  v_batas   time;
begin
  select tanggal_lomba, tahun, jam_mulai_berangkat, jam_batas_berangkat
    into v_tanggal, v_tahun, v_mulai, v_batas
  from edisi where nomor = 37;

  if not found then
    raise notice '0083: edisi 37 tidak ada di database ini — dilewati.';
    return;
  end if;

  assert v_tanggal = date '2026-08-29',
    format('0083: tanggal lomba masih %s', v_tanggal);
  assert v_tahun = 2026, format('0083: tahun masih %s', v_tahun);

  -- Jendelanya cuma DILAPORKAN, tidak dipaksa: 07:00-10:00 adalah
  -- konfigurasi per edisi (bagian 10.7), bukan tetapan. Yang perlu dilihat
  -- orang yang menjalankan migrasi ini adalah bahwa alas dan jendelanya kini
  -- bercerita hal yang sama.
  raise notice '0083: HRCD XXXVII, % — berangkat % sampai %.',
    v_tanggal, v_mulai, v_batas;
end;
$blok$;
