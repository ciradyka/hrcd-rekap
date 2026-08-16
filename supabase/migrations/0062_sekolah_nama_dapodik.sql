-- ============================================================================
-- hrcd-rekap : 0062_sekolah_nama_dapodik.sql
-- Enam sekolah yang luput dari pembakuan 0061, dan kenapa mereka luput.
--
-- APA YANG TERJADI
--
-- 0061 melebur 36 baris jadi 23 dengan benar, tapi hanya **17** yang nama dan
-- alamatnya berhasil dibakukan dari daftar kurasi. Enam sisanya lewat:
--
--     MA ASALIMIAH                  -> MA Assalimiyah
--     MAS AL-KAUTSAR                -> MA Al-Kautsar
--     SMAI NURUL FIKRI              -> SMA Islam Nurul Fikri
--     SMAT RIYADLUL ULUM            -> SMA Terpadu Riyadlul Ulum
--     SMKS GALUH RAHAYU             -> SMK Galuh Rahayu
--     SMPT RIYADLUL ULUM WADDAWAH   -> SMP Terpadu Riyadlul Ulum Waddawah
--
-- KENAPA
--
-- 0061 mencocokkan baris produksi dengan daftar kurasi memakai
-- `kunci_sekolah()` — kunci yang SENGAJA jinak, karena tugasnya menolak baris
-- kembar tanpa ada yang memeriksa. Tapi pencocokan ke daftar kurasi adalah
-- pekerjaan yang berbeda: ia dilakukan sekali, hasilnya diperiksa, dan ia
-- perlu tahu bahwa `ASALIMIAH` dan `Assalimiyah` adalah satu pesantren.
-- Pengetahuan itu ada — di `kunci()` milik `tools/normalize_sekolah.py`, yang
-- memang dibangun untuk itu — dan 0061 memakai kunci yang salah untuk
-- langkah itu.
--
-- Karena itu pemetaan di bawah ditulis TANGAN, dari nama yang benar-benar
-- ada di produksi. Tidak ada normalisasi yang perlu dipercaya: enam baris,
-- disebut satu per satu, bisa dibaca ulang oleh siapa pun.
--
-- SEKALIAN: HURUF STATUS DAPODIK
--
-- Empat dari enam nama itu berawalan bentuk Dapodik — `MAS`, `SMKS`, `SMAS`,
-- `MTsS` — di mana huruf `S` terakhir berarti *Swasta*. Itu status, bukan
-- bagian dari nama sekolah, dan pembina menulis dua-duanya. `kunci_sekolah()`
-- diperluas untuk membuangnya, jadi `SMKS Galuh Rahayu` yang diketik tahun
-- depan mendarat di baris yang sama dengan `SMK Galuh Rahayu`.
--
-- `SMAI`, `SMAT`, `SMPT` TIDAK ikut diperluas, walau ketiganya juga singkatan
-- (Islam, Terpadu). Alasannya: huruf status hanya punya satu arti, sedangkan
-- membuang `T` dari `SMAT` akan menyamakan "SMA Terpadu X" dengan "SMA X" —
-- dan itu bisa saja dua sekolah. Yang tidak pasti diselesaikan dengan
-- penggantian nama seperti di atas, bukan dengan kunci yang lebih rakus.
--
-- URUTANNYA PENTING
--
-- `sekolah_kunci_unik` adalah index atas `kunci_sekolah(name)`. Mengganti isi
-- fungsinya sementara index-nya masih berdiri meninggalkan index yang isinya
-- dihitung dengan rumus lama — ia akan tampak sehat dan diam-diam meloloskan
-- baris kembar. Jadi: index dibuang dulu, fungsinya diganti, baru index
-- dipasang lagi.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Lepas index yang bergantung pada fungsinya.
-- ---------------------------------------------------------------------------
drop index if exists sekolah_kunci_unik;

-- ---------------------------------------------------------------------------
-- 2. Kunci yang juga membuang huruf status Dapodik.
-- ---------------------------------------------------------------------------
create or replace function kunci_sekolah(p_nama text)
returns text
language sql immutable
set search_path = public
as $$
  select btrim(regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(lower(coalesce(p_nama, '')), '[^a-z0-9]+', ' ', 'g'),
               -- "SMP Negeri 1" dan "SMP N 1" adalah "SMPN 1".
               '\y(sd|smp|sma|smk|mi|mts|ma)\s+n(egeri)?\y', '\1n', 'g'),
             -- Huruf status Dapodik di AWAL nama: SMKS, SMAS, SMPS, MAS, MTsS,
             -- MIS. "S" itu Swasta — status, bukan nama. Diikat ke awal
             -- (`^`) supaya tidak menyentuh kata lain yang kebetulan berakhir
             -- begitu di tengah nama.
             '^(sd|smp|sma|smk|mi|mts|ma)s\y', '\1', 'g'),
           '\s+', ' ', 'g'))
