-- ============================================================================
-- hrcd-rekap : 0030_komponen_per_golongan.sql
--
-- Satu kolom baru: `wahana.golongan`. Null = berlaku untuk semua golongan
-- (itu keadaan hampir semua komponen). Diisi = komponen ini HANYA milik
-- golongan itu.
--
-- ---------------------------------------------------------------------------
-- KENAPA INI PERLU ADA
--
-- Format HRCD XXXVII memuat satu komponen yang tidak bisa dinyatakan tabel
-- ini apa adanya: **Tebak Simpul**.
--
--   Penggalang :  5 objek simpul, 1 benar = 20 poin, maksimum 100
--   Penegak    : 10 objek simpul, 1 benar = 10 poin, maksimum 100
--
-- Petugas menulis JUMLAH SIMPUL BENAR — data mentah yang sama untuk keduanya.
-- Yang berbeda penyebutnya. Satu baris `wahana` hanya punya satu
-- `raw_terbaik`, jadi apa pun yang dipilih akan salah untuk separuh peserta:
-- dengan raw_terbaik=10, regu Penggalang yang benar SEMUA (5 dari 5) dinilai
-- 50, bukan 100. Kesalahan itu tidak menimbulkan galat apa pun — ia hanya
-- memangkas separuh nilai satu golongan penuh, diam-diam, sampai ada yang
-- menghitung ulang dengan tangan.
--
-- Jalan keluarnya dua baris `wahana` yang saling melengkapi, satu per
-- golongan — dan kolom inilah yang memberi tahu sistem bahwa keduanya BUKAN
-- dua kolom yang dua-duanya harus diisi.
--
-- ---------------------------------------------------------------------------
-- APA YANG IKUT BERUBAH, DAN KENAPA HARUS IKUT
--
-- "Berapa komponen yang harus diisi" berhenti menjadi sifat POS dan menjadi
-- sifat POS UNTUK REGU INI. Tanpa itu:
--
--   · lembar Input Pos menghitung 4 komponen di Pos 1 padahal tiap regu cuma
--     bisa mengisi 3, sehingga tidak satu baris pun pernah berstatus lengkap;
--   · panel kelengkapan (0028) melaporkan `lengkap = 0` selamanya, dan panel
--     yang selalu merah adalah panel yang berhenti dibaca orang;
--   · `simpan_nilai_massal` menerima nilai Tebak Simpul Penegak untuk regu
--     Penggalang — dua kolom terisi, dan totalnya 200 dari maksimum 100.
--
-- Yang terakhir itu yang paling berbahaya, jadi servernya ikut menolak.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolomnya
-- ---------------------------------------------------------------------------
alter table wahana add column if not exists golongan text;

alter table wahana drop constraint if exists wahana_golongan_check;
alter table wahana add constraint wahana_golongan_check check (
  golongan is null
  or golongan in ('penggalang_pa', 'penggalang_pi', 'penegak_pa', 'penegak_pi'));

comment on column wahana.golongan is
  'NULL = komponen berlaku untuk semua golongan (hampir selalu begitu). '
  'Diisi = komponen ini hanya milik golongan tersebut, dipakai saat satu '
  'lomba dinilai dengan skala berbeda per golongan (mis. Tebak Simpul: '
  '5 objek untuk penggalang, 10 untuk penegak).';

-- Penyaring yang sama dipakai di empat tempat. Ditulis sekali sebagai fungsi
-- supaya tidak ada satu pun tempat yang lupa ikut diperbarui — itulah cara
-- kolom seperti ini biasanya membocorkan kesalahan setahun kemudian.
create or replace function komponen_berlaku(p_golongan_wahana text,
                                            p_golongan_regu   text)
returns boolean
language sql immutable
as $$ select p_golongan_wahana is null or p_golongan_wahana = p_golongan_regu $$;

comment on function komponen_berlaku(text, text) is
  'Apakah satu komponen berlaku untuk regu bergolongan ini. Dipakai '
  'v_lembar_pos, v_kelengkapan_pos, dan simpan_nilai_massal — jangan '
  'menyalin logikanya, panggil fungsinya.';

-- ---------------------------------------------------------------------------
-- 2. v_lembar_pos — `jumlah_komponen` jadi milik REGU, bukan milik pos
--
-- Kolom lain tidak berubah sama sekali; `create or replace` menuntut daftar
-- kolom yang persis sama, jadi seluruh definisinya disalin dari 0023 dengan
-- satu subquery yang diganti.
-- ---------------------------------------------------------------------------
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

  -- INI yang berubah: hanya komponen yang berlaku untuk golongan regu ini.
  (select count(*) from wahana w
   where w.edisi = p.edisi and w.pos = p.nomor
     and komponen_berlaku(w.golongan, r.golongan))::int
                as jumlah_komponen,

  round(coalesce((
    select sum(hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
                           w.raw_terbaik, w.raw_terburuk,
                           w.poin_benar, w.poin_salah, w.total_soal, w.tingkat))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), 0) * p.bobot, 2) as nilai_pos

from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
cross join pos p
where p.edisi = edisi_aktif()
  and not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and peran() is not null
  and (peran() <> 'operator_pos' or p.nomor = pos_saya());

-- ---------------------------------------------------------------------------
-- 3. v_kelengkapan_pos — "lengkap" dihitung per regu
--
-- Seluruh definisi disalin dari 0028; yang berubah hanya `terisi` yang kini
-- ikut membawa jumlah komponen yang berlaku untuk tiap regu.
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

  -- Pembandingnya `harus` — jumlah komponen yang berlaku untuk golongan regu
  -- itu — bukan `p.jumlah_komponen` yang menghitung seluruh baris.
  count(ri.id) filter (
    where coalesce(t.jumlah, 0) = harus.n)::int           as lengkap,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0) > 0
      and coalesce(t.jumlah, 0) < harus.n)::int           as sebagian,
  count(ri.id) filter (where coalesce(t.jumlah, 0) = 0)::int as kosong,
  count(ri.id) filter (
    where ri.sudah_closing
      and coalesce(t.jumlah, 0) < harus.n)::int           as hilang,

  (select max(n.created_at)
   from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where w.edisi = edisi_aktif() and w.pos = p.nomor)     as terakhir_masuk

from v_pos p
left join regu_ikut ri on true
left join lateral (
  select count(*)::int as n from wahana w
  where w.edisi = edisi_aktif() and w.pos = p.nomor
    and komponen_berlaku(w.golongan, ri.golongan)
) harus on true
left join terisi t on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
  and peran() is not null
  and (peran() <> 'operator_pos' or p.nomor = pos_saya())
group by p.nomor, p.name, p.bayangan, p.jumlah_komponen;

grant select on v_kelengkapan_pos to authenticated;

comment on view v_kelengkapan_pos is
  'Kelengkapan input per pos: lengkap / sebagian / kosong, ditambah `hilang` '
  '(regu yang sudah closing tapi nilainya belum lengkap) dan '
  '`terakhir_masuk`. Sejak 0030 "lengkap" dihitung terhadap komponen yang '
  'BERLAKU untuk golongan tiap regu. Operator pos hanya melihat posnya.';
