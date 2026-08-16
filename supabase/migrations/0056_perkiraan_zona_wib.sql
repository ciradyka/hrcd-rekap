-- ============================================================================
-- hrcd-rekap : 0056_perkiraan_zona_wib.sql
--
-- Perkiraan jam berangkat dibangun di zona WIB, bukan di zona server.
--
-- ---------------------------------------------------------------------------
-- APA YANG SALAH
--
-- `tanggal_lomba` adalah date, `jam_mulai_berangkat` adalah time. Keduanya
-- polos — tidak membawa zona. Menjumlahkannya menghasilkan timestamp polos
-- juga, dan `::timestamptz` menstempelnya dengan zona SESI DATABASE.
--
-- Sesi database Supabase berjalan di UTC. Jadi "2027-02-21 07:00" tersimpan
-- sebagai 07:00 UTC, dan layar — yang benar menampilkan segalanya dalam WIB —
-- membacanya kembali sebagai 14:00. Papan Keberangkatan menyebut kloter 1
-- berangkat pukul dua siang, dan kertas Daftar Kloter mencetak angka yang
-- sama ke tangan petugas barak.
--
-- Tujuh jam, di setiap kloter, di dua tempat sekaligus. Jendela 07:00-10:00
-- (CLAUDE.md bagian 10) tidak pernah benar-benar tampil sejak perkiraannya
-- ada.
--
-- ---------------------------------------------------------------------------
-- PERBAIKANNYA
--
--   (tanggal + jam) at time zone 'Asia/Jakarta'
--
-- `timestamp at time zone <zona>` membaca timestamp polos SEBAGAI waktu di
-- zona itu dan mengembalikan timestamptz. Kebalikan dari `::timestamptz`,
-- yang membacanya sebagai waktu di zona sesi.
--
-- Zonanya ditulis tetap, bukan diambil dari setelan server: seluruh acara
-- berlangsung di satu kota, dan `jam_mulai_berangkat` sudah dimaksudkan
-- sebagai jam dinding di lapangan sejak 0009. Setelan server yang berubah
-- tidak boleh menggeser jam upacara.
--
-- ---------------------------------------------------------------------------
-- `lewat_batas` TIDAK IKUT DIUBAH
--
-- Ia membandingkan time dengan time — aritmetika jam dinding tanpa zona sama
-- sekali — jadi ia sudah benar dan tetap benar.
--
-- ---------------------------------------------------------------------------
-- DUA VIEW, SATU KEKELIRUAN
--
-- Rumusnya disalin dari 0009 ke 0053, jadi cacatnya ikut tersalin. Keduanya
-- diperbaiki di sini supaya papan dan kertas tidak pernah berbeda.
--
-- Badan view lainnya disalin apa adanya. Di v_daftar_kloter ada TIGA
-- perubahan lain yang wajib: `e.aktif` jadi `e.is_active`, `r.batal` jadi
-- `r.is_cancelled`, dan `s.nama` jadi `s.name` — 0014 mengganti nama
-- kolomnya dan PostgreSQL ikut memperbarui definisi view yang tersimpan,
-- jadi menulis ulang dengan nama lama akan gagal. Persis yang menjatuhkan
-- 0053 di produksi, dan yang menjatuhkan berkas ini sekali lagi di CI —
-- alias keluarannya tetap `nama_sekolah`, jadi yang berubah hanya sisi
-- kanannya.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Papan garis start.
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

  ((e.tanggal_lomba + e.jam_mulai_berangkat) at time zone 'Asia/Jakarta')
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
  'merencanakan pagi, catatan untuk menghitung penalti. Perkiraannya '
  'dibangun di WIB, bukan di zona sesi database.';

-- ---------------------------------------------------------------------------
-- 2. Kertas barak.
-- ---------------------------------------------------------------------------
create or replace view v_daftar_kloter with (security_invoker = on) as
select
  r.kloter_nomor                        as kloter,
  r.urutan_kloter                       as urutan,
  r.nomor_dada,
  r.nama_regu,
  s.name                                as nama_sekolah,
  r.golongan,
  k.dicetak_pada,
  k.jam_berangkat,
  -- Perkiraan untuk kertas barak; kalau sudah berangkat, pakai jam nyata.
  coalesce(
    k.jam_berangkat,
    ((e.tanggal_lomba + e.jam_mulai_berangkat) at time zone 'Asia/Jakarta')
      + make_interval(mins => e.interval_berangkat_menit * (k.nomor - 1))
  )                                     as perkiraan_berangkat,
  k.jam_berangkat is not null           as sudah_berangkat,
  r.disisipkan_pada is not null         as sisipan,
  r.alasan_sisip
from regu r
join kloter k       on k.nomor = r.kloter_nomor
join pendaftaran d  on d.id = r.pendaftaran_id
join sekolah s      on s.id = d.sekolah_id
cross join edisi e
where e.is_active
  and not r.is_cancelled
  and d.status = 'lunas'
  and r.kloter_nomor is not null
order by r.kloter_nomor, r.urutan_kloter;

comment on view v_daftar_kloter is
  'Kertas barak. `perkiraan_berangkat` dibangun di WIB — sebelumnya di zona '
  'sesi database, yang mencetak 14:00 untuk kloter yang berangkat 07:00.';
