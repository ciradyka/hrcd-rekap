-- ============================================================================
-- hrcd-rekap : tests/sql/51_reset_event_times.sql
-- Reset waktu mengosongkan seluruh status keberangkatan dan closing.
-- ============================================================================

do $blok$
declare
  v_n           int;
  v_regu        int;
  v_kontrak     int;
  v_berangkat   int;
  v_datang      int;
begin
  select count(*) into v_n from kloter where jam_berangkat is not null;
  assert v_n = 0, format('%s kloter masih punya jam berangkat', v_n);

  select count(*) into v_n from closing_regu;
  assert v_n = 0, format('%s regu masih punya jam datang', v_n);

  select count(*) into v_n from keberangkatan_regu;
  assert v_n = 0, format('%s peserta masih berstatus berangkat', v_n);

  -- Reset status bukan reset peserta: nomor dada, kloter, dan kontrak bertahan.
  select count(*) into v_regu from regu
  where nomor_dada is not null and kloter_nomor is not null;
  select count(*) into v_kontrak from regu where kontrak_menit is not null;
  assert v_regu > 0 and v_kontrak > 0,
         format('data peserta ikut hilang: %s bernomor/berkloter, %s berkontrak',
                v_regu, v_kontrak);

  select regu_berangkat, regu_datang into v_berangkat, v_datang
  from v_kemajuan_hari;
  assert v_berangkat = 0 and v_datang = 0,
         format('kemajuan hari masih melaporkan %s berangkat / %s datang',
                v_berangkat, v_datang);

  select count(*) into v_n from v_klasemen;
  assert v_n = 0, format('%s regu masih masuk klasemen sebelum berangkat', v_n);

  raise notice '51: keberangkatan dan closing nol; % peserta tetap bernomor/berkloter.',
               v_regu;
end;
$blok$;

\echo '51 reset waktu acara: LULUS'
