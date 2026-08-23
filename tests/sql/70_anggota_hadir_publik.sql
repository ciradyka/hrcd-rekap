-- ============================================================================
-- hrcd-rekap : tests/sql/70_anggota_hadir_publik.sql
-- Kolom perjalanan halaman peserta: lengkap, dan TIDAK ikut dipagari fase.
--
-- Yang dijaga di sini pembagian yang gampang tertukar: `nilai` dan `poin`
-- adalah HASIL LOMBA dan menunggu fase `penuh`; kelima kolom perjalanan
-- adalah CATATAN dan terbit sejak `progres`. Memagari yang kedua akan
-- mengosongkan kolom Anggota justru pada fase ketika peserta paling sering
-- memeriksa apakah regunya sudah tercatat sampai.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

select set_config('app.uid', (select user_id::text from akun_panitia
                              where peran = 'admin' and is_active limit 1), true);

do $$
declare
  v_asal   text;
  v_regu   uuid;
  v_isi    int;
  v_poin   int;
begin
  select fase_live into v_asal from status_acara;

  -- Satu regu yang sudah dinilai DAN sudah closing, diberi nomor dada supaya
  -- ia masuk papan peserta. Ketiga kolom kloter dipasang bersama: `regu_check`
  -- menuntut nomor_dada dan kloter_nomor sama-sama terisi, `regu_check1`
  -- menuntut hal yang sama untuk urutan_kloter.
  select r.id into v_regu
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  join closing_regu c on c.regu_id = r.id
  where not r.is_cancelled and d.status = 'lunas' and r.nomor_dada is null
  limit 1;

  if v_regu is null then
    raise notice '70 dilewati: tidak ada regu closing tanpa nomor dada di titik ini.';
    return;
  end if;

  update regu set
    nomor_dada = (select max(s.nomor) from nomor_dada_stok s
                  where not exists (select 1 from regu r2
                                    where r2.nomor_dada = s.nomor)),
    kloter_nomor = 1,
    urutan_kloter = slot_kloter_berikutnya(1::smallint)
  where id = v_regu;

  -- 70.1 Di fase `progres`, catatan perjalanan ADA sementara hasil lomba TIDAK.
  update status_acara set fase_live = 'progres' where fase_live is not null;

  select count(*) into v_isi from v_progres_publik
  where nomor_dada = (select nomor_dada from regu where id = v_regu)
    and anggota_hadir is not null;
  assert v_isi = 1,
    '70.1: anggota_hadir kosong di fase progres — kolom Anggota akan kosong '
    'justru saat peserta paling sering memeriksanya';

  select count(*) into v_poin from v_progres_publik where poin <> '{}'::jsonb;
  assert v_poin = 0,
    format('70.1: %s baris membawa poin di fase progres — hasil bocor', v_poin);

  -- 70.2 Kelima kolom perjalanan terisi untuk regu yang memang sudah menjalaninya.
  select count(*) into v_isi from v_progres_publik
  where nomor_dada = (select nomor_dada from regu where id = v_regu)
    and kloter is not null;
  assert v_isi = 1, '70.2: kloter tidak ikut terbit ke halaman peserta';

  update status_acara set fase_live = v_asal where fase_live is not null;
end $$;

-- 70.3 Bentuk kolomnya, dibaca dari katalog — supaya penulisan ulang view
--      berikutnya tidak diam-diam menjatuhkan salah satunya.
do $$
declare v_kurang text;
begin
  select string_agg(k, ', ' order by k) into v_kurang
  from unnest(array['kloter', 'kontrak_menit', 'jam_berangkat', 'jam_datang',
                    'anggota_hadir', 'nilai', 'poin']) k
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'v_progres_publik'
      and column_name = k);
  assert v_kurang is null,
    format('70.3: v_progres_publik kehilangan kolom: %s', v_kurang);
end $$;

select '70_anggota_hadir_publik OK' as hasil;

rollback;
