-- ============================================================================
-- hrcd-rekap : tests/sql/40_peran_mengisi_ulang_centang.sql
-- Mengganti peran mengisi ulang akun_hak (migrasi 0077).
--
-- KENAPA TES INI ADA
--
-- Layar Akun menjanjikannya dengan satu kalimat, dan selama berbulan-bulan
-- tidak ada satu baris pun yang menepatinya. Yang membuatnya lolos: layarnya
-- BENAR — peran berubah, notifikasi muncul, tabel menampilkan peran baru.
-- Yang tidak berubah cuma sebelas kotak centang yang letaknya jauh di kanan.
--
-- Jadi yang diuji di sini bukan "triggernya ada", melainkan akibatnya: sesudah
-- diturunkan dari admin, akun itu TIDAK LAGI memegang `akun` dan `pengaturan`.
-- ============================================================================

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000d1', 'uji.peran@uji.local')
on conflict (id) do nothing;

insert into akun_panitia (user_id, username, peran, pos, is_active)
values ('00000000-0000-0000-0000-0000000000d1', 'uji.peran', 'admin', null, true)
on conflict (user_id) do update set peran = 'admin', pos = null, is_active = true;

insert into akun_hak (user_id, fitur)
select '00000000-0000-0000-0000-0000000000d1', unnest(paket_peran('admin'))
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 40.1  Turun dari admin jadi juri pos: centang admin HILANG.
--
--       Ini kerugian yang sebenarnya. Tanpa ini, orang yang perannya sudah
--       diturunkan tetap bisa membuka layar Akun dan Pengaturan — dan yang
--       memeriksa siapa boleh apa membaca kolom `peran`, yang sudah berbunyi
--       "Juri Pos".
-- ---------------------------------------------------------------------------
do $blok$
declare v_uid uuid := '00000000-0000-0000-0000-0000000000d1'; v_n integer;
begin
  select count(*) into v_n from akun_hak where user_id = v_uid and fitur = 'akun';
  assert v_n = 1, 'persiapan gagal: admin seharusnya memegang akun';

  -- Peran dan pos dikirim bersama: constraint 0058 menuntut juri_pos berpos.
  update akun_panitia set peran = 'juri_pos', pos = 1 where user_id = v_uid;

  select count(*) into v_n from akun_hak
  where user_id = v_uid and fitur in ('akun','pengaturan','pembayaran',
                                      'keberangkatan','rekap');
  assert v_n = 0,
    format('%s centang admin masih tertinggal sesudah turun jadi juri pos', v_n);

  select count(*) into v_n from akun_hak where user_id = v_uid;
  assert v_n = array_length(paket_peran('juri_pos'), 1),
    format('centangnya %s, seharusnya %s', v_n, array_length(paket_peran('juri_pos'), 1));

  select count(*) into v_n from akun_hak where user_id = v_uid and fitur = 'pos';
  assert v_n = 1, 'juri pos harus memegang fitur pos';

  raise notice '40.1 OK — centang admin hilang, centang juri pos terpasang.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 40.2  Naik jadi Koordinator Pos: centangnya ikut, dan posnya wajib kosong.
-- ---------------------------------------------------------------------------
do $blok$
declare v_uid uuid := '00000000-0000-0000-0000-0000000000d1'; v_n integer;
begin
  update akun_panitia set peran = 'koordinator_pos', pos = null where user_id = v_uid;

  select count(*) into v_n from akun_hak where user_id = v_uid;
  assert v_n = array_length(paket_peran('koordinator_pos'), 1),
    format('centangnya %s, seharusnya %s', v_n,
           array_length(paket_peran('koordinator_pos'), 1));
  raise notice '40.2 OK — pindah ke koordinator_pos ikut mengganti centangnya.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 40.3  Perubahan LAIN di baris yang sama tidak menyentuh centangnya.
--
--       Kalau penjaga `is distinct from` hilang, mengaktifkan akun atau
--       mengganti namanya akan menghapus centang yang baru saja disetel admin
--       dengan tangan — dan itu kerusakan yang persis sama diamnya.
-- ---------------------------------------------------------------------------
do $blok$
declare v_uid uuid := '00000000-0000-0000-0000-0000000000d1'; v_n integer;
begin
  insert into akun_hak (user_id, fitur) values (v_uid, 'rekap')
  on conflict do nothing;

  update akun_panitia set is_active = false where user_id = v_uid;
  update akun_panitia set username = 'uji.peran.2' where user_id = v_uid;

  select count(*) into v_n from akun_hak where user_id = v_uid and fitur = 'rekap';
  assert v_n = 1,
    'centang yang disetel tangan hilang padahal perannya tidak berubah';
  raise notice '40.3 OK — centang tangan bertahan selama perannya tetap.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 40.4  ...dan hilang begitu perannya berganti. Itu memang arti kalimat di
--       layar: mengganti peran MENGISI ULANG, bukan menambah.
-- ---------------------------------------------------------------------------
do $blok$
declare v_uid uuid := '00000000-0000-0000-0000-0000000000d1'; v_n integer;
begin
  update akun_panitia set peran = 'gerbang', pos = null where user_id = v_uid;

  select count(*) into v_n from akun_hak where user_id = v_uid and fitur = 'rekap';
  assert v_n = 0, 'centang tangan seharusnya ikut terhapus saat peran berganti';

  select count(*) into v_n from akun_hak where user_id = v_uid;
  assert v_n = array_length(paket_peran('gerbang'), 1),
    format('centangnya %s, seharusnya %s', v_n, array_length(paket_peran('gerbang'), 1));
  raise notice '40.4 OK — mengganti peran mengisi ulang, bukan menambah.';
end $blok$;

-- ---------------------------------------------------------------------------
-- Bersih-bersih.
-- ---------------------------------------------------------------------------
delete from akun_hak    where user_id = '00000000-0000-0000-0000-0000000000d1';
delete from akun_panitia where user_id = '00000000-0000-0000-0000-0000000000d1';
delete from auth.users   where id      = '00000000-0000-0000-0000-0000000000d1';
