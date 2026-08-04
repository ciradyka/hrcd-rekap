-- ============================================================================
-- hrcd-rekap : 0007_kunci_daftar_ulang.sql
--
-- TEMUAN UJI KONKURENSI (tests/uji_konkurensi.py, skala 300 regu):
-- versi 0004 memakai `FOR UPDATE SKIP LOCKED` pada nomor_dada_stok, tetapi
-- yang menentukan sebuah nomor "sudah terpakai" bukan baris yang dikunci itu
-- melainkan tabel LAIN (regu.nomor_dada). Mengunci tabel A sambil memutuskan
-- berdasarkan tabel B adalah pola yang bocor: pada 30 meja serentak, dua
-- transaksi bisa sama-sama menganggap nomor yang sama masih kosong.
--
-- Akibat nyatanya di hari-H: constraint UNIQUE menahan datanya (tidak ada
-- nomor dada ganda yang lolos — itu bekerja persis seperti seharusnya), tetapi
-- SATU SEKOLAH GAGAL daftar ulang dengan pesan error teknis, dan operator
-- harus mengulang. Terukur: 290 dari 300 regu berhasil, 1-3 meja gagal per
-- putaran.
--
-- PERBAIKAN: seluruh bagian "pilih nomor + sebar kloter" diserialisasi dengan
-- satu advisory lock DI AWAL. Hanya satu meja berada di dalam bagian itu pada
-- satu saat; meja lain menunggu beberapa milidetik lalu jalan dengan keadaan
-- database yang sudah pasti mutakhir.
--
-- Kenapa serialisasi total dapat diterima di sini:
--   * Operasinya hanya beberapa milidetik, dan pesertanya 2-3 meja — bukan
--     ribuan transaksi per detik.
--   * Uji 30 meja serentak (skenario jauh lebih ekstrem dari kenyataan)
--     selesai tanpa antrean yang terasa.
--   * Jauh lebih mudah dipahami penerus daripada penalaran SKIP LOCKED lintas
--     tabel (CLAUDE.md bagian 6: kode yang jelas menang atas kode yang pintar).
-- ============================================================================

