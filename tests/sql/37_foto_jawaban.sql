-- ============================================================================
-- hrcd-rekap : tests/sql/37_foto_jawaban.sql
-- Foto borongan yang nomor dadanya ditautkan belakangan (0074).
--
-- YANG DIJAGA DI SINI, DAN KENAPA MASING-MASING
--
-- 1. Foto tanpa regu HARUS TERLIHAT. Selama v_foto_lembar masih `join regu`,
--    setiap foto yang belum tertaut lenyap dari view tanpa satu pun galat —
--    layar melaporkan "tidak ada foto" untuk gambar yang sudah naik dan sudah
--    memakan kuota. Ini kegagalan yang paling mungkin dan paling sulit dilihat,
--    jadi ia diuji lebih dulu daripada yang lain.
--
-- 2. Penautan harus benar-benar MENULIS. Mencatat ulang lewat catat_foto_masuk
--    dengan nomor dada yang benar akan "berhasil" tanpa mengubah apa pun,
--    karena `path` unik dan `on conflict do nothing`. Layar akan tampak
--    bekerja. Yang membuktikan sebaliknya cuma membaca barisnya sesudahnya.
--
-- 3. Pagarnya menempati kursi, bukan memindai nama (CLAUDE.md 13.8). Panggilan
--    yang sama dijalankan dua kali dengan satu baris `akun_hak` diubah di
--    antaranya; kalau pesan galatnya tidak berubah, pagarnya tidak ada.
--
-- Yang TIDAK diuji: policy storage.objects, karena storage.objects tidak ada
-- di Postgres lokal. Karena itulah pagar path dipasang dua kali, dan yang
-- kedua inilah yang bisa diuji (37.4).
-- ============================================================================

-- Lomba yang benar-benar ada di Pos 1 di database uji. Diambil dari wahana,
-- bukan dikarang: `catat_foto_masuk` menolak kode lomba yang bukan milik pos
-- itu, jadi kode karangan akan menggagalkan seluruh berkas dengan galat yang
-- tidak ada hubungannya dengan apa yang sedang diuji.
create temp table t_lomba as
select slug_lomba(coalesce(w.lomba, w.name)) as kode,
       coalesce(w.lomba, w.name)             as nama
from wahana w
where w.pos = 1
order by w.sort_order, w.kode
limit 1;

create temp table t_regu as
select id, nomor_dada from regu
where nomor_dada is not null and not is_cancelled
order by nomor_dada limit 1;

grant select on t_lomba, t_regu to public;

select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

-- ---------------------------------------------------------------------------
-- 37.1  Foto masuk tanpa nomor dada — barisnya ada, regunya kosong.
-- ---------------------------------------------------------------------------
do $blok$
declare v_id uuid; v_kode text; v_nama text; v_regu uuid; v_cara text;
begin
  select kode, nama into v_kode, v_nama from t_lomba;

  v_id := catat_foto_masuk(1::smallint, v_kode, v_nama,
                           'pos1/' || v_kode || '/uji-borongan-a.jpg', 64000);
  assert v_id is not null, 'catat_foto_masuk tidak mengembalikan id';

  select regu_id, cara_taut into v_regu, v_cara from foto_lembar where id = v_id;
  assert v_regu is null, 'foto borongan seharusnya belum punya regu';
  assert v_cara is null, 'cara_taut seharusnya kosong sebelum ditautkan';

  raise notice '37.1 OK — foto masuk tanpa nomor dada.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 37.2  Foto yang belum tertaut TERLIHAT di v_foto_lembar.
--
-- Inilah yang membuktikan `left join`. Dengan `join` biasa, tes ini gagal dan
-- semua tes lain di berkas ini tetap lulus — persis bentuk kegagalannya di
-- lapangan.
-- ---------------------------------------------------------------------------
do $blok$
declare v_kode text; v_ada integer; v_dada integer;
begin
  select kode into v_kode from t_lomba;

  select count(*) into v_ada from v_foto_lembar
  where path = 'pos1/' || v_kode || '/uji-borongan-a.jpg';
  assert v_ada = 1,
    'foto belum tertaut LENYAP dari v_foto_lembar — join-nya bukan left join';

  select nomor_dada into v_dada from v_foto_lembar
  where path = 'pos1/' || v_kode || '/uji-borongan-a.jpg';
  assert v_dada is null, 'nomor dada seharusnya kosong';

  raise notice '37.2 OK — foto belum tertaut terlihat, nomor dadanya kosong.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 37.3  Penautan mengisi regu DAN ketiga kolom jejaknya.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_kode text; v_id uuid; v_dada integer; v_regu uuid;
  v_taut uuid; v_cara text; v_pada timestamptz;
