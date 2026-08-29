\echo '--- 100. Juara Umum berdasarkan poin gelar'

do $$
declare
  v_def text := pg_get_functiondef('hasil_kejuaraan()'::regprocedure);
  v_juara text;
begin
  assert v_def like '%order by bobot_juara desc, jumlah_skor desc, nama_sekolah%',
    '100.1 GAGAL: hasil_kejuaraan tidak mengurutkan total poin lebih dahulu';
  assert v_def not like '%order by jumlah_juara desc, bobot_juara desc%',
    '100.2 GAGAL: banyaknya gelar masih mengalahkan total poin';

  -- ALPHA: empat gelar = 6+5+6+3 = 20.
  -- GAMMA: lima gelar = 4+3+5+4+2 = 18.
  with gelar(sekolah, poin) as (values
    ('ALPHA', 6), ('ALPHA', 5), ('ALPHA', 6), ('ALPHA', 3),
    ('GAMMA', 4), ('GAMMA', 3), ('GAMMA', 5), ('GAMMA', 4), ('GAMMA', 2)
  )
  select sekolah into v_juara
  from gelar group by sekolah order by sum(poin) desc limit 1;

  assert v_juara = 'ALPHA',
    format('100.3 GAGAL: empat gelar 20 poin kalah dari lima gelar 18 poin: %s', v_juara);
end;
$$;

\echo '100 juara umum poin: LULUS'
