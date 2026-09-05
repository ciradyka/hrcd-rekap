-- ============================================================================
-- hrcd-rekap : 0171_lembar_pos_jawaban_benar_kembali.sql
-- Kembalikan argumen ke-11 `w.jawaban_benar` ke panggilan hitung_poin() di
-- dalam v_lembar_pos. Ini KETIGA KALINYA hilang.
--
-- APA YANG SALAH
--
-- Sesudah seluruh migrasi diterapkan berurutan, dua jalur yang menghitung
-- Nilai Pos memanggil hitung_poin() dengan cara BERBEDA:
--
--   v_lembar_pos   argumennya sepuluh   -> layar Input Nilai Pos (juri)
--   v_poin_wahana  argumennya sebelas   -> klasemen, Rekap, Live Score
--
-- Argumen ke-11 `p_jawaban_benar` punya `default null`, jadi panggilan yang
-- melupakannya TIDAK gagal: migrasinya berhasil, view-nya terbaca, cuma
-- angkanya yang berubah. Tidak ada yang merah dan tidak ada yang kosong --
-- dua layar hanya menyebut dua angka untuk regu yang sama.
--
-- YANG TERASA DI LAPANGAN
--
-- Hanya komponen `bertingkat` yang punya `jawaban_benar` yang terkena, dan
-- di konfigurasi produksi itu cuma Menaksir (jawaban_benar 855 cm, tangga
-- 100/200/300/400/500 cm). Contoh dari kepala 0095, masih berlaku persis:
--
--   taksiran 830 cm  ->  klasemen  : |830-855| = 25 cm  -> 100 poin
--                        layar juri: 830 dibaca apa adanya, lewat seluruh
--                                    anak tangga            ->   0 poin
--
-- Juri melihat 0 untuk regu yang sebenarnya mendapat angka penuh, lalu
-- mengetik ulang nilai yang sudah benar.
--
-- KENAPA HILANG LAGI
--
-- 0085 menambahkan argumennya. 0091 menulis ulang v_lembar_pos dari badan
-- yang lebih tua dan menjatuhkannya; 0095 mengembalikannya. Sekarang 0166
-- melakukan hal yang sama: ia membangun ulang view ini supaya `terkunci`
-- jadi per lomba, dan badan yang disalinnya mendahului 0095.
--
-- Ini bukan kecerobohan satu orang, melainkan bentuk yang berulang: setiap
-- `create or replace view` menuliskan ULANG seluruh badan view, jadi tiap
-- migrasi yang menyentuh satu kolom harus membawa serta setiap keputusan
-- yang pernah dibuat pada kolom lain. Yang menahan itu cuma pemeriksaan,
-- dan pemeriksaannya tidak berjalan pada tempat yang tepat -- lihat bawah.
--
-- YANG TIDAK BERUBAH
--
-- SELURUH sisanya milik 0166 dan dibiarkan apa adanya: `v_lomba_pos`,
-- kolom `lomba_terkunci`, `nilai_tergembok()` di kolom `terkunci`, dan
-- pagar hak di klausa `where`. Badan di bawah adalah SALINAN PERSIS badan
-- 0166 dengan SATU kata ditambahkan.
--
-- KENAPA PAGARNYA TIDAK MENANGKAP
--
-- 0095 memasang tests/sql/56_lembar_pos_sama_dengan_klasemen.sql tepat untuk
-- ini, dan tes itu bekerja -- tetapi ia berjalan di tests/run.sh baris 408,
-- sesaat sesudah 0095. Migrasi 0166 berjalan 320 baris di bawahnya, jadi
-- invarian itu dibuktikan pada saat ia dibuat lalu tidak pernah diperiksa
-- lagi terhadap skema akhir. Suite hijau, skema akhirnya melanggar.
--
-- Yang menemukannya supabase/checks/status_migrasi.sql, satu-satunya yang
-- membaca skema SESUDAH semuanya mendarat: jejak 0085 melapor BELUM di atas
-- database yang dibangun dari nol. Itu bukan migrasi yang terlewat -- itu
-- regresi ini, muncul sebagai jejak yang tidak lagi berdiri.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Salinan persis v_lembar_pos milik 0166, dengan `w.jawaban_benar` sebagai
-- argumen ke-11 hitung_poin() -- sama seperti v_poin_wahana (0085)
-- memanggilnya, dan itulah seluruh isi perubahan ini.
-- ---------------------------------------------------------------------------
create or replace view v_lembar_pos as
select p.nomor as pos,
    p.name as nama_pos,
    p.bayangan,
    r.id as regu_id,
    r.nomor_dada,
    r.nama_regu,
    s.name as nama_sekolah,
    r.golongan,
    coalesce((select jsonb_object_agg(w.kode, jsonb_build_object('nilai_1', n.nilai_1, 'nilai_2', n.nilai_2))
           from nilai_mentah n join wahana w on w.id = n.wahana_id
          where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor), '{}'::jsonb) as nilai,
    ((select count(*) from nilai_mentah n join wahana w on w.id = n.wahana_id
          where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor))::integer as jumlah_terisi,
    ((select count(*) from wahana w
          where w.edisi = p.edisi and w.pos = p.nomor and komponen_berlaku(w.golongan, r.golongan)))::integer as jumlah_komponen,
    round(coalesce((select sum(hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks, w.raw_terbaik, w.raw_terburuk, w.poin_benar, w.poin_salah, w.total_soal, w.tingkat, w.jawaban_benar))
           from nilai_mentah n join wahana w on w.id = n.wahana_id
          where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor), 0::numeric) * p.bobot, 2) as nilai_pos,
    nilai_tergembok(r.id, p.nomor) as terkunci,
    coalesce((select array_agg(t.kode_lomba order by t.kode_lomba)
           from nilai_terkunci t
          where t.regu_id = r.id and t.pos = p.nomor), '{}'::text[]) as lomba_terkunci
   from regu r
     join pendaftaran d on d.id = r.pendaftaran_id
     join sekolah s on s.id = d.sekolah_id
     cross join pos p
  where p.edisi = edisi_aktif() and not r.is_cancelled and d.status = 'lunas'::text
    and r.nomor_dada is not null and boleh('pos'::text)
    and (pos_saya() is null or p.nomor = pos_saya())
    and (exists (select 1 from wahana w
          where w.edisi = p.edisi and w.pos = p.nomor and komponen_berlaku(w.golongan, r.golongan)));

-- ---------------------------------------------------------------------------
-- Penjaga: gagal keras kalau badannya tidak membawa argumen ke-11.
--
-- Bukan hiasan. Tiga kali argumen ini hilang lewat `create or replace view`
-- yang menuliskan ulang seluruh badan, dan tiga-tiganya berhasil diterapkan
-- tanpa satu pun galat. Yang diperiksa di sini definisi yang BENAR-BENAR
-- terpasang, bukan yang baru saja diketik di atas -- kalau suatu hari
-- migrasi ini dijalankan ulang sesudah migrasi lain menulis ulang view-nya,
-- di sinilah ia berhenti.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_views
    where schemaname = 'public' and viewname = 'v_lembar_pos'
      and position('w.total_soal, w.tingkat, w.jawaban_benar' in definition) > 0)
  then
    raise exception
      '0171: v_lembar_pos tidak memanggil hitung_poin dengan w.jawaban_benar';
  end if;
  raise notice
    '0171: v_lembar_pos memanggil hitung_poin dengan w.jawaban_benar lagi.';
end $$;
