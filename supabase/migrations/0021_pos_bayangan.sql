-- ============================================================================
-- hrcd-rekap : 0021_pos_bayangan.sql
--
-- Pos bayangan IKUT DINILAI.
--
-- `docs/alur-lomba.md` 7.2 menulis pos bayangan "tidak dinilai, sehingga tidak
-- dimodelkan sistem sama sekali", dan skema mengunci nomor pos ke 1-5 atas
-- dasar kalimat itu. Lembar penilaian yang benar-benar dipakai panitia
-- menunjukkan sebaliknya: "Pos Bayangan 1 Kostum" punya kolom Kreativitas,
-- Kekompakan, dan Kesopanan, punya Nilai Pos, bahkan punya kolom RANK. Yang
-- salah adalah dokumennya, bukan lembarnya — dan dokumennya sudah dibetulkan
-- bersama migrasi ini.
--
-- Yang berubah karena itu:
--   1. Nomor pos tidak lagi dibatasi 1-5. Batas barunya 1-20 — cukup longgar
--      untuk pos bayangan sebanyak apa pun yang masuk akal, tapi tetap sebuah
--      batas, supaya salah ketik (pos 300) tertahan database.
--   2. `pos.bayangan` menandai mana yang pos bayangan. Penilaiannya sama persis
--      dengan pos utama — penanda ini untuk MANUSIA (judul layar, kertas,
--      pengurutan), bukan cabang logika di mesin skor.
--   3. `akun_panitia.pos` ikut dilonggarkan, kalau tidak akun operator untuk
--      pos bayangan tidak bisa dibuat sama sekali.
--
-- Tidak ada perubahan pada mesin skor. Pos bayangan adalah pos biasa yang
-- kebetulan dinilai lebih ringan; bobot relatifnya diatur lewat `pos.bobot`,
-- bukan lewat kode.
-- ============================================================================

-- 1. Nomor pos -------------------------------------------------------------
alter table pos drop constraint if exists pos_nomor_check;
alter table pos add constraint pos_nomor_check check (nomor between 1 and 20);

alter table akun_panitia drop constraint if exists akun_panitia_pos_check;
alter table akun_panitia add constraint akun_panitia_pos_check
  check (pos between 1 and 20);

-- Nama constraint bawaan PostgreSQL (`<tabel>_<kolom>_check`) tidak dijamin
-- apa pun — kalau di database ini namanya ternyata lain, DROP IF EXISTS di
-- atas tidak melakukan apa-apa dan batas 1-5 yang lama diam-diam tetap
-- berlaku. Migrasinya akan tampak berhasil, lalu insert pos 6 di 0024 gagal
-- dengan pesan yang menunjuk ke tempat yang salah. Jadi diperiksa di sini,
-- selagi penyebabnya masih terlihat.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid in ('pos'::regclass, 'akun_panitia'::regclass)
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%<= 5)%') then
    raise exception 'batas lama pos 1-5 masih terpasang dengan nama constraint yang berbeda — cari namanya lewat \d pos lalu drop manual';
  end if;
end;
$$;

-- 2. Penanda pos bayangan --------------------------------------------------
alter table pos add column bayangan boolean not null default false;

comment on column pos.bayangan is
  'Pos bayangan (kostum, yel-yel, dsb). Dinilai persis seperti pos utama; '
  'penanda ini hanya untuk judul layar dan kertas.';