create or replace function daftar_ulang_batch(p_kode text)
returns table (regu_id uuid, nama_regu text, golongan text, nomor_dada integer, kloter smallint)
language plpgsql security definer
set search_path = public
as $$
declare
  v_batch      pendaftaran%rowtype;
  v_regu       uuid[];
  v_nomor      integer[];
  v_n          int;
  v_cfg        edisi%rowtype;
  v_terpakai   int[];
  v_kandidat   int;
  v_mulai      int;
  v_i          int;
  v_langkah    int;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if (select daftar_ulang_ditutup from status_acara) then
    raise exception 'daftar ulang sudah ditutup';
  end if;

  select * into v_cfg from edisi where aktif;

  select * into v_batch from pendaftaran where kode_pembayaran = p_kode for update;
  if not found then
    raise exception 'kode pembayaran tidak dikenal: %', p_kode;
  end if;
  if v_batch.status <> 'lunas' then
    raise exception 'batch belum lunas (status: %)', v_batch.status;
  end if;

  -- ===== GERBANG TUNGGAL =====
  -- Semua keputusan nomor dada + kloter terjadi setelah baris ini, jadi tidak
  -- ada dua meja yang pernah melihat keadaan stok yang sama. Lock dilepas
  -- otomatis saat transaksi selesai (commit maupun rollback).
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  -- Regu yang berhak: belum bernomor, tidak batal. Dibaca SETELAH gerbang,
  -- sehingga dua meja yang mengetik kode sama tidak sama-sama melihat "belum
  -- bernomor" (meja kedua akan melihat daftar kosong dan ditolak di bawah).
  select array_agg(r.id order by r.nama_regu, r.id) into v_regu
  from regu r
  where r.pendaftaran_id = v_batch.id
    and not r.batal and r.nomor_dada is null;
  v_n := coalesce(array_length(v_regu, 1), 0);
  if v_n = 0 then
    raise exception 'tidak ada regu yang menunggu nomor dada di batch ini (sudah daftar ulang, atau semua batal)';
  end if;

  -- Ambil N nomor terkecil yang tersedia. Tanpa SKIP LOCKED: gerbang di atas
  -- sudah menjamin hanya satu meja yang membaca stok pada satu saat, sehingga
  -- hasil baca ini pasti mutakhir.
  select array_agg(nomor order by nomor) into v_nomor
  from (
    select s.nomor from nomor_dada_stok s
    where not exists (select 1 from regu r where r.nomor_dada = s.nomor)
      and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor)
    order by s.nomor
    limit v_n
  ) ambil;
  if coalesce(array_length(v_nomor, 1), 0) < v_n then
    raise exception 'stok nomor dada kurang: butuh %, tersedia %',
      v_n, coalesce(array_length(v_nomor, 1), 0);
  end if;

  -- Kloter yang sudah berisi regu sekolah yang sama (batch mana pun).
  select coalesce(array_agg(distinct r.kloter_nomor), '{}') into v_terpakai
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where d.sekolah_id = v_batch.sekolah_id and r.kloter_nomor is not null;

  v_mulai := null;
  for v_i in 1..v_n loop
    v_kandidat := null;

    if v_mulai is null then
      v_langkah := 1;
    else
      v_langkah := v_cfg.lompatan_kloter;
    end if;

    -- Putaran 1: hormati lompatan + hindari sekolah sama, dalam 1..kloter_dasar.
    select k.nomor into v_kandidat
    from kloter k
    where k.nomor <= v_cfg.kloter_dasar
      and k.jam_berangkat is null
      and (v_mulai is null or k.nomor >= v_mulai + v_langkah)
      and not (k.nomor = any (v_terpakai))
      and (select count(*) from regu r where r.kloter_nomor = k.nomor)
          < v_cfg.maks_regu_per_kloter
    order by k.nomor
    limit 1;

    -- Putaran 2: masih hindari sekolah sama, abaikan lompatan (wrap).
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor <= v_cfg.kloter_dasar
        and k.jam_berangkat is null
        and not (k.nomor = any (v_terpakai))
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by k.nomor
      limit 1;
    end if;

    -- Putaran 3: kloter dasar masih ada tempat tapi semuanya berisi sekolah
    -- ini — berkumpul dulu sebelum membuka kloter cadangan (alur 5.2 & 5.4).
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor <= v_cfg.kloter_dasar
        and k.jam_berangkat is null
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (select count(*) from regu r where r.kloter_nomor = k.nomor), k.nomor
      limit 1;
    end if;

    -- Putaran 4: kloter dasar benar-benar penuh — buka cadangan.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor between v_cfg.kloter_dasar + 1 and v_cfg.kloter_maks
        and k.jam_berangkat is null
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (k.nomor = any (v_terpakai)),
               (select count(*) from regu r where r.kloter_nomor = k.nomor),
               k.nomor
      limit 1;
    end if;

    if v_kandidat is null then
      raise exception 'semua kloter penuh — tambah kloter atau periksa konfigurasi';
    end if;

    update regu r set
      nomor_dada    = v_nomor[v_i],
      kloter_nomor  = v_kandidat,
      urutan_kloter = (select min(s) from generate_series(1, v_cfg.maks_regu_per_kloter) s
                       where not exists (select 1 from regu x
                                         where x.kloter_nomor = v_kandidat
                                           and x.urutan_kloter = s))
    where r.id = v_regu[v_i];

    v_terpakai := v_terpakai || v_kandidat;
    v_mulai := v_kandidat;
  end loop;

  return query
  select r.id, r.nama_regu, r.golongan, r.nomor_dada, r.kloter_nomor
  from regu r
  where r.id = any (v_regu)
  order by r.nomor_dada;
end;
$$;

revoke execute on function daftar_ulang_batch(text) from public, anon;
grant execute on function daftar_ulang_batch(text) to authenticated;
