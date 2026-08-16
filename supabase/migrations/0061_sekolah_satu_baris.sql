-- ============================================================================
-- hrcd-rekap : 0061_sekolah_satu_baris.sql
-- Satu sekolah, satu baris — dijaga database, bukan kehati-hatian pengetik.
--
-- APA YANG TERLIHAT
--
-- Di layar pendaftaran, kotak "Asal sekolah" menawarkan `SMPN 1 CIAMIS` TIGA
-- KALI: satu beralamat `Jl. Jenderal Sudirman No. 6`, satu `Jl. Jenderal
-- Sudirman No. 6, Ciamis`, satu lagi `nan`. Pembina memilih salah satunya —
-- tidak ada cara menebak yang mana — dan satu sekolah jadi tiga. `SMPN 2
-- CIPAKU` punya empat baris; seluruhnya 36 baris untuk 23 sekolah.
--
-- KENAPA
--
-- `submit_pendaftaran` mencari sekolahnya lewat pasangan (name, address)
-- PERSIS:
--
--     insert into sekolah (name, address) values (trim(...), trim(...))
--     on conflict (name, address) do nothing;
--     select id into v_sekolah from sekolah where name = ... and address = ...;
--
-- Beda satu koma, beda `Jl.` dan `Jln.`, beda spasi — baris baru, id baru.
--
-- `unique (name, address)` di 0001 dipasang untuk alasan yang masuk akal:
-- alur 3.2.2 ingin dua sekolah senama di tempat berbeda tetap bisa hidup
-- berdampingan, dan `address` dipakai sebagai pembedanya. Niatnya benar.
-- Mekanismenya terlalu harfiah: ia tidak bisa membedakan "sekolah yang sama,
-- alamatnya diketik lebih sembarangan" dari "sekolah lain di tempat lain".
--
-- YANG PALING MAHAL, DAN TIDAK KELIHATAN DI LAYAR MANA PUN
--
-- Pembagian kloter menyebar regu satu sekolah supaya tidak berangkat bareng
-- (CLAUDE.md 12.5), dan penyebaran itu membandingkan `sekolah_id`. Empat baris
-- SMPN 2 Cipaku terbaca sebagai EMPAT SEKOLAH BERLAINAN, jadi aturannya
-- berhenti berlaku di antara mereka dan regunya berangkat bersamaan — tanpa
-- satu pun pesan galat. Itu yang benar-benar terjadi di data contoh.
--
-- CARA MEMPERBAIKINYA
--
-- Pembedanya dipindah dari `address` ke dalam `name`. Dua sekolah yang
-- benar-benar berbeda tapi senama diberi ekor kabupaten — `MAN 3 Ciamis` dan
-- `MAN 3 Tasikmalaya` — dan yang menentukan mereka memang dua sekolah adalah
-- NPSN, bukan alamatnya (docs/runbook-sekolah.md bagian 5). Nama itu lalu
-- cukup membedakan sendirian, jadi kuncinya cukup nama, dan `address` kembali
-- jadi keterangan.
--
-- Alamat bakunya diambil dari daftar kurasi `tools/data/sekolah_alamat.json`:
-- 189 sekolah yang identitas dan alamatnya sudah dilacak satu per satu ke Data
-- Referensi Kemendikdasmen. Bentuknya seragam:
--
--     Jl. Jenderal Sudirman No. 6, Ciamis, Kec. Ciamis, Kabupaten Ciamis,
--     Jawa Barat 46211, Indonesia
--
-- KENAPA NORMALISASINYA SEDERHANA
--
-- `kunci_sekolah()` di bawah jauh lebih jinak daripada `kunci()` di
-- `tools/normalize_sekolah.py`. Yang di Python bertugas MENGGABUNGKAN 326
-- tulisan tangan jadi klaster — ia boleh agresif, karena hasilnya diperiksa
-- manusia sebelum dipakai. Yang di sini bertugas MENOLAK baris kembar tanpa
-- ada yang memeriksa, jadi ia hanya boleh menyamakan yang pasti sama:
-- besar-kecil huruf, tanda baca, dan `SMP Negeri` dengan `SMPN`. Normalisasi
-- yang lebih rakus akan melebur dua sekolah yang berbeda, dan itu kerusakan
-- yang jauh lebih sulit ditemukan daripada baris kembar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kunci penyamaan nama.
-- ---------------------------------------------------------------------------
create or replace function kunci_sekolah(p_nama text)
returns text
language sql immutable
set search_path = public
as $$
  select btrim(regexp_replace(
           regexp_replace(
             regexp_replace(lower(coalesce(p_nama, '')), '[^a-z0-9]+', ' ', 'g'),
             -- "SMP Negeri 1" dan "SMP N 1" adalah "SMPN 1".
             '\y(sd|smp|sma|smk|mi|mts|ma)\s+n(egeri)?\y', '\1n', 'g'),
           '\s+', ' ', 'g'))
