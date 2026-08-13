-- ============================================================================
-- hrcd-rekap : tests/sql/05_pindah_kloter.sql
-- Dua kebutuhan hari-H: peserta telat masuk kloter terakhir, dan peserta
-- urgent dipaksa masuk kloter tertentu meski kertasnya sudah beredar.
-- Yang WAJIB dibuktikan: regu sisipan selalu tertandai, karena nomor itu
-- tidak ada di kertas yang dipegang petugas garis start.
-- ============================================================================

\echo '== 05: pindah kloter =='

select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;

-- 5.1 Perkiraan berangkat muncul di kertas, dan berjarak sesuai interval.
do $$
declare
  v_k1 timestamptz; v_k3 timestamptz; v_interval int;
begin
  select interval_berangkat_menit into v_interval from edisi where aktif;
  select min(perkiraan_berangkat) into v_k1 from v_daftar_kloter where kloter = 1;
  select min(perkiraan_berangkat) into v_k3 from v_daftar_kloter where kloter = 3;
  assert v_k1 is not null, 'perkiraan berangkat kloter 1 kosong';
  assert v_k3 is not null, 'perkiraan berangkat kloter 3 kosong';
  assert extract(epoch from (v_k3 - v_k1)) / 60 = 2 * v_interval,
    format('jarak kloter 1->3 = %s menit, harusnya %s',
           extract(epoch from (v_k3 - v_k1)) / 60, 2 * v_interval);
end;
$$;

-- 5.2 Alasan wajib — pemindahan tanpa alasan ditolak.
do $$
declare v_dada integer;
begin
  select nomor_dada into v_dada from regu where nomor_dada is not null limit 1;
  begin
    perform pindah_kloter(v_dada, '   ');
    raise exception 'GAGAL: pindah kloter tanpa alasan diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;

-- 5.3 TELAT BIASA (p_kloter null): mendarat di kloter TERAKHIR yang belum
--     berangkat dan masih muat.
do $$
declare
  v_dada    integer;
  v_hasil   jsonb;
  v_terakhir smallint;
begin
  -- Regu yang kloternya belum berangkat.
  select r.nomor_dada into v_dada
  from regu r join kloter k on k.nomor = r.kloter_nomor
  where k.jam_berangkat is null and not r.batal
  order by r.nomor_dada limit 1;

  select max(k.nomor) into v_terakhir
  from kloter k
  where k.jam_berangkat is null
    and (select count(*) from regu r where r.kloter_nomor = k.nomor)
        < (select maks_regu_per_kloter from edisi where aktif);

  v_hasil := pindah_kloter(v_dada, 'terlambat masuk kloter');
  assert (v_hasil ->> 'kloter_baru')::smallint = v_terakhir,
    format('telat mendarat di kloter %s, harusnya %s',
           v_hasil ->> 'kloter_baru', v_terakhir);
end;
$$;

-- 5.4 URGENT: dipaksa ke kloter yang SUDAH DICETAK — berhasil, tapi WAJIB
--     tertandai sisipan dan mengembalikan peringatan untuk dibacakan.
do $$
declare
  v_dada     integer;
  v_tercetak smallint;
  v_hasil    jsonb;
begin
  select k.nomor into v_tercetak
  from kloter k
  where k.dicetak_pada is not null and k.jam_berangkat is null
    and (select count(*) from regu r where r.kloter_nomor = k.nomor)
        < (select maks_regu_per_kloter from edisi where aktif)
  limit 1;
  assert v_tercetak is not null, 'tidak ada kloter tercetak yang masih muat untuk diuji';

  select r.nomor_dada into v_dada
  from regu r join kloter k on k.nomor = r.kloter_nomor
  where k.jam_berangkat is null and r.kloter_nomor <> v_tercetak and not r.batal
  order by r.nomor_dada desc limit 1;

  v_hasil := pindah_kloter(v_dada, 'peserta urgent, harus berangkat sekarang', v_tercetak);

  assert (v_hasil ->> 'kloter_baru')::smallint = v_tercetak, 'tidak mendarat di kloter tujuan';
  assert (v_hasil ->> 'sisipan')::boolean, 'pemindahan ke kloter tercetak tidak ditandai sisipan';
  assert v_hasil ->> 'peringatan' like '%TIDAK ADA di kertas%',
    'peringatan untuk petugas garis start tidak dikembalikan';

  -- Tanda sisipan harus tersimpan, bukan hanya di respons.
  assert (select disisipkan_pada is not null from regu where nomor_dada = v_dada),
    'tanda sisipan tidak tersimpan di regu';
  assert exists (select 1 from v_sisipan_kloter where nomor_dada = v_dada),
    'regu sisipan tidak muncul di v_sisipan_kloter';
  assert (select sisipan from v_daftar_kloter where nomor_dada = v_dada),
    'v_daftar_kloter tidak menandai regu sisipan';
