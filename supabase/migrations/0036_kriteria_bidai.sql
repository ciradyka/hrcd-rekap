-- ============================================================================
-- hrcd-rekap : 0036_kriteria_bidai.sql
--
-- Kriteria penilaian Bidai (Pos 3 — P3K) sebagaimana ditetapkan panitia:
--
--   1. Diagnosis dan Penanganan Awal      20
--   2. Posisi Bidai                       20
--   3. Teknik Bidai                       20
--   4. Kerapihan dan Kebersihan           20
--   5. Kecepatan dan Kerja Sama           20
--                                        ---
--                                        100
--
-- ---------------------------------------------------------------------------
-- INI BUKAN SEKADAR MENAMBAH SATU KOLOM
--
-- Jumlah kriterianya tetap lima, jadi angka 20 dan total 100 tidak berubah dan
-- selisihnya mudah terlewat. Yang berubah adalah CARA JURI MENIMBANG:
--
--   sebelum : Kecepatan 20  +  Kerja Sama 20   = 40 poin untuk dua hal itu
--   sesudah : Kecepatan dan Kerja Sama 20      = 20 poin, dan 20 sisanya
--                                                pindah ke Diagnosis
--
-- Kecepatan dan kerja sama dulu bisa saling menutupi — regu yang lambat tapi
-- kompak tetap memanen 20. Sekarang keduanya satu penilaian, dan bobot yang
-- terbebas dipakai untuk hal yang sebelumnya tidak dinilai sama sekali:
-- apakah reguya benar mengenali cedera dan menanganinya lebih dulu.
--
-- Kriteria yang tidak dinilai bukan sekadar kehilangan poin — ia hilang dari
-- kertas, jadi jurinya pun tidak diminta melihatnya.
--
-- ---------------------------------------------------------------------------
-- DUA PENJAGA, MASING-MASING UNTUK BAHAYA YANG BERBEDA
--
-- 1. Berkas ini menyentuh Pos 3 berdasarkan NOMORNYA. Di database yang tata
--    letak XXXVII-nya belum terpasang — database uji, misalnya — pos 3 adalah
--    pos yang sama sekali lain, dan menambahkan kriteria bidai ke sana
--    menyelundupkan komponen asing tanpa satu galat pun. Jadi yang diperiksa
--    bukan "edisi keberapa", melainkan apakah `bidai_posisi` memang ada:
--    tanda paling langsung bahwa Pos 3 di sini benar-benar P3K.
--
-- 2. `bidai_kerja_sama` DIHAPUS, dan menghapus komponen ikut menghapus nilai
--    yang menempel padanya. Kalau sudah ada nilai bidai tersimpan, berkas ini
--    berhenti dengan galat — bukan notice. Notice berarti "dilewati, semua
--    aman"; di sini yang terjadi justru sebaliknya, dan konfigurasi setengah
--    berubah lebih berbahaya daripada tidak berubah sama sekali.
--
--    Kalau memang harus diubah setelah ada nilai, itu keputusan sadar: catat
--    dulu nilai bidai yang ada, jalankan, lalu masukkan ulang. Nilai lama
--    TIDAK bisa dipetakan otomatis — 20 untuk "Kecepatan" bukan 20 untuk
--    "Kecepatan dan Kerja Sama", dan yang hilang bukan angkanya melainkan
--    artinya.
--
-- ---------------------------------------------------------------------------
-- SATU PENYERAGAMAN KECIL
--
-- Panitia menulis "Diagnosis & Penanganan Awal" dan "Kerapihan / Kebersihan".
-- Kata-katanya dipakai apa adanya; hanya penyambungnya diseragamkan jadi "dan"
-- supaya kelima label yang berdiri berdampingan di satu lembar tidak memakai
-- tiga gaya sekaligus (&, /, dan). Ini nama yang dibaca juri di kertas dan di
-- layar (CLAUDE.md aturan 5.1).
-- ============================================================================

do $$
declare
  v_edisi  smallint;
  v_ada    boolean;
  v_nilai  int;
  v_jumlah int;
  v_total  numeric;
