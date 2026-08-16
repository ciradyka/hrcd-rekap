-- ============================================================================
-- hrcd-rekap : tests/sql/24_hak_akses.sql
-- Hak akses per fitur (migrasi 0057).
--
-- Yang dijaga: migrasi ini dipasang di tengah edisi, dan syarat mutlaknya
-- adalah TIDAK ADA akun yang berubah aksesnya. Jadi yang diuji pertama bukan
-- fitur barunya, melainkan bahwa boleh() menjawab persis sama dengan yang
-- selama ini dijawab peran().
--
-- Yang kedua: nonaktifkan harus benar-benar berarti berhenti. Akun nonaktif
-- yang barisnya masih ada di akun_hak tidak boleh memegang apa pun — kalau
-- ini bocor, "hapus akun" di layar Akun cuma menyembunyikan orangnya dari
-- daftar sambil membiarkan aksesnya utuh.
-- ============================================================================

do $$
declare
  v_admin uuid := '00000000-0000-0000-0000-00000000000a';  -- admin.ciradyka
  v_meja  uuid := '00000000-0000-0000-0000-0000000000b1';  -- meja1hrcd37
  v_pos   uuid := '00000000-0000-0000-0000-000000000001';  -- pos1hrcd37
  v_mati  uuid := '00000000-0000-0000-0000-0000000000ff';  -- lama_hrcd36, nonaktif
  v_n     int;
begin
  -- ------------------------------------------------------------------ 1
  -- Sepuluh fitur, dan urutannya rapat 1..10. Layar Akun menggambar kolom
  -- dari tabel ini, jadi lubang di urutan berarti kolom yang meloncat.
  select count(*) into v_n from fitur;
  assert v_n = 10, format('fitur harus 10, ada %s', v_n);
  select count(*) into v_n from fitur where urutan between 1 and 10;
  assert v_n = 10, 'urutan fitur harus 1..10 tanpa lubang';

  -- ------------------------------------------------------------------ 2
  -- Hak terisi dari peran, persis sebanyak paketnya.
  select count(*) into v_n from akun_hak where user_id = v_admin;
  assert v_n = 10, format('admin harus punya 10 fitur, ada %s', v_n);
  select count(*) into v_n from akun_hak where user_id = v_meja;
  assert v_n = 7, format('meja harus punya 7 fitur, ada %s', v_n);
  select count(*) into v_n from akun_hak where user_id = v_pos;
  assert v_n = 1, format('operator_pos harus punya 1 fitur, ada %s', v_n);

  -- Yang TIDAK boleh dipegang meja — kalau salah satu bocor, migrasi ini
  -- menambah akses, dan itu jauh lebih buruk daripada mengurangi.
  assert not exists (select 1 from akun_hak
                     where user_id = v_meja and fitur in ('pos', 'live_score', 'akun')),
         'meja tidak boleh memegang pos/live_score/akun';
  assert exists (select 1 from akun_hak where user_id = v_pos and fitur = 'pos'),
         'operator_pos harus memegang pos';
end $$;

-- ---------------------------------------------------------------------------
-- 3. boleh() dilihat dari kursi masing-masing. Harus dijalankan sebagai
--    `authenticated` dengan app.uid terpasang — boleh() membaca auth.uid().
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;

  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  assert boleh('akun'),        'admin harus boleh akun';
  assert boleh('pembayaran'),  'admin harus boleh pembayaran';

  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', true);
  assert boleh('pembayaran'),      'meja harus boleh pembayaran';
  assert not boleh('akun'),        'meja TIDAK boleh akun';
  assert not boleh('pos'),         'meja TIDAK boleh pos';

  perform set_config('app.uid', '00000000-0000-0000-0000-000000000001', true);
  assert boleh('pos'),             'operator_pos harus boleh pos';
  assert not boleh('pembayaran'),  'operator_pos TIDAK boleh pembayaran';

  -- Fitur yang tidak ada bukan galat, dan bukan pula "boleh".
  assert not boleh('tidak_ada_fitur_ini'), 'fitur asing harus dijawab false';

  -- Belum masuk: tidak memegang apa pun.
  perform set_config('app.uid', '', true);
  assert not boleh('pos'), 'tanpa sesi tidak boleh apa-apa';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Nonaktif = berhenti, walau barisnya masih ada.
-- ---------------------------------------------------------------------------
do $$
declare v_uid uuid := '00000000-0000-0000-0000-0000000000ff';
begin
  -- Akun ini nonaktif di seed. Diberi hak penuh dengan sengaja: kalau
  -- is_active tidak diperiksa boleh(), baris berikutnya akan lolos.
  insert into akun_hak (user_id, fitur)
  select v_uid, kode from fitur on conflict do nothing;

  set local role authenticated;
  perform set_config('app.uid', v_uid::text, true);
  assert not boleh('pembayaran'), 'akun nonaktif tidak boleh apa pun';
  assert not boleh('akun'),       'akun nonaktif tidak boleh akun';

  reset role;
  delete from akun_hak where user_id = v_uid;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Pengelolaan akun sekarang ditentukan centang, bukan peran.
--
--    Ini inti perubahannya: admin yang centang 'akun'-nya dicabut harus
--    kehilangan akses ke akun_panitia, walau kolom peran-nya masih 'admin'.
--    Kalau tes ini gagal, centangnya cuma hiasan.
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin uuid := '00000000-0000-0000-0000-00000000000a';
  v_n int;
begin
  set local role authenticated;
  perform set_config('app.uid', v_admin::text, true);
  select count(*) into v_n from akun_panitia;
  assert v_n >= 6, format('admin bercentang akun harus melihat semua baris, lihat %s', v_n);

  reset role;
  delete from akun_hak where user_id = v_admin and fitur = 'akun';

  set local role authenticated;
  perform set_config('app.uid', v_admin::text, true);
  assert not boleh('akun'), 'centang sudah dicabut, boleh() harus false';
  select count(*) into v_n from akun_panitia;
  -- Tinggal barisnya sendiri, lewat policy sel_akun_sendiri.
  assert v_n = 1, format('tanpa centang akun hanya barisnya sendiri, lihat %s', v_n);

  reset role;
  insert into akun_hak (user_id, fitur) values (v_admin, 'akun');
end $$;

\echo '24 hak akses: LULUS'
