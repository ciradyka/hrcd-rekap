-- ============================================================================
-- hrcd-rekap : 0005_views.sql
-- Rantai view hitung-saat-baca. Acuan: docs/rancangan-b.md bagian 5.
--
-- Tidak ada angka turunan yang disimpan: tidak ada job rekap, tidak ada cache
-- basi, tidak ada tombol "hitung ulang". Edit konfigurasi langsung berlaku
-- pada muat ulang layar berikutnya.
--
-- security_invoker = on: view tunduk pada RLS pemanggil — kecuali
-- v_progres_publik dan v_klasemen_publik yang dibaca service role
-- (GitHub Actions) dan memang tidak berisi PII.
-- ============================================================================

-- 1. Poin per komponen: nilai mentah -> poin (mesin konversi).
create view v_poin_wahana with (security_invoker = on) as
select
  n.regu_id,
  w.pos,
  w.id   as wahana_id,
  w.kode,
  n.nilai_1,
  n.nilai_2,
  hitung_poin(w.bentuk, n.nilai_1, n.nilai_2, w.poin_maks,
              w.raw_terbaik, w.raw_terburuk,
              w.poin_benar, w.poin_salah, w.total_soal) as poin
from nilai_mentah n
join wahana w on w.id = n.wahana_id
where w.edisi = edisi_aktif();

-- 2. Poin per pos: jumlah komponen x bobot pos. Pos terlewat menyumbang 0
--    lewat LEFT JOIN di v_total_skor — tanpa pengurangan tambahan (alur 10.8).
create view v_poin_pos with (security_invoker = on) as
select
  pw.regu_id,
  pw.pos,
  round(sum(pw.poin) * p.bobot, 2) as poin_pos
from v_poin_wahana pw
join pos p on p.edisi = edisi_aktif() and p.nomor = pw.pos
group by pw.regu_id, pw.pos, p.bobot;

-- 3. Penalti waktu: target = jam berangkat kloter + kontrak; selisih presisi
--    menit (tie-break); penalti = floor(|selisih| / blok) * per_blok —
--    simetris; toleransi 0-9 menit LAHIR DARI floor, bukan aturan tersendiri.
create view v_penalti_waktu with (security_invoker = on) as
select
  r.id as regu_id,
  k.jam_berangkat,
  r.kontrak_menit,
  c.jam_datang,
  case when k.jam_berangkat is not null and r.kontrak_menit is not null
            and c.jam_datang is not null
    then round(extract(epoch from (
           c.jam_datang - (k.jam_berangkat + make_interval(mins => r.kontrak_menit))
         )) / 60)::int
  end as selisih_menit,   -- bertanda: negatif = kecepatan, positif = telat
  case when k.jam_berangkat is not null and r.kontrak_menit is not null
            and c.jam_datang is not null
    -- floor pada menit MENTAH, bukan hasil pembulatan: 9m30s adalah selisih
    -- 9,5 menit = penalti 0; membulatkan dulu ke 10 lalu mem-floor akan
    -- menghukum regu yang sebenarnya masih di dalam blok (temuan review).
    then floor((abs(extract(epoch from (
           c.jam_datang - (k.jam_berangkat + make_interval(mins => r.kontrak_menit))
         ))) / 60.0) / kp.blok_menit) * kp.penalti_per_blok
    else 0
  end as penalti_waktu
from regu r
left join kloter k        on k.nomor = r.kloter_nomor
left join closing_regu c  on c.regu_id = r.id
cross join konfig_penalti kp
where kp.edisi = edisi_aktif();

-- 4. Total skor per regu: seluruh pos - seluruh pengurangan (alur 9.3, 10).
--    -100 tanpa checkout dihitung DI SINI (tidak ada baris closing => kena;
--    penalti waktu saat itu 0 karena tak terhitung). -20 per anggota hilang.
create view v_total_skor with (security_invoker = on) as
select
  r.id            as regu_id,
  r.nomor_dada,
  r.nama_regu,
  s.nama          as nama_sekolah,
  r.golongan,
  -- Pos terlewat menyumbang nilai_pos_terlewat per pos (knob konfigurasi;
  -- default 0 — temuan review: sebelumnya knob ini mati).
  coalesce(pp.total_pos, 0)
    + (( (select count(*) from pos p where p.edisi = edisi_aktif())
         - coalesce(pp.jumlah_pos, 0) ) * kp.nilai_pos_terlewat)
                                                  as total_pos,
  pw.penalti_waktu,
  case when c.regu_id is null then kp.penalti_tanpa_checkout else 0 end
                                                  as penalti_checkout,
  case when c.regu_id is not null
    then (5 - c.anggota_hadir) * kp.penalti_per_anggota_hilang else 0 end
                                                  as penalti_anggota,
  coalesce(pp.total_pos, 0)
    + (( (select count(*) from pos p where p.edisi = edisi_aktif())
         - coalesce(pp.jumlah_pos, 0) ) * kp.nilai_pos_terlewat)
    - pw.penalti_waktu
    - case when c.regu_id is null then kp.penalti_tanpa_checkout else 0 end
    - case when c.regu_id is not null
        then (5 - c.anggota_hadir) * kp.penalti_per_anggota_hilang else 0 end
                                                  as total,
  pw.selisih_menit
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
left join (select regu_id, sum(poin_pos) as total_pos, count(*) as jumlah_pos
           from v_poin_pos group by regu_id) pp on pp.regu_id = r.id
