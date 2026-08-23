-- ============================================================================
-- hrcd-rekap : tests/sql/61_gate_regu_lookup.sql — migrasi 0100.
-- Lookup staging/finish mengikuti hak gerbang, bukan centang Live Score.
-- ============================================================================

\echo '--- 61. lookup regu tetap hidup tanpa hak Live Score'

do $blok$
declare
  v_gerbang uuid := '00000000-0000-0000-0000-0000000000c3';
  v_jumlah integer;
begin
  insert into auth.users (id, email) values (v_gerbang, 'gerbang.lookup@uji.local')
  on conflict (id) do nothing;
  insert into akun_panitia (user_id, username, peran, pos, is_active)
  values (v_gerbang, 'gerbang.lookup', 'juri_pos', 1, true)
  on conflict (user_id) do update set peran = 'juri_pos', pos = 1, is_active = true;
  update akun_panitia set peran = 'gerbang', pos = null where user_id = v_gerbang;
  delete from akun_hak where user_id = v_gerbang and fitur = 'live_score';

  perform set_config('app.uid', v_gerbang::text, true);
  set local role authenticated;

  select count(*) into v_jumlah from v_regu_ringkas;
  assert v_jumlah > 0,
    '61.1 GAGAL: hak keberangkatan/kedatangan tidak membuka lookup regu';

  -- View tidak boleh dibetulkan dengan membuka seluruh pendaftaran beserta
  -- nomor WA kepada gerbang. Policy tabel tetap tertutup untuk akun ini.
  select count(*) into v_jumlah from pendaftaran;
  assert v_jumlah = 0,
    '61.2 GAGAL: gerbang bisa membaca tabel pendaftaran secara langsung';

  reset role;
  delete from akun_hak
  where user_id = v_gerbang and fitur in ('keberangkatan', 'kedatangan');
  set local role authenticated;
  perform set_config('app.uid', v_gerbang::text, true);
  select count(*) into v_jumlah from v_regu_ringkas;
  assert v_jumlah = 0,
    '61.3 GAGAL: lookup tetap terbuka sesudah kedua hak gerbang dicabut';

  reset role;
  insert into akun_hak (user_id, fitur)
  values (v_gerbang, 'keberangkatan'), (v_gerbang, 'kedatangan'),
         (v_gerbang, 'live_score')
  on conflict do nothing;
  perform set_config('app.uid', '', true);
end;
$blok$;

\echo '61 lookup regu gerbang: LULUS'
