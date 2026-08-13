-- ============================================================================
-- hrcd-rekap : tests/sql/07_pindah_setelah_berangkat.sql
-- Pelonggaran pindah_kloter di migrasi 0018.
--
-- Yang WAJIB dibuktikan ada dua, dan keduanya berlawanan arah:
--   - regu yang KETINGGALAN kloternya (tidak tercatat berangkat) BISA
--     dipindah, termasuk ke kloter yang sudah berangkat;
--   - regu yang SUDAH tercatat berangkat tetap TIDAK bisa dipindah.
-- Kalau yang kedua ikut longgar, penalti regu yang sedang di lintasan
-- berubah diam-diam dan tidak ada yang tahu sampai klasemen keluar.
-- ============================================================================

\echo '== 07: pindah kloter setelah berangkat =='

select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;

-- 7.1 Regu yang tercatat berangkat DITOLAK — ini pagar yang tersisa.
do $$
declare v_dada integer;
begin
  select r.nomor_dada into v_dada
  from regu r
  join keberangkatan_regu kr on kr.regu_id = r.id
  join kloter k on k.nomor = r.kloter_nomor
  where not r.is_cancelled and k.jam_berangkat is not null
  limit 1;
  if v_dada is null then
    raise notice '7.1 dilewati: tidak ada regu yang benar-benar berangkat';
    return;
  end if;
  begin
    perform pindah_kloter(v_dada, 'coba pindah padahal sudah berangkat');
    raise exception 'GAGAL: regu yang benar-benar berangkat bisa dipindah';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;

-- 7.2 Regu yang KLOTERNYA sudah berangkat tapi ia sendiri TIDAK tercatat
--     berangkat: boleh dipindah. Inilah regu yang telat dan ditinggal.
do $$
declare
  v_dada   integer;
  v_lama   smallint;
  v_tujuan smallint;
  v_hasil  jsonb;
begin
  select r.nomor_dada, r.kloter_nomor into v_dada, v_lama
  from regu r
  join kloter k on k.nomor = r.kloter_nomor
  where k.jam_berangkat is not null
    and not r.is_cancelled
    and not exists (select 1 from keberangkatan_regu kr where kr.regu_id = r.id)
  order by r.nomor_dada
  limit 1;
  if v_dada is null then
    raise notice '7.2 dilewati: tidak ada regu tertinggal di kloter yang sudah berangkat';
    return;
  end if;

  -- Kloter tujuan yang masih muat dan bukan kloter asalnya.
  select k.nomor into v_tujuan
  from kloter k, edisi e
  where e.is_active
    and k.nomor <> v_lama
    and (select count(*) from regu r2 where r2.kloter_nomor = k.nomor)
        < e.maks_regu_per_kloter
  order by k.nomor
  limit 1;
  assert v_tujuan is not null, 'tidak ada kloter tujuan yang muat untuk 7.2';

  v_hasil := pindah_kloter(v_dada, 'telat, ikut kloter berikutnya', v_tujuan);

  assert (v_hasil->>'kloter_baru')::smallint = v_tujuan,
    format('kloter_baru = %s, harusnya %s', v_hasil->>'kloter_baru', v_tujuan);
  assert (select kloter_nomor from regu where nomor_dada = v_dada) = v_tujuan,
    'baris regu tidak ikut pindah';
end;
$$;

-- 7.3 Kloter tujuan yang SUDAH berangkat diterima, dan hasilnya mengaku
--     terus terang lewat peringatan. Peringatan itu yang dibacakan panitia,
--     jadi ia harus ada — bukan sekadar pindahnya berhasil.
do $$
declare
  v_dada    integer;
  v_lama    smallint;
  v_tujuan  smallint;
  v_hasil   jsonb;
begin
  select r.nomor_dada, r.kloter_nomor into v_dada, v_lama
  from regu r
  where not r.is_cancelled
    and not exists (select 1 from keberangkatan_regu kr where kr.regu_id = r.id)
  order by r.nomor_dada
  limit 1;
  if v_dada is null then
    raise notice '7.3 dilewati: tidak ada regu yang belum tercatat berangkat';
    return;
  end if;

  select k.nomor into v_tujuan
  from kloter k, edisi e
  where e.is_active
    and k.jam_berangkat is not null
    and k.nomor <> v_lama
    and (select count(*) from regu r2 where r2.kloter_nomor = k.nomor)
        < e.maks_regu_per_kloter
  order by k.nomor
  limit 1;
  if v_tujuan is null then
    raise notice '7.3 dilewati: tidak ada kloter berangkat yang masih muat';
    return;
  end if;

  v_hasil := pindah_kloter(v_dada, 'menyusul kloter yang sudah jalan', v_tujuan);

  assert (v_hasil->>'tujuan_sudah_berangkat')::boolean,
    'tujuan_sudah_berangkat tidak ditandai';
  assert v_hasil->>'peringatan' is not null,
    'pindah ke kloter yang sudah berangkat tanpa peringatan untuk dibacakan';
end;
$$;

-- 7.4 Alasan tetap wajib, dan kapasitas tetap dijaga — dua pagar yang
--     TIDAK boleh ikut longgar.
do $$
declare v_dada integer;
begin
  select r.nomor_dada into v_dada
  from regu r
  where not r.is_cancelled
    and not exists (select 1 from keberangkatan_regu kr where kr.regu_id = r.id)
  limit 1;
  if v_dada is null then
    raise notice '7.4 dilewati: tidak ada regu yang bisa dipindah';
    return;
  end if;
  begin
    perform pindah_kloter(v_dada, '   ');
    raise exception 'GAGAL: pindah tanpa alasan diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;

reset role;
\echo '   07 lulus'
