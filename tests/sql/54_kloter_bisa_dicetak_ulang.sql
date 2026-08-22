-- ============================================================================
-- Kloter yang sudah punya timestamp cetak tetap bisa dicetak ulang. Panggilan
-- kedua memperbarui timestamp itu, bukan mengembalikan nol seperti aturan
-- lama. Kloter kosong tetap tidak ikut ditandai.
-- ============================================================================

select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);

do $$
declare
  v_kloter smallint;
  v_kosong smallint;
  v_lama timestamptz := '2026-08-01 07:00:00+07';
begin
  select k.nomor into v_kloter
  from kloter k
  where exists (
    select 1 from regu r
    join pendaftaran d on d.id = r.pendaftaran_id
    where r.kloter_nomor = k.nomor
      and not r.is_cancelled
      and d.status = 'lunas'
  )
  order by k.nomor
  limit 1;

  select k.nomor into v_kosong
  from kloter k
  where not exists (
    select 1 from regu r
    join pendaftaran d on d.id = r.pendaftaran_id
    where r.kloter_nomor = k.nomor
      and not r.is_cancelled
      and d.status = 'lunas'
  )
  order by k.nomor desc
  limit 1;

  assert v_kloter is not null, 'tidak ada kloter berisi untuk menguji cetak ulang';
  assert v_kosong is not null, 'tidak ada kloter kosong untuk menguji pagar';

  create temporary table target_cetak_ulang (
    kloter smallint not null,
    kosong smallint not null,
    lama timestamptz not null
  );
  insert into target_cetak_ulang values (v_kloter, v_kosong, v_lama);

  update kloter set dicetak_pada = v_lama where nomor = v_kloter;
  update kloter set dicetak_pada = null where nomor = v_kosong;
end;
$$;

grant select on target_cetak_ulang to authenticated;
set role authenticated;

do $$
declare
  v_target target_cetak_ulang%rowtype;
  v_jumlah integer;
begin
  select * into strict v_target from target_cetak_ulang;
  v_jumlah := tandai_kloter_dicetak(array[v_target.kloter, v_target.kosong]);

  assert v_jumlah = 1,
         format('cetak ulang memperbarui %s kloter, seharusnya 1', v_jumlah);
  assert (select dicetak_pada > v_target.lama
          from kloter where nomor = v_target.kloter),
         'timestamp kloter yang dicetak ulang tidak diperbarui';
  assert (select dicetak_pada is null
          from kloter where nomor = v_target.kosong),
         'kloter kosong ikut ditandai tercetak';
end;
$$;

reset role;
\echo '54 kloter bisa dicetak ulang: LULUS'
