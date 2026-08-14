-- ============================================================================
-- hrcd-rekap : tests/sql/15_kriteria_bidai.sql
-- Kriteria Bidai (0036) — yang diuji PENJAGANYA, bukan daftar kriterianya.
--
-- Daftar kriteria berubah tiap tahun dan tidak perlu tes; ia data. Yang tidak
-- boleh berubah adalah dua penolakan yang membuat perubahan itu aman:
--
--   1. 0036 menyentuh Pos 3 lewat NOMORNYA. Di edisi yang pos 3-nya bukan
--      P3K, ia harus diam. Kalau tidak, kriteria bidai menyelinap ke pos yang
--      sama sekali lain dan tidak ada yang gagal.
--   2. 0036 MENGHAPUS satu komponen. Kalau sudah ada nilai bidai tersimpan, ia
--      harus berhenti dengan galat. Nilai yang ikut terhapus tidak bisa
--      dikembalikan oleh git revert.
--
-- ---------------------------------------------------------------------------
-- BERKAS MIGRASINYA DIJALANKAN SUNGGUHAN, BUKAN DITIRU
--
-- Godaan besar di tes semacam ini adalah menyalin syarat penjaganya ke sini
-- lalu memeriksa salinan itu. Tesnya akan lulus selamanya — termasuk pada hari
-- seseorang menghapus penjaga aslinya. Jadi berkas 0036 yang sama persis
-- dengan yang dijalankan ke produksi dipanggil dengan `\ir`, dua kali: sekali
-- dalam keadaan yang harus ditolaknya, sekali dalam keadaan yang harus
-- dikerjakannya.
--
-- Dua kali itu bukan kelebihan. Panggilan yang GAGAL saja tidak membuktikan
-- apa-apa: berkas yang salah ketik juga gagal, dan juga tidak mengubah apa
-- pun. Panggilan kedua yang BERHASIL-lah yang menutup celah itu — ia
-- membuktikan berkasnya memang bisa jalan, sehingga satu-satunya penjelasan
-- bagi kegagalan pertama adalah penjaganya.
--
-- Galat yang diharapkan itu akan menghentikan psql, karena run.sh memakai
-- ON_ERROR_STOP. Jadi ia dimatikan sebentar — hanya selama satu baris itu —
-- lalu dinyalakan lagi. Kalau lupa dinyalakan, seluruh tes SESUDAH berkas ini
-- berubah jadi tidak bisa gagal.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 15.1 Penjaga 1, dibuktikan dari luar: 0036 sudah dijalankan sungguhan oleh
--      run.sh beberapa baris di atas ini. Karena database uji memakai
--      konfigurasi XXXVI dan tidak punya `bidai_posisi`, ia harus tidak
--      meninggalkan jejak apa pun.
-- ---------------------------------------------------------------------------
do $$
declare v_selundupan int;
begin
  select count(*) into v_selundupan from wahana
  where edisi = edisi_aktif() and kode like 'bidai%';
  assert v_selundupan = 0,
    format('0036 memasang %s komponen bidai di edisi yang bukan XXXVII',
           v_selundupan);
end;
$$;

-- ---------------------------------------------------------------------------
-- 15.2 Pos 3 yang menyamar jadi P3K: kelima kriteria bidai LAMA, apa adanya
--      seperti 0033 memasangnya, plus satu nilai tersimpan.
--
--      Sengaja TIDAK di dalam transaksi. Berkas 0036 harus melihat keadaan ini
--      sudah tersimpan, dan galatnya sendiri membatalkan transaksi apa pun
--      yang sedang berjalan — jadi rollback bukan alat yang tersedia di sini.
--      Dibersihkan dengan tangan di 15.6.
-- ---------------------------------------------------------------------------
do $$
declare v_regu uuid;
begin
  insert into wahana (edisi, pos, kode, name, type, form, poin_maks,
                      raw_terbaik, raw_terburuk, rentang_mentah_min,
                      rentang_mentah_maks, sort_order)
  values
    (edisi_aktif(), 3, 'bidai_posisi',     'Posisi Bidai',             'wahana', 'besar_baik', 20, 20, 0, 0, 20, 91),
    (edisi_aktif(), 3, 'bidai_teknik',     'Teknik Bidai',             'wahana', 'besar_baik', 20, 20, 0, 0, 20, 92),
    (edisi_aktif(), 3, 'bidai_kerapihan',  'Kerapihan dan Kebersihan', 'wahana', 'besar_baik', 20, 20, 0, 0, 20, 93),
    (edisi_aktif(), 3, 'bidai_kecepatan',  'Kecepatan',                'wahana', 'besar_baik', 20, 20, 0, 0, 20, 94),
    (edisi_aktif(), 3, 'bidai_kerja_sama', 'Kerja Sama',               'wahana', 'besar_baik', 20, 20, 0, 0, 20, 95);

  select id into strict v_regu from regu where nomor_dada is not null
  order by nomor_dada limit 1;

  -- Nilainya ditempelkan pada kriteria yang akan DIHAPUS 0036 — itu kasus
  -- terburuknya, dan itulah yang harus ditolak.
  insert into nilai_mentah (regu_id, wahana_id, nilai_1, source, created_by)
  select v_regu, id, 15, 'manual', '00000000-0000-0000-0000-00000000000a'
  from wahana where edisi = edisi_aktif() and kode = 'bidai_kerja_sama';
