-- ============================================================================
-- hrcd-rekap : tests/sql/26_nilai_mentah_bulat.sql
-- Nilai mentah tidak punya koma (migrasi 0059).
--
-- Yang dijaga: penolakannya datang dari DATABASE, bukan dari kotak isian.
-- `step="1"` di layar hanya membuat koma sulit diketik — ia tidak menahan
-- import massal, tidak menahan tempel dari spreadsheet, dan tidak menahan
-- siapa pun yang membuka devtools. Kalau tes ini lulus hanya karena layarnya
-- rapi, ia tidak menjaga apa-apa.
-- ============================================================================

do $$
declare
  v_wahana uuid;
  v_regu   uuid;
begin
  -- Pasangan diambil dari nilai_mentah ITU SENDIRI. Mengambil wahana dan regu
  -- terpisah bisa menghasilkan pasangan yang tidak punya baris, dan UPDATE
  -- yang tidak mengenai apa pun tidak melanggar constraint apa pun — tesnya
  -- lalu lulus tanpa menguji sesuatu. Itu yang terjadi waktu ini ditulis
  -- pertama kali.
  select regu_id, wahana_id into v_regu, v_wahana from nilai_mentah limit 1;
  if v_wahana is null or v_regu is null then
    raise notice '26: belum ada wahana/nilai di edisi aktif — tes dilewati';
    return;
  end if;

  -- Bulat: diterima.
  update nilai_mentah set nilai_1 = 4
   where regu_id = v_regu and wahana_id = v_wahana;

  -- Pecahan: ditolak, dan ditolak oleh constraint — bukan oleh trigger lain
  -- yang kebetulan ikut menggagalkannya.
  begin
    update nilai_mentah set nilai_1 = 4.85
     where regu_id = v_regu and wahana_id = v_wahana;
    assert false, 'nilai 4,85 seharusnya ditolak constraint nilai_mentah_bulat';
  exception when check_violation then
    null;
  end;

  -- nilai_2 juga, dan null tetap boleh.
  begin
    update nilai_mentah set nilai_2 = 1.5
     where regu_id = v_regu and wahana_id = v_wahana;
    assert false, 'nilai_2 1,5 seharusnya ditolak';
  exception when check_violation then
    null;
  end;
  update nilai_mentah set nilai_2 = null
   where regu_id = v_regu and wahana_id = v_wahana;

  -- Angka besar tetap boleh: yang dijaga BENTUKNYA, bukan besarnya. Rentang
  -- tetap urusan rentang_mentah_min/maks.
  update nilai_mentah set nilai_1 = 1000
   where regu_id = v_regu and wahana_id = v_wahana;
end $$;

-- Seluruh isi tabel lolos — kalau tidak, migrasinya tidak akan terpasang di
-- produksi dan yang menemukannya adalah apply-migration yang gagal.
do $$
declare v_n int;
begin
  select count(*) into v_n from nilai_mentah
   where nilai_1 <> round(nilai_1)
      or (nilai_2 is not null and nilai_2 <> round(nilai_2));
  assert v_n = 0, format('%s nilai mentah masih pecahan', v_n);
end $$;

\echo '26 nilai mentah bulat: LULUS'
