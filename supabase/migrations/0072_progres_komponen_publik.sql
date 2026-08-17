-- ============================================================================
-- hrcd-rekap : 0072_progres_komponen_publik.sql
-- Halaman peserta butuh data yang sama bentuknya dengan layar panitia.
--
-- KENAPA
--
-- Diminta pemilik acara: tampilan peserta sama persis dengan Live Score
-- panitia, bedanya cuma "masking" — di fase `progres` nilainya diganti
-- CENTANG. "Semaphore sudah masuk ✓, Tebak Simpul belum."
--
-- `v_progres_publik` selama ini hanya membawa `pos_terlewati`: satu boolean
-- PER POS. Dengan itu halaman peserta tidak bisa menggambar kolom per
-- komponen sama sekali — ia tidak tahu Semaphore dan Tebak Simpul itu dua
-- hal berbeda.
--
-- DUA KOLOM BARU, DAN PEMBAGIAN TUGASNYA
--
--   komponen_terisi   {"1.semaphore": true, "1.tebak_simpul": false, ...}
--                     Ada di fase `progres` MAUPUN `penuh`. Ini yang jadi
--                     centang.
--   nilai             {"1.semaphore": {"nilai_1": 4, "nilai_2": null}, ...}
--                     HANYA di fase `penuh`. Di `progres` ia objek kosong —
--                     bukan berisi angka yang disembunyikan tampilan.
--
-- Pemisahan itu bukan kerapian. Berkas rekap.json duduk di CDN dan bisa
-- diminta siapa pun yang tahu alamatnya; satu-satunya jaminan bahwa nilai
-- belum bocor adalah nilainya MEMANG TIDAK ADA DI SANA. Kalau `nilai` ikut
-- terisi di fase `progres`, jaminan itu berubah jadi "ada tapi tidak
-- digambar", dan centangnya jadi hiasan.
--
-- Kolom ditambahkan DI BELAKANG: PostgreSQL mengizinkan kolom baru di ujung
-- pada `create or replace view`, tapi menolak kalau urutan atau tipe kolom
-- yang sudah ada ikut bergeser.
-- ============================================================================

create or replace view v_progres_publik as
select
  r.nomor_dada,
  r.nama_regu,
  s.name as nama_sekolah,
  r.golongan,
  (select jsonb_object_agg(p.nomor::text,
            exists (select 1 from nilai_mentah n
                    join wahana w on w.id = n.wahana_id
                    where n.regu_id = r.id and w.pos = p.nomor))
   from pos p
   where p.edisi = edisi_aktif()
     and exists (select 1 from wahana w
                 where w.edisi = p.edisi and w.pos = p.nomor)) as pos_terlewati,
  exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing,
  r.kloter_nomor                              as kloter,
  r.kontrak_menit,
  k.jam_berangkat,
  case when k.jam_berangkat is not null and r.kontrak_menit is not null
    then k.jam_berangkat + make_interval(mins => r.kontrak_menit)
  end                                         as target_datang,
  c.jam_datang,
  exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
                                              as sudah_berangkat,

  -- Centang per komponen. Komponen yang tidak berlaku untuk golongan regu ini
  -- TIDAK ikut — kolomnya digambar sebagai "–" oleh halaman peserta, sama
  -- seperti layar panitia.
  (select coalesce(jsonb_object_agg(w.pos || '.' || w.kode,
            exists (select 1 from nilai_mentah n
                     where n.regu_id = r.id and n.wahana_id = w.id)), '{}'::jsonb)
   from wahana w
   where w.edisi = edisi_aktif()
     and (w.golongan is null or w.golongan = r.golongan))    as komponen_terisi,

  -- Nilai asli, HANYA saat hasil sudah diumumkan.
  case when (select fase_live from status_acara) = 'penuh' then
    (select coalesce(jsonb_object_agg(w.pos || '.' || w.kode,
              jsonb_build_object('nilai_1', n.nilai_1, 'nilai_2', n.nilai_2)), '{}'::jsonb)
     from nilai_mentah n join wahana w on w.id = n.wahana_id
     where n.regu_id = r.id and w.edisi = edisi_aktif())
  else '{}'::jsonb end                                        as nilai
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
left join kloter k        on k.nomor = r.kloter_nomor
left join closing_regu c  on c.regu_id = r.id
where not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and (select fase_live from status_acara) in ('progres', 'penuh');

do $blok$
declare v_n int; v_nilai int;
begin
  select count(*) into v_n from v_progres_publik;
  select count(*) into v_nilai from v_progres_publik where nilai <> '{}'::jsonb;
  raise notice '0072: % baris progres publik, % membawa nilai (0 kalau fase belum penuh).',
    v_n, v_nilai;
end $blok$;
