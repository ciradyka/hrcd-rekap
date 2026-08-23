-- ============================================================================
-- hrcd-rekap : tests/sql/02_constraints.sql
-- Bukti tahap 1 (rancangan-b.md 13): constraint menegakkan kebenaran data.
-- Setiap blok gagal = RAISE EXCEPTION = psql keluar dengan error
-- (ON_ERROR_STOP di runner).
-- ============================================================================

\echo '== 02: constraint =='

-- 2.1 Nomor dada ganda MUSTAHIL.
do $$
declare
  v_batch uuid; v_r1 uuid; v_r2 uuid;
begin
  insert into sekolah (name, address) values ('SMP Uji Constraint', 'Jl. Uji 1')
  returning id into strict v_batch;  -- dipakai ulang sbg penampung sementara
  insert into pendaftaran (sekolah_id, kode_pembayaran, jumlah_regu, kontak_wa)
  values (v_batch, 'UJI-DUP', 2, '0812xxxx') returning id into strict v_batch;
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, nomor_dada, kloter_nomor, urutan_kloter)
  values (v_batch, 'Uji A', 'Ketua A', 'penegak_pa', 401, 39, 1) returning id into v_r1;

  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, nomor_dada, kloter_nomor, urutan_kloter)
    values (v_batch, 'Uji B', 'Ketua B', 'penegak_pa', 401, 39, 2);
    raise exception 'GAGAL: nomor dada ganda diterima';
  exception when unique_violation then
    null;  -- yang diharapkan
  end;
end;
$$;

-- 2.2 Kapasitas kloter: urutan ke-11 tertolak CHECK; urutan kembar tertolak
--     UNIQUE (kloter, urutan).
do $$
declare v_batch uuid;
begin
  select p.id into v_batch from pendaftaran p where kode_pembayaran = 'UJI-DUP';

  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, nomor_dada, kloter_nomor, urutan_kloter)
    values (v_batch, 'Uji C', 'Ketua C', 'penegak_pa', 402, 39, 11);
    raise exception 'GAGAL: urutan kloter 11 diterima';
  exception when check_violation then null;
  end;

  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, nomor_dada, kloter_nomor, urutan_kloter)
    values (v_batch, 'Uji D', 'Ketua D', 'penegak_pa', 403, 39, 1);
    raise exception 'GAGAL: urutan kloter kembar diterima';
  exception when unique_violation then null;
  end;
end;
$$;

-- 2.3 Nomor dada dan kloter lahir bersama.
do $$
declare v_batch uuid;
begin
  select p.id into v_batch from pendaftaran p where kode_pembayaran = 'UJI-DUP';
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, nomor_dada)
    values (v_batch, 'Uji E', 'Ketua E', 'penegak_pa', 404);
    raise exception 'GAGAL: nomor dada tanpa kloter diterima';
  exception when check_violation then null;
  end;
end;
$$;

-- 2.4 Konfigurasi salah bentuk tertolak sejak insert.
do $$
begin
  begin
    insert into wahana (edisi, pos, kode, name, type, form, poin_maks,
                        rentang_mentah_min, rentang_mentah_maks)
    values (37, 1, 'salah_param', 'Tanpa Raw', 'wahana', 'kecil_baik', 100, 0, 10);
    raise exception 'GAGAL: kecil_baik tanpa raw_terbaik/terburuk diterima';
  exception when check_violation then null;
  end;

  begin
    insert into wahana (edisi, pos, kode, name, type, form, poin_maks,
                        poin_benar, poin_salah, rentang_mentah_min, rentang_mentah_maks)
    values (37, 1, 'Kode Spasi!', 'Kode Jelek', 'wahana', 'biner', 10, 10, 0, 0, 1);
    raise exception 'GAGAL: kode berspasi diterima';
  exception when check_violation then null;
  end;
end;
$$;

-- 2.5 Tepat satu edisi aktif.
do $$
begin
  begin
    insert into edisi (nomor, name, tahun, tanggal_lomba, biaya_per_regu, is_active)
    values (38, 'HRCD 38', 2028, date '2028-02-20', 275000, true);
    raise exception 'GAGAL: dua edisi aktif diterima';
  exception when unique_violation then null;
  end;
end;
$$;

-- 2.6 Kunci konfigurasi hari-H menolak SEMUA tulisan ke tabel konfigurasi —
--     termasuk superuser konteks tes — sampai dibuka lagi.
do $$
declare
  v_tolak boolean := false;
begin
  assert exists (select 1 from wahana where kode = 'lari_zigzag'),
         'fixture lari_zigzag tidak ada; tes kunci konfigurasi akan kosong';
  update status_acara set konfigurasi_terkunci = true;
  begin
    update wahana set poin_maks = 999 where kode = 'lari_zigzag';
    raise exception 'GAGAL: edit konfigurasi tembus saat terkunci';
  exception when others then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true;
  end;
  assert v_tolak, 'kunci konfigurasi hari-H tidak menolak edit wahana';
  update status_acara set konfigurasi_terkunci = false;
  -- setelah dibuka, edit jalan lagi
  update wahana set poin_maks = poin_maks where kode = 'lari_zigzag';
end;
$$;

-- 2.7 akun_panitia: operator_pos wajib punya pos, peran lain wajib tidak.
do $$
begin
  begin
    insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000e1');
    insert into akun_panitia (user_id, username, peran, pos)
    values ('00000000-0000-0000-0000-0000000000e1', 'ops_tanpa_pos', 'operator_pos', null);
    raise exception 'GAGAL: operator_pos tanpa pos diterima';
  exception when check_violation then null;
  end;
end;
$$;

-- Bersihkan artefak tes constraint.
delete from regu where nama_regu like 'Uji %';
delete from pendaftaran where kode_pembayaran = 'UJI-DUP';
delete from sekolah where name = 'SMP Uji Constraint';

\echo '== 02: OK =='