end;
$$;

\set ON_ERROR_STOP off
\ir ../../supabase/migrations/0036_kriteria_bidai.sql
\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 15.3 Sesudah penolakan itu, semuanya HARUS masih utuh. Inilah pertanyaan
--      sebenarnya — bukan "apakah ia berteriak", melainkan "apakah ia berhenti
--      sebelum merusak". Migrasi yang menolak setelah menghapus separuh isi
--      jauh lebih buruk daripada yang tidak menolak sama sekali.
-- ---------------------------------------------------------------------------
do $$
declare v_nilai int; v_lama int; v_baru int;
begin
  select count(*) into v_nilai
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif() and w.kode = 'bidai_kerja_sama';
  assert v_nilai = 1,
    format('nilai bidai hilang padahal 0036 menolak: tersisa %s', v_nilai);

  select count(*) into v_lama from wahana
  where edisi = edisi_aktif() and kode like 'bidai%';
  assert v_lama = 5,
    format('kriteria lama tersentuh padahal 0036 menolak: %s dari 5', v_lama);

  select count(*) into v_baru from wahana
  where edisi = edisi_aktif() and kode = 'bidai_diagnosis';
  assert v_baru = 0, '0036 sempat memasang kriteria baru sebelum menolak';
end;
$$;

-- ---------------------------------------------------------------------------
-- 15.4 Nilainya dibuang, penjaga 2 tidak lagi berlaku — dan sekarang berkas
--      yang SAMA harus bekerja. Tanpa langkah ini, 15.3 juga lulus untuk
--      berkas yang rusak total.
-- ---------------------------------------------------------------------------
do $$
begin
  delete from nilai_mentah n using wahana w
  where n.wahana_id = w.id and w.edisi = edisi_aktif() and w.kode like 'bidai%';
end;
$$;

\ir ../../supabase/migrations/0036_kriteria_bidai.sql

-- ---------------------------------------------------------------------------
-- 15.5 Kelima kriteria baru, berikut urutan bacanya. Yang dijaga di sini bukan
--      selera penamaan, melainkan dua hal yang diam-diam mengubah penilaian:
--      `bidai_kecepatan` dan `bidai_kerja_sama` TIDAK boleh keduanya tinggal
--      (itu berarti 40 poin untuk hal yang panitia beri 20), dan totalnya
--      harus tetap 100.
-- ---------------------------------------------------------------------------
do $$
declare
  v_dapat text;
  v_harap text := 'bidai_diagnosis, bidai_posisi, bidai_teknik, '
                  'bidai_kerapihan, bidai_kecepatan_kerja_sama';
  v_total numeric;
begin
  select string_agg(kode, ', ' order by sort_order), sum(poin_maks)
    into v_dapat, v_total
  from wahana where edisi = edisi_aktif() and kode like 'bidai%';

  assert v_dapat = v_harap,
    format('kriteria bidai tidak sesuai.%s  seharusnya: %s%s  ternyata  : %s',
           chr(10), v_harap, chr(10), v_dapat);
  assert v_total = 100,
    format('total poin bidai %s, seharusnya 100', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- 15.6 Database uji kembali seperti sebelum berkas ini dibuka. Tes 02-14 di
--      atasnya sudah selesai, tapi urutan run.sh bisa berubah kapan saja.
-- ---------------------------------------------------------------------------
do $$
declare v_sisa int;
begin
  delete from nilai_mentah n using wahana w
  where n.wahana_id = w.id and w.edisi = edisi_aktif() and w.kode like 'bidai%';
  delete from wahana where edisi = edisi_aktif() and kode like 'bidai%';

  select count(*) into v_sisa from wahana
  where edisi = edisi_aktif() and kode like 'bidai%';
  assert v_sisa = 0, format('pos 3 palsu tertinggal: %s baris', v_sisa);
end;
$$;

select '15_kriteria_bidai OK' as hasil;
