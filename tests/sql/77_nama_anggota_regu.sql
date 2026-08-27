-- ============================================================================
-- hrcd-rekap : tests/sql/77_nama_anggota_regu.sql — migrasi 0114.
-- Nama anggota dicatat, opsional, dan kotak kosong tidak ikut tersimpan.
--
-- Yang paling mudah salah di sini bukan penyimpanannya melainkan KEKOSONGANNYA:
-- form mengirim empat kotak apa pun isinya, dan kotak yang dilewati akan
-- tersimpan sebagai "" kalau tidak disaring. "Anggota ke-3 bernama kosong"
-- adalah baris yang tidak berarti apa-apa, dan ia baru terlihat saat ada yang
-- mencetak daftar hadir.
-- ============================================================================

\echo '--- 77. nama anggota regu'
\set ON_ERROR_STOP on

select set_config('app.uid', (select user_id::text from akun_panitia
                              where peran = 'admin' and is_active limit 1), false);

begin;

-- ---------------------------------------------------------------------------
-- 77.1 Ketua wajib, anggota opsional — dan ketiadaan `anggota` bukan galat.
-- ---------------------------------------------------------------------------
do $blok$
declare v jsonb; v_id uuid; v_ang text[];
begin
  v := submit_pendaftaran(
    'SMPN Uji Anggota', 'Jl. Uji Anggota', false, '081200007701',
    '[{"nama_regu":"Ujianggota Satu","nama_ketua":"Ketua Satu","golongan":"penegak_pa"}]', p_metode_bayar => 'tunai');

  select r.anggota into v_ang
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v ->> 'kode_pembayaran';

  assert v_ang is null,
    format('77.1 GAGAL: tanpa kunci anggota seharusnya NULL, dapat %s', v_ang);
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 77.2 Empat nama tersimpan berurutan, dan kotak kosong TIDAK ikut.
-- ---------------------------------------------------------------------------
do $blok$
declare v jsonb; v_ang text[];
begin
  v := submit_pendaftaran(
    'SMPN Uji Anggota Isi', 'Jl. Uji Isi', false, '081200007702',
    '[{"nama_regu":"Ujianggota Dua","nama_ketua":"Ketua Dua","golongan":"penegak_pa",
       "anggota":["Budi Santoso","","  ","Citra Lestari"]}]', p_metode_bayar => 'tunai');

  select r.anggota into v_ang
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v ->> 'kode_pembayaran';

  assert v_ang = array['Budi Santoso', 'Citra Lestari'],
    format('77.2 GAGAL: tersimpan %s', v_ang);
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 77.3 Bentuk yang salah ditolak, dan penolakannya tidak menyisakan setengah
--      pendaftaran.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_sebelum integer;
  v_tolak   boolean;
begin
  select count(*) into v_sebelum from pendaftaran;

  -- Lebih dari empat.
  v_tolak := false;
  begin
    perform submit_pendaftaran(
      'SMPN Uji Anggota Lima', 'Jl. Uji Lima', false, '081200007703',
      '[{"nama_regu":"Ujianggota Tiga","nama_ketua":"Ketua Tiga","golongan":"penegak_pa",
         "anggota":["A Satu","B Dua","C Tiga","D Empat","E Lima"]}]', p_metode_bayar => 'tunai');
  exception when others then v_tolak := true;
  end;
  assert v_tolak, '77.3 GAGAL: lima anggota diterima';

  -- Berangka — aturan yang sama dengan nama ketua (0052).
  v_tolak := false;
  begin
    perform submit_pendaftaran(
      'SMPN Uji Anggota Angka', 'Jl. Uji Angka', false, '081200007704',
      '[{"nama_regu":"Ujianggota Empat","nama_ketua":"Ketua Empat","golongan":"penegak_pa",
         "anggota":["Anggota 2"]}]', p_metode_bayar => 'tunai');
  exception when others then v_tolak := true;
  end;
  assert v_tolak, '77.3 GAGAL: nama anggota berangka diterima';

  assert (select count(*) from pendaftaran) = v_sebelum,
    '77.3 GAGAL: pendaftaran yang ditolak tetap tersimpan';
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 77.4 Ketua TETAP wajib. Yang dilonggarkan cuma anggotanya.
-- ---------------------------------------------------------------------------
do $blok$
declare v_tolak boolean := false;
begin
  begin
    perform submit_pendaftaran(
      'SMPN Uji Tanpa Ketua', 'Jl. Uji Ketua', false, '081200007705',
      '[{"nama_regu":"Ujianggota Lima","nama_ketua":"","golongan":"penegak_pa",
         "anggota":["Budi Santoso"]}]', p_metode_bayar => 'tunai');
  exception when others then v_tolak := true;
  end;
  assert v_tolak, '77.4 GAGAL: regu tanpa nama ketua diterima';
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 77.5 Pagar tabelnya berdiri sendiri, bukan hanya di dalam RPC. Jalur tulis
--      lain — admin lewat SQL, migrasi berikutnya — harus ikut tertahan.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_daf   uuid;
  v_tolak boolean;
begin
  select id into v_daf from pendaftaran limit 1;

  v_tolak := false;
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, anggota)
    values (v_daf, 'Ujianggota Enam', 'Ketua Enam', 'penegak_pa',
            array['A', 'B', 'C', 'D', 'E']);
  exception when others then v_tolak := true;
  end;
  assert v_tolak, '77.5 GAGAL: constraint maksimal empat tidak menahan';

  v_tolak := false;
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, anggota)
    values (v_daf, 'Ujianggota Tujuh', 'Ketua Tujuh', 'penegak_pa',
            array['Budi', '']);
  exception when others then v_tolak := true;
  end;
  assert v_tolak, '77.5 GAGAL: nama anggota kosong tidak ditahan';
end;
$blok$;

rollback;

select '77_nama_anggota_regu OK' as hasil;
