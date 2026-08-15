-- ============================================================================
-- hrcd-rekap : tests/sql/22_nama_tanpa_angka.sql
-- Nama regu, nama ketua, dan nama contact person tanpa angka (0052).
--
-- Yang dijaga: yang ditolak HANYA digit. Aturan yang ikut menolak titik atau
-- apostrof akan menolak lebih banyak nama asli daripada kekeliruan yang
-- dicegahnya, dan itu ditemukan di meja pendaftaran saat antrean mengular.
-- ============================================================================

create temp table t_daftar as select id from pendaftaran limit 1;

do $$
declare v_d uuid; v_tolak boolean;
begin
  select id into v_d from t_daftar;

  -- Nama regu berangka ditolak.
  v_tolak := false;
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    values (v_d, 'Uji Regu 1', 'Uji Angka', 'penegak_pa');
    raise exception 'GAGAL: nama regu berangka diterima';
  exception when others then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true;
  end;
  assert v_tolak, 'nama regu berangka tidak ditolak';

  -- Nama ketua berangka ditolak.
  v_tolak := false;
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    values (v_d, 'Uji Regu Bebas', '08123456789', 'penegak_pa');
    raise exception 'GAGAL: nama ketua berangka diterima';
  exception when others then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true;
  end;
  assert v_tolak, 'nama ketua berangka tidak ditolak';

  raise notice '22.1 OK — nama berangka ditolak.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 22.2  Tanda baca dalam nama asli TETAP diterima. Inilah bagian yang mudah
--       dirusak kalau suatu hari aturannya diperketat jadi "hanya huruf".
-- ---------------------------------------------------------------------------
do $$
declare v_d uuid; v_ada integer;
begin
  select id into v_d from t_daftar;
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  values (v_d, 'Uji Ma''ruf-Aini', 'Nur Aisyah binti H. Abdul', 'penegak_pi');

  select count(*) into v_ada from regu where nama_regu = 'Uji Ma''ruf-Aini';
  assert v_ada = 1, 'nama dengan apostrof/titik/tanda hubung ikut ditolak';
  raise notice '22.2 OK — titik, apostrof, dan tanda hubung tetap boleh.';
end;
$$;

delete from regu where nama_regu like 'Uji %';
drop table if exists t_daftar;