$$;

comment on function kunci_sekolah(text) is
  'Penyamaan nama sekolah untuk unique index. Sengaja jinak: hanya besar-kecil huruf, tanda baca, dan bentuk "Negeri". Yang membedakan dua sekolah senama adalah ekor kabupaten di dalam namanya, bukan fungsi ini.';

-- ---------------------------------------------------------------------------
-- 2. Laporkan dulu apa yang akan dilebur. Migrasi yang menghapus baris tanpa
--    menyebut baris mana adalah migrasi yang tidak bisa diperiksa sesudahnya.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select kunci_sekolah(name) as k, count(*) as n,
           string_agg(format('%s <%s>', name, address), ' | ' order by created_at) as isi
      from sekolah group by 1 having count(*) > 1 order by 2 desc, 1
  loop
    raise notice '0061: % baris -> 1 : %', r.n, r.isi;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Lebur. Yang bertahan adalah baris TERTUA — ia yang paling mungkin sudah
--    dirujuk pendaftaran lain, dan namanya toh ditimpa nama baku di langkah 4.
-- ---------------------------------------------------------------------------
-- Tanpa `on commit drop`: psql menjalankan tiap perintah dalam transaksinya
-- sendiri, jadi tabelnya akan lenyap sebelum baris berikutnya membacanya.
-- Ia dibuang sendiri di ujung berkas.
drop table if exists peta_lebur;
create temporary table peta_lebur as
with urut as (
  select id,
         first_value(id) over (partition by kunci_sekolah(name)
                               order by created_at, id) as pemenang
    from sekolah
)
select id as id_lama, pemenang from urut where id <> pemenang;

do $$
declare v_n int; v_p int;
begin
  select count(*) into v_n from peta_lebur;

  update pendaftaran d set sekolah_id = m.pemenang
    from peta_lebur m where d.sekolah_id = m.id_lama;
  get diagnostics v_p = row_count;

  delete from sekolah where id in (select id_lama from peta_lebur);
  raise notice '0061: % baris kembar dihapus, % pendaftaran dialihkan.', v_n, v_p;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Nama dan alamat baku, dari daftar kurasi.