begin
  select kode into v_kode from t_lomba;
  select nomor_dada, id into v_dada, v_regu from t_regu;
  select id into v_id from foto_lembar
  where path = 'pos1/' || v_kode || '/uji-borongan-a.jpg';

  perform tautkan_foto(v_id, v_dada, 'tangan');

  select regu_id, ditaut_oleh, cara_taut, ditaut_pada
    into v_regu, v_taut, v_cara, v_pada
  from foto_lembar where id = v_id;

  assert v_regu = (select id from t_regu), 'regu tidak tertaut';
  assert v_cara = 'tangan',       'cara_taut tidak tercatat';
  assert v_taut is not null,      'ditaut_oleh kosong';
  assert v_pada is not null,      'ditaut_pada kosong';

  raise notice '37.3 OK — penautan menulis regu dan jejaknya.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 37.4  Path di luar folder posnya DITOLAK.
--
-- Path datang dari JavaScript, dan apa pun yang datang dari JavaScript bisa
-- dikarang. Baris tercatat sebagai milik Pos 1 sementara gambarnya di folder
-- Pos 3: yang membaca daftar foto Pos 1 kemudian melihat kertas pos lain.
-- ---------------------------------------------------------------------------
do $blok$
declare v_kode text; v_pesan text;
begin
  select kode into v_kode from t_lomba;
  begin
    perform catat_foto_masuk(1::smallint, v_kode, 'Uji',
                             'pos3/' || v_kode || '/nyasar.jpg', 1000);
    assert false, 'path pos3 diterima sebagai foto pos 1';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%tidak berada di folder pos%',
    format('galat yang diharapkan bukan ini: %s', v_pesan);
  raise notice '37.4 OK — path lintas pos ditolak.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 37.5  Kode lomba yang bukan milik pos itu DITOLAK.
--
-- Tanpa pagar ini, salah pilih di layar melahirkan tumpukan foto di lomba yang
-- tidak pernah ada — dan tidak ada layar yang akan menampilkannya lagi, karena
-- setiap layar membangun daftar lombanya dari `wahana`.
-- ---------------------------------------------------------------------------
do $blok$
declare v_pesan text;
begin
  begin
    perform catat_foto_masuk(1::smallint, 'lomba-karangan', 'Lomba Karangan',
                             'pos1/lomba-karangan/x.jpg', 1000);
    assert false, 'kode lomba karangan diterima';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%bukan lomba di pos%',
    format('galat yang diharapkan bukan ini: %s', v_pesan);
  raise notice '37.5 OK — kode lomba asing ditolak.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 37.6  Nomor dada karangan ditolak, dan fotonya TETAP belum tertaut.
--
-- Yang diuji bukan cuma galatnya: penautan yang gagal separuh jalan akan
-- meninggalkan baris yang punya `ditaut_pada` tapi tidak punya regu, dan
-- constraint foto_lembar_taut_utuh ada justru untuk itu.
-- ---------------------------------------------------------------------------
do $blok$
declare v_kode text; v_id uuid; v_pesan text; v_regu uuid; v_cara text;
begin
  select kode into v_kode from t_lomba;
  v_id := catat_foto_masuk(1::smallint, v_kode, 'Uji',
                           'pos1/' || v_kode || '/uji-borongan-b.jpg', 51000);
  begin
    perform tautkan_foto(v_id, 999999, 'tangan');
    assert false, 'nomor dada karangan diterima';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%tidak dikenal%',
    format('galat yang diharapkan bukan ini: %s', v_pesan);

  select regu_id, cara_taut into v_regu, v_cara from foto_lembar where id = v_id;
  assert v_regu is null and v_cara is null,
    'penautan gagal meninggalkan baris setengah tertaut';

  raise notice '37.6 OK — nomor dada karangan ditolak, barisnya utuh.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 37.7  Centang `pos` di layar Akun benar-benar jadi pagarnya.
