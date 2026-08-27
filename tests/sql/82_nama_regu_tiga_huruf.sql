-- ============================================================================
-- hrcd-rekap : tests/sql/82_nama_regu_tiga_huruf.sql — migrasi 0120.
--
-- Batas nama regu selama ini hanya di ujung ATAS: maksimal 20 karakter, tanpa
-- angka, tidak boleh kembar. Yang diuji di sini ujung bawahnya.
--
-- Yang paling mudah salah adalah CARA menghitungnya. "A B" panjangnya tiga
-- karakter tetapi hurufnya dua, dan yang dibacakan di lapangan adalah
-- hurufnya — jadi menghitung `length()` saja akan meloloskannya.
--
-- Diuji dua arah, karena syarat yang terlalu ketat menolak nama sungguhan
-- persis sesempit syarat yang terlalu longgar meloloskan yang bukan nama:
-- "Ma'ruf" dan "Nur-Aini" wajib tetap masuk.
--
-- Seluruhnya di-rollback, jadi tidak ada baris uji yang tertinggal.
-- ============================================================================

\echo '--- 82. nama regu minimal tiga huruf'
\set ON_ERROR_STOP on

do $blok$
declare
  v_pendaftaran uuid;
  v_nama        text;
  v_diterima    boolean;
begin
  select id into v_pendaftaran from pendaftaran limit 1;
  assert v_pendaftaran is not null,
    '82 GAGAL: tidak ada pendaftaran untuk disisipi — tes ini akan lulus '
    'tanpa menguji apa pun';

  -- 82.1 Yang harus DITOLAK. Dua yang terakhir punya cukup karakter tetapi
  -- tidak cukup huruf, dan itulah kekeliruan yang dijaga tes ini.
  foreach v_nama in array array['A', 'Ab', 'A B', 'A.B', 'C -'] loop
    begin
      insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
      values (v_pendaftaran, v_nama, 'Ketua Uji', 'penegak_pa');
      v_diterima := true;
    exception when check_violation then
      v_diterima := false;
    end;
    assert not v_diterima,
      format('82.1 GAGAL: "%s" diterima, padahal hurufnya kurang dari tiga',
             v_nama);
  end loop;

  -- 82.2 Yang harus DITERIMA. "Abc" tepat di batas; sisanya nama sungguhan
  -- bertanda baca, yang oleh syarat terlalu ketat akan ikut tertolak.
  foreach v_nama in array array['Abc', 'A B C', 'Ma''ruf', 'Nur-Aini'] loop
    begin
      insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
      values (v_pendaftaran, v_nama, 'Ketua Uji', 'penegak_pa');
      v_diterima := true;
    exception when check_violation then
      v_diterima := false;
    end;
    assert v_diterima,
      format('82.2 GAGAL: "%s" ditolak, padahal hurufnya tiga atau lebih',
             v_nama);
  end loop;

  raise exception 'ROLLBACK UJI 82';
exception when others then
  if sqlerrm <> 'ROLLBACK UJI 82' then raise; end if;
end;
$blok$;

\echo '    82 LULUS'
