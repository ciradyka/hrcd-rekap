-- ============================================================================
-- hrcd-rekap : tests/sql/60_anon_default_privileges.sql — migrasi 0099.
-- Hak tabel/view anon harus persis daftar putih situs peserta.
-- ============================================================================

\echo '--- 60. relasi anon hanya yang sengaja dibuka'

do $blok$
declare
  v_tidak_sengaja text;
  v_daftar_putih integer;
begin
  select string_agg(x.table_name, ', ' order by x.table_name)
    into v_tidak_sengaja
  from (
    select distinct table_name
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'
      and table_name not in (
        'sekolah', 'v_edisi_publik', 'v_fase_live', 'v_publik_ringkas',
        'v_kelengkapan_publik'
      )
  ) x;

  assert v_tidak_sengaja is null,
    format('60 GAGAL: anon mendapat relasi yang tidak sengaja dibuka: %s',
           v_tidak_sengaja);

  select count(distinct table_name) into v_daftar_putih
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon'
    and privilege_type = 'SELECT'
    and table_name in (
      'sekolah', 'v_edisi_publik', 'v_fase_live', 'v_publik_ringkas',
      'v_kelengkapan_publik'
    );

  assert v_daftar_putih = 5,
    format('60 GAGAL: hanya %s dari 5 relasi publik yang bisa dibaca anon',
           v_daftar_putih);
end;
$blok$;

\echo '60 default privileges anon: LULUS'
