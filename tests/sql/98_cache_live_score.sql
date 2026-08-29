\echo '--- 98. cache Live Score privat dan lengkap'

do $$
declare
  v_n int;
  v_data jsonb;
begin
  perform segarkan_cache_live_score();

  select count(*) into v_n from cache_live_score;
  select data into v_data from cache_live_score where tunggal;
  assert v_n = 1, format('98.1 GAGAL: cache berisi %s baris, seharusnya satu', v_n);
  assert v_data ?& array['kelengkapan', 'pos', 'komponen', 'rekap'],
    '98.2 GAGAL: bentuk snapshot tidak lengkap';
end;
$$;

do $$
declare
  v_juri uuid := '00000000-0000-0000-0000-000000000001';
  v_n int;
begin
  set local role authenticated;
  perform set_config('app.uid', v_juri::text, true);
  select count(*) into v_n from cache_live_score;
  assert v_n = 1, '98.3 GAGAL: pemegang live_score tidak dapat membaca cache';

  reset role;
  delete from akun_hak where user_id = v_juri and fitur = 'live_score';
  set local role authenticated;
  select count(*) into v_n from cache_live_score;
  reset role;
  insert into akun_hak (user_id, fitur) values (v_juri, 'live_score')
  on conflict do nothing;
  assert v_n = 0, '98.4 GAGAL: cache terbaca tanpa hak live_score';
end;
$$;

\echo '98 cache live score: LULUS'
