-- ============================================================================
-- hrcd-rekap : 0001_schema.sql
-- Tabel operasional + konfigurasi. Acuan: docs/rancangan-b.md bagian 2.
--
-- Prinsip: kebenaran data ditegakkan constraint database, bukan kehati-hatian
-- kode. UNIQUE (nomor_dada) membuat nomor ganda mustahil; UNIQUE
-- (kloter_nomor, urutan_kloter) menegakkan kapasitas kloter.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabel konfigurasi (diedit admin tiap edisi — rancangan-b.md 2.2)
-- ---------------------------------------------------------------------------

create table edisi (
  nomor                     smallint primary key,
  nama                      text not null,
  tahun                     smallint not null,
  tanggal_lomba             date not null,
  biaya_per_regu            integer not null check (biaya_per_regu >= 0),
  maks_regu_per_kloter      smallint not null default 10 check (maks_regu_per_kloter between 1 and 10),
  kloter_dasar              smallint not null default 30,
  kloter_maks               smallint not null default 40,
  lompatan_kloter           smallint not null default 2 check (lompatan_kloter >= 1),
  interval_berangkat_menit  smallint not null default 4,
  aktif                     boolean not null default false,
  check (kloter_dasar <= kloter_maks)
);

-- Tepat satu edisi aktif.
create unique index edisi_satu_aktif on edisi ((true)) where aktif;

create table pos (
  edisi   smallint not null references edisi (nomor),
  nomor   smallint not null check (nomor between 1 and 5),
  nama    text not null,
  bobot   numeric(6,2) not null default 1.00 check (bobot > 0),
  primary key (edisi, nomor)
);

create table wahana (
  id                 uuid primary key default gen_random_uuid(),
  edisi              smallint not null,
  pos                smallint not null,
  -- kode = header kolom lembar cetak SEKALIGUS header import massal.
  -- Format ketat supaya kertas, foto, hasil AI, dan paste memakai kosakata
  -- yang sama persis (rancangan-b.md 2.2.1).
  kode               text not null check (kode ~ '^[a-z0-9_]+$'),
  nama               text not null,
  jenis              text not null check (jenis in ('wahana', 'soal')),
  bentuk             text not null check (bentuk in
                       ('kecil_baik', 'besar_baik', 'biner',
                        'benar_per_total', 'benar_kurang_salah')),
  poin_maks          numeric(8,2) not null check (poin_maks > 0),
  raw_terbaik        numeric(10,2),          -- kecil_baik / besar_baik
  raw_terburuk       numeric(10,2),          -- kecil_baik / besar_baik
  poin_benar         numeric(8,2),           -- biner / benar_kurang_salah
  poin_salah         numeric(8,2),           -- biner / benar_kurang_salah (negatif utk pengurang)
  total_soal         numeric(6,0),           -- benar_per_total
  rentang_mentah_min numeric(10,2) not null, -- batas validasi import
  rentang_mentah_maks numeric(10,2) not null,
  urutan             smallint not null default 1,
  unique (edisi, pos, kode),
  foreign key (edisi, pos) references pos (edisi, nomor),
  check (rentang_mentah_min <= rentang_mentah_maks),
  -- Parameter wajib sesuai bentuk — konfigurasi salah tertolak sejak insert.
  check (bentuk not in ('kecil_baik', 'besar_baik')
         or (raw_terbaik is not null and raw_terburuk is not null
             and raw_terbaik <> raw_terburuk)),
  check (bentuk <> 'biner'
         or (poin_benar is not null and poin_salah is not null)),
  check (bentuk <> 'benar_per_total'
         or (total_soal is not null and total_soal > 0)),
  check (bentuk <> 'benar_kurang_salah'
         or (poin_benar is not null and poin_salah is not null))
);

create table kontrak_opsi (
  edisi   smallint not null references edisi (nomor),
  label   text not null,
  menit   smallint not null check (menit > 0),
  urutan  smallint not null default 1,
  primary key (edisi, menit)
);

create table konfig_penalti (
  edisi                       smallint primary key references edisi (nomor),
  blok_menit                  smallint not null default 10 check (blok_menit > 0),
  penalti_per_blok            numeric(6,2) not null default 10,
  penalti_tanpa_checkout      numeric(6,2) not null default 100,
  penalti_per_anggota_hilang  numeric(6,2) not null default 20,
  nilai_pos_terlewat          numeric(6,2) not null default 0
);