join v_penalti_waktu pw  on pw.regu_id = r.id
left join closing_regu c on c.regu_id = r.id
cross join konfig_penalti kp
where kp.edisi = edisi_aktif()
  and not r.batal
  -- Batch yang mundur dari 'lunas' ikut keluar dari seluruh penilaian
  -- (temuan review).
  and d.status = 'lunas';

-- 5. Klasemen: empat golongan terpisah; tie-break ketepatan waktu presisi
--    menit sudah tertanam di ORDER BY. Regu batal / tak pernah berangkat
--    tidak ikut diperingkat (rancangan-b.md 11.12).
create view v_klasemen with (security_invoker = on) as
select
  rank() over (partition by t.golongan
               order by t.total desc, abs(coalesce(t.selisih_menit, 100000)) asc)
    as peringkat,
  t.*
from v_total_skor t
where exists (select 1 from keberangkatan_regu kb where kb.regu_id = t.regu_id)
  -- Ceklis saja belum cukup — jam yang dinilai milik kloter; regu yang
  -- kloternya belum pernah berangkat tidak diperingkat (temuan review).
  and exists (select 1 from regu r join kloter k on k.nomor = r.kloter_nomor
              where r.id = t.regu_id and k.jam_berangkat is not null);

-- 6. Monitoring input: matriks regu x pos — pos mana sudah menyetor untuk
--    regu mana (alur 8.7).
create view v_monitoring_input with (security_invoker = on) as
select
  r.nomor_dada,
  r.nama_regu,
  r.golongan,
  r.kloter_nomor,
  p.nomor as pos,
  exists (select 1 from nilai_mentah n
          join wahana w on w.id = n.wahana_id
          where n.regu_id = r.id and w.pos = p.nomor) as sudah_input,
  (select count(*) from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where n.regu_id = r.id and w.pos = p.nomor) as jumlah_komponen_terisi,
  exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
cross join pos p
where p.edisi = edisi_aktif()
  and not r.batal
  and d.status = 'lunas'
  and r.nomor_dada is not null
  -- Operator pos hanya melihat kolom pos-nya: RLS nilai_mentah membuat
  -- kolom pos lain SELALU tampak kosong — tampilan palsu lebih buruk
  -- daripada tampilan sempit (temuan review).
  and (peran() <> 'operator_pos' or p.nomor = pos_saya());

-- 7. Papan garis start: posisi pipeline DITURUNKAN dari kloter terakhir yang
--    berangkat (rancangan-b.md 11.5) — tidak ada status yang digeser manual.
--    N terakhir berangkat => N+1..N+2 siap, N+3 konfirmasi kontrak.
create view v_keberangkatan with (security_invoker = on) as
with terakhir as (
  select coalesce(max(nomor), 0) as n
  from kloter where jam_berangkat is not null
)
select
  k.nomor,
  k.jam_berangkat,
  case
    when k.jam_berangkat is not null            then 'berangkat'
    when k.nomor <= t.n + 2                     then 'siap'
    when k.nomor =  t.n + 3                     then 'konfirmasi_kontrak'
    else 'menunggu'
  end as posisi,
  (select count(*) from regu r
   where r.kloter_nomor = k.nomor and not r.batal) as jumlah_regu,
  (select count(*) from regu r
   join keberangkatan_regu kb on kb.regu_id = r.id
   where r.kloter_nomor = k.nomor)               as sudah_ceklis,
  (select count(*) from regu r
   where r.kloter_nomor = k.nomor and not r.batal
     and r.kontrak_menit is not null)            as sudah_kontrak
from kloter k
cross join terakhir t
where exists (select 1 from regu r where r.kloter_nomor = k.nomor)
   or k.jam_berangkat is not null;

