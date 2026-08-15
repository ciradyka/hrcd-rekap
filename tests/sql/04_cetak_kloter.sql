-- ============================================================================
-- hrcd-rekap : tests/sql/04_cetak_kloter.sql
-- Kloter yang sudah dicetak harus BEKU: kertas sudah beredar di garis start,
-- jadi isinya tidak boleh berubah lewat jalur mana pun.
-- ============================================================================

\echo '== 04: cetak kloter =='

select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;

-- 4.1 Cetak menandai hanya kloter yang benar-benar berisi regu lunas.
do $$
declare v_ditandai int; v_berisi int;
begin
  select count(distinct r.kloter_nomor) into v_berisi
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where r.kloter_nomor is not null and not r.is_cancelled and d.status = 'lunas';

  v_ditandai := tandai_kloter_dicetak();
  assert v_ditandai = v_berisi,
    format('yang ditandai %s, kloter berisi %s', v_ditandai, v_berisi);

  -- Kloter kosong tidak boleh ikut tertandai.
  assert not exists (
    select 1 from kloter k
    where k.dicetak_pada is not null
      and not exists (select 1 from regu r where r.kloter_nomor = k.nomor)),
    'kloter kosong ikut ditandai tercetak';

  -- Menandai ulang tidak menambah apa-apa (idempotent).
  assert tandai_kloter_dicetak() = 0, 'penandaan kedua menandai ulang';
end;
$$;

-- 4.2 View cetak memuat kolom yang dibutuhkan garis start, urut kloter.
do $$
declare v record;
begin
  select * into v from v_daftar_kloter limit 1;
  assert v.kloter is not null and v.nomor_dada is not null
     and v.nama_regu is not null and v.nama_sekolah is not null,
    'v_daftar_kloter kekurangan kolom';
  assert (select bool_and(dicetak_pada is not null) from v_daftar_kloter),
    'v_daftar_kloter tidak menampilkan status cetak';
end;
$$;

-- 4.3 INTI, dua lapis.
--     Lapis 1 (RLS): peran meja tidak boleh menulis langsung ke tabel regu —
--     UPDATE-nya tersaring, nol baris berubah, tanpa error.
do $$
declare
  v_tercetak smallint;
  v_regu     uuid;
  v_n        int;
begin
  select nomor into v_tercetak from kloter where dicetak_pada is not null limit 1;
  select id into v_regu from regu where kloter_nomor is null and not is_cancelled limit 1;
  assert v_tercetak is not null, 'tidak ada kloter tercetak untuk diuji';
  assert v_regu is not null, 'tidak ada regu tanpa kloter untuk diuji';

  update regu set kloter_nomor = v_tercetak, urutan_kloter = 9, nomor_dada = 499
  where id = v_regu;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'RLS: peran meja bisa menulis langsung ke tabel regu';
end;
$$;

--     Lapis 2 (trigger): ADMIN yang berhak menulis langsung pun ditolak —
--     inilah jaring terakhirnya, karena koreksi admin lewat SQL adalah jalur
--     yang paling mungkin melupakan aturan "kertas sudah beredar".
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
do $$
declare
  v_tercetak smallint;
  v_regu     uuid;
begin
  select nomor into v_tercetak from kloter where dicetak_pada is not null limit 1;
  select id into v_regu from regu where kloter_nomor is null and not is_cancelled limit 1;

  -- Menyisipkan regu baru ke kloter tercetak.
  begin
    update regu set kloter_nomor = v_tercetak, urutan_kloter = 9, nomor_dada = 499
    where id = v_regu;
    raise exception 'GAGAL: admin bisa menyisipkan regu ke kloter tercetak';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  -- Memindahkan regu KELUAR dari kloter tercetak.
  select id into v_regu from regu where kloter_nomor = v_tercetak limit 1;
  begin
    update regu set kloter_nomor = 40 where id = v_regu;
    raise exception 'GAGAL: admin bisa memindah regu keluar dari kloter tercetak';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;
