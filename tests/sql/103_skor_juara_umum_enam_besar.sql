\echo '--- 103. total skor Juara Umum hanya dari enam besar'

do $$
declare v_juara text;
begin
  -- Poin A dan B sama-sama 6. Skor peringkat 7 milik A tidak boleh membuat A
  -- mengalahkan skor enam besar B yang lebih tinggi.
  with hasil(sekolah, nomor_juara, skor) as (values
    ('A', 1, 100::numeric),
    ('A', 7, 9000::numeric),
    ('B', 1, 200::numeric)
  ), calon as (
    select sekolah,
           sum(7 - nomor_juara) filter (where nomor_juara <= 6) poin,
           sum(skor) filter (where nomor_juara <= 6) jumlah_skor
    from hasil group by sekolah
  )
  select sekolah into v_juara from calon
  order by poin desc nulls last, jumlah_skor desc, sekolah limit 1;

  assert v_juara = 'B',
    format('103.1 GAGAL: skor di luar enam besar ikut dihitung: %s', v_juara);
  assert pg_get_functiondef('hasil_kejuaraan()'::regprocedure) like
    '%sum(total) filter (where nomor_juara <= 6) as jumlah_skor%',
    '103.2 GAGAL: fungsi belum membatasi jumlah skor ke enam besar';
end;
$$;

\echo '103 skor juara umum enam besar: LULUS'