--
-- Bentuk "menempati kursi" (CLAUDE.md 13.8): panggilan yang SAMA PERSIS
-- dijalankan dua kali oleh akun yang sama, yang berubah cuma satu baris
-- `akun_hak`. Kalau pesan galatnya tidak berubah, pagarnya tidak ada.
-- ---------------------------------------------------------------------------
reset role;
do $blok$
declare
  v_uid   uuid;
  v_kode  text;
  v_pesan text;
begin
  select user_id into v_uid from akun_panitia
  where peran = 'juri_pos' and is_active and pos = 1
  order by username limit 1;
  if v_uid is null then
    raise notice '37.7 DILEWATI — tidak ada akun juri_pos pos 1 yang aktif.';
    return;
  end if;
  select kode into v_kode from t_lomba;

  perform set_config('app.uid', v_uid::text, false);

  -- Masih tercentang: penjaganya lolos, yang menolak adalah isinya.
  begin
    perform catat_foto_masuk(1::smallint, 'lomba-karangan', 'Uji',
                             'pos1/lomba-karangan/pagar.jpg', 1000);
    assert false, 'kode karangan seharusnya ditolak';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%bukan lomba di pos%',
    format('penjaga seharusnya sudah lolos, galatnya justru: %s', v_pesan);

  -- Cabut satu centang. Ini yang dilakukan admin di layar Akun.
  delete from akun_hak where user_id = v_uid and fitur = 'pos';

  -- Panggilan yang sama persis.
  begin
    perform catat_foto_masuk(1::smallint, 'lomba-karangan', 'Uji',
                             'pos1/lomba-karangan/pagar.jpg', 1000);
    assert false, 'seharusnya ditolak penjaga';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%tidak berhak: pos%',
    format('centang seharusnya jadi pagarnya, galatnya: %s', v_pesan);

  insert into akun_hak (user_id, fitur) values (v_uid, 'pos')
  on conflict do nothing;

  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
  raise notice '37.7 OK — centang `pos` menahan unggahan borongan.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 37.8  Penautan MENINGGALKAN JEJAK di history.
--
-- Menautkan ulang sengaja dibolehkan — pembacaan mesin akan sesekali salah
-- satu digit, dan pembetulnya harus orang yang sedang memegang kertasnya. Yang
-- menjaga kebolehan itu bukan larangan melainkan jejaknya; tanpa tes ini,
-- trigger yang tidak terpasang tidak akan ketahuan oleh apa pun.
--
-- Versi pertama migrasi 0074 memang tidak memasangnya: ia mencari fungsi
-- bernama `catat_riwayat`, padahal 0012 sudah me-rename-nya jadi
-- `record_history`. Migrasinya sukses, warningnya lewat begitu saja.
-- ---------------------------------------------------------------------------
do $blok$
declare v_kode text; v_id uuid; v_dada integer; v_jejak integer;
begin
  select kode into v_kode from t_lomba;
  select nomor_dada into v_dada from t_regu;
  select id into v_id from foto_lembar
  where path = 'pos1/' || v_kode || '/uji-borongan-a.jpg';

  select count(*) into v_jejak from history
  where table_name = 'foto_lembar' and row_id = v_id::text and action = 'UPDATE';
  assert v_jejak >= 1,
    'penautan foto tidak terekam di history — trigger auditnya tidak terpasang';

  raise notice '37.8 OK — penautan terekam di history (% baris).', v_jejak;
end $blok$;

-- ---------------------------------------------------------------------------
-- Bersih-bersih. Dari akar ke daun, seperti tes lain — tanpa ini hitungan tes
-- berikutnya ikut bergeser.
-- ---------------------------------------------------------------------------
reset role;
delete from history where table_name = 'foto_lembar';
delete from foto_lembar where path like 'pos1/%uji-borongan-%';
drop table if exists t_lomba;
drop table if exists t_regu;
