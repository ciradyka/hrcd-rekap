-- ============================================================================
-- hrcd-rekap : 0076_bidai_dan_lomba_soal.sql
--
-- DUA PERUBAHAN PENILAIAN, DIMINTA PEMILIK ACARA:
--
--   A. Pembidaian (Pos 3) tidak lagi lima kriteria sama berat.
--   B. Lima lomba SOAL baru di Pos 1, 2, dan 3.
--
-- ---------------------------------------------------------------------------
-- A. PEMBIDAIAN: 20/20/20/20/20 -> 25/25/20/15/15
--
--   Diagnosis dan Penanganan Awal   20 -> 25
--   Teknik Bidai                    20 -> 25
--   Kecepatan dan Kerja Sama        20 -> 20   (tetap)
--   Posisi Bidai                    20 -> 15
--   Kerapihan dan Kebersihan        20 -> 15
--                                   ---    ---
--                                   100    100
--
-- Jumlahnya tetap 100, jadi bobot Pembidaian terhadap lomba lain TIDAK
-- berubah. Yang berubah cuma pembagiannya di dalam: menilai salah pada
-- diagnosis sekarang lebih mahal daripada menilai salah pada kerapihan, dan
-- itu memang urutan yang benar untuk lomba pertolongan pertama.
--
-- TIGA kolom yang harus bergerak bersama, bukan satu. Bentuknya `besar_baik`,
-- dan rumusnya `poin_maks * (nilai - raw_terburuk) / (raw_terbaik -
-- raw_terburuk)`. Baris-baris ini sengaja dipasang 1:1 — poin_maks =
-- raw_terbaik = batas atas rentang — supaya angka yang ditulis juri di kertas
-- adalah poinnya, tanpa perkalian di kepala siapa pun. Menaikkan poin_maks
-- saja tanpa raw_terbaik akan membuat juri yang menulis 20 mendapat 25 poin.
--
-- ---------------------------------------------------------------------------
-- B. LIMA LOMBA SOAL BARU
--
--   Pos 1  Keagamaan          10 soal, 1 benar 5 poin -> maks  50
--   Pos 1  Kepramukaan        10 soal, 1 benar 5 poin -> maks  50
--   Pos 2  Kesehatan          10 soal, 1 benar 5 poin -> maks  50
--   Pos 2  Pengetahuan Umum   10 soal, 1 benar 5 poin -> maks  50
--   Pos 3  Logika             20 soal, 1 benar 5 poin -> maks 100
--
-- Bentuknya `benar_per_total`: `poin = poin_maks * benar / total_soal`.
-- 50 x benar / 10 = 5 poin per jawaban benar; 100 x benar / 20 = 5 juga.
-- Yang diketik petugas cuma SATU angka — jumlah jawaban benar — dan itu yang
-- diminta: "input benar saja".
--
-- MASING-MASING LOMBA TERSENDIRI, bukan satu lomba berisi dua penilaian.
-- Keputusan pemilik acara, dan konsekuensinya disebut supaya tidak jadi
-- kejutan: Pos 1 mencetak dua blangko tambahan, bukan satu, dan tiap regu
-- punya dua kolom foto tambahan di sana. Itulah arti `lomba` dibiarkan NULL —
-- komponen yang berdiri sendiri adalah lombanya sendiri (CLAUDE.md 11.7).
--
-- BOBOTNYA MEMANG SETENGAH, dan itu bukan kelalaian. Komponen lain bernilai
-- maksimum 100; kelima soal ini 50 (Logika 100). Klasemen menjumlahkan poin
-- apa adanya, jadi:
--
--   Pos 1  300 -> 400   (Semaphore, Tebak Simpul, Menaksir, +50, +50)
--   Pos 2  300 -> 400   (Bakiak, Lari Balok, Balap Karung, +50, +50)
--   Pos 3  300 -> 400   (Pembidaian 100, KIM 200, +100)
--
-- Kalau yang dimaksud "satu benar 5 poin" adalah 10 poin supaya setara dengan
-- lomba lain, yang diubah cukup `poin_maks` jadi 100 — angka 5 di kepala
-- panitia tetap benar karena rumusnya membagi dengan total soal.
-- ============================================================================

do $blok$
declare
  v_edisi smallint := edisi_aktif();
  v_n     integer;
begin

-- ---------------------------------------------------------------------------
-- A. Pembidaian.
--
-- Dijalankan sebagai UPDATE per baris, bukan insert ... on conflict: barisnya
-- SUDAH ADA di produksi beserta nilai yang tertaut padanya, dan `on conflict`
-- yang salah satu kolomnya lupa disebut akan menimpanya dengan NULL.
-- ---------------------------------------------------------------------------
update wahana set poin_maks = 25, raw_terbaik = 25, rentang_mentah_maks = 25
where edisi = v_edisi and pos = 3 and kode = 'bidai_diagnosis';

