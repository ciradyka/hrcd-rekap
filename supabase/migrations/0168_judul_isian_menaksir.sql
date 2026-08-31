-- ============================================================================
-- hrcd-rekap : 0168_judul_isian_menaksir.sql
--
-- Judul kotak isian Menaksir jadi "Hasil Taksir". Yang diketik memang bukan
-- selisih lagi.
--
-- ---------------------------------------------------------------------------
-- KENAPA JUDULNYA TERTINGGAL
--
-- 0039 memasang "Selisih Taksir" waktu petugas memang mengetik SELISIH
-- taksiran regu terhadap jarak sebenarnya. 0085 membalik aturannya — yang
-- diketik ANGKA YANG DITULIS PESERTA apa adanya, dan mesin skor yang
-- menghitung selisihnya terhadap `wahana.jawaban_benar` — lalu 0086
-- memindahkan satuannya ke sentimeter. Keduanya membetulkan `petunjuk`,
-- `tingkat`, `rentang_mentah_maks` dan `satuan`; tidak satu pun menyentuh
-- `judul_isian`.
--
-- Jadi sejak 0085 layar Input Nilai Pos menuliskan "Selisih Taksir" di atas
-- kotak yang menunggu HASIL taksir. Blangko kertasnya sudah benar — lembar
-- Menaksir mencetak "Hasil Taksir" dari cabang khususnya sendiri di app.js —
-- sehingga kertas dan layar menyuruh dua hal yang berbeda untuk satu kotak
-- yang sama.
--
-- Kerusakannya persis yang ditakutkan 0039, cuma terbalik arahnya: petugas
-- yang menurut judul mengetik selisih 1 untuk taksiran 7,55 m mengirim
-- nilai mentah 1 cm, dan tangganya membaca |1 - 855| = 854 cm — nol poin.
-- Tidak ada galat, tidak ada rentang yang dilanggar, dan yang terlihat cuma
-- satu lomba yang seluruh pesertanya kebetulan buruk.
--
-- ---------------------------------------------------------------------------
-- PETUNJUKNYA IKUT DITEGASKAN
--
-- `petunjuk` — baris kecil di bawah judul — sudah dibetulkan 0085 jadi
-- "(meter)". Ia ditulis ulang di sini dengan nilai yang sama, bukan karena
-- diragukan, melainkan karena judul dan petunjuk adalah SATU kalimat di layar
-- dan di kertas: "Selisih Taksir / (selisih meter)" salah dua kali, dan
-- membetulkan separuhnya meninggalkan kata "selisih" tepat di bawah judul yang
-- baru. Nilainya sama dengan yang dipasang 0085, jadi di produksi baris ini
-- tidak mengubah apa pun; yang dijaganya database mana pun yang urutan
-- konfigurasinya berbeda — database dev, misalnya, menjalankan ulang 0038
-- sesudah 0085 dan sampai hari ini masih berbunyi "(selisih meter)".
--
-- ---------------------------------------------------------------------------
-- KENAPA DIISI, BUKAN DIKOSONGKAN
--
-- Dikosongkan pun layar akan menurunkan "Hasil taksir" sendiri dari
-- `satuan = 'meter'` (judulIsian() di app.js). Tapi cadangan itu berlaku untuk
-- SETIAP komponen bersatuan meter yang mungkin dibuat panitia tahun depan,
-- dan 0039 sudah menulis kenapa bentuk `bertingkat` membawa judulnya sendiri:
-- angkanya bisa berarti apa saja, dan yang tahu artinya cuma yang mengatur
-- komponennya.
-- ============================================================================

do $blok$
declare
  v_baris integer;
  v_edisi smallint := edisi_aktif();
begin
  update wahana set judul_isian = 'Hasil Taksir',
                    petunjuk    = '(meter)'
  where edisi = v_edisi and kode = 'menaksir';

  get diagnostics v_baris = row_count;

  -- Dilaporkan, bukan diandaikan: di database uji konfigurasi XXXVII belum
  -- terpasang, baris `menaksir` memang tidak ada, dan UPDATE ini tidak
  -- mengenai apa pun. Itu keadaan yang sah (pelajaran 0035).
  if v_baris = 0 then
    raise notice '0168: komponen `menaksir` tidak ada di edisi % — dilewati.', v_edisi;
  else
    raise notice '0168: judul isian Menaksir jadi "Hasil Taksir", petunjuk "(meter)".';
  end if;
end;
$blok$;