end;
$$;

-- Riwayat hanya terbaca admin (RLS) — jadi diperiksa dengan akun admin.
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
do $$
begin
  assert exists (select 1 from history
                 where new_value -> 'pindah_kloter' ->> 'alasan'
                       = 'peserta urgent, harus berangkat sekarang'),
    'perpindahan tidak terekam riwayat';
  assert exists (select 1 from history
                 where (new_value -> 'pindah_kloter' ->> 'kloter_tujuan_sudah_dicetak')::boolean),
    'riwayat tidak mencatat bahwa tujuannya kloter tercetak';
end;
$$;
select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);

-- 5.5 Pindah ke kloter yang BELUM dicetak tidak menandai sisipan —
--     kertasnya memang belum beredar, jadi tidak ada yang perlu diperingatkan.
do $$
declare
  v_dada   integer;
  v_belum  smallint;
  v_hasil  jsonb;
begin
  select k.nomor into v_belum
  from kloter k
  where k.dicetak_pada is null and k.jam_berangkat is null
    and (select count(*) from regu r where r.kloter_nomor = k.nomor)
        < (select maks_regu_per_kloter from edisi where aktif)
  limit 1;

  select r.nomor_dada into v_dada
  from regu r join kloter k on k.nomor = r.kloter_nomor
  where k.jam_berangkat is null and r.disisipkan_pada is null
    and r.kloter_nomor <> v_belum and not r.batal
  order by r.nomor_dada limit 1;

  if v_dada is not null and v_belum is not null then
    v_hasil := pindah_kloter(v_dada, 'geser biasa', v_belum);
    assert not (v_hasil ->> 'sisipan')::boolean,
      'pindah ke kloter belum tercetak salah ditandai sisipan';
    assert v_hasil ->> 'peringatan' is null, 'peringatan muncul padahal tidak perlu';
  end if;
end;
$$;

-- 5.6 Batas yang TIDAK boleh ditembus meski urgent:
--     kloter yang sudah berangkat, dan kapasitas fisik.
do $$
declare
  v_dada integer; v_kloter smallint; v_isi int; v_maks int;
begin
  -- Berangkatkan satu kloter untuk diuji.
  select k.nomor into v_kloter from kloter k
  where k.jam_berangkat is null
    and exists (select 1 from regu r where r.kloter_nomor = k.nomor and not r.batal)
  order by k.nomor limit 1;

  -- Semua regu di kloter itu perlu kontrak sebelum boleh berangkat.
  -- Lewat RPC, bukan UPDATE langsung: peran meja memang tidak berhak menulis
  -- ke tabel regu (kebijakan sejak review tahap 1).
  perform konfirmasi_kontrak(id, 240::smallint) from regu where kloter_nomor = v_kloter;
  perform ceklis_berangkat(nomor_dada) from regu where kloter_nomor = v_kloter;
  perform berangkatkan_kloter(v_kloter, now());

  select r.nomor_dada into v_dada from regu r join kloter k on k.nomor = r.kloter_nomor
  where k.jam_berangkat is null and not r.batal limit 1;

  begin
    perform pindah_kloter(v_dada, 'coba tembus', v_kloter);
    raise exception 'GAGAL: regu bisa dipindah ke kloter yang sudah berangkat';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  -- Regu yang SUDAH berangkat tidak bisa dipindah ke mana pun.
  select r.nomor_dada into v_dada from regu r where r.kloter_nomor = v_kloter limit 1;
  begin
    perform pindah_kloter(v_dada, 'coba pindah yang sudah jalan');
    raise exception 'GAGAL: regu yang sudah berangkat bisa dipindah';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;

-- 5.7 Tulisan langsung ke tabel tetap ditolak — pintu resmi hanya
--     pindah_kloter(), dan penandanya tidak bocor ke luar transaksi.
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
do $$
declare v_regu uuid; v_tercetak smallint;
begin
  assert coalesce(current_setting('hrcd.izin_pindah', true), '') <> '1',
    'penanda izin pindah bocor ke luar transaksi RPC';

  select k.nomor into v_tercetak from kloter k
  where k.dicetak_pada is not null and k.jam_berangkat is null limit 1;
  select r.id into v_regu from regu r join kloter k on k.nomor = r.kloter_nomor
  where k.jam_berangkat is null and r.kloter_nomor <> v_tercetak limit 1;

  begin
    update regu set kloter_nomor = v_tercetak where id = v_regu;
    raise exception 'GAGAL: admin bisa menembus pembekuan lewat UPDATE langsung';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;

reset role;
\echo '== 05: OK =='
