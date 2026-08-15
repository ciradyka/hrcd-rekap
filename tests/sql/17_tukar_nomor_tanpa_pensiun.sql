-- ============================================================================
-- hrcd-rekap : tests/sql/17_tukar_nomor_tanpa_pensiun.sql
-- Menukar nomor dada (0041): kapan nomor lama boleh dipakai lagi.
--
-- Dua keadaan yang berlawanan, dan keduanya harus tetap berlawanan:
--
--   kertas BELUM beredar  -> nomor lama KEMBALI ke stok, boleh dipakai lagi
--   kertas SUDAH beredar  -> nomor lama PENSIUN, tidak pernah terbit ulang
--
-- Yang pertama adalah kasus paling sering: petugas meja salah ketik satu
-- digit. Dulu nomor itu mati permanen walau kainnya masih utuh di kardus.
--
-- Yang kedua bukan kehati-hatian berlebih. Slip form per lomba hanya memuat
-- NOMOR DADA tanpa nama regu; kalau 001 terbit ulang, slip bertuliskan 001
-- tidak bisa lagi dipastikan milik siapa.
-- ============================================================================

select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;

-- ---------------------------------------------------------------------------
-- 17.1 Kertas BELUM beredar: nomor lama kembali ke peredaran.
-- ---------------------------------------------------------------------------
do $$
declare
  v_regu  uuid;
  v_lama  integer;
  v_baru  integer;
begin
  -- Regu yang kloternya belum dicetak dan belum berangkat.
  select r.id, r.nomor_dada into v_regu, v_lama
  from regu r join kloter k on k.nomor = r.kloter_nomor
  where r.nomor_dada is not null and not r.is_cancelled
    and k.dicetak_pada is null and k.jam_berangkat is null
  order by r.nomor_dada limit 1;
  assert v_regu is not null, 'tidak ada regu di kloter yang belum beredar';

  select s.nomor into v_baru from nomor_dada_stok s
  where not exists (select 1 from regu where nomor_dada = s.nomor)
    and not exists (select 1 from nomor_dada_pensiun where nomor = s.nomor)
  order by s.nomor desc limit 1;

  perform tukar_nomor_dada(v_regu, v_baru, 'uji: salah ketik di meja');

  assert (select nomor_dada from regu where id = v_regu) = v_baru,
    'nomor baru tidak terpasang';
  assert not exists (select 1 from nomor_dada_pensiun where nomor = v_lama),
    format('nomor %s dipensiunkan padahal kertasnya belum beredar', v_lama);

  -- Dan benar-benar bisa dipakai lagi, bukan sekadar tidak tercatat pensiun.
  perform tukar_nomor_dada(v_regu, v_lama, 'uji: dikembalikan');
  assert (select nomor_dada from regu where id = v_regu) = v_lama,
    'nomor lama tidak bisa dipakai lagi padahal tidak pensiun';
end;
$$;

-- ---------------------------------------------------------------------------
-- 17.2 Kertas SUDAH beredar: nomor lama pensiun, dan penukaran hanya oleh
--      admin. Dijalankan sebagai admin karena meja memang ditolak di sini.
-- ---------------------------------------------------------------------------
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);

do $$
declare
  v_regu uuid;
  v_lama integer;
  v_baru integer;
begin
  select r.id, r.nomor_dada into v_regu, v_lama
  from regu r join kloter k on k.nomor = r.kloter_nomor
  where r.nomor_dada is not null and not r.is_cancelled
    and k.dicetak_pada is not null
  order by r.nomor_dada limit 1;
  assert v_regu is not null, 'tidak ada regu di kloter yang sudah dicetak';

  select s.nomor into v_baru from nomor_dada_stok s
  where not exists (select 1 from regu where nomor_dada = s.nomor)
    and not exists (select 1 from nomor_dada_pensiun where nomor = s.nomor)
  order by s.nomor desc limit 1;

  perform tukar_nomor_dada(v_regu, v_baru, 'uji: kain robek di lapangan');

  assert (select nomor_dada from regu where id = v_regu) = v_baru,
    'nomor baru tidak terpasang';
  assert exists (select 1 from nomor_dada_pensiun where nomor = v_lama),
    format('nomor %s TIDAK dipensiunkan padahal kertasnya sudah beredar', v_lama);

  -- Dan penolakannya nyata, bukan sekadar tercatat di tabel pensiun.
  begin
    perform tukar_nomor_dada(v_regu, v_lama, 'uji: seharusnya ditolak');
    raise exception 'GAGAL: nomor pensiun masih bisa dipakai lagi';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;

reset role;
select '17_tukar_nomor_tanpa_pensiun OK' as hasil;
