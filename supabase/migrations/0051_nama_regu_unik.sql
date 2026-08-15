-- ============================================================================
-- hrcd-rekap : 0051_nama_regu_unik.sql
--
-- Nama regu: maksimal 20 karakter, dan tidak boleh kembar di seluruh edisi.
--
-- ---------------------------------------------------------------------------
-- KENAPA 20
--
-- Diturunkan dari satu tempat, bukan dikira-kira: kolom Nama Regu pada form
-- tabel per pos (A4 melintang) lebarnya `max-width: 48mm` dengan huruf 10pt.
-- Dikurangi padding, tersisa ~45,9 mm. Huruf KAPITAL Inter rata-rata 0,62 em
-- = 2,19 mm, jadi yang muat ~21 karakter. 20 memberi satu karakter jarak.
--
-- Kapital yang dipakai sebagai patokan, bukan Title Case, karena begitulah
-- data ini sebenarnya ditulis: KALAKI RACING, KAMBING HITAM, SATE TUSUK.
-- Menyandarkan batas pada gaya penulisan yang tidak kita kendalikan hanya
-- menunda masalahnya.
--
-- Lembar itu memang sudah memotong dengan elipsis dan tinggi barisnya sudah
-- seragam — jadi batas ini bukan mencegah tata letak rusak, melainkan
-- mencegah nama terpotong DIAM-DIAM di kertas cadangan, yang justru dipakai
-- saat internet mati.
--
-- ---------------------------------------------------------------------------
-- KENAPA UNIK SELURUH EDISI, BUKAN PER SEKOLAH
--
-- Keputusan pemilik acara, dengan alasan yang tidak kelihatan dari kode:
-- nama juara dibacakan di depan lapangan saat pengumuman, dan nama yang sudah
-- pernah disebut kehilangan momennya.
--
-- Harganya nyata dan disebut di sini supaya tidak jadi kejutan: nama pramuka
-- generik berulang di mana-mana, jadi sekolah yang mendaftar belakangan akan
-- ditolak karena nama yang sepenuhnya wajar dan harus memilih nama lain di
-- meja. Itulah kenapa form pendaftaran memeriksanya SAMBIL DIKETIK — lihat
-- nama_regu_dipakai() di bawah — bukan saat tombol Kirim ditekan.
--
-- ---------------------------------------------------------------------------
-- APA YANG DIANGGAP SAMA
--
-- Perbandingannya dinormalkan: huruf kecil-besar diabaikan, dan spasi
-- beruntun dirapatkan jadi satu. "Rajawali", "RAJAWALI", dan "Raja  wali"
-- karena itu bertabrakan.
--
-- Itu disengaja. Yang dijaga bunyinya saat dibacakan, bukan ejaannya di
-- layar — dan pembatas yang bisa dilewati dengan menekan Caps Lock bukan
-- pembatas.
--
-- Regu BATAL tidak ikut dihitung: namanya kembali bebas dipakai. Pendaftaran
-- yang dibatalkan tidak boleh menyandera satu kata selamanya.
--
-- ---------------------------------------------------------------------------
-- LINGKUP "SELURUH EDISI"
--
-- Tabel `regu` tidak punya kolom edisi, dan memang tidak perlu: hanya ada
-- SATU edisi aktif pada satu waktu (indeks edisi_satu_aktif, 0001), jadi
-- seluruh isi tabel ini adalah edisi berjalan. Indeks unik biasa karena itu
-- sudah berarti "unik dalam edisi ini".
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Berhenti lebih dulu kalau data yang sudah ada melanggar, dengan menyebut
-- pelanggarnya. Tanpa ini `create unique index` gagal dengan pesan Postgres
-- yang menyebut satu baris saja, dan yang menjalankan migrasi harus menebak
-- sisanya.
-- ---------------------------------------------------------------------------
do $$
declare v_panjang text; v_kembar text;
begin
  select string_agg(format('%s (%s huruf)', nama_regu, length(trim(nama_regu))), ', ')
  into v_panjang
  from regu where not is_cancelled and length(trim(nama_regu)) > 20;

  if v_panjang is not null then
    raise exception '0051: ada nama regu lebih dari 20 karakter — perbaiki dulu: %', v_panjang;
  end if;

  select string_agg(n, ', ') into v_kembar from (
    select lower(regexp_replace(trim(nama_regu), '\s+', ' ', 'g')) as n
    from regu where not is_cancelled
    group by 1 having count(*) > 1) d;

  if v_kembar is not null then
    raise exception '0051: ada nama regu kembar — perbaiki dulu: %', v_kembar;
  end if;

  raise notice '0051: data yang ada lolos — tidak ada nama > 20 huruf, tidak ada kembar.';
end;
$$;

alter table regu drop constraint if exists regu_nama_panjang;
alter table regu add constraint regu_nama_panjang
  check (length(trim(nama_regu)) between 1 and 20);

-- Normalisasinya harus IMMUTABLE supaya boleh jadi indeks. lower(), trim()
-- dan regexp_replace() ketiganya immutable.
create unique index if not exists regu_nama_unik
  on regu (lower(regexp_replace(trim(nama_regu), '\s+', ' ', 'g')))
  where not is_cancelled;

comment on index regu_nama_unik is
  'Nama regu unik seluruh edisi, dibandingkan tanpa memandang huruf besar/kecil '
  'dan spasi beruntun. Regu batal tidak ikut — namanya bebas dipakai lagi.';

-- ---------------------------------------------------------------------------
-- Dipakai form pendaftaran untuk memeriksa SAMBIL DIKETIK.
--
-- Terbuka untuk anon karena form pendaftaran memang tanpa login. Yang bocor
-- lewat sini cuma jawaban ya/tidak atas nama yang ditebak penanya sendiri —
-- dan seluruh nama regu memang terbit di halaman rekap begitu lomba mulai.
--
-- Menolak saat Kirim ditekan sudah terlambat: pembina baru saja mengisi lima
-- regu, dan yang ditolak satu nama di baris kedua.
-- ---------------------------------------------------------------------------
create or replace function nama_regu_dipakai(p_nama text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from regu
    where not is_cancelled
      and lower(regexp_replace(trim(nama_regu), '\s+', ' ', 'g'))
        = lower(regexp_replace(trim(p_nama), '\s+', ' ', 'g')))
$$;

revoke all on function nama_regu_dipakai(text) from public;
grant execute on function nama_regu_dipakai(text) to anon, authenticated;

comment on function nama_regu_dipakai(text) is
  'true kalau nama itu sudah dipakai regu yang tidak batal. Dibandingkan '
  'tanpa memandang huruf besar/kecil dan spasi beruntun, sama dengan indeks '
  'regu_nama_unik.';
