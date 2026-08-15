-- ============================================================================
-- hrcd-rekap : 0053_perkiraan_berangkat.sql
--
-- Perkiraan jam berangkat tiap kloter, dan batas pukul 10:00, dibawa ke papan
-- Keberangkatan.
--
-- ---------------------------------------------------------------------------
-- YANG SUDAH ADA DAN TIDAK PERNAH TERLIHAT
--
-- Perkiraannya sudah dihitung sejak migrasi 0009: `edisi.jam_mulai_berangkat`
-- (bawaan 07:00) ditambah `interval_berangkat_menit` dikali nomor kloter,
-- dan hasilnya berdiri di `v_daftar_kloter` sebagai `perkiraan_berangkat`.
--
-- Tapi view itu hanya dibaca layar CETAK. Papan Keberangkatan — layar yang
-- ditunggui petugas di garis start sepanjang pagi — membaca `v_keberangkatan`,
-- dan di sana perkiraannya tidak ada. Petugas yang ditanya "kloter 9 kira-kira
-- jam berapa?" tidak punya jawaban di layar yang sedang ia pandangi.
--
-- Jadi yang ditambahkan di sini bukan perhitungan baru, melainkan kolom yang
-- sama pada view yang benar. Satu rumus, dua tempat membacanya.
--
-- ---------------------------------------------------------------------------
-- BATAS 10:00
--
-- CLAUDE.md bagian 10: tidak ada kloter berangkat sebelum tujuh, dan yang
-- terakhir sudah lepas pukul sepuluh. Batas atasnya belum pernah jadi data —
-- hanya angka di kepala panitia.
--
-- Ia dijadikan konfigurasi, bukan konstanta, karena alasan yang sama dengan
-- jam mulainya: panitia tahun depan mengubah jendelanya tanpa menyentuh kode.
--
-- Yang dilakukan `lewat_batas` cuma MEMBERI TAHU. Ia tidak menolak
-- keberangkatan dan tidak boleh: jam yang tercatat adalah jam yang benar-benar
-- terjadi (alur 12.4), dan sistem yang menolak mencatat kenyataan karena
-- kenyataan itu terlambat akan kehilangan data yang justru paling perlu
-- dijelaskan sesudahnya.
--
-- ---------------------------------------------------------------------------
-- PERKIRAAN BUKAN CATATAN
--
-- CLAUDE.md 10.6. `perkiraan_berangkat` di sini SELALU perkiraan — ia tidak
-- pernah jatuh kembali ke `jam_berangkat` seperti di v_daftar_kloter, karena
-- papan ini sudah menampilkan jam nyata di kolomnya sendiri. Dua kolom
-- terpisah, dan layar bisa menyebut mana yang mana.
-- ============================================================================

alter table edisi add column if not exists jam_batas_berangkat time not null
  default '10:00';

comment on column edisi.jam_batas_berangkat is
  'Kloter terakhir sudah harus berangkat sebelum jam ini. Dipakai menandai '
  'perkiraan yang melewatinya — TIDAK menolak keberangkatan.';

-- ---------------------------------------------------------------------------
-- Badan view disalin dari 0005 apa adanya, dengan SATU perubahan yang
-- disengaja: `r.batal` jadi `r.is_cancelled`, dan `e.aktif` jadi `e.is_active`.
--
-- Bukan kekeliruan pada 0005 — 0014 mengganti nama kolomnya, dan PostgreSQL
-- ikut memperbarui definisi view yang menyebutnya. Jadi yang tersimpan di
-- database sekarang memang `is_cancelled`, dan menulis ulang dengan `batal`
-- akan gagal.
--
-- Dua kolom baru DITARUH DI UJUNG: `create or replace view` mengizinkan
-- menambah di belakang, tapi menolak kalau urutan atau tipe kolom yang sudah
-- ada ikut bergeser.
-- ---------------------------------------------------------------------------
create or replace view v_keberangkatan with (security_invoker = on) as
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
   where r.kloter_nomor = k.nomor and not r.is_cancelled) as jumlah_regu,
  (select count(*) from regu r
   join keberangkatan_regu kb on kb.regu_id = r.id
   where r.kloter_nomor = k.nomor)               as sudah_ceklis,
  (select count(*) from regu r
   where r.kloter_nomor = k.nomor and not r.is_cancelled
     and r.kontrak_menit is not null)            as sudah_kontrak,

  -- Kolom baru, di ujung.
  (e.tanggal_lomba + e.jam_mulai_berangkat)::timestamptz
    + make_interval(mins => e.interval_berangkat_menit * (k.nomor - 1))
                                                 as perkiraan_berangkat,
  ((e.jam_mulai_berangkat
    + make_interval(mins => e.interval_berangkat_menit * (k.nomor - 1)))
      > e.jam_batas_berangkat)                   as lewat_batas
from kloter k
cross join terakhir t
cross join edisi e
where e.is_active
  and (exists (select 1 from regu r where r.kloter_nomor = k.nomor)
       or k.jam_berangkat is not null);

comment on view v_keberangkatan is
  'Papan garis start. `jam_berangkat` yang tercatat dan `perkiraan_berangkat` '
  'adalah dua hal berbeda dan sengaja dua kolom — perkiraan untuk '
  'merencanakan pagi, catatan untuk menghitung penalti.';