begin
  select nomor into v_edisi from edisi where is_active;
  if v_edisi is null then
    raise notice '0036: belum ada edisi aktif — kriteria bidai dilewati.';
    return;
  end if;

  -- Penjaga 1: Pos 3 di edisi ini benar-benar P3K?
  select exists (select 1 from wahana
                 where edisi = v_edisi and pos = 3 and kode = 'bidai_posisi')
    into v_ada;
  if not v_ada then
    raise notice '0036: `bidai_posisi` tidak ada di edisi % — tata letak '
                 'XXXVII tidak terpasang, kriteria bidai TIDAK diubah.',
                 v_edisi;
    return;
  end if;

  -- Penjaga 2: ada nilai bidai tersimpan?
  select count(*) into v_nilai
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  where w.edisi = v_edisi and w.pos = 3 and w.kode like 'bidai%';

  if v_nilai > 0 then
    raise exception
      '0036: ada % nilai bidai tersimpan di edisi %. Mengubah kriteria akan '
      'menghapus sebagian di antaranya dan membuat sisanya berarti lain. '
      'Catat dulu nilainya, baru jalankan ulang.', v_nilai, v_edisi;
  end if;

  -- Kriteria baru, di urutan pertama — juri menilai diagnosis SEBELUM memasang
  -- bidai, jadi kertasnya pun harus bertanya dalam urutan itu.
  insert into wahana (edisi, pos, kode, name, type, form, poin_maks,
                      raw_terbaik, raw_terburuk, poin_benar, poin_salah,
                      total_soal, tingkat, satuan, golongan,
                      rentang_mentah_min, rentang_mentah_maks, sort_order)
  values
    (v_edisi, 3, 'bidai_diagnosis', 'Diagnosis dan Penanganan Awal',
     'wahana', 'besar_baik',
     20, 20, 0, null, null, null, null, null, null, 0, 20, 1)
  on conflict (edisi, pos, kode) do update set
    name = excluded.name, sort_order = excluded.sort_order;

  -- Kecepatan dan Kerja Sama menyatu. Barisnya diganti nama, bukan dihapus
  -- lalu dibuat ulang — supaya `id`-nya tetap, dan supaya jelas di riwayat
  -- bahwa yang terjadi adalah penggabungan, bukan pergantian.
  update wahana set kode = 'bidai_kecepatan_kerja_sama',
                    name = 'Kecepatan dan Kerja Sama'
  where edisi = v_edisi and pos = 3 and kode = 'bidai_kecepatan';

  delete from wahana
  where edisi = v_edisi and pos = 3 and kode = 'bidai_kerja_sama';

  -- Urutan di kertas dan di layar. Ditulis semuanya, bukan hanya yang
  -- bergeser: satu daftar utuh lebih mudah dicocokkan dengan aturan panitia
  -- daripada tiga UPDATE yang harus dibaca sebagai selisih.
  update wahana set sort_order = 1 where edisi = v_edisi and pos = 3 and kode = 'bidai_diagnosis';
  update wahana set sort_order = 2 where edisi = v_edisi and pos = 3 and kode = 'bidai_posisi';
  update wahana set sort_order = 3 where edisi = v_edisi and pos = 3 and kode = 'bidai_teknik';
  update wahana set sort_order = 4 where edisi = v_edisi and pos = 3 and kode = 'bidai_kerapihan';
  update wahana set sort_order = 5 where edisi = v_edisi and pos = 3 and kode = 'bidai_kecepatan_kerja_sama';

  -- Diperiksa, bukan diandaikan: lima kriteria, seratus poin. Kalau salah satu
  -- UPDATE di atas tidak mengenai apa pun karena kodenya berbeda dari dugaan,
  -- yang muncul di sini adalah galat — bukan lembar penilaian bernilai 80.
  -- Keduanya diperiksa, karena jumlah baris yang benar dengan poin yang salah
  -- (atau sebaliknya) sama-sama menghasilkan rekap yang tidak ada yang curigai.
  select count(*), coalesce(sum(poin_maks), 0) into v_jumlah, v_total
  from wahana
  where edisi = v_edisi and pos = 3 and kode like 'bidai%';

  if v_jumlah <> 5 or v_total <> 100 then
    raise exception '0036: kriteria bidai berjumlah % senilai % poin, '
                    'seharusnya 5 kriteria senilai 100.', v_jumlah, v_total;
  end if;

  raise notice '0036: lima kriteria bidai terpasang, total % poin.', v_total;
end;
$$;
