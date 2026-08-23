-- ============================================================================
-- hrcd-rekap : tests/sql/62_guard_pos_completeness.sql — migrasi 0101.
-- View definer harus berubah hasil saat akun yang sama diaktifkan.
-- ============================================================================

\echo '--- 62. kelengkapan pos hanya untuk panitia aktif'

do $blok$
declare
  v_user uuid := '00000000-0000-0000-0000-0000000000c4';
  v_jumlah integer;
begin
  insert into auth.users (id, email) values (v_user, 'kelengkapan@uji.local')
  on conflict (id) do nothing;
  insert into akun_panitia (user_id, username, peran, pos, is_active)
  values (v_user, 'kelengkapan.uji', 'registrasi', null, false)
  on conflict (user_id) do update
    set peran = 'registrasi', pos = null, is_active = false;

  perform set_config('app.uid', v_user::text, true);
  set local role authenticated;
  select count(*) into v_jumlah from v_kelengkapan_pos;
  assert v_jumlah = 0,
    format('62.1 GAGAL: akun nonaktif melihat %s baris kelengkapan', v_jumlah);

  reset role;
  update akun_panitia set is_active = true where user_id = v_user;
  set local role authenticated;
  perform set_config('app.uid', v_user::text, true);
  select count(*) into v_jumlah from v_kelengkapan_pos;
  assert v_jumlah > 0,
    '62.2 GAGAL: panitia aktif tidak bisa membaca kelengkapan lintas pos';

  reset role;
  update akun_panitia set is_active = false where user_id = v_user;
  perform set_config('app.uid', '', true);
end;
$blok$;

\echo '62 pagar kelengkapan pos: LULUS'
