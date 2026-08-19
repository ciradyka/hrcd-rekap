-- ============================================================================
-- hrcd-rekap : tests/sql/43_catat_foto_lembar_taut.sql
-- Unggah foto PER REGU tetap bisa menulis sesudah 0074 (perbaikan 0080).
--
-- YANG DIJAGA DI SINI, DAN KENAPA
--
-- 1. Yang diuji adalah `catat_foto_lembar` — penulis LAMA, dari 0047/0064.
--    Tes 37 menguji dua fungsi yang ditulis 0074 sendiri (`catat_foto_masuk`,
--    `tautkan_foto`) dan keduanya lolos constraint barunya, jadi tes 37 hijau
--    sementara dialog per regu di layar menolak setiap unggahan. Constraint
--    baru harus diuji lewat SETIAP penulis yang sudah ada, bukan cuma lewat
--    penulis yang lahir bersamanya.
--
-- 2. Yang dibaca bukan cuma "tidak galat", tapi ISI barisnya. `on conflict
--    (path) do nothing` membuat panggilan yang tidak menulis apa pun tetap
--    kembali dengan sukses — sama persis seperti yang sudah menipu tes 37.2.
--    Karena itu 43.1 memakai path yang pasti baru dan membaca barisnya.
--
-- 3. `cara_taut` harus 'unggah', bukan sekadar "terisi". Nilai itulah yang
--    dipakai 0074 untuk baris lama yang tertaut sejak lahir; kalau jalur ini
--    memakai nama lain, dua kelompok baris yang identik asal-usulnya akan
--    terpisah di layar tanpa satu pun galat.
-- ============================================================================

create temp table t43_lomba as
select slug_lomba(coalesce(w.lomba, w.name)) as kode,
       coalesce(w.lomba, w.name)             as nama
from wahana w
where w.pos = 1
order by w.sort_order, w.kode
limit 1;

create temp table t43_regu as
select id, nomor_dada from regu
where nomor_dada is not null and not is_cancelled
order by nomor_dada limit 1;

grant select on t43_lomba, t43_regu to public;

select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

-- ---------------------------------------------------------------------------
-- 43.1  Unggahan per regu MENULIS, dan barisnya lahir sudah tertaut.
--
-- Ini pengganti langsung dari galat yang dilihat petugas di lapangan:
--   new row for relation "foto_lembar" violates check constraint
--   "foto_lembar_taut_utuh"
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_kode text; v_nama text; v_nomor integer; v_path text;
  v_regu uuid; v_cara text; v_oleh uuid; v_pada timestamptz; v_regu_asli uuid;
begin
  select kode, nama into v_kode, v_nama from t43_lomba;
  select id, nomor_dada into v_regu_asli, v_nomor from t43_regu;
  v_path := 'pos1/' || v_kode || '/uji-per-regu-a.jpg';

  perform catat_foto_lembar(v_nomor, 1::smallint, v_kode, v_nama, v_path, 48000);

  select regu_id, cara_taut, ditaut_oleh, ditaut_pada
    into v_regu, v_cara, v_oleh, v_pada
  from foto_lembar where path = v_path;

  assert v_regu is not null, 'baris tidak tertulis — unggahan per regu masih tertolak';
  assert v_regu = v_regu_asli,
    format('foto tertaut ke regu yang salah: %s bukan %s', v_regu, v_regu_asli);
  assert v_cara = 'unggah',
    format('cara_taut seharusnya ''unggah'', bukan %L', v_cara);
  assert v_oleh is not null, 'ditaut_oleh kosong padahal regunya terisi';
  assert v_pada is not null, 'ditaut_pada kosong padahal regunya terisi';

  raise notice '43.1 OK — foto per regu tertulis dan lahir sudah tertaut.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 43.2  Kirim ulang berkas yang sama tetap bukan galat.
--
-- Jaringan lapangan memutus jawaban, bukan permintaan. Kalau perbaikan 0080
-- menghapus `on conflict do nothing`, petugas yang menekan "kirim ulang" akan
-- melihat layar merah untuk unggahan yang sebenarnya sudah berhasil.
-- ---------------------------------------------------------------------------
do $blok$
declare v_kode text; v_nama text; v_nomor integer; v_path text; v_jumlah integer;
begin
  select kode, nama into v_kode, v_nama from t43_lomba;
  select nomor_dada into v_nomor from t43_regu;
  v_path := 'pos1/' || v_kode || '/uji-per-regu-a.jpg';

  perform catat_foto_lembar(v_nomor, 1::smallint, v_kode, v_nama, v_path, 48000);

  select count(*) into v_jumlah from foto_lembar where path = v_path;
  assert v_jumlah = 1,
    format('kirim ulang seharusnya menyisakan satu baris, ada %s', v_jumlah);

  raise notice '43.2 OK — kirim ulang tidak menggandakan dan tidak menggalat.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 43.3  Nomor dada karangan tetap ditolak, dan TIDAK meninggalkan baris.
--
-- Pagar 0064 harus selamat dari penyalinan di 0080. Yang kedua lebih penting
-- daripada galatnya: baris yatim di sini berarti gambar yang memakan kuota
-- tanpa pernah muncul di layar mana pun.
-- ---------------------------------------------------------------------------
do $blok$
declare v_kode text; v_nama text; v_path text; v_pesan text; v_jumlah integer;
begin
  select kode, nama into v_kode, v_nama from t43_lomba;
  v_path := 'pos1/' || v_kode || '/uji-per-regu-b.jpg';

  begin
    perform catat_foto_lembar(999999, 1::smallint, v_kode, v_nama, v_path, 1000);
    assert false, 'nomor dada karangan diterima';
  exception when others then
    v_pesan := sqlerrm;
  end;

  assert v_pesan like '%tidak dikenal%',
    format('galat yang diharapkan bukan ini: %s', v_pesan);

  select count(*) into v_jumlah from foto_lembar where path = v_path;
  assert v_jumlah = 0,
    format('unggahan gagal meninggalkan %s baris yatim', v_jumlah);

  raise notice '43.3 OK — nomor dada karangan ditolak tanpa meninggalkan baris.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 43.4  Path di luar folder posnya tetap ditolak.
-- ---------------------------------------------------------------------------
do $blok$
declare v_kode text; v_nama text; v_nomor integer; v_pesan text;
begin
  select kode, nama into v_kode, v_nama from t43_lomba;
  select nomor_dada into v_nomor from t43_regu;

  begin
    perform catat_foto_lembar(v_nomor, 1::smallint, v_kode, v_nama,
                              'pos9/' || v_kode || '/uji-per-regu-c.jpg', 1000);
    assert false, 'path pos lain diterima';
  exception when others then
    v_pesan := sqlerrm;
  end;

  assert v_pesan like '%tidak berada di folder pos%',
    format('galat yang diharapkan bukan ini: %s', v_pesan);

  raise notice '43.4 OK — path di luar folder pos ditolak.';
end $blok$;

reset role;
