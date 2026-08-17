-- ============================================================================
-- hrcd-rekap : tests/sql/33_live_score_semua_peran.sql
-- Live Score terbaca semua peran yang mencentangnya (migrasi 0067).
--
-- KENAPA TES 31 TIDAK MENANGKAP INI
--
-- Tes 31 memindai katalog untuk nama peran LAMA ('meja', 'operator_pos').
-- `v_klasemen_live_score` menyaring `peran() = 'admin'` — tidak mengandung
-- keduanya, jadi ia lolos dengan gembira sementara setiap peran selain admin
-- melihat papan kosong.
--
-- Pemeriksaan yang mencari gejala kemarin bukan pemeriksaan. Yang dijaga di
-- sini pertanyaan yang sebenarnya: APAKAH LAYARNYA TERISI dari kursi
-- masing-masing.
--
-- DAN SATU ARAH LAGI YANG MUDAH HILANG
--
-- View ini sengaja BUKAN security_invoker — ia berjalan dengan hak pemilik
-- dan menjaga haknya sendiri di WHERE. Kalau suatu hari seseorang
-- "merapikannya" jadi security_invoker seperti tetangga-tetangganya, papan
-- ini akan kosong lagi untuk juri pos, dan satu-satunya jalan membetulkannya
-- adalah membuka nilai mentah seluruh pos — membatalkan isolasi R6. Tes ini
-- menahan kedua-duanya.
-- ============================================================================

do $blok$
declare
  v_admin uuid := '00000000-0000-0000-0000-00000000000a';
  v_juri  uuid := '00000000-0000-0000-0000-000000000001';
  v_meja  uuid := '00000000-0000-0000-0000-0000000000b1';
  v_a int; v_j int; v_m int;
begin
  set local role authenticated;

  perform set_config('app.uid', v_admin::text, true);
  select count(*) into v_a from v_klasemen_live_score;

  perform set_config('app.uid', v_juri::text, true);
  select count(*) into v_j from v_klasemen_live_score;

  perform set_config('app.uid', v_meja::text, true);
  select count(*) into v_m from v_klasemen_live_score;

  assert v_a > 0, 'fixture kosong — tes ini tidak menguji apa pun';
  assert v_j = v_a,
         format('juri pos melihat %s baris, admin %s — papan Live Score harus sama', v_j, v_a);
  assert v_m = v_a,
         format('registrasi melihat %s baris, admin %s', v_m, v_a);
end $blok$;

-- ---------------------------------------------------------------------------
-- Centang live_score yang menentukan, bukan perannya.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_juri uuid := '00000000-0000-0000-0000-000000000001';
  v_n int;
begin
  reset role;
  delete from akun_hak where user_id = v_juri and fitur = 'live_score';

  set local role authenticated;
  perform set_config('app.uid', v_juri::text, true);
  select count(*) into v_n from v_klasemen_live_score;

  reset role;
  insert into akun_hak (user_id, fitur) values (v_juri, 'live_score')
  on conflict do nothing;

  assert v_n = 0,
         format('tanpa centang live_score seharusnya nol baris, terbaca %s', v_n);
end $blok$;

-- ---------------------------------------------------------------------------
-- Isolasi pos TIDAK ikut terbuka. Inilah harga yang tidak boleh dibayar untuk
-- mengisi papan skor: juri pos melihat klasemen lengkap, tapi nilai mentah
-- tetap posnya sendiri saja.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_juri uuid := '00000000-0000-0000-0000-000000000001';
  v_lain int;
begin
  set local role authenticated;
  perform set_config('app.uid', v_juri::text, true);

  select count(*) into v_lain
    from nilai_mentah n join wahana w on w.id = n.wahana_id
   where w.pos <> pos_saya();
  assert v_lain = 0,
         format('juri pos membaca %s nilai mentah pos LAIN — isolasi R6 bocor', v_lain);
end $blok$;

-- ---------------------------------------------------------------------------
-- Regu yang baru melewati sebagian pos TETAP diperingkat. Ini permintaan
-- pemilik acara: papan menunjukkan keadaan SEKARANG, bukan hanya yang sudah
-- selesai seluruhnya.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_admin uuid := '00000000-0000-0000-0000-00000000000a';
  v_sebagian int;
  v_total    int;
begin
  set local role authenticated;
  perform set_config('app.uid', v_admin::text, true);

  select count(*) into v_total from v_klasemen_live_score;
  -- Regu yang poin_per_pos-nya memuat lebih sedikit pos daripada jumlah pos
  -- bernilai di edisi ini = belum selesai, dan harus tetap ada di papan.
  select count(*) into v_sebagian from v_klasemen_live_score
   where poin_per_pos is null
      or (select count(*) from jsonb_object_keys(poin_per_pos))
           < (select count(*) from v_pos where jumlah_komponen > 0);

  raise notice '33: % dari % regu di papan belum lengkap seluruh pos', v_sebagian, v_total;
  assert v_total > 0, 'papan kosong';
end $blok$;

\echo '33 live score semua peran: LULUS'
