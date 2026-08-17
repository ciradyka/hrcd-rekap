-- ============================================================================
-- hrcd-rekap : tests/sql/32_kloter_boleh_ditambah.sql
-- Kloter tidak pernah tertutup untuk penambahan regu (migrasi 0066).
--
-- APA YANG DIJAGA
--
-- Tiga pagar pernah ada, dipasang di tiga tempat berbeda, dan menghapus satu
-- saja tidak cukup:
--
--   1. `dicetak_pada is null` di pemilihan kloter `daftar_ulang_batch` (0008,
--      dikembalikan 0040)
--   2. `jam_berangkat is null` di tempat yang sama
--   3. trigger `jaga_kloter_tercetak` di `regu` — ia menolak SETIAP perubahan
--      `kloter_nomor` yang menyentuh kloter tercetak, dari arah mana pun, jadi
--      ia tetap menolak walau kedua syarat di atas sudah hilang
--
-- Tes ini menekan ketiganya dari sisi yang berbeda: lewat UPDATE langsung
-- (menabrak trigger) dan lewat alur daftar ulang (menabrak syarat pemilihan).
--
-- YANG TIDAK BOLEH IKUT HILANG
--
-- Kapasitas. Kertas boleh dilanggar; jumlah orang yang muat di satu rombongan
-- tidak. Sebuah "perbaikan" yang membuka kloter tercetak sekaligus membuka
-- kloter penuh bukan perbaikan.
-- ============================================================================

do $blok$
declare
  v_kloter    int;
  v_regu      uuid;
  v_maks      int;
  v_isi       int;
begin
  select maks_regu_per_kloter into v_maks from edisi where is_active;

  -- Cari kloter yang masih longgar, lalu tandai ia sudah dicetak DAN sudah
  -- berangkat — keadaan yang dulu menutupnya rapat-rapat.
  select k.nomor into v_kloter
    from kloter k
   where (select count(*) from regu r where r.kloter_nomor = k.nomor
            and not r.is_cancelled) < v_maks - 1
   order by k.nomor limit 1;
  if v_kloter is null then
    raise notice '32: tidak ada kloter longgar di fixture — tes dilewati';
    return;
  end if;

  update kloter set dicetak_pada = now(), jam_berangkat = now()
   where nomor = v_kloter;

  -- Ambil satu regu dari kloter LAIN untuk dipindahkan ke sana.
  select r.id into v_regu from regu r
   where r.kloter_nomor is not null and r.kloter_nomor <> v_kloter
     and not r.is_cancelled
   limit 1;
  if v_regu is null then
    raise notice '32: tidak ada regu di kloter lain — tes dilewati';
    update kloter set dicetak_pada = null, jam_berangkat = null where nomor = v_kloter;
    return;
  end if;

  -- INI yang dulu ditolak trigger jaga_kloter_tercetak, tanpa pengecualian.
  -- `urutan_kloter` ikut diisi: ada unique (kloter_nomor, urutan_kloter), dan
  -- UPDATE mentah yang membawa urutan lamanya akan menabraknya. Panitia tidak
  -- pernah melakukan ini lewat SQL — mereka lewat pindah_kloter, yang mencari
  -- urutan kosongnya sendiri.
  update regu set
    kloter_nomor  = v_kloter,
    urutan_kloter = (select min(s) from generate_series(1, v_maks) s
                      where not exists (select 1 from regu x
                                        where x.kloter_nomor = v_kloter
                                          and x.urutan_kloter = s))
   where id = v_regu;

  select count(*) into v_isi from regu
   where kloter_nomor = v_kloter and not is_cancelled;
  assert v_isi > 0, 'regu tidak masuk ke kloter tercetak/berangkat';

  raise notice '32: kloter % (tercetak + berangkat) menerima regu — pagar hilang', v_kloter;

  update kloter set dicetak_pada = null, jam_berangkat = null where nomor = v_kloter;
end $blok$;