-- ---------------------------------------------------------------------------
drop table if exists sekolah_baku;
create temporary table sekolah_baku (nama text, alamat text);
insert into sekolah_baku (nama, alamat) values
  ('MA Al-Azhar Kota Banjar',
   'Jl. Pesantren No. 02, Kujangsari, Kec. Langensari, Kota Banjar, Jawa Barat 46345, Indonesia'),   -- NPSN 20277086
  ('MA Al-Kautsar',
   'Jl. Pejuang No. 100, Jajawar, Kec. Banjar, Kota Banjar, Jawa Barat 46318, Indonesia'),   -- NPSN 20277087
  ('MA Assalimiyah',
   'Jl. KH. Salim No. 1, Darmacaang, Kec. Cikoneng, Kabupaten Ciamis, Jawa Barat 46261, Indonesia'),   -- NPSN 20276445
  ('MA YPI Rijalul Hikam',
   'Jl. Raya Jatinagara No. 03, Jatinagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat 46273, Indonesia'),   -- NPSN 20280199
  ('MTs Rancah',
   'Jl. Cibeureum No. 50, Rancah, Kec. Rancah, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20278706
  ('MTs Rijalul Hikam',
   'Jl. Raya Jatinagara No. 03, Jatinagara, Kec. Jatinagara, Kabupaten Ciamis, Jawa Barat 46273, Indonesia'),   -- NPSN 20278644
  ('SMA IT Al-Falah',
   'Jl. Citalahab, Mekarjaya, Kec. Bungbulang, Kabupaten Garut, Jawa Barat 44165, Indonesia'),   -- NPSN 69830402
  ('SMA Islam Ainurrafiq',
   'Jl. Pemuda No. 001, Panawuan, Kec. Cigandamekar, Kabupaten Kuningan, Jawa Barat 45556, Indonesia'),   -- NPSN 20212946
  ('SMA Islam Nurul Fikri',
   'Jl. Palka, Bantarwaru, Kec. Cinangka, Kabupaten Serang, Banten 42167, Indonesia'),   -- NPSN 20607991
  ('SMA Terpadu Cikanyere',
   'Dusun Cigoong RT 01 RW 01, Sirnabaya, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat 46254, Indonesia'),   -- NPSN 69988141
  ('SMA Terpadu Riyadlul Ulum',
   'Komplek Pesantren Condong-Cibeurem, Setianagara, Kec. Cibeureum, Kota Tasikmalaya, Jawa Barat 46196, Indonesia'),   -- NPSN 20224512
  ('SMAN 1 Cihaurbeuti',
   'Jl. Kartawijaya No. 600, Pamokolan, Kec. Cihaurbeuti, Kabupaten Ciamis, Jawa Barat 46262, Indonesia'),   -- NPSN 20211578
  ('SMAN 1 Cirebon',
   'Jl. Wahidin Sudirohusodo No. 81, Sukapura, Kec. Kejaksan, Kota Cirebon, Jawa Barat 45122, Indonesia'),   -- NPSN 20222364
  ('SMAN 1 Maja',
   'Jl. Raya Maja Selatan No. 6, Maja Selatan, Kec. Maja, Kabupaten Majalengka, Jawa Barat 45461, Indonesia'),   -- NPSN 20213894
  ('SMK Bangkit Indonesia Talaga',
   'Jl. Ganeas No. 01, Ganeas, Kec. Talaga, Kabupaten Majalengka, Jawa Barat 45463, Indonesia'),   -- NPSN 69816737
  ('SMK Galuh Rahayu',
   'Jl. Raya Sukaraja, Sukaraja, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat 46268, Indonesia'),   -- NPSN 20254622
  ('SMK Siliwangi AMS Banjarsari',
   'Jl. Raya Timur No. 60, Cibadak, Kec. Banjarsari, Kabupaten Ciamis, Jawa Barat, Indonesia'),   -- NPSN 20254624
  ('SMKN 1 Losarang',
   'Jl. Raya Santing, Santing, Kec. Losarang, Kabupaten Indramayu, Jawa Barat 45253, Indonesia'),   -- NPSN 20216001
  ('SMKN 2 Ciamis',
   'Jl. Sadananya No. 21, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46214, Indonesia'),   -- NPSN 20211512
  ('SMP Islam Ainurrafiq',
   'Jl. Pemuda No. 001, Panawuan, Kec. Cigandamekar, Kabupaten Kuningan, Jawa Barat 45556, Indonesia'),   -- NPSN 20212933
  ('SMP Terpadu Riyadlul Ulum Waddawah',
   'Komplek Pesantren Condong RT 01 RW 04, Setianegara, Kec. Cibeureum, Kota Tasikmalaya, Jawa Barat 46196, Indonesia'),   -- NPSN 20224575
  ('SMPN 1 Ciamis',
   'Jl. Jenderal Sudirman No. 6, Ciamis, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46211, Indonesia'),   -- NPSN 20211519
  ('SMPN 2 Cipaku',
   'Jl. Desa Cipaku No. 5, Cipaku, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat 46252, Indonesia')   -- NPSN 20211649
;

do $$
declare v_n int; r record;
begin
  update sekolah s
     set name = b.nama, address = b.alamat
    from sekolah_baku b
   where kunci_sekolah(s.name) = kunci_sekolah(b.nama);
  get diagnostics v_n = row_count;
  raise notice '0061: % sekolah dibakukan dari daftar kurasi.', v_n;

  -- Yang tidak ada di daftar kurasi dibiarkan apa adanya, tapi disebut
  -- namanya. Sekolah baru memang boleh lahir dari pendaftaran; yang tidak
  -- boleh adalah ia lahir DUA KALI, dan itu dijaga langkah 5.
  for r in
    select s.name, s.address from sekolah s
     where not exists (select 1 from sekolah_baku b
                        where kunci_sekolah(b.nama) = kunci_sekolah(s.name))
     order by s.name
  loop
    raise notice '0061: di luar daftar kurasi, alamat dibiarkan — % <%>', r.name, r.address;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Pagarnya. Ini bagian yang membuat perbaikan di atas bertahan.
-- ---------------------------------------------------------------------------
alter table sekolah drop constraint if exists sekolah_nama_alamat_key;
alter table sekolah drop constraint if exists sekolah_name_address_key;

create unique index if not exists sekolah_kunci_unik on sekolah (kunci_sekolah(name));

comment on index sekolah_kunci_unik is
  'Satu sekolah, satu baris. Menggantikan unique (name, address) dari 0001, yang memakai alamat sebagai pembeda dan karena itu membelah satu sekolah tiap kali alamatnya diketik berbeda.';

-- ---------------------------------------------------------------------------
-- 6. Pendaftaran mencari sekolah lewat NAMA.
--
--    Alamat yang diketik pembina hanya dipakai kalau sekolahnya memang belum
--    ada. Kalau sudah ada, alamat kurasi yang bertahan — pembina sedang
--    mendaftarkan regu, bukan sedang memperbaiki data kita.
-- ---------------------------------------------------------------------------
create or replace function submit_pendaftaran(
  p_nama_sekolah   text,
  p_alamat_sekolah text,
  p_butuh_barak    boolean,
  p_kontak_wa      text,
  p_regu           jsonb,
  p_jumlah_pendamping smallint default 0,
  p_kunci_kirim    uuid default null,
  p_nama_kontak    text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_sekolah  uuid;
  v_batch    uuid;
  v_kode     text;
  v_n        int;
  v_r        jsonb;
  v_ada      pendaftaran%rowtype;
begin
  -- Kiriman ulang dengan kunci yang sama: kembalikan hasil yang dulu.
  if p_kunci_kirim is not null then
    select * into v_ada from pendaftaran where kunci_kirim = p_kunci_kirim;
    if found then
      return jsonb_build_object(
        'kode_pembayaran', v_ada.kode_pembayaran,
        'jumlah_regu', v_ada.jumlah_regu,
        'total_tagihan', v_ada.jumlah_regu * (select biaya_per_regu from edisi where is_active),
        'terkirim_ulang', true);
    end if;
  end if;

  v_n := jsonb_array_length(p_regu);
  if v_n is null or v_n < 1 then
    raise exception 'minimal satu regu';
  end if;
  if v_n > 30 then
    raise exception 'maksimal 30 regu per pendaftaran';
  end if;
  if p_kontak_wa is null or length(trim(p_kontak_wa)) < 8 then
    raise exception 'kontak WA wajib diisi';
  end if;
  if coalesce(trim(p_nama_sekolah), '') = '' then
    raise exception 'nama sekolah wajib diisi';
  end if;

  for v_r in select * from jsonb_array_elements(p_regu) loop
    if coalesce(trim(v_r ->> 'nama_regu'), '') = '' then
      raise exception 'nama regu wajib diisi';
    end if;
    if coalesce(trim(v_r ->> 'nama_ketua'), '') = '' then
      raise exception 'nama ketua wajib diisi';
    end if;
    if coalesce(v_r ->> 'golongan', '') not in
       ('penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi') then
      raise exception 'golongan tidak dikenal: %', coalesce(v_r ->> 'golongan', '(kosong)');
    end if;
  end loop;

  select id into v_sekolah from sekolah
   where kunci_sekolah(name) = kunci_sekolah(p_nama_sekolah);

  if v_sekolah is null then
    insert into sekolah (name, address)
    values (trim(p_nama_sekolah), trim(coalesce(p_alamat_sekolah, '')))
    on conflict (kunci_sekolah(name)) do nothing
    returning id into v_sekolah;

    -- Dua pendaftaran sekolah yang sama pada detik yang sama: yang kalah
    -- membaca baris pemenangnya, bukan gagal.
    if v_sekolah is null then
      select id into v_sekolah from sekolah
       where kunci_sekolah(name) = kunci_sekolah(p_nama_sekolah);
    end if;
  end if;

  loop
    v_kode := 'HRCD' || edisi_aktif() || '-' ||
              upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from pendaftaran where kode_pembayaran = v_kode);
  end loop;

  insert into pendaftaran (sekolah_id, kode_pembayaran, butuh_barak,
                           jumlah_pendamping, jumlah_regu, kontak_wa, kunci_kirim, nama_kontak)
  values (v_sekolah, v_kode, coalesce(p_butuh_barak, false),
          greatest(coalesce(p_jumlah_pendamping, 0), 0), v_n, trim(p_kontak_wa),
          p_kunci_kirim, nullif(trim(coalesce(p_nama_kontak, '')), ''))
  returning id into v_batch;

  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  select v_batch, trim(r ->> 'nama_regu'), trim(r ->> 'nama_ketua'), r ->> 'golongan'
  from jsonb_array_elements(p_regu) r;

  return jsonb_build_object(
    'kode_pembayaran', v_kode,
    'jumlah_regu', v_n,
    'total_tagihan', v_n * (select biaya_per_regu from edisi where is_active));
end;
$$;

drop table peta_lebur;
drop table sekolah_baku;

-- ---------------------------------------------------------------------------
-- 7. Hasilnya.
-- ---------------------------------------------------------------------------
do $$
declare v_s int; v_d int;
begin
  select count(*) into v_s from sekolah;
  select count(*) into v_d from (
    select 1 from sekolah group by kunci_sekolah(name) having count(*) > 1) x;
  raise notice '0061: % sekolah, % nama kembar.', v_s, v_d;
  assert v_d = 0, 'masih ada nama sekolah kembar';
end $$;
