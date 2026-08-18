-- ============================================================================
-- hrcd-rekap : 0078_kunci_akun.sql
--
-- NAMA AKUN DISAMAKAN SEPERTI GMAIL: TITIK TIDAK MENJADIKANNYA AKUN LAIN.
-- `aji.furqon` dan `ajifurqon` orang yang sama.
--
-- ---------------------------------------------------------------------------
-- POLANYA SUDAH ADA DI RUMAH INI
--
-- Ini `kunci_sekolah()` (0061/0062) diterapkan ke akun: nama DISIMPAN seperti
-- diketik, keunikannya dijaga atas KUNCInya, dan pencarian lewat kunci itu.
-- Satu konsep untuk dua tabel, bukan dua mekanisme yang mirip.
--
-- Karena itu `admin.ciradyka` tetap terbaca bertitik di daftar Akun, di kolom
-- "oleh" seluruh riwayat yang sudah dicatat, di simulasi_end_to_end.sql, dan
-- di change_password.py. Tidak ada satu baris pun yang ditulis ulang.
--
-- ---------------------------------------------------------------------------
-- KENAPA HANYA TITIK, DAN KENAPA ITU PENTING
--
-- CLAUDE.md 12.10 memberi ukurannya: kunci database menolak baris TANPA ADA
-- YANG MEMERIKSA, jadi ia hanya boleh menyamakan yang PASTI sama. Untuk akun
-- itu berarti titik dan besar-kecil huruf, TIDAK LEBIH.
--
-- `-` dan `_` sengaja TIDAK ikut walaupun gateway pernah menerimanya: melebur
-- `aji-furqon` dengan `ajifurqon` berarti melebur dua ORANG, dan itu jauh
-- lebih sulit ketahuan daripada dua baris sekolah kembar — yang satu tidak
-- bisa login dan tidak tahu kenapa. Ekor `+tag` gaya Gmail juga tidak ikut.
--
-- ---------------------------------------------------------------------------
-- YANG TIDAK DIKERJAKAN DI SINI
--
-- Login TIDAK dijaga oleh index ini. Yang mencocokkan akun saat login adalah
-- `auth.users.email`, bukan tabel ini — barisnya baru dibaca sesudah token
-- didapat. Jadi index ini menjaga syarat "tidak boleh keduanya terdaftar";
-- syarat "login dengan salah satu bentuk menemukan akun yang sama" dikerjakan
-- di klien dan gateway, dan tidak bisa dipindahkan ke sini.
-- ============================================================================

create or replace function kunci_akun(p_nama text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(replace(coalesce(p_nama, ''), '.', ''));
$$;

comment on function kunci_akun(text) is
  'Kunci penyamaan nama akun: huruf kecil, titik dibuang. HANYA titik — '
  'melebur - atau _ berarti melebur dua orang (CLAUDE.md 12.10).';

-- ---------------------------------------------------------------------------
-- Melapor DULU, baru memasang. Dua akun yang cuma beda titik TIDAK BISA
-- dilebur seperti dua baris sekolah (0061): ada dua user auth, dua password,
-- dua orang. Yang benar adalah berhenti dan menyerahkannya ke manusia.
-- ---------------------------------------------------------------------------
do $blok$
declare
  r      record;
  v_n    integer := 0;
begin
  for r in
    select kunci_akun(username) as kunci, count(*) as jml,
           string_agg(username, ' | ' order by username) as nama
    from akun_panitia group by 1 having count(*) > 1
  loop
    raise warning '0078: TABRAKAN — % menunjuk % akun: %', r.kunci, r.jml, r.nama;
    v_n := v_n + 1;
  end loop;

  if v_n > 0 then
    raise exception '0078: % kunci bertabrakan. Index tidak dipasang. Dua akun '
      'yang cuma beda titik tidak bisa dilebur — pilih yang bertahan, '
      'nonaktifkan yang lain, lalu jalankan lagi.', v_n;
  end if;
end;
$blok$;

create unique index if not exists akun_kunci_unik
  on akun_panitia (kunci_akun(username));

do $blok$
declare v_n integer;
begin
  select count(*) into v_n from akun_panitia;
  raise notice '0078: kunci akun terpasang, % akun, tidak ada yang bertabrakan.', v_n;
end;
$blok$;
