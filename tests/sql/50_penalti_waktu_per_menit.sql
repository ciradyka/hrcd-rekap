-- ============================================================================
-- hrcd-rekap : tests/sql/50_penalti_waktu_per_menit.sql
-- Tepat target = 0; terlalu cepat/lambat = 1 poin per menit (0089).
-- ============================================================================

do $blok$
declare
  v_regu       uuid;
  v_kloter     smallint;
  v_target     timestamptz;
  v_jam_lama   timestamptz;
  v_berangkat_lama timestamptz;
  v_kontrak_lama smallint;
  v_selisih    int;
  v_penalti    numeric;
begin
  select r.id, r.kloter_nomor, k.jam_berangkat, r.kontrak_menit, c.jam_datang
    into v_regu, v_kloter, v_berangkat_lama, v_kontrak_lama, v_jam_lama
  from regu r
  join kloter k on k.nomor = r.kloter_nomor
  join closing_regu c on c.regu_id = r.id
  where k.jam_berangkat is not null and r.kontrak_menit is not null
  order by r.nomor_dada
  limit 1;

  assert v_regu is not null,
         'fixture tidak punya regu berangkat, berkontrak, dan sudah closing';
  assert (select blok_menit = 1 and penalti_per_blok = 1
          from konfig_penalti where edisi = edisi_aktif()),
         'konfigurasi bukan 1 menit -> 1 poin';

  update kloter set jam_berangkat = timestamptz '2026-08-29 07:00+07'
  where nomor = v_kloter;
  update regu set kontrak_menit = 240 where id = v_regu;
  v_target := timestamptz '2026-08-29 11:00+07';

  -- Kasus keputusan pemilik: kontrak 4 jam dari 07:00 menargetkan tepat 11:00.
  update closing_regu set jam_datang = v_target where regu_id = v_regu;
  select selisih_menit, penalti_waktu into v_selisih, v_penalti
  from v_penalti_waktu where regu_id = v_regu;
  assert v_selisih = 0 and v_penalti = 0,
         format('tepat target menghasilkan selisih %s dan penalti %s', v_selisih, v_penalti);

  -- Terlalu cepat dan terlambat dihukum sama beratnya.
  update closing_regu set jam_datang = v_target - interval '1 minute' where regu_id = v_regu;
  select selisih_menit, penalti_waktu into v_selisih, v_penalti
  from v_penalti_waktu where regu_id = v_regu;
  assert v_selisih = -1 and v_penalti = 1,
         format('1 menit terlalu cepat menghasilkan selisih %s dan penalti %s', v_selisih, v_penalti);

  update closing_regu set jam_datang = v_target + interval '1 minute' where regu_id = v_regu;
  select selisih_menit, penalti_waktu into v_selisih, v_penalti
  from v_penalti_waktu where regu_id = v_regu;
  assert v_selisih = 1 and v_penalti = 1,
         format('1 menit terlambat menghasilkan selisih %s dan penalti %s', v_selisih, v_penalti);

  -- Bukan penalti tetap satu poin: setiap menit berikutnya ikut dihitung.
  update closing_regu set jam_datang = v_target - interval '17 minutes' where regu_id = v_regu;
  select selisih_menit, penalti_waktu into v_selisih, v_penalti
  from v_penalti_waktu where regu_id = v_regu;
  assert v_selisih = -17 and v_penalti = 17,
         format('17 menit terlalu cepat menghasilkan selisih %s dan penalti %s', v_selisih, v_penalti);

  update closing_regu set jam_datang = v_jam_lama where regu_id = v_regu;
  update regu set kontrak_menit = v_kontrak_lama where id = v_regu;
  update kloter set jam_berangkat = v_berangkat_lama where nomor = v_kloter;
  raise notice '50: tepat=0, cepat 1 menit=-1, lambat 1 menit=-1, cepat 17 menit=-17.';
end;
$blok$;

\echo '50 penalti waktu per menit: LULUS'
