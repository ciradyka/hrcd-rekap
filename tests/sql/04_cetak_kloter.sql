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
