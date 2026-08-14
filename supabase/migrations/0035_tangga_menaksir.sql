-- ============================================================================
-- hrcd-rekap : 0035_tangga_menaksir.sql
--
-- Tangga poin Menaksir sebagaimana ditetapkan panitia:
--
--   selisih 0 m  -> 100      selisih 3 m    ->  40
--   selisih 1 m  ->  80      selisih 4 m    ->  20
--   selisih 2 m  ->  60      lebih dari 4 m ->   0
--
-- Turun 20 poin tiap meter, dan menyentuh 0.
--
-- Menggantikan tangga di 0033, yang dua tingkat terakhirnya memang ditandai
-- asumsi: di sana selisih 2 m dan 3 m sama-sama bernilai 60, dan poinnya
-- berhenti di 20 seperti Pos 2. Keduanya keliru.
--
-- ---------------------------------------------------------------------------
-- SATU BARIS YANG DIBACA SEBAGAI SALAH KETIK
--
-- Daftar yang diberikan panitia berakhir dengan "Selisih 2m 0", padahal
-- selisih 2 m sudah bernilai 60 di baris ketiga. Dibaca sebagai tingkat
-- TERAKHIR — batas di mana poinnya habis — karena itu satu-satunya bacaan
-- yang membuat daftarnya utuh: 0, 1, 2, 3, 4, lalu selesai. Polanya sendiri
-- yang menentukan angkanya, bukan tebakan: tiap meter turun 20, jadi meter
-- kelima jatuh ke 0.
--
-- Kalau yang dimaksud lain, cukup satu UPDATE pada baris `menaksir`.
--
-- ---------------------------------------------------------------------------
-- KENAPA TIDAK ADA TINGKAT PENUTUP
--
-- `bertingkat` memberi 0 untuk nilai di luar seluruh tingkat (migrasi 0022).
-- Di Pos 2 itu justru salah, karena aturannya berhenti di 20 — ketiga lomba di
-- sana diberi tingkat terakhir berbatas sangat besar supaya tidak jatuh ke 0.
-- Menaksir tidak membutuhkannya: 0 di luar tangga memang jawabannya. Tingkat
-- `{"sampai": 100000, "poin": 20}` dari 0033 karena itu dibuang, bukan diubah.
--
-- Tidak ada penjaga "belum ada nilai" di sini, dan itu disengaja. 0033 dan
-- 0034 dipagari begitu karena mereka menulis ULANG tata letak — berbahaya di
-- database yang isinya lain. Berkas ini hanya membetulkan satu aturan
-- penilaian, dan pembetulan aturan justru harus tetap bisa dijalankan setelah
-- ada nilai masuk. Yang perlu disadari: skor diturunkan saat DIBACA, jadi
-- mengubah tangga ini mengubah pula peringkat yang sudah tampil di layar.
-- ============================================================================

do $$
declare v_baris int;
begin
  update wahana set
    tingkat = '[{"sampai": 0, "poin": 100},
                {"sampai": 1, "poin": 80},
                {"sampai": 2, "poin": 60},
                {"sampai": 3, "poin": 40},
                {"sampai": 4, "poin": 20}]'::jsonb
  where edisi = edisi_aktif() and kode = 'menaksir';

  get diagnostics v_baris = row_count;

  -- Dilaporkan, bukan diandaikan: di database yang konfigurasi XXXVII-nya
  -- belum terpasang, baris `menaksir` memang tidak ada dan UPDATE ini tidak
  -- mengenai apa pun. Itu keadaan yang sah — yang tidak sah adalah mengira
  -- tangganya sudah terpasang padahal tidak.
  if v_baris = 0 then
    raise notice '0035: komponen `menaksir` tidak ada di edisi aktif — '
                 'tangga poin dilewati.';
  else
    raise notice '0035: tangga Menaksir diperbarui (% baris).', v_baris;
  end if;
end;
$$;