select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);

-- 4.4 Pendaftar SUSULAN setelah cetak tetap dilayani — masuk kloter yang
--     belum pernah tercetak (cadangan), bukan diselipkan ke yang sudah.
do $$
declare
  v_kode  text;
  v_hasil record;
  v_biaya integer;
begin
  reset role;
  select biaya_per_regu into v_biaya from edisi where is_active;
  set role service_role;
  v_kode := (submit_pendaftaran('SMP Susulan Cetak', 'Jl. Susulan 1', false,
    '081277778888',
    '[{"nama_regu":"Terlambat","nama_ketua":"Tono","golongan":"penegak_pa"}]',
    0::smallint, gen_random_uuid())) ->> 'kode_pembayaran';
  reset role;

  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
  set role authenticated;
  perform verifikasi_pembayaran(v_kode, v_biaya, 'tunai');

  select * into v_hasil from daftar_ulang_batch(v_kode, uji_dada(v_kode)) limit 1;
  assert v_hasil.nomor_dada is not null, 'pendaftar susulan tidak dapat nomor';
  assert (select dicetak_pada from kloter where nomor = v_hasil.kloter) is null,
    format('pendaftar susulan masuk kloter %s yang SUDAH dicetak', v_hasil.kloter);
end;
$$;

-- 4.4b SEMUA kloter dasar sudah tercetak — keadaan lapangan yang sebenarnya,
--      dan justru yang TIDAK diuji 4.4.
--
--      4.4 lolos karena keberuntungan: `lompatan_kloter = 2` membuat data uji
--      hanya mengisi kloter ganjil, dan kloter genap yang kosong tidak pernah
--      ditandai tercetak. Putaran pertama pemilihan kloter mendarat di celah
--      kosong itu, jadi kloter tercetak tidak pernah terpilih.
--
--      Di lapangan celah itu habis begitu kloter 1..kloter_dasar semuanya
--      berisi. Bagian ini menirunya dengan menandai SELURUH kloter dasar
--      tercetak, sehingga putaran 1-3 tidak punya kandidat dan pemilihan harus
--      jatuh ke kloter cadangan.
--
--      Tanpa 0040, putaran pertama tetap memilih kloter dasar yang tercetak,
--      trigger jaga_kloter_tercetak menolak UPDATE-nya, dan SELURUH batch
--      gagal — tidak satu regu pun mendapat nomor dada. Itulah bug yang
--      dilaporkan panitia dari lapangan.
do $$
declare
  v_kode   text;
  v_hasil  record;
  v_biaya  integer;
  v_dasar  smallint;
  v_semula smallint[];
begin
  reset role;
  select biaya_per_regu, kloter_dasar into v_biaya, v_dasar
  from edisi where is_active;

  -- Dicatat dulu supaya bisa dikembalikan: 4.5 menghitung berapa kloter BARU
  -- yang ditandai, dan tanda yang tertinggal di sini akan mengubah angkanya.
  select array_agg(nomor) into v_semula
  from kloter where nomor <= v_dasar and dicetak_pada is null;

  update kloter set dicetak_pada = now()
  where nomor <= v_dasar and dicetak_pada is null;

  set role service_role;
  v_kode := (submit_pendaftaran('SMP Susulan Penuh', 'Jl. Susulan 2', false,
    '081200001111',
    '[{"nama_regu":"Paling Telat","nama_ketua":"Tini","golongan":"penegak_pi"}]',
    0::smallint, gen_random_uuid())) ->> 'kode_pembayaran';
  reset role;

  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
  set role authenticated;
  perform verifikasi_pembayaran(v_kode, v_biaya, 'tunai');

  select * into v_hasil from daftar_ulang_batch(v_kode, uji_dada(v_kode)) limit 1;
  assert v_hasil.nomor_dada is not null,
    'daftar ulang gagal padahal masih ada kloter cadangan yang belum dicetak';
  assert v_hasil.kloter > v_dasar,
    format('regu susulan masuk kloter %s, seharusnya kloter cadangan di atas %s',
           v_hasil.kloter, v_dasar);
  assert (select dicetak_pada from kloter where nomor = v_hasil.kloter) is null,
    format('regu susulan masuk kloter %s yang SUDAH dicetak', v_hasil.kloter);

  -- Dikembalikan persis seperti semula.
  reset role;
  update kloter set dicetak_pada = null where nomor = any(v_semula);
  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
  set role authenticated;
