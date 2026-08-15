-- ============================================================================
-- hrcd-rekap : 0048_live_skor_peserta.sql
--
-- Dua tambahan untuk halaman rekap peserta:
--   1. kemajuan input per pos, dalam persen — terlihat SELAMA lomba
--   2. rincian poin per pos di klasemen — terlihat setelah hasil diumumkan
--
-- ---------------------------------------------------------------------------
-- KENAPA PERSENTASE INPUT DITERBITKAN KE PESERTA
--
-- Sepanjang hari peserta menanyakan satu hal ke panitia mana pun yang lewat:
-- "nilai regu saya sudah masuk belum?" Halaman rekap sudah menjawabnya per
-- regu lewat centang pos, tapi centang yang masih kosong punya DUA arti yang
-- sangat berbeda — "regu kamu terlewat" atau "pos itu memang baru mulai
-- diinput" — dan peserta tidak punya cara membedakannya.
--
-- Satu angka per pos menutup selisih itu. "Pos 3: 42%" mengubah centang kosong
-- dari kabar buruk jadi kabar biasa, dan pertanyaan yang tadinya jadi antrean
-- di meja panitia terjawab sebelum diajukan.
--
-- Angkanya juga bukan rahasia: ia menghitung BERAPA BANYAK yang sudah diinput,
-- bukan berapa nilainya. Tidak ada satu pun angka nilai yang bocor lewat sini.
--
-- ---------------------------------------------------------------------------
-- KENAPA `lengkap`, BUKAN `sebagian`, YANG JADI PENYEBUT PERSEN
--
-- Satu regu dihitung sudah masuk hanya kalau SELURUH komponen pos itu terisi.
-- Pos 3 punya tujuh kolom; regu yang baru terisi dua kolomnya belum bisa
-- dinilai, dan menghitungnya sebagai "sudah" membuat angka persennya
-- menanjak cepat lalu berhenti lama di 90-an — bentuk grafik yang membuat
-- orang mengira pekerjaannya hampir selesai padahal justru sedang tersendat.
--
-- `sebagian` tetap diterbitkan terpisah, karena transkripsi yang terpotong
-- adalah hal yang memang perlu terlihat.
--
-- ---------------------------------------------------------------------------
-- PAGARNYA TETAP `fase_live`, SAMA SEPERTI SEMUA VIEW PUBLIK
--
-- Di fase 'pra' view ini mengembalikan NOL BARIS, persis seperti
-- v_progres_publik (0026) dan v_klasemen_publik (0005). Jadi persentase tidak
-- pernah ikut tertulis ke berkas statis sebelum lomba mulai — bukan dikirim
-- lalu disembunyikan CSS, yang bisa dibuka siapa pun lewat devtools.
--
-- Halaman peserta TIDAK membaca database sama sekali; publish-live.yml yang
-- membacanya dengan service role lalu menulis live.json. Karena itu tidak ada
-- grant ke `anon` di berkas ini — menambahkannya justru akan membuka jalur
-- yang sengaja tidak pernah dibuka.
-- ============================================================================

create or replace view v_kelengkapan_publik as
with regu_ikut as (
  -- Sama seperti v_kelengkapan_pos (0028): sebelum daftar ulang tidak ada yang
  -- bisa dinilai, jadi tidak ada yang bisa hilang.
  select r.id
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
  p.nomor                                                    as pos,
  p.name                                                     as nama_pos,
  p.jumlah_komponen,
  count(ri.id)::int                                          as regu_total,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0) = p.jumlah_komponen)::int    as lengkap,
  count(ri.id) filter (
    where coalesce(t.jumlah, 0) > 0
      and coalesce(t.jumlah, 0) < p.jumlah_komponen)::int    as sebagian,
  -- Dibulatkan ke bawah, bukan ke terdekat: 99,6% yang tampil sebagai "100%"
  -- padahal masih ada dua regu tertinggal adalah persis kekeliruan yang
  -- membuat orang berhenti mencari.
  case when count(ri.id) = 0 then 0 else
    floor(100.0 * count(ri.id) filter (
      where coalesce(t.jumlah, 0) = p.jumlah_komponen) / count(ri.id))::int
  end                                                        as persen
from v_pos p
left join regu_ikut ri on true
left join terisi t     on t.regu_id = ri.id and t.pos = p.nomor
where p.jumlah_komponen > 0
  and (select fase_live from status_acara) in ('progres', 'penuh')
group by p.nomor, p.name, p.jumlah_komponen;

comment on view v_kelengkapan_publik is
  'Kemajuan input per pos untuk halaman peserta — hitungan saja, tidak satu '
  'pun angka nilai. Nol baris selama fase_live masih `pra`.';

-- ---------------------------------------------------------------------------
-- Rincian poin per pos di klasemen.
--
-- Kolom baru DITARUH DI UJUNG. `create or replace view` mengizinkan menambah
-- kolom di belakang, tapi menolak kalau urutan atau tipe kolom yang sudah ada
-- ikut bergeser — dan v_klasemen_publik sudah dibaca live_json.sql apa adanya
-- lewat to_jsonb().
--
-- Kenapa jsonb dan bukan satu kolom per pos: jumlah pos berubah tiap edisi
-- (rancangan-b: aturan adalah data). Satu kolom per pos berarti view ini harus
-- ditulis ulang setiap kali panitia menambah pos, dan halaman peserta ikut
-- ditulis ulang bersamanya.
-- ---------------------------------------------------------------------------
create or replace view v_klasemen_publik as
select
  k.peringkat, k.nomor_dada, k.nama_regu, k.nama_sekolah, k.golongan,
  k.total_pos, k.penalti_waktu, k.penalti_checkout, k.penalti_anggota, k.total,
  (select jsonb_object_agg(pp.pos::text, pp.poin_pos)
   from v_poin_pos pp where pp.regu_id = k.regu_id)          as poin_per_pos,
  -- Selisih menit terhadap kontrak. Inilah tie-break yang sudah dipakai
  -- ORDER BY v_klasemen — menerbitkannya membuat dua regu bernilai sama yang
  -- berbeda peringkat bisa dijelaskan tanpa bertanya ke panitia.
  k.selisih_menit
from v_klasemen k
where (select fase_live from status_acara) = 'penuh';

comment on view v_klasemen_publik is
  'Klasemen untuk halaman peserta, per golongan. Nol baris sampai fase_live '
  'jadi `penuh`. `poin_per_pos` berisi {"<nomor pos>": poin}.';
