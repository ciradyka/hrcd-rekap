-- ============================================================================
-- hrcd-rekap : 0096_kelengkapan_mengenal_intern.sql
-- Kelengkapan pos memakai aturan golongan yang sama dengan penilaian.
--
-- ---------------------------------------------------------------------------
-- APA YANG SALAH
--
-- `komponen_pos_golongan()` adalah PENYEBUT kelengkapan: berapa komponen yang
-- harus diisi satu regu bergolongan tertentu di satu pos. Sejak 0060 ia
-- menuliskan sendiri aturan golongannya:
--
--     w.golongan is null or w.golongan = p_golongan
--
-- 0091 mengubah aturan itu dan memberinya nama: `komponen_berlaku()`. Untuk
-- Intern PA/PI komponen berlaku hanya kalau `wahana.golongan` bernilai
-- 'intern_pa', 'intern_pi', atau penanda 'intern' — dan komponen ber-golongan
-- NULL justru TIDAK berlaku, karena Intern tidak mengikuti lomba lapangan.
-- 0091 memperbarui `v_lembar_pos` dan `simpan_nilai_massal`, tetapi salinan
-- aturan di dalam fungsi ini tertinggal.
--
-- Akibatnya, dengan 300 Eksternal + 50 Intern:
--
--   Pos 1  regu Intern mengisi 2 Soal Tulis, penyebutnya dihitung 4
--          (dua Soal Tulis + Semaphore + Menaksir) -> selamanya 'sebagian'
--   Pos 4  regu Intern tidak punya komponen sama sekali, penyebutnya 4
--          -> selamanya 'kosong', dan sesudah checkout ikut jadi 'hilang'
--
-- `lengkap` karena itu tidak pernah memuat satu pun regu Intern, dan papan
-- Kelengkapan berhenti di bawah 100% seharian sambil melaporkan puluhan regu
-- yang seolah belum dinilai. Itu persis kegagalan yang 0060 ditulis untuk
-- memperbaiki, dan kepalanya sendiri menyebutkan akibatnya: "panitia yang
-- melihat papan itu akan menyimpulkan juri Pos 1 belum memasukkan apa pun dan
-- pergi mencari orang yang sebenarnya sudah selesai."
--
-- ---------------------------------------------------------------------------
-- DUA PERUBAHAN, DAN YANG KEDUA BUKAN SEKADAR IKUTAN
--
-- 1. Penyebutnya memanggil `komponen_berlaku()` — satu aturan, satu tempat.
--
-- 2. Regu yang di satu pos TIDAK punya komponen apa pun dikeluarkan dari
--    hitungan pos itu, bukan dihitung sebagai 'kosong'.
--
--    Tanpa yang kedua, Pos 4 dan Pos 5 tetap melaporkan 50 regu 'kosong'
--    selamanya — angka yang benar secara aritmetika ("mereka memang belum
--    dinilai") dan salah secara arti: mereka tidak akan pernah dinilai di
--    sana, karena mereka memang tidak berlomba di sana. Penyebut nol bukan
--    "belum selesai" melainkan "tidak ikut", dan papan yang tidak bisa
--    membedakan keduanya mengirim panitia mencari juri yang tidak punya
--    pekerjaan.
--
--    Ini juga yang membuat `persen` di halaman peserta bisa kembali mencapai
--    100: penyebutnya sekarang regu yang memang dinilai di pos itu.
--
-- Yang TIDAK diubah: `v_pos.jumlah_komponen` tetap lebar blangko — ia menjawab
-- pertanyaan lain, dan blangko memang memuat seluruh golongan (catatan yang
-- sama sudah ada di 0060).
--
-- Bentuk kedua view disalin utuh dari 0060; yang berubah cuma baris
-- `left join regu_ikut ri on true` jadi bersyarat.
-- ============================================================================

create or replace function komponen_pos_golongan(p_pos smallint, p_golongan text)
returns int
language sql stable
set search_path = public
as $fn$
  select count(*)::int
    from wahana w
   where w.edisi = edisi_aktif()
     and w.pos = p_pos
     -- SATU aturan golongan untuk seluruh sistem (0091). Menuliskannya ulang
     -- di sini adalah cara satu salinan ketinggalan tanpa ada yang tahu.
     and komponen_berlaku(w.golongan, p_golongan)
$fn$;

comment on function komponen_pos_golongan(smallint, text) is
  'Berapa komponen yang HARUS diisi satu regu bergolongan ini di pos ini, menurut komponen_berlaku(). Nol berarti regu itu tidak berlomba di pos ini dan tidak ikut dihitung. Penyebut kelengkapan; v_pos.jumlah_komponen menjawab pertanyaan lain (lebar blangko).';

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
-- INI yang berubah: regu yang tidak punya komponen apa pun di pos ini tidak
-- ikut dihitung sama sekali. Barisnya tetap muncul walau tidak ada satu regu
-- pun yang lolos syaratnya, karena join-nya tetap LEFT.
left join regu_ikut ri on komponen_pos_golongan(p.nomor, ri.golongan) > 0
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
left join regu_ikut ri on komponen_pos_golongan(p.nomor, ri.golongan) > 0
left join terisi t     on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
  and (select fase_live from status_acara) in ('progres', 'penuh')
group by p.nomor, p.name, p.jumlah_komponen;

grant select on v_kelengkapan_publik to anon, authenticated, service_role;

do $blok$
declare r record;
begin
  for r in select pos, nama_pos, lengkap, regu_total from v_kelengkapan_pos order by pos
  loop
    raise notice '0096: pos % (%) — % dari % regu dihitung lengkap',
      r.pos, r.nama_pos, r.lengkap, r.regu_total;
  end loop;
end $blok$;
