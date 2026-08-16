-- ============================================================================
-- hrcd-rekap : 0060_kelengkapan_per_golongan.sql
-- Kelengkapan pos dihitung per GOLONGAN, bukan per pos.
--
-- CACATNYA
--
-- `v_kelengkapan_pos` (0028) dan `v_kelengkapan_publik` (0048) menyebut sebuah
-- regu "lengkap" di satu pos kalau jumlah nilainya sama dengan
-- `v_pos.jumlah_komponen` — SELURUH komponen pos itu.
--
-- Itu benar hanya kalau setiap regu mengisi setiap komponen. Pos 1 tidak
-- begitu: dari enam komponennya, empat adalah Tebak Simpul yang berbeda per
-- golongan (`tebak_simpul_pg_pa`, `_pg_pi`, `_pn_pa`, `_pn_pi`). Satu regu
-- mengisi tiga — Semaphore, Tebak Simpul miliknya, Menaksir — dan tiga tidak
-- akan pernah sama dengan enam.
--
-- Akibatnya Pos 1 menunjukkan **0%** selamanya. Bukan angka yang meleset:
-- nol, sepanjang hari, sementara empat pos lain bergerak normal. Panitia yang
-- melihat papan itu akan menyimpulkan juri Pos 1 belum memasukkan apa pun dan
-- pergi mencari orang yang sebenarnya sudah selesai.
--
-- Ini bukan cacat data. Ia sudah ada sejak 0028, dan tidak pernah terlihat
-- karena konfigurasi pos edisi-edisi sebelumnya tidak punya komponen
-- per-golongan. `wahana.golongan` sendiri sudah lama ada — yang belum, dua
-- view ini menghormatinya.
--
-- CARA MEMPERBAIKINYA
--
-- Penyebutnya berhenti menjadi milik pos dan menjadi milik PASANGAN
-- (pos, golongan). Satu fungsi, dipakai kedua view, supaya papan panitia dan
-- papan peserta tidak pernah menghitung dengan penyebut yang berbeda — dan
-- itu bukan kerapian: dua angka berbeda untuk pertanyaan yang sama akan
-- membuat panitia berdebat dengan peserta di tengah lomba.
--
-- `v_pos.jumlah_komponen` DIBIARKAN. Ia jawaban yang benar untuk pertanyaan
-- lain — berapa kolom yang dicetak di blangko pos itu — dan blangko memang
-- memuat seluruh golongan.
-- ============================================================================

create or replace function komponen_pos_golongan(p_pos smallint, p_golongan text)
returns int
language sql stable
set search_path = public
as $$
  select count(*)::int
    from wahana w
   where w.edisi = edisi_aktif()
     and w.pos = p_pos
     -- golongan NULL = komponen yang diisi semua orang (Semaphore, Menaksir).
     and (w.golongan is null or w.golongan = p_golongan)
$$;

comment on function komponen_pos_golongan(smallint, text) is
  'Berapa komponen yang HARUS diisi satu regu bergolongan ini di pos ini. Penyebut kelengkapan; v_pos.jumlah_komponen menjawab pertanyaan lain (lebar blangko).';

-- ---------------------------------------------------------------------------
-- 1. Papan panitia.
-- ---------------------------------------------------------------------------
drop view if exists v_kelengkapan_pos;
create view v_kelengkapan_pos as
with regu_ikut as (
  select
    r.id,
    r.golongan,
    (k.jam_berangkat is not null)                                as sudah_berangkat,
    exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing
  from regu r
  join pendaftaran d  on d.id = r.pendaftaran_id
  left join kloter k  on k.nomor = r.kloter_nomor
  where not r.is_cancelled
    and d.status = 'lunas'
    and r.nomor_dada is not null
),
terisi as (
  select n.regu_id, w.pos, count(*)::int as jumlah
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif()
  group by n.regu_id, w.pos
)
select
  p.nomor                       as pos,
  p.name                        as nama_pos,
  p.bayangan,
  p.jumlah_komponen,
  count(ri.id)::int                                      as regu_total,
  count(ri.id) filter (where ri.sudah_berangkat)::int    as regu_berangkat,
  count(ri.id) filter (where ri.sudah_closing)::int      as regu_closing,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0)
          = komponen_pos_golongan(p.nomor, ri.golongan))::int as lengkap,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0) > 0
      and coalesce(t.jumlah, 0)
          < komponen_pos_golongan(p.nomor, ri.golongan))::int as sebagian,
  count(ri.id) filter (where coalesce(t.jumlah, 0) = 0)::int  as kosong,
  count(ri.id) filter (
    where ri.sudah_closing
      and coalesce(t.jumlah, 0)
          < komponen_pos_golongan(p.nomor, ri.golongan))::int as hilang
from v_pos p
left join regu_ikut ri on true
left join terisi t     on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
group by p.nomor, p.name, p.bayangan, p.jumlah_komponen;

grant select on v_kelengkapan_pos to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Papan peserta. Syarat fasenya tetap: tanpa itu kemajuan bocor sebelum
--    admin membukanya.
-- ---------------------------------------------------------------------------
create or replace view v_kelengkapan_publik as
with regu_ikut as (
  select r.id, r.golongan
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled
    and d.status = 'lunas'
    and r.nomor_dada is not null
),
terisi as (
  select n.regu_id, w.pos, count(*)::int as jumlah
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif()
  group by n.regu_id, w.pos
)
select
  p.nomor          as pos,
  p.name           as nama_pos,
  p.jumlah_komponen,
  count(ri.id)::int as regu_total,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0)
          = komponen_pos_golongan(p.nomor, ri.golongan))::int as lengkap,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0) > 0
      and coalesce(t.jumlah, 0)
          < komponen_pos_golongan(p.nomor, ri.golongan))::int as sebagian,
  -- Dibulatkan ke bawah, bukan ke terdekat: 99,6% yang tampil sebagai "100%"
  -- padahal masih ada dua regu tertinggal adalah persis kekeliruan yang
  -- membuat orang berhenti mencari.
  case when count(ri.id) = 0 then 0 else
    floor(100.0 * count(ri.id) filter (
      where coalesce(t.jumlah, 0)
            = komponen_pos_golongan(p.nomor, ri.golongan)) / count(ri.id))::int
  end              as persen
from v_pos p
left join regu_ikut ri on true
left join terisi t     on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
  and (select fase_live from status_acara) in ('progres', 'penuh')
group by p.nomor, p.name, p.jumlah_komponen;

grant select on v_kelengkapan_publik to anon, authenticated, service_role;

do $$
declare r record;
begin
  for r in select pos, nama_pos, lengkap, regu_total from v_kelengkapan_pos order by pos
  loop
    raise notice '0060: pos % (%) — % dari % regu lengkap',
      r.pos, r.nama_pos, r.lengkap, r.regu_total;
  end loop;
end $$;