update wahana set poin_maks = 25, raw_terbaik = 25, rentang_mentah_maks = 25
where edisi = v_edisi and pos = 3 and kode = 'bidai_teknik';

update wahana set poin_maks = 20, raw_terbaik = 20, rentang_mentah_maks = 20
where edisi = v_edisi and pos = 3 and kode = 'bidai_kecepatan_kerja_sama';

update wahana set poin_maks = 15, raw_terbaik = 15, rentang_mentah_maks = 15
where edisi = v_edisi and pos = 3 and kode = 'bidai_posisi';

update wahana set poin_maks = 15, raw_terbaik = 15, rentang_mentah_maks = 15
where edisi = v_edisi and pos = 3 and kode = 'bidai_kerapihan';

-- Pemeriksaannya dikurung "kalau lombanya memang ada". Database uji memakai
-- seed generik yang tidak punya Pembidaian sama sekali (0032/0033 tidak
-- berjalan di sana), dan menggagalkan seluruh rangkaian tes karena baris yang
-- memang tidak ada akan membuat berkas ini berhenti diuji — persis kebiasaan
-- yang bagian 7.5 larang.
select count(*) into v_n from wahana
where edisi = v_edisi and pos = 3 and lomba = 'Pembidaian';

if v_n = 0 then
  raise notice '0076: Pembidaian tidak ada di database ini — bagian A dilewati.';
elsif v_n <> 5 then
  raise warning '0076: Pembidaian punya % baris, bukan 5 — periksa kodenya.', v_n;
else
  select coalesce(sum(poin_maks), 0) into v_n from wahana
  where edisi = v_edisi and pos = 3 and lomba = 'Pembidaian';
  assert v_n = 100,
    format('0076: Pembidaian berjumlah %s, seharusnya 100', v_n);
  raise notice '0076: Pembidaian 25/25/20/15/15, berjumlah 100.';
end if;

-- ---------------------------------------------------------------------------
-- B. Lima lomba soal.
--
-- `lomba` NULL = komponen ini lombanya sendiri. `golongan` NULL = berlaku
-- untuk keempat golongan. `judul_isian` menamai kotaknya di layar dan di
-- kertas: yang ditulis petugas adalah JUMLAH BENAR, bukan poin.
-- ---------------------------------------------------------------------------
insert into wahana
  (edisi, pos, kode, name, type, form, poin_maks, total_soal,
   rentang_mentah_min, rentang_mentah_maks, judul_isian, sort_order)
values
  (v_edisi, 1, 'keagamaan',        'Keagamaan',        'soal', 'benar_per_total',  50, 10, 0, 10, 'Benar', 4),
  (v_edisi, 1, 'kepramukaan',      'Kepramukaan',      'soal', 'benar_per_total',  50, 10, 0, 10, 'Benar', 5),
  (v_edisi, 2, 'kesehatan',        'Kesehatan',        'soal', 'benar_per_total',  50, 10, 0, 10, 'Benar', 4),
  (v_edisi, 2, 'pengetahuan_umum', 'Pengetahuan Umum', 'soal', 'benar_per_total',  50, 10, 0, 10, 'Benar', 5),
  (v_edisi, 3, 'logika',           'Logika',           'soal', 'benar_per_total', 100, 20, 0, 20, 'Benar', 8)
on conflict (edisi, pos, kode) do update set
  name                = excluded.name,
  type                = excluded.type,
  form                = excluded.form,
  poin_maks           = excluded.poin_maks,
  total_soal          = excluded.total_soal,
  rentang_mentah_min  = excluded.rentang_mentah_min,
  rentang_mentah_maks = excluded.rentang_mentah_maks,
  judul_isian         = excluded.judul_isian,
  sort_order          = excluded.sort_order,
  lomba               = null,
  golongan            = null;

-- ---------------------------------------------------------------------------
-- Laporan: bobot tiap pos SESUDAH perubahan, supaya angkanya dilihat sekarang
-- dan bukan ditemukan waktu klasemen sudah terisi.
-- ---------------------------------------------------------------------------
declare
  r record;
begin
  for r in
    select pos, sum(poin_maks) as poin, count(*) as komponen
    from wahana where edisi = v_edisi group by pos order by pos
  loop
    raise notice '0076: Pos % -> % poin dari % komponen.', r.pos, r.poin, r.komponen;
  end loop;
end;

end;
$blok$;
