\echo '--- 101. sekolah tanpa enam besar tidak menjadi Juara Umum'

do $$
declare v_juara text;
begin
  with calon(sekolah, poin, jumlah_skor) as (values
    ('SEKOLAH ENAM BESAR', 6::numeric, 900::numeric),
    ('SEKOLAH BANYAK REGU', null::numeric, 9000::numeric)
  )
  select sekolah into v_juara from calon
  order by poin desc nulls last, jumlah_skor desc, sekolah limit 1;

  assert v_juara = 'SEKOLAH ENAM BESAR',
    format('101.1 GAGAL: sekolah tanpa poin menang: %s', v_juara);
  assert pg_get_functiondef('hasil_kejuaraan()'::regprocedure)
    like '%order by bobot_juara desc nulls last, jumlah_skor desc, nama_sekolah%',
    '101.2 GAGAL: hasil_kejuaraan belum memakai NULLS LAST';
end;
$$;

\echo '101 juara umum null: LULUS'
