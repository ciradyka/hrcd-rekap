-- ============================================================================
-- hrcd-rekap : tests/sql/19_kunci_nilai.sql
-- Gembok nilai (0043 + 0044).
--
-- Yang dijaga: gembok itu PENJAGA, bukan hiasan layar. Kalau penolakannya cuma
-- ada di JavaScript, HP yang layarnya dimuat sebelum gemboknya dipasang tetap
-- bisa menulis — dan justru itu keadaan yang paling mungkin terjadi, karena
-- lembar pos memang dibuka di beberapa HP sekaligus.
-- ============================================================================

select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

-- ---------------------------------------------------------------------------
-- 19.1 Sesudah dikunci: menyimpan DITOLAK, menghapus DITOLAK.
-- ---------------------------------------------------------------------------
do $$
declare
  v_dada  integer; v_pos smallint; v_kode text; v_regu uuid;
  v_hasil jsonb;   v_gagal boolean := false;
begin
  select r.nomor_dada, w.pos, w.kode, r.id
    into strict v_dada, v_pos, v_kode, v_regu
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  join regu r   on r.id = n.regu_id
  where w.edisi = edisi_aktif() and r.nomor_dada is not null
  order by n.id limit 1;

  perform kunci_nilai_pos(v_dada, v_pos);
  assert nilai_tergembok(v_regu, v_pos), 'gembok tidak terpasang';

  -- Menyimpan: ditolak per baris, dengan alasan yang terbaca petugas.
  v_hasil := simpan_nilai_massal(
    jsonb_build_array(jsonb_build_object(
      'nomor_dada', v_dada, 'kode', v_kode, 'nilai_1', 1)), 'manual', v_pos);
  assert v_hasil -> 0 ->> 'status' = 'ditolak',
    'nilai masuk padahal barisnya tergembok';
  assert v_hasil -> 0 ->> 'alasan' like '%digembok%',
    format('alasan tidak menyebut gembok: %L', v_hasil -> 0 ->> 'alasan');

  -- Menghapus lewat pintu yang lain: harus ditolak juga. Dua jalur tulis, dua
  -- penolakan — kalau hanya satu yang dijaga, yang lain jadi pintu belakang.
  begin
    perform hapus_nilai_pos(v_dada, v_kode, v_pos);
    raise exception 'GAGAL: hapus lolos padahal barisnya tergembok';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_gagal := true;
  end;
  assert v_gagal, 'hapus tidak menolak';
end;
$$;

-- ---------------------------------------------------------------------------
-- 19.2 v_lembar_pos memberitahu layar — supaya petugas tahu SEBELUM mengetik.
-- ---------------------------------------------------------------------------
do $$
declare v_ada int;
begin
  select count(*) into v_ada from v_lembar_pos where terkunci;
  assert v_ada >= 1, 'v_lembar_pos tidak melaporkan baris yang tergembok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 19.3 MEMBUKA hanya admin, dan wajib beralasan.
-- ---------------------------------------------------------------------------
do $$
declare
  v_dada integer; v_pos smallint; v_regu uuid; v_tolak boolean := false;
begin
  select r.nomor_dada, k.pos, r.id into strict v_dada, v_pos, v_regu
  from nilai_terkunci k join regu r on r.id = k.regu_id limit 1;

  -- Alasan kosong ditolak walau yang meminta admin.
  begin
    perform buka_kunci_nilai_pos(v_dada, v_pos, '   ');
    raise exception 'GAGAL: gembok terbuka tanpa alasan';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true;
  end;
  assert v_tolak, 'alasan kosong tidak ditolak';
  assert nilai_tergembok(v_regu, v_pos), 'gembok terlanjur terbuka';

  -- Operator pos ditolak untuk pos ORANG LAIN (0045). Pagar posnya sama
  -- persis dengan aturan menguncinya.
  perform set_config('app.uid', '00000000-0000-0000-0000-000000000001', false);
  if v_pos <> pos_saya() then
    v_tolak := false;
    begin
      perform buka_kunci_nilai_pos(v_dada, v_pos, 'coba-coba');
      raise exception 'GAGAL: operator pos membuka gembok pos lain';
    exception when raise_exception then
      if sqlerrm like 'GAGAL:%' then raise; end if;
      v_tolak := true;
    end;
    assert v_tolak, 'operator pos pos lain tidak ditolak';
  end if;

  -- Dengan alasan: berhasil.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
  perform buka_kunci_nilai_pos(v_dada, v_pos, 'uji: dibuka kembali');
  assert not nilai_tergembok(v_regu, v_pos), 'gembok tidak terbuka';
end;
$$;

-- ---------------------------------------------------------------------------
-- 19.4 Akun TANPA peran ditolak (0046). Bukan kasus teoretis: itulah akun yang
--      sesinya masih sah tetapi barisnya sudah dicabut dari akun_panitia, dan
--      `null not in (...)` di PostgreSQL bernilai NULL — bukan true — sehingga
--      cabang penolakan versi 0045 tidak pernah jalan untuknya.
-- ---------------------------------------------------------------------------
do $$
declare v_dada integer; v_pos smallint; v_tolak boolean := false;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
  select r.nomor_dada, w.pos into strict v_dada, v_pos
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  join regu r on r.id = n.regu_id
  where w.edisi = edisi_aktif() and r.nomor_dada is not null limit 1;
  perform kunci_nilai_pos(v_dada, v_pos);

  -- uid yang tidak ada di akun_panitia sama sekali -> peran() NULL.
  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000ff', false);
  assert peran() is null, 'akun uji ternyata punya peran';
  begin
    perform buka_kunci_nilai_pos(v_dada, v_pos, 'harusnya ditolak');
    raise exception 'GAGAL: akun tanpa peran bisa membuka gembok';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true;
  end;
  assert v_tolak, 'akun tanpa peran tidak ditolak';

  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
  perform buka_kunci_nilai_pos(v_dada, v_pos, 'uji 19.4 selesai');
end;
$$;

-- ---------------------------------------------------------------------------
-- 19.5 Gembok ikut terhapus bersama regunya (0046), supaya pembersihan data
--      uji tidak gagal di baris `delete from regu`.
-- ---------------------------------------------------------------------------
do $$
declare v_aturan "char";
begin
  -- pg_constraint, BUKAN information_schema. Yang terakhir hanya memperlihatkan
  -- constraint pada tabel yang penggunanya punya hak — dan tes ini berjalan
  -- sebagai `authenticated`, jadi kueri-nya mengembalikan nol baris dan
  -- v_aturan tinggal NULL. Assert-nya lalu gagal dengan alasan yang keliru:
  -- seolah cascade tidak terpasang, padahal yang tidak ada cuma izin membaca
  -- katalognya. pg_catalog terbaca siapa pun.
  select c.confdeltype into v_aturan
  from pg_constraint c
  where c.conname = 'nilai_terkunci_regu_id_fkey';
  assert v_aturan = 'c',
    format('nilai_terkunci.regu_id confdeltype = %L, seharusnya c (cascade)',
           v_aturan);
end;
$$;

reset role;
select '19_kunci_nilai OK' as hasil;
