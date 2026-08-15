-- ============================================================================
-- hrcd-rekap : tests/sql/21_nama_regu_unik.sql
-- Nama regu maksimal 20 karakter dan unik seluruh edisi (0051).
--
-- Yang dijaga: penjaganya DATABASE, bukan form. Form pendaftaran memeriksa
-- sambil diketik supaya pembina tahu lebih awal, tapi dua sekolah bisa
-- menekan Kirim pada detik yang sama dari dua HP — dan yang memutuskan siapa
-- yang mendapat nama itu hanya indeks unik.
-- ============================================================================

create temp table t_daftar as
select id from pendaftaran limit 1;

-- ---------------------------------------------------------------------------
-- 21.1  Lebih dari 20 karakter ditolak.
-- ---------------------------------------------------------------------------
do $$
declare v_d uuid; v_tolak boolean := false;
begin
  select id into v_d from t_daftar;
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    values (v_d, 'REGU DENGAN NAMA YANG KEPANJANGAN', 'Uji', 'penegak_pa');
    raise exception 'GAGAL: nama 33 huruf diterima';
  exception
    when others then
      if sqlerrm like 'GAGAL:%' then raise; end if;
      v_tolak := true;
  end;
  assert v_tolak, 'nama kepanjangan tidak ditolak';
  raise notice '21.1 OK — nama > 20 huruf ditolak.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 21.2  Nama kembar ditolak, dan huruf besar-kecil serta spasi beruntun
--       TIDAK menyelamatkan. Pembatas yang bisa dilewati dengan Caps Lock
--       bukan pembatas.
-- ---------------------------------------------------------------------------
do $$
declare v_d uuid; v_tolak boolean;
begin
  select id into v_d from t_daftar;
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  values (v_d, 'Uji Elang Satu', 'Uji', 'penegak_pa');

  -- persis sama
  v_tolak := false;
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    values (v_d, 'Uji Elang Satu', 'Uji', 'penegak_pi');
    raise exception 'GAGAL: nama persis sama diterima';
  exception when others then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true;
  end;
  assert v_tolak, 'nama persis sama tidak ditolak';

  -- beda huruf besar-kecil
  v_tolak := false;
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    values (v_d, 'UJI ELANG SATU', 'Uji', 'penegak_pi');
    raise exception 'GAGAL: nama beda kapital diterima';
  exception when others then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true;
  end;
  assert v_tolak, 'kapital berbeda lolos';

  -- spasi beruntun
  v_tolak := false;
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    values (v_d, 'Uji  Elang   Satu', 'Uji', 'penegak_pi');
    raise exception 'GAGAL: nama beda spasi diterima';
  exception when others then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true;
  end;
  assert v_tolak, 'spasi beruntun lolos';

  raise notice '21.2 OK — kembar ditolak, kapital dan spasi tidak menolong.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 21.3  nama_regu_dipakai() menjawab sama dengan indeksnya.
-- ---------------------------------------------------------------------------
do $$
begin
  assert nama_regu_dipakai('uji elang satu'), 'nama terpakai dilaporkan bebas';
  assert nama_regu_dipakai('  UJI   ELANG  SATU '), 'normalisasi tidak dipakai fungsi';
  assert not nama_regu_dipakai('Uji Nama Bebas'), 'nama bebas dilaporkan terpakai';
  raise notice '21.3 OK — fungsi dan indeks sepakat.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 21.4  Regu BATAL melepaskan namanya. Pendaftaran yang dibatalkan tidak
--       boleh menyandera satu kata selamanya.
-- ---------------------------------------------------------------------------
do $$
declare v_d uuid;
begin
  select id into v_d from t_daftar;
  update regu set is_cancelled = true where nama_regu = 'Uji Elang Satu';

  assert not nama_regu_dipakai('Uji Elang Satu'), 'nama regu batal masih terkunci';

  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  values (v_d, 'Uji Elang Satu', 'Uji', 'penegak_pi');
  raise notice '21.4 OK — nama regu batal bebas dipakai lagi.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Bersih-bersih.
-- ---------------------------------------------------------------------------
delete from regu where nama_ketua = 'Uji' and nama_regu like 'Uji %';
drop table if exists t_daftar;
