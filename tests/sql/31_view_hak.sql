-- ============================================================================
-- hrcd-rekap : tests/sql/31_view_hak.sql
-- View ikut menghormati boleh(), dan isolasi per pos benar-benar mengisolasi
-- (migrasi 0065).
--
-- KENAPA TES 30 TIDAK MENANGKAP INI
--
-- Tes 30 memindai `pg_policies` dan `pg_proc`, persis seperti pemeriksaan
-- penutup 0064 — dan VIEW bukan keduanya. Enam view lolos tanpa disebut.
-- Pemeriksaan yang cakupannya lebih sempit daripada masalahnya bukan cuma
-- gagal menemukan: ia MENGHENTIKAN pencarian, karena laporannya hijau.
--
-- ARAH KEBOCORANNYA BERLAWANAN DENGAN YANG DI 0064
--
-- Yang di 0064 mengunci. Yang di sini MEMBUKA:
--
--     and (peran() <> 'operator_pos' or p.nomor = pos_saya())
--
-- Untuk juri pos, ruas kirinya true, jadi pembatas posnya tidak pernah
-- diperiksa. Satu tes yang cuma memastikan "juri pos bisa melihat lembarnya"
-- akan lulus dengan gembira sambil membiarkan ia melihat lembar pos lain.
-- Karena itu tes di bawah memeriksa DUA hal: yang terlihat, dan yang TIDAK
-- boleh terlihat.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Isolasi per pos — R6 di rancangan-b.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_juri     uuid := '00000000-0000-0000-0000-000000000001';  -- pos 1
  v_pos_lain int;
  v_pos_ada  int;
begin
  set local role authenticated;
  perform set_config('app.uid', v_juri::text, true);

  select count(*) into v_pos_ada   from v_lembar_pos where pos = pos_saya();
  select count(*) into v_pos_lain  from v_lembar_pos where pos <> pos_saya();

  assert v_pos_lain = 0,
         format('juri pos melihat %s baris lembar pos LAIN — isolasi bocor', v_pos_lain);
  -- Baris posnya sendiri boleh nol kalau fixture-nya memang kosong; yang
  -- dijaga tes ini kebocorannya, dan itu sudah dijaga assert di atas.

  select count(*) into v_pos_lain from v_monitoring_input where pos <> pos_saya();
  assert v_pos_lain = 0,
         format('juri pos melihat kemajuan %s pos LAIN', v_pos_lain);
end $blok$;

-- ---------------------------------------------------------------------------
-- 2. Rekapitulasi: haknya lewat centang, bukan lewat nama peran.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_admin uuid := '00000000-0000-0000-0000-00000000000a';
  v_juri  uuid := '00000000-0000-0000-0000-000000000001';
  v_admin_lihat int;
  v_juri_lihat  int;
  v_setelah     int;
begin
  set local role authenticated;

  perform set_config('app.uid', v_admin::text, true);
  select count(*) into v_admin_lihat from v_rekap_penuh;
  assert v_admin_lihat > 0, 'admin seharusnya melihat rekap';

  -- Juri pos tidak punya centang rekap.
  perform set_config('app.uid', v_juri::text, true);
  select count(*) into v_juri_lihat from v_rekap_penuh;
  assert v_juri_lihat = 0,
         format('juri pos seharusnya tidak melihat rekap, terlihat %s', v_juri_lihat);

  -- Beri centangnya: sekarang terlihat. Inilah yang membedakan "hak lewat
  -- centang" dari "hak lewat nama peran" — perannya tidak berubah sama sekali.
  reset role;
  insert into akun_hak (user_id, fitur) values (v_juri, 'rekap') on conflict do nothing;
  set local role authenticated;
  perform set_config('app.uid', v_juri::text, true);
  select count(*) into v_setelah from v_rekap_penuh;

  reset role;
  delete from akun_hak where user_id = v_juri and fitur = 'rekap';

  assert v_setelah = v_admin_lihat,
         format('dengan centang rekap seharusnya %s baris, terlihat %s',
                v_admin_lihat, v_setelah);
end $blok$;

-- ---------------------------------------------------------------------------
-- 3. N+1 hilang, dan hasilnya TIDAK berubah.
--
--    Yang dijaga di sini bukan kecepatannya — itu tidak stabil di CI — tapi
--    kesamaan hasilnya. Optimasi yang mengubah isi adalah bug, dan `coalesce`
--    yang pindah dari subquery ke join adalah tempat paling mungkin isinya
--    berubah: regu tanpa nilai sama sekali harus tetap dapat '{}', bukan NULL.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_admin  uuid := '00000000-0000-0000-0000-00000000000a';
  v_null   int;
  v_kosong int;
begin
  set local role authenticated;
  perform set_config('app.uid', v_admin::text, true);

  select count(*) into v_null from v_rekap_penuh
   where nilai is null or poin_pos is null;
  assert v_null = 0,
         format('%s baris ber-nilai/poin_pos NULL — coalesce hilang saat pindah ke join', v_null);

  select count(*) into v_kosong from v_rekap_penuh where nilai = '{}'::jsonb;
  raise notice '31: % regu belum punya nilai sama sekali (wajar, bukan galat)', v_kosong;
end $blok$;

-- ---------------------------------------------------------------------------
-- 4. Pemindaian katalog, kali ini termasuk pg_views.
-- ---------------------------------------------------------------------------
do $blok$
declare r record; v_n int := 0;
begin
  for r in
    select 'policy'::text as jenis,
           schemaname || '.' || tablename || '.' || policyname as nama
      from pg_policies
     where coalesce(qual, '') || coalesce(with_check, '') ~ '''meja''|''operator_pos'''
    union all
    select 'fungsi', p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosrc ~ '''meja''|''operator_pos'''
       and p.proname <> 'paket_peran'
    union all
    select 'view', v.viewname
      from pg_views v
     where v.schemaname = 'public' and v.definition ~ '''meja''|''operator_pos'''
  loop
    v_n := v_n + 1;
    raise notice '31: MASIH menyebut peran lama — % %', r.jenis, r.nama;
  end loop;
  assert v_n = 0, format('%s objek masih menyebut peran lama', v_n);
end $blok$;

\echo '31 view hak: LULUS'
