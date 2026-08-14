-- ============================================================================
-- hrcd-rekap : 0028_kelengkapan_pos.sql
--
-- "Pos ini datanya sudah masuk semua belum?" — satu baris per pos, dan
-- jawabannya harus bisa dipercaya tanpa membuka lembar pos satu per satu.
--
-- ---------------------------------------------------------------------------
-- KENAPA TIDAK CUKUP SATU ANGKA PERSEN
--
-- Pos yang "90% terisi" bisa berarti tiga keadaan yang sangat berbeda, dan
-- hanya satu di antaranya masalah:
--
--   a. 10% regunya memang belum sampai di pos itu. Normal, dan sepanjang
--      lomba inilah keadaan yang paling sering.
--   b. 10% regunya sudah lewat tapi barisnya baru terisi separuh. Hampir
--      selalu berarti transkripsi dari foto terpotong di tengah.
--   c. 10% regunya sudah SELESAI LOMBA dan tetap tidak punya nilai di pos
--      itu. Ini kehilangan data yang sesungguhnya — mereka pasti melewati
--      pos itu, dan angkanya tidak pernah sampai.
--
-- Maka view ini memisahkan ketiganya: `sebagian` menangkap (b), `hilang`
-- menangkap (c), dan `kosong` yang bukan keduanya adalah (a).
--
-- `hilang` adalah satu-satunya angka yang berarti "ada yang rusak". Ia
-- disandarkan pada CLOSING, bukan pada tebakan tentang sudah sampai mana
-- regunya: regu yang sudah checkout pasti sudah melewati seluruh pos, jadi
-- pos tanpa nilai untuknya tidak punya penjelasan yang tidak buruk.
--
-- ---------------------------------------------------------------------------
-- KENAPA PENYEBUTNYA "SUDAH BERANGKAT", BUKAN SELURUH REGU
--
-- Regu yang kloternya belum berangkat tidak mungkin dinilai di mana pun.
-- Memasukkannya ke penyebut membuat tiap pos terlihat 30% sepanjang pagi dan
-- angka yang selalu merah berhenti dibaca orang. Penyebutnya karena itu regu
-- yang kloternya SUDAH punya jam berangkat — dan tetap tidak sempurna
-- (regu yang berangkat lima menit lalu belum sampai Pos 3), jadi layar
-- menyebutkan penyebutnya apa adanya alih-alih memamerkan satu angka persen
-- telanjang.
--
-- ---------------------------------------------------------------------------
-- `terakhir_masuk` — PENDETEKSI "TIDAK SYNC" YANG SEBENARNYA
--
-- Jam nilai terakhir yang masuk ke pos itu. Kalau empat pos menyetor terus
-- dan satu pos diam 40 menit, yang rusak hampir pasti sambungan atau laptop
-- di pos itu — dan itu ketahuan di sini berjam-jam sebelum ketahuan dari
-- angka kelengkapan, yang baru bergerak setelah regunya selesai.
--
-- `simpan_nilai_massal` menyetel `created_at = now()` juga saat menimpa
-- (0014), jadi angka ini bergerak untuk perbaikan, bukan hanya untuk nilai
-- yang benar-benar baru. Itu memang yang diinginkan: yang ditanyakan bukan
-- "kapan nilai baru datang" melainkan "pos ini masih hidup atau tidak".
--
-- ---------------------------------------------------------------------------
-- OPERATOR POS BOLEH MELIHAT — POSNYA SENDIRI SAJA
--
-- Berbeda dengan `v_rekap_penuh` (0027) yang menolaknya, view ini justru
-- berguna untuk operator pos: "lembar saya sudah lengkap belum?". Angkanya
-- pun benar untuknya, karena RLS `sel_nilai` mengizinkan ia membaca seluruh
-- `nilai_mentah` POS-NYA — dan barisnya memang disaring ke pos itu saja,
-- persis seperti `v_monitoring_input` (0025).
-- ============================================================================

create view v_kelengkapan_pos with (security_invoker = on) as
with regu_ikut as (
  -- Regu yang sudah punya nomor dada dan batch-nya lunas. Sebelum daftar
  -- ulang tidak ada yang bisa dinilai, jadi tidak ada yang bisa hilang.
  select
    r.id,
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

  count(*)::int                                          as regu_total,
  count(*) filter (where ri.sudah_berangkat)::int        as regu_berangkat,
  count(*) filter (where ri.sudah_closing)::int          as regu_closing,

  -- Seluruh komponen pos ini terisi.
  count(*) filter (
    where coalesce(t.jumlah, 0) = p.jumlah_komponen)::int as lengkap,
  -- Terisi, tapi tidak semuanya — transkripsi yang terpotong.
  count(*) filter (
    where coalesce(t.jumlah, 0) > 0
      and coalesce(t.jumlah, 0) < p.jumlah_komponen)::int as sebagian,
  count(*) filter (where coalesce(t.jumlah, 0) = 0)::int  as kosong,
  -- SUDAH SELESAI LOMBA dan tetap belum lengkap di pos ini. Inilah alarmnya.
  count(*) filter (
    where ri.sudah_closing
      and coalesce(t.jumlah, 0) < p.jumlah_komponen)::int as hilang,

  (select max(n.created_at)
   from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where w.edisi = edisi_aktif() and w.pos = p.nomor)     as terakhir_masuk

from v_pos p
cross join regu_ikut ri
left join terisi t on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
  and peran() is not null
  -- Sama seperti v_monitoring_input: operator pos hanya posnya sendiri.
  -- Tampilan sempit lebih baik daripada tampilan palsu.
  and (peran() <> 'operator_pos' or p.nomor = pos_saya())
group by p.nomor, p.name, p.bayangan, p.jumlah_komponen;

grant select on v_kelengkapan_pos to authenticated;

comment on view v_kelengkapan_pos is
  'Kelengkapan input per pos: lengkap / sebagian / kosong, ditambah `hilang` '
  '(regu yang sudah closing tapi nilainya belum lengkap — kehilangan data '
  'yang sesungguhnya) dan `terakhir_masuk` (pendeteksi pos yang berhenti '
  'menyetor). Operator pos hanya melihat posnya sendiri.';