end;
$$;

-- 4.5 Cetak lembar tambahan hanya menandai kloter baru itu.
do $$
declare v_baru int;
begin
  v_baru := tandai_kloter_dicetak();
  assert v_baru = 1, format('lembar tambahan menandai %s kloter, harusnya 1', v_baru);
end;
$$;

-- 4.6 Batalkan tanda cetak: hanya admin, wajib beralasan, dan setelah itu
--     kloter bisa diisi lagi (untuk cetak ulang).
do $$
declare v_tercetak smallint;
begin
  select nomor into v_tercetak from kloter where dicetak_pada is not null limit 1;
  begin
    perform batalkan_tanda_cetak(v_tercetak, 'kertas macet');
    raise exception 'GAGAL: meja bisa membatalkan tanda cetak';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
  begin
    perform batalkan_tanda_cetak(v_tercetak, '');
    raise exception 'GAGAL: tanda cetak dibatalkan tanpa alasan';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  perform batalkan_tanda_cetak(v_tercetak, 'kertas macet, cetak ulang');
  assert (select dicetak_pada from kloter where nomor = v_tercetak) is null,
    'tanda cetak tidak terhapus';
  assert exists (select 1 from history
                 where table_name = 'kloter'
                   and new_value ? 'alasan_batal_tanda_cetak'),
    'pembatalan tanda cetak tidak terekam riwayat';
end;
$$;

reset role;
\echo '== 04: OK =='

-- ---------------------------------------------------------------------------
-- 4.5 tukar_nomor_dada memakai patokan DICETAK, bukan berangkat (0019).
--     Jendela "sudah dicetak, belum berangkat" adalah saat petugas staging
--     memegang kertas dan memanggil nama — persis saat nomor di kertas tidak
--     boleh berubah diam-diam.
-- ---------------------------------------------------------------------------
select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;

do $$
declare
  v_kloter smallint;
  v_regu   uuid;
  v_baru   integer;
begin
  -- Kloter yang sudah dicetak tapi BELUM berangkat.
  select k.nomor into v_kloter
  from kloter k
  where k.dicetak_pada is not null and k.jam_berangkat is null
  order by k.nomor limit 1;
  if v_kloter is null then
    raise notice '4.5 dilewati: tidak ada kloter tercetak yang belum berangkat';
    return;
  end if;

  select r.id into v_regu from regu r
  where r.kloter_nomor = v_kloter and r.nomor_dada is not null and not r.is_cancelled
  limit 1;
  assert v_regu is not null, 'kloter tercetak tanpa regu bernomor';

  select s.nomor into v_baru from nomor_dada_stok s
  where not exists (select 1 from regu r2 where r2.nomor_dada = s.nomor)
    and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor)
  order by s.nomor limit 1;
  assert v_baru is not null, 'stok nomor dada habis';

  -- Meja DITOLAK: dulu diterima karena kloternya belum berangkat.
  begin
    perform tukar_nomor_dada(v_regu, v_baru, 'coba tukar padahal kertas sudah beredar');
    raise exception 'GAGAL: meja menukar nomor di kloter yang kertasnya sudah dicetak';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  -- Admin tetap boleh — pembatasannya soal siapa, bukan soal mustahil.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
  perform tukar_nomor_dada(v_regu, v_baru, 'nomor dada sobek, ganti kain');
  assert (select nomor_dada from regu where id = v_regu) = v_baru,
    'admin tidak bisa menukar nomor di kloter tercetak';
  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
end;
$$;

reset role;
\echo '== 4.5: OK =='