-- ---------------------------------------------------------------------------
-- 2. Saklar hari-H — satu baris (rancangan-b.md 2.1 status_acara)
-- ---------------------------------------------------------------------------

create table status_acara (
  id                    boolean primary key default true check (id),
  daftar_ulang_ditutup  boolean not null default false,
  fase_live             text not null default 'pra'
                        check (fase_live in ('pra', 'progres', 'penuh')),
  konfigurasi_terkunci  boolean not null default false
);

-- ---------------------------------------------------------------------------
-- 3. Tabel operasional
-- ---------------------------------------------------------------------------

create table sekolah (
  id           uuid primary key default gen_random_uuid(),
  nama         text not null check (length(trim(nama)) > 0),
  alamat       text not null,
  dibuat_pada  timestamptz not null default now(),
  -- Sekolah bernama sama boleh ada selama alamatnya beda (alur 3.2.2).
  unique (nama, alamat)
);

create table pendaftaran (
  id                uuid primary key default gen_random_uuid(),
  sekolah_id        uuid not null references sekolah (id),
  -- Terbit saat submit; ID yang disebut sekolah saat bayar & daftar ulang.
  kode_pembayaran   text not null unique,
  butuh_barak       boolean not null default false,
  jumlah_pendamping smallint not null default 0 check (jumlah_pendamping >= 0),
  jumlah_regu       smallint not null check (jumlah_regu between 1 and 100),
  kontak_wa         text not null,   -- PII: tertutup untuk anon
  -- Semua-atau-tidak: tidak ada bentuk "lunas sebagian" (alur 3.5).
  status            text not null default 'menunggu_pembayaran'
                    check (status in ('menunggu_pembayaran', 'lunas', 'batal')),
  dibuat_pada       timestamptz not null default now()
);

create table nomor_dada_stok (
  -- Stok fisik yang disiapkan admin. Nomor "tersedia" = belum ada di
  -- regu.nomor_dada dan belum pensiun — satu sumber kebenaran per fakta.
  nomor integer primary key check (nomor > 0)
);

create table nomor_dada_pensiun (
  -- Nomor yang pernah dilepas regu (rusak/tukar) TIDAK kembali ke antrean:
  -- lembar kertas lama di lapangan masih menuliskan nomor itu, dan bila
  -- terbit ulang di regu lain, foto susulan akan menilai regu yang salah
  -- (temuan review). Pensiun permanen untuk edisi berjalan.
  nomor integer primary key references nomor_dada_stok (nomor),
  alasan text not null,
  pada   timestamptz not null default now()
);

create table kloter (
  nomor         smallint primary key check (nomor between 1 and 40),
  -- DIKETIK panitia pencatat — TIDAK PERNAH default now() (alur 12.4).
  -- Posisi pipeline garis start DITURUNKAN dari kolom ini (v_keberangkatan),
  -- tidak ada kolom status yang digeser manual (rancangan-b.md 11.5).
  jam_berangkat timestamptz
);

create table regu (
  id             uuid primary key default gen_random_uuid(),
  pendaftaran_id uuid not null references pendaftaran (id),
  nama_regu      text not null check (length(trim(nama_regu)) > 0),
  -- Empat anggota lain sengaja tidak dicatat (alur 3.2.6);
  -- kelengkapan dicek fisik di closing (anggota_hadir).
  nama_ketua     text not null,
  golongan       text not null check (golongan in
                   ('penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi')),
  -- UNIQUE: nomor dada ganda MUSTAHIL, dari berapa pun meja paralel.
  nomor_dada     integer unique references nomor_dada_stok (nomor),
  kloter_nomor   smallint references kloter (nomor),
  urutan_kloter  smallint check (urutan_kloter between 1 and 10),
  kontrak_menit  smallint,   -- divalidasi RPC terhadap kontrak_opsi
  batal          boolean not null default false,
  -- Kapasitas maks 10 regu/kloter ditegakkan database, bukan kode.
  unique (kloter_nomor, urutan_kloter),
  -- Nomor dada dan kloter lahir bersama di daftar_ulang_batch.
  check ((nomor_dada is null) = (kloter_nomor is null)),
  check ((kloter_nomor is null) = (urutan_kloter is null))
);