-- 8. Lembar nilai cetak per pos: identitas terisi, kolom nilai kosong untuk
--    petugas; urut nomor dada — urutan kanonik (rancangan-b.md 11.13).
--    Header kolom diambil layar cetak dari wahana.kode pos bersangkutan.
create view v_lembar_nilai with (security_invoker = on) as
select
  r.nomor_dada,
  r.nama_regu,
  s.nama as nama_sekolah,
  r.golongan
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
where not r.batal and r.nomor_dada is not null and d.status = 'lunas'
order by r.nomor_dada;

-- 9. Kwitansi cetak per batch.
create view v_kwitansi with (security_invoker = on) as
select
  b.nomor_kwitansi,
  d.kode_pembayaran,
  s.nama   as nama_sekolah,
  s.alamat as alamat_sekolah,
  d.jumlah_regu,
  b.nominal,
  b.metode,
  b.diverifikasi_pada,
  (select jsonb_agg(jsonb_build_object(
            'nama_regu', r.nama_regu, 'golongan', r.golongan)
          order by r.nama_regu)
   from regu r where r.pendaftaran_id = d.id) as daftar_regu
from pembayaran b
join pendaftaran d on d.id = b.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id;

-- 10. Okupansi barak.
create view v_barak with (security_invoker = on) as
select
  ru.nama       as ruangan,
  ru.kapasitas,
  coalesce(sum(p.jumlah_orang), 0)                as terisi,
  ru.kapasitas - coalesce(sum(p.jumlah_orang), 0) as sisa,
  coalesce(jsonb_agg(jsonb_build_object(
             'sekolah', s.nama, 'orang', p.jumlah_orang))
           filter (where p.id is not null), '[]') as penghuni
from ruangan ru
left join penempatan_barak p on p.ruangan_id = ru.id
left join pendaftaran d      on d.id = p.pendaftaran_id
left join sekolah s          on s.id = d.sekolah_id
group by ru.id, ru.nama, ru.kapasitas;

-- 11. View publik — dibaca HANYA oleh service role (GitHub Actions), tanpa
--     PII, isinya mengikuti fase_live (rancangan-b.md bagian 7).
--     fase 'pra':     baris kosong (halaman menampilkan hitungan pendaftar
--                     dari v_publik_ringkas).
--     fase 'progres': per regu tanpa angka — hanya pos mana yang sudah lewat.
--     fase 'penuh':   klasemen lengkap.
create view v_progres_publik as
select
  r.nomor_dada,
  r.nama_regu,
  s.nama as nama_sekolah,
  r.golongan,
  (select jsonb_object_agg(p.nomor::text,
            exists (select 1 from nilai_mentah n
                    join wahana w on w.id = n.wahana_id
                    where n.regu_id = r.id and w.pos = p.nomor))
   from pos p where p.edisi = edisi_aktif())     as pos_terlewati,
  exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
where not r.batal
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
  and (select fase_live from status_acara) in ('progres', 'penuh');

create view v_klasemen_publik as
select peringkat, nomor_dada, nama_regu, nama_sekolah, golongan,
       total_pos, penalti_waktu, penalti_checkout, penalti_anggota, total
from v_klasemen
where (select fase_live from status_acara) = 'penuh';

create view v_publik_ringkas as
select
  (select fase_live from status_acara) as fase_live,
  (select count(*) from regu r
   join pendaftaran d on d.id = r.pendaftaran_id
   where d.status = 'lunas' and not r.batal) as jumlah_regu_lunas,
  (select jsonb_object_agg(golongan, jumlah) from (
     select golongan, count(*) as jumlah
     from regu r join pendaftaran d on d.id = r.pendaftaran_id
     where d.status = 'lunas' and not r.batal
     group by golongan) g) as per_golongan;

-- View panitia: grant eksplisit (dibuat setelah grant massal di 0003).
-- service_role ikut karena rantai view publik melewatinya.
grant select on v_poin_wahana, v_poin_pos, v_penalti_waktu, v_total_skor,
  v_klasemen, v_monitoring_input, v_keberangkatan, v_lembar_nilai,
  v_kwitansi, v_barak to authenticated, service_role;

-- Info edisi untuk FORM PUBLIK (biaya & tanggal — tanpa PII, tanpa login).
create view v_edisi_publik as
select nomor, nama, biaya_per_regu, tanggal_lomba
from edisi where aktif;
grant select on v_edisi_publik to anon, authenticated, service_role;

-- View publik tidak untuk klien anon/authenticated — hanya service role
-- (GitHub Actions memakai service key).
revoke all on v_progres_publik, v_klasemen_publik, v_publik_ringkas
  from anon, authenticated;
grant select on v_progres_publik, v_klasemen_publik, v_publik_ringkas
  to service_role;
