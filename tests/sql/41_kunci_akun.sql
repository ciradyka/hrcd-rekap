-- ============================================================================
-- hrcd-rekap : tests/sql/41_kunci_akun.sql
-- Titik tidak menjadikan nama akun jadi akun lain (migrasi 0078).
--
-- YANG DIJAGA DAN YANG TIDAK
--
-- Index ini menjaga SATU dari dua syarat: `aji.furqon` dan `ajifurqon` tidak
-- bisa sama-sama terdaftar. Syarat keduanya — login dengan salah satu bentuk
-- menemukan akun yang sama — TIDAK bisa diuji di sini: yang mencocokkan akun
-- saat login adalah `auth.users.email`, dan barisnya baru dibaca sesudah token
-- didapat. Itu dijaga di klien dan gateway.
--
-- Yang paling penting di berkas ini justru 41.3: kunci ini HANYA menyamakan
-- titik. Melebur `aji-furqon` dengan `ajifurqon` berarti melebur dua ORANG,
-- dan orang yang terlebur tidak bisa login tanpa tahu kenapa.
-- ============================================================================

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000e1', 'uji.kunci@uji.local')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 41.1  Nama bertitik boleh, dan tersimpan APA ADANYA.
--
-- Kalau yang tersimpan ikut dibakukan, `admin.ciradyka` akan terbaca
-- `adminciradyka` di seluruh riwayat yang sudah dicatat — dan pola
-- kunci_sekolah justru dipilih untuk menghindari itu.
-- ---------------------------------------------------------------------------
do $blok$
declare v_nama text;
begin
  insert into akun_panitia (user_id, username, peran, pos, is_active)
  values ('00000000-0000-0000-0000-0000000000e1', 'uji.kunci', 'gerbang', null, false);

  select username into v_nama from akun_panitia
  where user_id = '00000000-0000-0000-0000-0000000000e1';
  assert v_nama = 'uji.kunci',
    format('nama tersimpan berubah jadi %s — seharusnya apa adanya', v_nama);
  raise notice '41.1 OK — nama bertitik tersimpan apa adanya.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 41.2  Bentuk tanpa titik DITOLAK sebagai akun baru.
-- ---------------------------------------------------------------------------
do $blok$
declare v_pesan text;
begin
  insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000e2', 'ujikunci@uji.local')
  on conflict (id) do nothing;

  begin
    insert into akun_panitia (user_id, username, peran, pos, is_active)
    values ('00000000-0000-0000-0000-0000000000e2', 'ujikunci', 'gerbang', null, false);
    assert false, 'ujikunci seharusnya bertabrakan dengan uji.kunci';
  exception when unique_violation then
    v_pesan := sqlerrm;
  end;
  assert v_pesan is not null, 'unique index atas kunci_akun tidak terpasang';
  raise notice '41.2 OK — ujikunci ditolak karena uji.kunci sudah ada.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 41.3  TAPI `-` dan `_` TETAP akun lain. Ini batas yang disengaja.
--
-- Kunci yang terlalu rakus melebur dua orang, dan yang terlebur tidak pernah
-- diberi tahu — ia cuma tidak bisa login (CLAUDE.md 12.10).
-- ---------------------------------------------------------------------------
do $blok$
declare v_n integer;
begin
  insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000e3', 'uji-kunci@uji.local')
  on conflict (id) do nothing;

  insert into akun_panitia (user_id, username, peran, pos, is_active)
  values ('00000000-0000-0000-0000-0000000000e3', 'uji-kunci', 'gerbang', null, false);

  select count(*) into v_n from akun_panitia
  where username in ('uji.kunci', 'uji-kunci');
  assert v_n = 2, format('uji-kunci seharusnya akun tersendiri, ada %s baris', v_n);
  raise notice '41.3 OK — tanda strip tetap membedakan dua orang.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 41.4  Besar-kecil huruf ikut disamakan.
-- ---------------------------------------------------------------------------
do $blok$
declare v_pesan text;
begin
  insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000e4', 'ujikuncibesar@uji.local')
  on conflict (id) do nothing;

  begin
    insert into akun_panitia (user_id, username, peran, pos, is_active)
    values ('00000000-0000-0000-0000-0000000000e4', 'Uji.Kunci', 'gerbang', null, false);
    assert false, 'Uji.Kunci seharusnya bertabrakan dengan uji.kunci';
  exception when unique_violation then
    v_pesan := sqlerrm;
  end;
  assert v_pesan is not null, 'besar-kecil huruf tidak ikut disamakan';
  raise notice '41.4 OK — besar-kecil huruf ikut disamakan.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 41.5  Fungsi kuncinya sendiri, diperiksa langsung.
-- ---------------------------------------------------------------------------
do $blok$
begin
  assert kunci_akun('aji.furqon') = 'ajifurqon', 'titik seharusnya dibuang';
  assert kunci_akun('AJI.FURQON') = 'ajifurqon', 'huruf besar seharusnya diturunkan';
  assert kunci_akun('aji..furqon') = 'ajifurqon', 'titik ganda seharusnya dibuang';
  assert kunci_akun('aji-furqon') = 'aji-furqon', 'strip TIDAK boleh dibuang';
  assert kunci_akun('aji_furqon') = 'aji_furqon', 'garis bawah TIDAK boleh dibuang';
  assert kunci_akun(null) = '', 'null seharusnya jadi teks kosong, bukan null';
  raise notice '41.5 OK — kunci hanya membuang titik dan menurunkan huruf.';
end $blok$;

-- ---------------------------------------------------------------------------
-- Bersih-bersih.
-- ---------------------------------------------------------------------------
delete from akun_panitia where username in ('uji.kunci', 'uji-kunci');
delete from auth.users where id in (
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000e2',
  '00000000-0000-0000-0000-0000000000e3',
  '00000000-0000-0000-0000-0000000000e4');
