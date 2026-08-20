-- ============================================================================
-- hrcd-rekap : 0086_menaksir_sentimeter.sql
--
-- TAKSIRAN DISIMPAN DALAM SENTIMETER BULAT, DITAMPILKAN DALAM METER.
--
-- ---------------------------------------------------------------------------
-- APA YANG RUSAK
--
-- 0085 membuat panitia mengetik taksiran peserta apa adanya — dan taksiran
-- peserta berkoma. Petugas yang mengetik `8.55` mendapat penolakan:
--
--   New row for relation "nilai_mentah" violates check constraint
--   "nilai_mentah_bulat"
--
-- Constraint itu (0059) menolak SEMUA pecahan di nilai mentah, dan ia benar:
-- kolomnya `numeric` dan kotak isiannya mengundang koma, jadi juri yang
-- mengetik "4,85" untuk Semaphore dulu diterima tanpa sepatah kata dan
-- angkanya ikut dihitung ke klasemen seolah-olah ia berarti.
--
-- ---------------------------------------------------------------------------
-- YANG DILAKUKAN, DAN KENAPA BUKAN MELONGGARKAN CONSTRAINT
--
-- Kepala 0059 sudah menuliskan jalan keluarnya, dan berkas ini menempuhnya
-- persis:
--
--   "Jangan melonggarkan constraint ini diam-diam. Yang benar: simpan
--    angkanya dalam satuan terkecil yang bulat — sentimeter alih-alih meter."
--
-- Jadi 8,55 m disimpan sebagai 855. Bukan aturan baru: `detik` sudah begitu
-- sejak awal — kertas berbunyi 00:47, database menyimpan 47, dan tidak ada
-- petugas yang pernah melihat angka 47 itu.
--
-- Melonggarkan constraint bukan pilihan yang lebih murah, ia pilihan yang
-- lebih mahal: check constraint tidak bisa memuat sub-query, jadi "boleh
-- pecahan HANYA untuk komponen tertentu" menuntut trigger — pagar yang lebih
-- banyak mesinnya dan lebih sedikit dibaca orang. Yang tersisa cuma membuang
-- pagarnya untuk semua komponen, dan itu mengembalikan persis kerusakan yang
-- 0059 dipasang untuk mencegah.
--
-- ---------------------------------------------------------------------------
-- ANGKA YANG IKUT BERPINDAH SATUAN
--
--   jawaban_benar        8.55 m   -> 855 cm
--   tangga               1..5 m   -> 100..500 cm  (poin tetap 100..20)
--   rentang_mentah_maks  999.99   -> 10000        (100 m)
--   satuan               null     -> 'meter'
--
-- `satuan` itulah yang memberi tahu layar bahwa isinya sentimeter dan yang
-- ditampilkan meter — penanda yang sama persis dengan `detik`, dibaca di
-- kotak isian, kepala kolom, rekap, dan blangko. Tanpa penanda itu angkanya
-- akan tampil apa adanya sebagai 855.
--
-- RENTANGNYA DIPERKETAT, bukan sekadar dikonversi. 999,99 m tidak menolak
-- apa pun yang bisa salah ketik; 100 m menolak "855" yang lahir dari titik
-- yang terlewat, sementara masih longgar untuk apa pun yang bisa ditaksir
-- dengan mata di lapangan.
--
-- ---------------------------------------------------------------------------
-- NILAI YANG SUDAH TERLANJUR MASUK
--
-- Tidak ada yang dikonversi otomatis, dan itu disengaja: baris menaksir yang
-- ada sekarang lahir sebelum 0085, jadi isinya SELISIH dalam meter — bukan
-- taksiran, bukan sentimeter. Mengalikannya 100 hanya akan mengubah angka
-- yang salah jadi angka yang salah dan besar. Yang benar mengetiknya ulang
-- dari kertas. Pada saat berkas ini ditulis seluruh isi produksi masih data
-- uji; jumlahnya dilaporkan di bawah supaya yang menjalankan tahu persis
-- berapa yang perlu diketik ulang.
-- ============================================================================

do $blok$
declare
  v_baris integer;
  v_nilai integer;
  v_edisi smallint := edisi_aktif();
begin
  select count(*) into v_nilai
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  where w.edisi = v_edisi and w.kode = 'menaksir';

  update wahana set
    satuan        = 'meter',
    jawaban_benar = 855,
    tingkat = '[{"sampai": 100, "poin": 100},
                {"sampai": 200, "poin": 80},
                {"sampai": 300, "poin": 60},
                {"sampai": 400, "poin": 40},
                {"sampai": 500, "poin": 20}]'::jsonb,
    rentang_mentah_min  = 0,
    rentang_mentah_maks = 10000
  where edisi = v_edisi and kode = 'menaksir';

  get diagnostics v_baris = row_count;

  if v_baris = 0 then
    raise notice '0086: baris menaksir tidak ada di edisi % — dilewati.', v_edisi;
  else
    raise notice '0086: taksiran disimpan sentimeter; jawaban 855 cm (8,55 m), '
                 'selisih sampai 100 cm tetap 100 poin.';
    if v_nilai > 0 then
      raise notice '0086: % nilai menaksir sudah tersimpan dan TIDAK '
                   'dikonversi — isinya selisih meter dari sebelum 0085. '
                   'Ketik ulang dari kertas.', v_nilai;
    end if;
  end if;
end;
$blok$;
