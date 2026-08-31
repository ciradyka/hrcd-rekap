-- ============================================================================
-- hrcd-rekap : 0169_judul_isian_soal.sql
--
-- Kotak lima lomba soal tulis berjudul "Jumlah benar", sama seperti Semaphore.
--
-- ---------------------------------------------------------------------------
-- APA YANG BERUBAH
--
-- 0076 memberi kelima lomba soal — Keagamaan, Kepramukaan, Kesehatan,
-- Pengetahuan Umum, Logika — `judul_isian = 'Benar'`, dengan maksud yang
-- benar: yang ditulis petugas adalah JUMLAH BENAR, bukan poin. Kata "Benar"
-- sendirian tidak menyampaikan itu; ia terbaca seperti pertanyaan ya/tidak,
-- dan di kotak yang menunggu angka 0-10 pertanyaan ya/tidak adalah tebakan
-- yang salah.
--
-- ---------------------------------------------------------------------------
-- DIKOSONGKAN, BUKAN DIISI ULANG
--
-- `judulIsian()` di app.js sudah menurunkan "Jumlah benar" sendiri untuk
-- bentuk `benar_per_total` — itulah judul yang dipakai Semaphore dan Tebak
-- Simpul, yang `judul_isian`-nya memang kosong. Menulis "Jumlah benar" ke
-- database berarti kalimat yang sama hidup di dua tempat, dan yang mengubah
-- salah satunya suatu hari akan membuat dua lomba serupa berbunyi berbeda di
-- satu layar.
--
-- 0039 menuntut `judul_isian` diisi hanya untuk `bertingkat` tanpa satuan,
-- karena bentuk itu tidak menentukan arti angkanya. `benar_per_total`
-- menentukannya: angkanya selalu jumlah jawaban benar.
--
-- Yang dikenali `type = 'soal'`, bukan daftar kode — supaya lomba soal
-- tahun depan tidak lahir dengan judul yang sudah dibuang hari ini.
-- ============================================================================

do $blok$
declare
  v_baris integer;
  v_edisi smallint := edisi_aktif();
begin
  update wahana set judul_isian = null
  where edisi = v_edisi and type = 'soal' and judul_isian is not null;

  get diagnostics v_baris = row_count;

  -- Dilaporkan, bukan diandaikan: di database uji konfigurasi XXXVII belum
  -- terpasang, jadi tidak ada baris `soal` sama sekali dan UPDATE ini tidak
  -- mengenai apa pun. Itu keadaan yang sah (pelajaran 0035).
  if v_baris = 0 then
    raise notice '0169: tidak ada baris soal berjudul isian di edisi % — dilewati.', v_edisi;
  else
    raise notice '0169: % baris soal memakai judul turunan "Jumlah benar".', v_baris;
  end if;
end;
$blok$;
