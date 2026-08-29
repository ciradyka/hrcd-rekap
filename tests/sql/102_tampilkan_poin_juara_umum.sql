\echo '--- 102. Kejuaraan menampilkan poin dan skor Juara Umum'

do $$
declare
  v_def text := pg_get_functiondef('hasil_kejuaraan()'::regprocedure);
begin
  assert v_def like
    '%order by bobot_juara desc nulls last, jumlah_skor desc, nama_sekolah%',
    '102.1 GAGAL: total skor bukan pemecah poin Juara Umum yang sama';

  assert exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'v_kejuaraan'
      and column_name = 'poin_juara'
  ), '102.2 GAGAL: poin juara tidak tersedia di Kejuaraan';

  assert exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'v_kejuaraan'
      and column_name = 'jumlah_skor'
  ), '102.3 GAGAL: jumlah skor tidak tersedia di Kejuaraan';
end;
$$;

\echo '102 tampilkan poin juara umum: LULUS'
