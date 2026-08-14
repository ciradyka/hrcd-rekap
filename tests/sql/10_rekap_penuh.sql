-- ============================================================================
-- hrcd-rekap : tests/sql/10_rekap_penuh.sql
-- Lembar Rekapitulasi panitia (v_rekap_penuh, migrasi 0027).
--
-- Dua hal yang diuji, dan keduanya soal yang sama: layar ini menampilkan
-- ANGKA AKHIR, jadi ia hanya boleh dibuka oleh orang yang bisa melihat
-- SELURUH bahannya.
--
--   1. Operator pos mendapat NOL BARIS. Bukan tampilan sempit — kalau ia
--      diberi baris, RLS memotong nilai_mentah pos lain dan Nilai Total-nya
--      mengecil tanpa satu pun galat. Total yang salah lebih berbahaya
--      daripada layar yang menolak dibuka.
--
--   2. Angkanya sama persis dengan mesin skor yang sudah ada. View ini tidak
--      boleh menghitung apa pun sendiri; kalau suatu hari ia menyimpang dari
--      v_poin_pos / v_total_skor / v_klasemen, ada dua mesin skor di sistem
--      ini dan salah satunya berbohong.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 10.1 Admin melihat seluruh regu.
-- ---------------------------------------------------------------------------
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

-- Pembandingnya dibaca dari tabel dasar DI DALAM peran yang sama — admin
-- memang boleh membaca regu dan pendaftaran. Berpindah peran di tengah blok
-- plpgsql sengaja dihindari: itu bukan yang sedang diuji, dan blok yang
-- separuhnya berjalan sebagai orang lain sulit dibaca ulang setahun lagi.
do $$
declare v_admin int; v_semua int;
begin
  select count(*) into v_admin from v_rekap_penuh;
  select count(*) into v_semua
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled and d.status = 'lunas';
  assert v_admin > 0, 'admin tidak melihat satu baris pun di rekap';
  assert v_admin = v_semua,
    format('admin melihat %s regu, seharusnya %s', v_admin, v_semua);
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.2 Meja juga boleh — ia memang sudah boleh membaca seluruh nilai_mentah
--      (policy sel_nilai), jadi totalnya utuh.
-- ---------------------------------------------------------------------------
select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;

do $$
begin
  assert (select count(*) from v_rekap_penuh) > 0, 'akun meja tidak melihat apa pun';
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.3 Operator pos: NOL BARIS. Inilah pagarnya.
-- ---------------------------------------------------------------------------
reset role;
select set_config('app.uid', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;

do $$
begin
  assert (select count(*) from v_rekap_penuh) = 0,
    'operator pos mendapat baris rekap — Nilai Total-nya pasti salah, '
    'karena RLS memotong nilai_mentah pos lain';
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.4 Angkanya sama dengan mesin skor yang sudah ada — tidak ada mesin kedua.
-- ---------------------------------------------------------------------------
reset role;
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

do $$
declare r record; v_beda int;
begin
  -- Nilai Pos per pos harus identik dengan v_poin_pos, kunci demi kunci.
  select count(*) into v_beda
  from v_rekap_penuh k
  join lateral jsonb_each_text(k.poin_pos) e(pos, poin) on true
  left join v_poin_pos pp
         on pp.regu_id = k.regu_id and pp.pos = e.pos::smallint
  where pp.poin_pos is null
     or round(pp.poin_pos, 2) <> round(e.poin::numeric, 2);
  assert v_beda = 0,
    format('%s Nilai Pos di rekap tidak sama dengan v_poin_pos', v_beda);

  -- Total, penalti, dan peringkat diambil, bukan dihitung ulang.
  select count(*) into v_beda
  from v_rekap_penuh k
  join v_total_skor t on t.regu_id = k.regu_id
  where k.total <> t.total
     or k.total_pos <> t.total_pos
     or k.penalti_checkout <> t.penalti_checkout
     or k.penalti_anggota <> t.penalti_anggota;
  assert v_beda = 0,
    format('%s baris rekap berbeda angka dengan v_total_skor', v_beda);

  select count(*) into v_beda
  from v_rekap_penuh k
  join v_klasemen kl on kl.regu_id = k.regu_id
  where k.peringkat is distinct from kl.peringkat;
  assert v_beda = 0,
    format('%s peringkat di rekap berbeda dengan v_klasemen', v_beda);

  -- Regu yang belum berangkat tetap muncul, hanya tanpa peringkat: sepanjang
  -- lomba sebagian besar baris memang begitu, dan membuangnya akan membuat
  -- papan ini kosong justru saat paling dibutuhkan.
  select * into r from v_rekap_penuh where peringkat is null limit 1;
  if found then
    assert not r.sudah_berangkat or r.jam_berangkat is null,
      format('regu %s tidak berperingkat padahal kloternya sudah berangkat',
             r.nomor_dada);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10.5 Nilai mentah SELURUH pos ada di satu baris, berkunci "<pos>.<kode>".
--      Awalan nomor pos itu bukan hiasan: `wahana.kode` hanya unik per
--      (edisi, pos), jadi dua pos yang memakai kode sama akan saling menimpa
--      kalau kuncinya cuma kodenya.
-- ---------------------------------------------------------------------------
do $$
declare v_baris record; v_harus int; v_ada int;
begin
  select * into v_baris from v_rekap_penuh
  where nilai <> '{}'::jsonb
  order by nomor_dada
  limit 1;
  assert found, 'tidak ada satu pun baris rekap yang memuat nilai mentah';

  select count(*) into v_harus
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  where n.regu_id = v_baris.regu_id and w.edisi = edisi_aktif();
  select count(*) into v_ada from jsonb_object_keys(v_baris.nilai);
  assert v_ada = v_harus,
    format('regu %s punya %s nilai mentah tapi rekap memuat %s',
           v_baris.nomor_dada, v_harus, v_ada);

  assert (select bool_and(k ~ '^[0-9]+\.[a-z0-9_]+$')
          from jsonb_object_keys(v_baris.nilai) k),
    'kunci nilai tidak berbentuk "<pos>.<kode>": '
    || (select string_agg(k, ', ') from jsonb_object_keys(v_baris.nilai) k);
end;
$$;

reset role;
select '10_rekap_penuh OK' as hasil;
