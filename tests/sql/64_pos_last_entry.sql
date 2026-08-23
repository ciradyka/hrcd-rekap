-- Panel kelengkapan harus membawa waktu nilai terakhir pada setiap pos.

do $blok$
declare
  v_pos smallint;
  v_terakhir timestamptz;
  v_dari_view timestamptz;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  assert exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'v_kelengkapan_pos'
      and column_name = 'terakhir_masuk'
  ), 'v_kelengkapan_pos tidak mengekspos terakhir_masuk';

  select w.pos, max(n.created_at)
    into v_pos, v_terakhir
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif()
  group by w.pos
  order by w.pos
  limit 1;

  assert v_pos is not null, 'fixture tidak punya nilai untuk menguji terakhir_masuk';
  select terakhir_masuk into v_dari_view
  from v_kelengkapan_pos where pos = v_pos;
  assert v_dari_view = v_terakhir,
         format('terakhir_masuk view %s, seharusnya %s', v_dari_view, v_terakhir);

  raise notice '64: waktu nilai terakhir Pos % terbaca di panel kelengkapan.', v_pos;
end $blok$;

\echo '64 waktu nilai terakhir per pos: LULUS'