-- ---------------------------------------------------------------------------
-- Pagarnya benar-benar tidak ada lagi di katalog — bukan cuma tidak dipanggil.
-- ---------------------------------------------------------------------------
do $blok$
declare v_n int;
begin
  select count(*) into v_n from pg_trigger
   where tgname = 'jaga_kloter_tercetak' and not tgisinternal;
  assert v_n = 0, 'trigger jaga_kloter_tercetak masih terpasang';

  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'daftar_ulang_batch'
     and p.prosrc ~ 'dicetak_pada is null|jam_berangkat is null';
  assert v_n = 0, 'daftar_ulang_batch masih menyaring kloter tercetak/berangkat';
end $blok$;

-- ---------------------------------------------------------------------------
-- Kapasitas TETAP dijaga. Ini arah kedua, dan tanpa ia tes di atas akan lulus
-- sama gembiranya untuk perbaikan yang membuka segalanya.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_maks   int;
  v_penuh  int;
  v_isi    int;
  v_regu   uuid;
begin
  select maks_regu_per_kloter into v_maks from edisi where is_active;

  -- Fixture-nya tidak punya kloter penuh, dan tes yang MELEWATI dirinya
  -- sendiri tidak menguji apa pun — itu persis cara tes 26 dan 27 pernah
  -- hijau tanpa menyentuh apa pun. Jadi kondisinya dibuat: batas kapasitas
  -- diturunkan sementara ke isi kloter yang sudah ada, bukan sepuluh regu
  -- dipindah-pindahkan.
  select k.nomor, (select count(*) from regu r where r.kloter_nomor = k.nomor
                     and not r.is_cancelled)
    into v_penuh, v_isi
    from kloter k
   where k.jam_berangkat is null
     and (select count(*) from regu r where r.kloter_nomor = k.nomor
            and not r.is_cancelled) > 0
   order by k.nomor limit 1;
  assert v_penuh is not null, 'fixture tidak punya kloter berisi yang belum berangkat';

  update edisi set maks_regu_per_kloter = v_isi where is_active;

  -- Harus yang PUNYA nomor dada: pindah_kloter mencarinya lewat nomor dada,
  -- dan regu tanpa nomor akan ditolak "tidak dikenal" sebelum kapasitas
  -- sempat diperiksa.
  -- Dan regu yang kloternya juga BELUM berangkat: pindah_kloter menolak
  -- memindahkan regu yang sudah ikut berangkat, dan penolakan itu akan
  -- datang lebih dulu daripada kapasitas.
  select r.id into v_regu from regu r
   join kloter k on k.nomor = r.kloter_nomor
   where r.kloter_nomor is distinct from v_penuh and not r.is_cancelled
     and r.nomor_dada is not null and k.jam_berangkat is null limit 1;
  assert v_regu is not null,
         'fixture tidak punya regu bernomor dada di kloter lain yang belum berangkat';

  -- pindah_kloter menjaga kapasitas secara eksplisit; UPDATE langsung tidak,
  -- dan memang tidak dimaksudkan begitu — yang dipakai panitia adalah RPC-nya.
  --
  -- Identitas admin dipasang dulu: sejak 0064 penjaganya boleh('cetak_kloter'),
  -- dan tanpa app.uid ia menolak lebih dulu daripada kapasitas — tesnya lalu
  -- lulus/gagal karena alasan yang salah.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  declare v_pesan text;
  begin
    begin
      perform pindah_kloter((select nomor_dada from regu where id = v_regu),
                            'uji kapasitas', v_penuh::smallint);
      v_pesan := '(diterima)';
    exception when others then
      v_pesan := sqlerrm;
    end;
    update edisi set maks_regu_per_kloter = v_maks where is_active;
    assert v_pesan like '%penuh%',
           format('kloter penuh harus ditolak karena KAPASITAS, bukan: %s', v_pesan);
  end;
end $blok$;

\echo '32 kloter boleh ditambah: LULUS'
