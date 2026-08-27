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
-- Diuji untuk KEDUA jenis peserta. Constraint-nya memang tidak menyebut
-- golongan, tetapi "berlaku untuk semua" adalah persis jenis kalimat yang
-- benar saat ditulis dan diam-diam berhenti benar nanti — pos, kelengkapan,
-- dan penalti semuanya sudah pernah bercabang untuk Intern.
--
-- Dan constraint-nya NOT VALID: empat baris satu huruf yang sudah ada di
-- produksi sengaja dibiarkan. Yang dijaga tes terakhir adalah bahwa
-- "dibiarkan" itu hanya berlaku ke belakang — baris BARU tetap ditolak.
--
-- Seluruhnya di-rollback, jadi tidak ada baris uji yang tertinggal.
-- ============================================================================

\echo '--- 82. nama regu minimal tiga huruf'
\set ON_ERROR_STOP on

do $blok$
declare
  v_pendaftaran uuid;
  v_nama        text;
  v_golongan    text;
  v_diterima    boolean;
begin
  select id into v_pendaftaran from pendaftaran limit 1;
  assert v_pendaftaran is not null,
    '82 GAGAL: tidak ada pendaftaran untuk disisipi — tes ini akan lulus '
    'tanpa menguji apa pun';

  -- 82.1 Yang harus DITOLAK, dan ditolak untuk KEDUA jenis peserta. Tiga yang
  -- terakhir punya cukup karakter tetapi tidak cukup huruf, dan itulah
  -- kekeliruan yang dijaga tes ini.
  foreach v_golongan in array array['penegak_pa', 'intern_pa'] loop
    foreach v_nama in array array['A', 'Ab', 'A B', 'A.B', 'C -'] loop
      begin
        insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
        values (v_pendaftaran, v_nama, 'Ketua Uji', v_golongan);
        v_diterima := true;
      exception when check_violation then
        v_diterima := false;
      end;
      assert not v_diterima,
        format('82.1 GAGAL: "%s" diterima sebagai %s, padahal hurufnya '
               'kurang dari tiga', v_nama, v_golongan);
    end loop;
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

  -- 82.3 Nama Intern yang cukup panjang tetap masuk — supaya 82.1 tidak
  -- lulus hanya karena golongan Intern kebetulan ditolak oleh hal lain.
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    values (v_pendaftaran, 'Cakrawala', 'Ketua Uji', 'intern_pa');
    v_diterima := true;
  exception when check_violation then
    v_diterima := false;
  end;
  assert v_diterima,
    '82.3 GAGAL: regu Intern bernama "Cakrawala" ditolak — 82.1 tidak '
    'membuktikan apa pun kalau semua Intern memang ditolak';

  -- 82.4 Constraint-nya NOT VALID: baris lama dibiarkan, baris baru tidak.
  -- Kalau suatu saat ia divalidasi, keempat nama satu huruf di produksi harus
  -- diganti LEBIH DULU — dan tes ini yang mengingatkannya.
  assert exists (select 1 from pg_constraint
                 where conname = 'regu_nama_regu_tiga_huruf'
                   and not convalidated),
    '82.4 GAGAL: regu_nama_regu_tiga_huruf sudah divalidasi — empat regu satu '
    'huruf di produksi akan membuat migrasinya gagal';

  raise exception 'ROLLBACK UJI 82';
exception when others then
  if sqlerrm <> 'ROLLBACK UJI 82' then raise; end if;
end;
$blok$;

\echo '    82 LULUS'
