-- Sekolah tanpa satu pun gelar enam besar mempunyai bobot_juara NULL.
-- Pada ORDER BY DESC PostgreSQL menaruh NULL di atas angka, sehingga sekolah
-- tanpa poin dapat mengalahkan sekolah yang benar-benar mendapat 6-5-4-3-2-1.

do $$
declare
  v_def text := pg_get_functiondef('hasil_kejuaraan()'::regprocedure);
  v_lama text := 'order by bobot_juara desc, jumlah_skor desc, nama_sekolah';
  v_baru text := 'order by bobot_juara desc nulls last, jumlah_skor desc, nama_sekolah';
begin
  assert position(v_lama in v_def) > 0,
    '0149: urutan Juara Umum tanpa NULLS LAST tidak ditemukan';
  execute replace(v_def, v_lama, v_baru);
end;
$$;

do $$
begin
  assert pg_get_functiondef('hasil_kejuaraan()'::regprocedure)
    like '%order by bobot_juara desc nulls last, jumlah_skor desc, nama_sekolah%',
    '0149: sekolah tanpa poin masih dapat berada di atas';
end;
$$;
