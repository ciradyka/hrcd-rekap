-- ============================================================================
-- hrcd-rekap : 0095_lembar_pos_jawaban_benar.sql
-- Nilai Pos di layar juri dihitung dengan jawaban benar, sama seperti klasemen.
--
-- ---------------------------------------------------------------------------
-- APA YANG SALAH
--
-- Poin tidak pernah disimpan; ia diturunkan tiap kali dibaca, dan diturunkan
-- di DUA tempat:
--
--   v_poin_wahana  -> v_poin_pos -> v_total_skor -> v_klasemen   (klasemen)
--   v_lembar_pos.nilai_pos                                        (layar juri)
--
-- 0085 menambahkan argumen ke-11 `p_jawaban_benar` ke hitung_poin dan
-- membangun ulang KEDUANYA, dengan alasan yang ditulis di kepalanya sendiri:
-- kalau salah satu ditinggalkan memakai bentuk lama, "layar Input Nilai Pos
-- menampilkan Nilai Pos yang dihitung TANPA jawaban benar sementara klasemen
-- memakai yang dengan. Dua angka untuk satu regu di dua layar, keduanya tanpa
-- galat."
--
-- 0091 membangun ulang v_lembar_pos sekali lagi — untuk menambahkan pagar
-- Intern — dan menyalin badannya dari 0065, yaitu bentuk SEBELUM 0085. Sejak
-- itu panggilannya kembali sepuluh argumen, tanpa `w.jawaban_benar`.
--
-- ---------------------------------------------------------------------------
-- KENAPA TIDAK ADA GALAT SAMA SEKALI
--
-- Argumen ke-11 punya `default null`, jadi panggilan sepuluh argumen tetap
-- cocok dengan fungsi yang sama. Bentuk sepuluh argumen memang sudah di-drop
-- di akhir 0085, dan itu justru yang menyesatkan: yang dibuang overload-nya,
-- bukan kemampuan memanggilnya dengan argumen kurang. Apply-nya berhasil,
-- pembacaannya berhasil, dan yang berubah cuma angkanya.
--
-- Yang terlihat di lapangan, dengan konfigurasi Menaksir hari ini
-- (jawaban_benar 855 cm, tangga 100/200/300/400/500 cm):
--
--   taksiran 830 cm  ->  klasemen  : |830-855| = 25 cm  -> 100 poin
--                        layar juri: 830 dibaca apa adanya, lebih besar dari
--                                    seluruh batas tangga -> 0 poin
--
-- Juri melihat 0 untuk regu yang sebenarnya mendapat angka penuh. Tidak ada
-- yang merah, tidak ada yang gagal — dua layar cuma menyebut dua angka.
-- Hanya `bertingkat` ber-jawaban_benar yang terpengaruh, yaitu Menaksir; itu
-- sebabnya ia tidak tertangkap oleh mata siapa pun yang melihat Pos 2 sampai
-- Pos 5.
--
-- ---------------------------------------------------------------------------
-- YANG DILAKUKAN BERKAS INI
--
-- Badan view disalin UTUH dari 0091 — termasuk pagar Intern
-- (`komponen_berlaku`) dan predikat EXISTS di akhirnya. Satu-satunya yang
-- berubah: `w.jawaban_benar` dikembalikan sebagai argumen ke-11.
--
-- `create or replace view` menolak daftar kolom yang berubah urutan atau
-- tipenya, jadi kolomnya harus sama persis — dan memang begitu.
--
-- Argumen default-nya sengaja TIDAK dibuang. Membuangnya memang akan membuat
-- panggilan yang lupa gagal keras, tetapi belasan tes memanggil hitung_poin
-- dengan sepuluh argumen untuk komponen yang memang tidak punya jawaban benar
-- (tes 08, 14, 16, 39), dan itu pemakaian yang sah. Yang menjaga supaya
-- kejadian ini tidak terulang bukan tanda tangan fungsinya melainkan
-- tests/sql/56_lembar_pos_sama_dengan_klasemen.sql: ia membandingkan
-- nilai_pos milik SETIAP baris v_lembar_pos dengan jumlah v_poin_wahana untuk
-- regu dan pos yang sama. Siapa pun yang membangun ulang salah satu view ini
-- lagi dan lupa satu argumen akan melihat CI merah, bukan dua angka di dua
-- layar.
-- ============================================================================

create or replace view v_lembar_pos as
select
  p.nomor       as pos,
  p.name        as nama_pos,
  p.bayangan,
  r.id          as regu_id,
  r.nomor_dada,
  r.nama_regu,
  s.name        as nama_sekolah,
  r.golongan,
  coalesce((
    select jsonb_object_agg(w.kode, jsonb_build_object(
             'nilai_1', n.nilai_1, 'nilai_2', n.nilai_2))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), '{}'::jsonb) as nilai,
  (select count(*) from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor)::int
                as jumlah_terisi,
  (select count(*) from wahana w
   where w.edisi = p.edisi and w.pos = p.nomor
     and komponen_berlaku(w.golongan, r.golongan))::int
                as jumlah_komponen,

  -- INI yang berubah dari 0091: `w.jawaban_benar` sebagai argumen ke-11,
  -- persis seperti v_poin_wahana (0085) memanggilnya.
  round(coalesce((
    select sum(hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
                           w.raw_terbaik, w.raw_terburuk,
                           w.poin_benar, w.poin_salah, w.total_soal, w.tingkat,
                           w.jawaban_benar))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), 0) * p.bobot, 2) as nilai_pos,

  nilai_tergembok(r.id, p.nomor) as terkunci
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
cross join pos p
where p.edisi = edisi_aktif()
  and not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and boleh('pos')
  and (pos_saya() is null or p.nomor = pos_saya())
  and exists (
    select 1 from wahana w
    where w.edisi = p.edisi and w.pos = p.nomor
      and komponen_berlaku(w.golongan, r.golongan)
  );
