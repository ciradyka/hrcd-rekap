-- ============================================================================
-- hrcd-rekap : tests/sql/35_detail_live_score_panitia.sql
-- Rincian Live Score terbaca semua panitia (migrasi 0069).
--
-- Yang dijaga: baris rekap TERBACA dari kursi juri pos dan gerbang, bukan
-- cuma admin. Sebelum 0069 keduanya mendapat nol baris — kolom Semaphore,
-- Tebak Simpul, dan Menaksir kosong di layar mereka sementara kolom NILAI
-- terisi, dan itu terbaca seperti nilainya hilang.
--
-- Sekaligus arah sebaliknya: yang TIDAK memegang live_score tetap tidak
-- melihat apa pun.
-- ============================================================================

do $blok$
declare
  v_admin uuid := '00000000-0000-0000-0000-00000000000a';
  v_juri  uuid := '00000000-0000-0000-0000-000000000001';
  v_a int; v_j int;
begin
  set local role authenticated;

  perform set_config('app.uid', v_admin::text, true);
  select count(*) into v_a from v_rekap_penuh;
  assert v_a > 0, 'fixture kosong — tes ini tidak menguji apa pun';

  perform set_config('app.uid', v_juri::text, true);
  select count(*) into v_j from v_rekap_penuh;
  assert v_j = v_a,
         format('juri pos melihat %s baris rekap, admin %s', v_j, v_a);
end $blok$;

do $blok$
declare
  v_juri uuid := '00000000-0000-0000-0000-000000000001';
  v_n int;
begin
  reset role;
  delete from akun_hak where user_id = v_juri and fitur in ('live_score', 'rekap');

  set local role authenticated;
  perform set_config('app.uid', v_juri::text, true);
  select count(*) into v_n from v_rekap_penuh;

  reset role;
  insert into akun_hak (user_id, fitur) values (v_juri, 'live_score')
  on conflict do nothing;

  assert v_n = 0,
         format('tanpa live_score maupun rekap seharusnya nol baris, terbaca %s', v_n);
end $blok$;

-- Menulis nilai TETAP terkunci ke pos sendiri. Membaca dibuka, mengubah
-- tidak — dan itu batas yang tidak boleh ikut hilang.
do $blok$
declare
  v_juri  uuid := '00000000-0000-0000-0000-000000000001';
  v_pesan text;
begin
  perform set_config('app.uid', v_juri::text, true);
  begin
    perform simpan_nilai_massal(
      jsonb_build_array(jsonb_build_object(
        'nomor_dada', 999, 'kode', 'apa_saja', 'nilai_1', 1)),
      'manual', 5::smallint);
    v_pesan := '(lolos)';
  exception when others then v_pesan := sqlerrm;
  end;
  assert v_pesan not like '%tidak berhak%',
         format('juri pos kehilangan hak menulis posnya sendiri: %s', v_pesan);
end $blok$;

\echo '35 detail live score panitia: LULUS'
