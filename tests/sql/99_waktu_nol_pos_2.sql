\echo '--- 99. waktu 00:00 Pos 2 bernilai nol'

do $$
declare
  v_w wahana%rowtype;
  v_poin numeric;
begin
  for v_w in
    select * from wahana
    where edisi = edisi_aktif() and pos = 2 and satuan = 'detik'
    order by kode
  loop
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

  assert found, '99.3 GAGAL: komponen waktu Pos 2 tidak ditemukan';
end;
$$;

\echo '99 waktu nol Pos 2: LULUS'
