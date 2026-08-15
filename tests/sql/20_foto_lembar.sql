-- ============================================================================
-- hrcd-rekap : tests/sql/20_foto_lembar.sql
-- Foto slip penilaian (0047).
--
-- Yang dijaga: pagarnya ada di SERVER, bukan di layar. Gambar diunggah langsung
-- dari browser ke Storage, jadi path-nya datang dari JavaScript — dan apa pun
-- yang datang dari JavaScript bisa dikarang. Yang harus menolak path karangan
-- adalah database.
--
-- Yang TIDAK diuji di sini: policy storage.objects itu sendiri, karena
-- storage.objects tidak ada di Postgres lokal. Pagarnya karena itu dipasang
-- dua kali — sekali di bucket, sekali di catat_foto_lembar — dan yang kedua
-- inilah yang bisa diuji.
-- ============================================================================

-- Dicari SEBELUM `set role`, selagi masih boleh membaca akun_panitia utuh.
create temp table t_op as
select user_id as uid, pos from akun_panitia
where peran = 'operator_pos' and is_active and pos is not null
order by pos limit 1;

create temp table t_regu as
select id, nomor_dada from regu
where nomor_dada is not null and not is_cancelled
order by nomor_dada limit 1;

-- Tabel sementara di atas dibuat SEBAGAI PEMILIK, lalu dibaca sebagai
-- `authenticated` di bawah — dan tabel temp tidak mewarisi hak apa pun.
-- Tanpa grant ini seluruh berkas berhenti di "permission denied for table
-- t_regu", galat yang tidak ada hubungannya dengan apa yang sedang diuji.
grant select on t_op, t_regu to public;

select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

-- ---------------------------------------------------------------------------
-- 20.1  Admin mencatat foto, barisnya mendarat di regu yang benar.
-- ---------------------------------------------------------------------------
do $$
declare v_dada integer; v_regu uuid; v_ada integer;
begin
  select nomor_dada, id into v_dada, v_regu from t_regu;

  perform catat_foto_lembar(v_dada, 1::smallint, 'uji-lomba', 'Uji Lomba',
                            'pos1/uji-lomba/uji-a.jpg', 71234);

  select count(*) into v_ada from foto_lembar
  where path = 'pos1/uji-lomba/uji-a.jpg' and regu_id = v_regu;
  assert v_ada = 1, 'foto tidak tercatat / regu salah';

  raise notice '20.1 OK — foto tercatat.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 20.2  Path di luar folder posnya DITOLAK.
--
-- Ini kebocoran yang paling mudah terjadi dan paling sulit dilihat: baris
-- tercatat sebagai milik Pos 1, gambarnya sebenarnya di folder Pos 3. Yang
-- membaca daftar foto Pos 1 kemudian melihat kertas pos lain, dan mengira
-- itulah slip regu tersebut.
-- ---------------------------------------------------------------------------
do $$
declare v_dada integer; v_tolak boolean := false;
begin
  select nomor_dada into v_dada from t_regu;
  begin
    perform catat_foto_lembar(v_dada, 1::smallint, 'uji-lomba', 'Uji Lomba',
                              'pos3/uji-lomba/nyasar.jpg', 1000);
    raise exception 'GAGAL: path pos3 diterima sebagai foto pos 1';
  exception
    when others then
      if sqlerrm like 'GAGAL:%' then raise; end if;
      v_tolak := true;
  end;
  assert v_tolak, 'path lintas pos tidak ditolak';
  raise notice '20.2 OK — path lintas pos ditolak.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 20.3  Mengirim ulang path yang sama BUKAN galat, dan tidak menggandakan.
--
-- Jaringan lapangan memutus JAWABAN, bukan permintaan. Petugas yang menekan
-- "kirim ulang" setelah unggahan yang sebenarnya berhasil tidak melakukan
-- kesalahan apa pun, dan tidak boleh melihat pesan merah.
-- ---------------------------------------------------------------------------
do $$
declare v_dada integer; v_ada integer;
begin
  select nomor_dada into v_dada from t_regu;
  perform catat_foto_lembar(v_dada, 1::smallint, 'uji-lomba', 'Uji Lomba',
                            'pos1/uji-lomba/uji-a.jpg', 71234);
  select count(*) into v_ada from foto_lembar
  where path = 'pos1/uji-lomba/uji-a.jpg';
  assert v_ada = 1, 'kiriman ulang menggandakan barisnya';
  raise notice '20.3 OK — kiriman ulang tidak menggandakan.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 20.4  Operator pos tidak boleh mencatat foto pos lain, dan tidak boleh
--       MELIHAT foto pos lain.
-- ---------------------------------------------------------------------------
do $$
declare
  v_dada integer; v_uid uuid; v_pos smallint;
  v_lain smallint; v_tolak boolean := false; v_lihat integer;
begin
  select nomor_dada into v_dada from t_regu;
  select uid, pos into v_uid, v_pos from t_op;
  if v_uid is null then
    raise notice '20.4 DILEWATI — tidak ada akun operator_pos aktif.';
    return;
  end if;
  v_lain := case when v_pos = 1 then 2 else 1 end;

  perform set_config('app.uid', v_uid::text, false);

  begin
    perform catat_foto_lembar(v_dada, v_lain, 'uji-lomba', 'Uji Lomba',
                              'pos' || v_lain::text || '/uji-lomba/curi.jpg', 1000);
    raise exception 'GAGAL: operator pos % mencatat foto pos %', v_pos, v_lain;
  exception
    when others then
      if sqlerrm like 'GAGAL:%' then raise; end if;
      v_tolak := true;
  end;
  assert v_tolak, 'operator pos lain tidak ditolak';

  -- Foto 20.1 ada di Pos 1. Operator pos selain 1 tidak boleh melihatnya.
  if v_pos <> 1 then
    select count(*) into v_lihat from foto_lembar
    where path = 'pos1/uji-lomba/uji-a.jpg';
    assert v_lihat = 0, 'operator pos ' || v_pos || ' bisa melihat foto pos 1';
  end if;

  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
  raise notice '20.4 OK — operator pos terkurung di posnya.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Bersih-bersih. Barisnya dibuang dari akar ke daun seperti tes lain — tanpa
-- ini hitungan tes berikutnya ikut bergeser.
-- ---------------------------------------------------------------------------
reset role;
delete from foto_lembar where kode_lomba = 'uji-lomba';
drop table if exists t_op;
drop table if exists t_regu;