create index regu_pendaftaran_idx on regu (pendaftaran_id);
create index regu_kloter_idx on regu (kloter_nomor);

create table pembayaran (
  id               uuid primary key default gen_random_uuid(),
  -- UNIQUE = satu batch satu pembayaran penuh; verifikasi ganda dari dua
  -- meja tertolak database.
  pendaftaran_id   uuid not null unique references pendaftaran (id),
  nominal          integer not null check (nominal > 0),
  metode           text not null check (metode in ('tunai', 'transfer')),
  nomor_kwitansi   text not null unique,
  diverifikasi_oleh uuid not null references auth.users (id),
  diverifikasi_pada timestamptz not null default now()
);

create table keberangkatan_regu (
  -- Keberadaan baris = regu berangkat; PK membuat ceklis ganda mustahil.
  regu_id      uuid primary key references regu (id),
  dicatat_oleh uuid not null references auth.users (id),
  -- Jejak administratif saja — jam yang DINILAI ada di kloter.jam_berangkat.
  dicatat_pada timestamptz not null default now()
);

create table nilai_mentah (
  id          bigint generated always as identity primary key,
  regu_id     uuid not null references regu (id),
  wahana_id   uuid not null references wahana (id),
  nilai_1     numeric(10,2) not null,
  nilai_2     numeric(10,2),   -- hanya benar_kurang_salah (jumlah salah)
  sumber      text not null check (sumber in ('manual', 'upload')),
  diinput_oleh uuid not null references auth.users (id),
  diinput_pada timestamptz not null default now(),
  -- Satu nilai per regu per komponen; input ulang = update (menimpa,
  -- kuning di preview, terekam riwayat).
  unique (regu_id, wahana_id)
);

create index nilai_mentah_wahana_idx on nilai_mentah (wahana_id);

create table closing_regu (
  regu_id       uuid primary key references regu (id),
  -- DIKETIK dan bisa di-edit (upsert ulang) — bukan cap waktu server
  -- (alur 12.3–12.4). Jalur kertas menyusul adalah kejadian normal.
  jam_datang    timestamptz not null,
  anggota_hadir smallint not null default 5 check (anggota_hadir between 0 and 5),
  dicatat_oleh  uuid not null references auth.users (id),
  dicatat_pada  timestamptz not null default now(),
  catatan       text
);

create table ruangan (
  id        uuid primary key default gen_random_uuid(),
  nama      text not null unique,
  kapasitas integer not null check (kapasitas > 0)
);

create table penempatan_barak (
  id             uuid primary key default gen_random_uuid(),
  pendaftaran_id uuid not null references pendaftaran (id),
  ruangan_id     uuid not null references ruangan (id),
  jumlah_orang   integer not null check (jumlah_orang > 0),
  -- Satu sekolah BOLEH terpecah ke beberapa ruangan (rancangan-b.md 11.8);
  -- yang unik hanyalah pasangannya.
  unique (pendaftaran_id, ruangan_id)
);

create table akun_panitia (
  user_id  uuid primary key references auth.users (id),
  username text not null unique,   -- pola per edisi: pos1hrcd37, meja1hrcd37
  peran    text not null check (peran in ('admin', 'meja', 'operator_pos')),
  pos      smallint check (pos between 1 and 5),
  aktif    boolean not null default true,
  -- operator_pos wajib punya pos; peran lain wajib tidak.
  check ((peran = 'operator_pos') = (pos is not null))
);

create table riwayat (
  id         bigint generated always as identity primary key,
  tabel      text not null,
  baris_id   text not null,
  -- Diisi trigger bila baris menyangkut satu regu — pencarian riwayat per
  -- nomor dada jadi satu query (rancangan-b.md 11.11).
  regu_id    uuid,
  aksi       text not null check (aksi in ('INSERT', 'UPDATE', 'DELETE')),
  nilai_lama jsonb,
  nilai_baru jsonb,
  oleh       uuid,
  pada       timestamptz not null default now()
);

create index riwayat_regu_idx on riwayat (regu_id);
create index riwayat_tabel_idx on riwayat (tabel, pada);
