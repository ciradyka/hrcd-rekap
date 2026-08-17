-- ============================================================================
-- hrcd-rekap : tests/sql/36_fase_live_publik.sql
-- Fase live terbaca anon, dan HANYA fase (migrasi 0070).
--
-- Yang dijaga: view ini dibuka ke `anon` — pengunjung tanpa login. Satu kolom
-- tambahan yang ikut terbawa dari `status_acara` berarti kunci konfigurasi
-- dan penanda hari-H ikut terbaca seluruh internet, dan tidak ada satu pun
-- layar yang akan memberi tahu.
-- ============================================================================

do $blok$
declare v_kolom text;
begin
  select string_agg(column_name, ', ' order by ordinal_position)
    into v_kolom
    from information_schema.columns
   where table_schema = 'public' and table_name = 'v_fase_live';
  assert v_kolom = 'fase_live',
         format('v_fase_live harus membawa fase_live SAJA, membawa: %s', v_kolom);
end $blok$;

do $blok$
declare v_f text; v_n int;
begin
  -- Terbaca tanpa identitas sama sekali — persis keadaan pengunjung.
  set local role anon;
  perform set_config('app.uid', '', true);
  select count(*) into v_n from v_fase_live;
  select fase_live into v_f from v_fase_live;
  reset role;

  assert v_n = 1, format('v_fase_live harus satu baris, ada %s', v_n);
  assert v_f in ('pra', 'progres', 'penuh'), format('fase tidak dikenal: %s', v_f);
end $blok$;

-- status_acara sendiri TETAP tertutup untuk anon. View di atas jendela, bukan
-- pintu.
do $blok$
declare v_gagal boolean := false;
begin
  set local role anon;
  begin
    perform 1 from status_acara;
  exception when insufficient_privilege then v_gagal := true;
  end;
  reset role;
  assert v_gagal, 'status_acara terbaca anon — seharusnya hanya v_fase_live';
end $blok$;

\echo '36 fase live publik: LULUS'
