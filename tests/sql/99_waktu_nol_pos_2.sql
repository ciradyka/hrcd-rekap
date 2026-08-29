\echo '--- 99. waktu 00:00 Pos 2 bernilai nol'

do $$
declare
  v_w wahana%rowtype;
  v_poin numeric;
  v_n int := 0;
begin
  for v_w in
    select * from wahana
    where edisi = edisi_aktif() and pos = 2 and satuan = 'detik'
    order by kode
  loop
    v_n := v_n + 1;
    v_poin := hitung_poin(v_w.form, 0, null, v_w.poin_maks,
      v_w.raw_terbaik, v_w.raw_terburuk, v_w.poin_benar, v_w.poin_salah,
      v_w.total_soal, v_w.tingkat);
    assert v_poin = 0,
      format('99.1 GAGAL: %s pada 00:00 mendapat %s poin', v_w.kode, v_poin);

    v_poin := hitung_poin(v_w.form, 1, null, v_w.poin_maks,
      v_w.raw_terbaik, v_w.raw_terburuk, v_w.poin_benar, v_w.poin_salah,
      v_w.total_soal, v_w.tingkat);
    assert v_poin = 100,
      format('99.2 GAGAL: %s pada 00:01 mendapat %s poin', v_w.kode, v_poin);
  end loop;

  -- Database test generik tidak selalu memuat konfigurasi lomba XXXVII.
  -- Tangga representatif tetap membuktikan batas khusus 0 tidak mengubah
  -- waktu positif pertama.
  if v_n = 0 then
    assert hitung_poin('bertingkat', 0, null, 100, null, null, null, null,
      null, '[{"sampai":0,"poin":0},{"sampai":30,"poin":100}]') = 0,
      '99.3 GAGAL: tangga 00:00 tidak menghasilkan nol';
    assert hitung_poin('bertingkat', 1, null, 100, null, null, null, null,
      null, '[{"sampai":0,"poin":0},{"sampai":30,"poin":100}]') = 100,
      '99.4 GAGAL: tingkat nol mengubah waktu positif';
  end if;
end;
$$;

\echo '99 waktu nol Pos 2: LULUS'