$$;

comment on function kunci_sekolah(text) is
  'Penyamaan nama sekolah untuk unique index. Sengaja jinak: besar-kecil huruf, tanda baca, bentuk "Negeri", dan huruf status Dapodik (Swasta). TIDAK membuang singkatan seperti SMAT/SMAI — itu bisa memisahkan dua sekolah yang berbeda.';

-- ---------------------------------------------------------------------------
-- 3. Enam nama yang tertinggal, ditulis tangan dari isi produksi.
--
--    Alamatnya dari `tools/data/sekolah_alamat.json`, bentuk yang sama dengan
--    0061: jalan, desa, Kec., kabupaten, provinsi + kode pos, Indonesia.
-- ---------------------------------------------------------------------------
drop table if exists sekolah_ganti;
create temporary table sekolah_ganti (lama text, nama text, alamat text);
insert into sekolah_ganti (lama, nama, alamat) values
  ('MA ASALIMIAH',
   'MA Assalimiyah',
   'Jl. KH. Salim No. 1, Darmacaang, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat 46261, Indonesia'),
  ('MAS AL-KAUTSAR',
   'MA Al-Kautsar',
   'Jl. Pejuang No. 100, Jajawar, Kec. Banjar, Kota Banjar, Jawa Barat 46318, Indonesia'),
  ('SMAI NURUL FIKRI',
   'SMA Islam Nurul Fikri',
   'Jl. Palka, Bantarwaru, Kec. Cinangka, Kabupaten Serang, Banten 42167, Indonesia'),
  ('SMAT RIYADLUL ULUM',
   'SMA Terpadu Riyadlul Ulum',
   'Komplek Pesantren Condong-Cibeurem, Setianagara, Kec. Cibeureum, Kota Tasikmalaya, Jawa Barat 46196, Indonesia'),
  ('SMKS GALUH RAHAYU',
   'SMK Galuh Rahayu',
   'Jl. Raya Sukaraja, Sukaraja, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat 46268, Indonesia'),
  ('SMPT RIYADLUL ULUM WADDAWAH',
   'SMP Terpadu Riyadlul Ulum Waddawah',
   'Komplek Pesantren Condong RT 01 RW 04, Setianegara, Kec. Cibeureum, Kota Tasikmalaya, Jawa Barat 46196, Indonesia')
;

do $$
declare r record; v_n int := 0;
begin
  for r in select * from sekolah_ganti order by lama loop
    update sekolah set name = r.nama, address = r.alamat where name = r.lama;
    if found then
      v_n := v_n + 1;
      raise notice '0062: % -> %', r.lama, r.nama;
    else
      -- Bukan galat: di database uji keenamnya memang tidak ada, dan di
      -- produksi ia berarti migrasinya sudah pernah dijalankan.
      raise notice '0062: % tidak ada, dilewati', r.lama;
    end if;
  end loop;
  raise notice '0062: % nama dibakukan.', v_n;
end $$;

drop table sekolah_ganti;

-- ---------------------------------------------------------------------------
-- 4. Pasang lagi pagarnya, dengan rumus yang baru.
-- ---------------------------------------------------------------------------
create unique index sekolah_kunci_unik on sekolah (kunci_sekolah(name));

comment on index sekolah_kunci_unik is
  'Satu sekolah, satu baris. Menggantikan unique (name, address) dari 0001, yang memakai alamat sebagai pembeda dan karena itu membelah satu sekolah tiap kali alamatnya diketik berbeda.';

-- ---------------------------------------------------------------------------
-- 5. Hasilnya.
-- ---------------------------------------------------------------------------
do $$
declare v_s int; v_d int; v_tanpa int;
begin
  select count(*) into v_s from sekolah;
  select count(*) into v_d from (
    select 1 from sekolah group by kunci_sekolah(name) having count(*) > 1) x;
  -- Alamat baku selalu berakhir "Indonesia". Yang tidak, berarti alamatnya
  -- masih tulisan tangan pembina — sah, tapi pantas disebut.
  select count(*) into v_tanpa from sekolah where address not like '%, Indonesia';
  raise notice '0062: % sekolah, % nama kembar, % alamat belum baku.', v_s, v_d, v_tanpa;
  assert v_d = 0, 'masih ada nama sekolah kembar';
end $$;
