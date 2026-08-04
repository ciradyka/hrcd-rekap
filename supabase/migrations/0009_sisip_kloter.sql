-- ============================================================================
-- hrcd-rekap : 0009_sisip_kloter.sql
--
-- Panitia:
--   "Kertas dibagikan ke setiap barak, beserta perkiraan berangkat, jadi
--    tidak mungkin berubah. Namun di hari-H ada peserta yang terlambat masuk
--    kloter — akan diberangkatkan ke kloter terakhir. Atau bisa jadi sangat
--    urgent, harus diberangkatkan saat itu, jadi harus ada sistem di mana kita
--    bisa memasukkan nomor dada tertentu ke kloter di luar yang sudah
--    terdaftar."
--
-- Tiga hal yang ditambahkan:
--
-- 1. PERKIRAAN BERANGKAT di kertas. Regu di barak perlu tahu kapan harus siap;
--    tanpa itu kertasnya hanya daftar nama. Dihitung dari jam mulai + interval
--    x (nomor kloter - 1). Kalau kloter sudah berangkat, yang tampil adalah
--    jam sebenarnya, bukan perkiraan.
--
-- 2. JALUR SAH untuk memindahkan regu. Pembekuan di 0008 dimaksudkan mencegah
--    perubahan DIAM-DIAM, bukan melarang keputusan sadar panitia. Jadi
--    pembekuan tetap, tetapi ada satu pintu resmi: pindah_kloter(), yang wajib
--    beralasan dan terekam riwayat.
--
-- 3. PENANDA SISIPAN — bagian terpenting, dan tidak diminta secara eksplisit.
--    Petugas staging memegang kertas yang TIDAK memuat regu sisipan itu.
--    Kalau sistem diam saja, regu itu ada di database tapi tidak akan pernah
--    dipanggil. Maka tiap regu yang disisipkan setelah kertas cetak diberi
--    tanda, dan layar staging wajib menyorotnya: "nomor ini TIDAK ADA di
--    kertas Anda."
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Jam mulai keberangkatan (untuk perkiraan di kertas)
-- ---------------------------------------------------------------------------

alter table edisi add column jam_mulai_berangkat time not null default '07:00';

comment on column edisi.jam_mulai_berangkat is
  'Perkiraan jam berangkat kloter 1. Dipakai menghitung perkiraan di kertas '
  'yang dibagikan ke barak; jam sebenarnya tetap diketik panitia saat start.';

-- ---------------------------------------------------------------------------
-- 2. Penanda sisipan pada regu
-- ---------------------------------------------------------------------------

alter table regu add column disisipkan_pada timestamptz;
alter table regu add column alasan_sisip text;

comment on column regu.disisipkan_pada is
  'Diisi bila regu dipindahkan ke kloter SETELAH daftar kloter dicetak. '
  'Artinya nomor dada ini TIDAK ADA di kertas yang dipegang petugas garis '
  'start — layar wajib menyorotnya.';

-- ---------------------------------------------------------------------------
-- 3. Trigger 0008 diberi pintu resmi.
--    Perubahan kloter tetap ditolak, KECUALI dilakukan lewat pindah_kloter()
--    yang menyalakan penanda transaksi hrcd.izin_pindah.
-- ---------------------------------------------------------------------------

create or replace function tolak_ubah_kloter_tercetak()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Pintu resmi: pindah_kloter() menyalakan penanda ini di dalam transaksinya.
  if coalesce(current_setting('hrcd.izin_pindah', true), '') = '1' then
    return new;
  end if;

  if old.kloter_nomor is not null
     and old.kloter_nomor is distinct from new.kloter_nomor
     and exists (select 1 from kloter where nomor = old.kloter_nomor
                 and dicetak_pada is not null) then
    raise exception 'kloter % sudah dicetak — isinya tidak boleh berubah. Pakai menu "Pindah kloter" bila memang perlu.',
      old.kloter_nomor;
  end if;
  if new.kloter_nomor is not null
     and new.kloter_nomor is distinct from old.kloter_nomor
     and exists (select 1 from kloter where nomor = new.kloter_nomor
                 and dicetak_pada is not null) then
    raise exception 'kloter % sudah dicetak — regu baru tidak boleh disisipkan ke sana. Pakai menu "Pindah kloter" bila memang perlu.',
      new.kloter_nomor;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. pindah_kloter — satu pintu untuk dua kebutuhan hari-H.
--
--    p_kloter NULL  -> "telat biasa": taruh di kloter TERAKHIR yang belum
--                      berangkat dan masih muat (jalur yang panitia sebut).
--    p_kloter diisi -> "urgent": paksa ke kloter itu, termasuk yang sudah
--                      dicetak atau yang sebentar lagi berangkat.
--
--    Keduanya wajib beralasan dan tercatat. Regu yang mendarat di kloter
--    tercetak otomatis diberi tanda sisipan.
-- ---------------------------------------------------------------------------

create or replace function pindah_kloter(
  p_nomor_dada integer,
  p_alasan     text,
  p_kloter     smallint default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu    regu%rowtype;
  v_cfg     edisi%rowtype;
  v_tujuan  smallint;
  v_isi     int;
  v_tercetak boolean;
  v_lama    smallint;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan pemindahan wajib diisi — tercatat di riwayat';
  end if;

  select * into v_cfg from edisi where aktif;

  -- Serialisasi bersama daftar ulang: keduanya menyentuh isi kloter.
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  select * into v_regu from regu where nomor_dada = p_nomor_dada for update;
  if not found then
    raise exception 'nomor dada % tidak dikenal', p_nomor_dada;
  end if;
  if v_regu.batal then
    raise exception 'regu % berstatus batal', p_nomor_dada;
  end if;
  v_lama := v_regu.kloter_nomor;

  if v_lama is not null
     and exists (select 1 from kloter where nomor = v_lama and jam_berangkat is not null) then
    raise exception 'regu % sudah diberangkatkan di kloter % — tidak bisa dipindah',
      p_nomor_dada, v_lama;
  end if;

  if p_kloter is null then
    -- TELAT BIASA: kloter terakhir yang belum berangkat dan masih muat.
    select k.nomor into v_tujuan
    from kloter k
    where k.jam_berangkat is null
      and k.nomor <= v_cfg.kloter_maks
      and (select count(*) from regu r where r.kloter_nomor = k.nomor)
          < v_cfg.maks_regu_per_kloter
    order by k.nomor desc
    limit 1;
    if v_tujuan is null then
      raise exception 'tidak ada kloter tersisa yang belum berangkat dan masih muat';
    end if;
  else
    -- URGENT: kloter yang disebut panitia, apa pun keadaannya.
    v_tujuan := p_kloter;
    if not exists (select 1 from kloter where nomor = v_tujuan) then
      raise exception 'kloter % tidak ada', v_tujuan;
    end if;
    if exists (select 1 from kloter where nomor = v_tujuan and jam_berangkat is not null) then
      raise exception 'kloter % sudah berangkat', v_tujuan;
    end if;
  end if;

  if v_tujuan = v_lama then
    raise exception 'regu % sudah ada di kloter %', p_nomor_dada, v_tujuan;
  end if;

  -- Kapasitas tetap dijaga: kertas boleh dilanggar, kapasitas fisik tidak.
  select count(*) into v_isi from regu where kloter_nomor = v_tujuan;
  if v_isi >= v_cfg.maks_regu_per_kloter then
    raise exception 'kloter % sudah penuh (% regu)', v_tujuan, v_isi;
  end if;

  select dicetak_pada is not null into v_tercetak from kloter where nomor = v_tujuan;

  -- Buka pintu untuk trigger 0008, hanya di dalam transaksi ini.
  perform set_config('hrcd.izin_pindah', '1', true);

  update regu set
    kloter_nomor  = v_tujuan,
    urutan_kloter = (select min(s) from generate_series(1, v_cfg.maks_regu_per_kloter) s
                     where not exists (select 1 from regu x
                                       where x.kloter_nomor = v_tujuan
                                         and x.urutan_kloter = s)),
    -- Ditandai sisipan HANYA bila kertas tujuan sudah beredar.
    disisipkan_pada = case when v_tercetak then now() else disisipkan_pada end,
    alasan_sisip    = case when v_tercetak then p_alasan else alasan_sisip end
  where id = v_regu.id;

  perform set_config('hrcd.izin_pindah', '0', true);

  insert into riwayat (tabel, baris_id, regu_id, aksi, nilai_baru, oleh)
  values ('regu', v_regu.id::text, v_regu.id, 'UPDATE',
          jsonb_build_object('pindah_kloter', jsonb_build_object(
            'nomor_dada', p_nomor_dada, 'dari', v_lama, 'ke', v_tujuan,
            'alasan', p_alasan, 'kloter_tujuan_sudah_dicetak', v_tercetak)),
          auth.uid());

  return jsonb_build_object(
    'nomor_dada', p_nomor_dada,
    'kloter_lama', v_lama,
    'kloter_baru', v_tujuan,
    'sisipan', v_tercetak,
    'peringatan', case when v_tercetak
      then format('Nomor %s TIDAK ADA di kertas kloter %s. Beri tahu petugas staging.',
                  p_nomor_dada, v_tujuan)
      end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. View cetak diperbarui: perkiraan berangkat + penanda sisipan.
-- ---------------------------------------------------------------------------

drop view if exists v_daftar_kloter;

create view v_daftar_kloter with (security_invoker = on) as
select
  r.kloter_nomor                        as kloter,
  r.urutan_kloter                       as urutan,
  r.nomor_dada,
  r.nama_regu,
  s.nama                                as nama_sekolah,
  r.golongan,
  k.dicetak_pada,
  k.jam_berangkat,
  -- Perkiraan untuk kertas barak; kalau sudah berangkat, pakai jam nyata.
  coalesce(
    k.jam_berangkat,
    (e.tanggal_lomba + e.jam_mulai_berangkat)::timestamptz
      + make_interval(mins => e.interval_berangkat_menit * (k.nomor - 1))
  )                                     as perkiraan_berangkat,
  k.jam_berangkat is not null           as sudah_berangkat,
  r.disisipkan_pada is not null         as sisipan,
  r.alasan_sisip
from regu r
join kloter k       on k.nomor = r.kloter_nomor
join pendaftaran d  on d.id = r.pendaftaran_id
join sekolah s      on s.id = d.sekolah_id
cross join edisi e
where e.aktif
  and not r.batal
  and d.status = 'lunas'
  and r.kloter_nomor is not null
order by r.kloter_nomor, r.urutan_kloter;

grant select on v_daftar_kloter to authenticated;

-- ---------------------------------------------------------------------------
-- 6. View sisipan: daftar pendek yang WAJIB dibacakan ke petugas garis start,
--    karena nomor-nomor ini tidak ada di kertas mereka.
-- ---------------------------------------------------------------------------

create view v_sisipan_kloter with (security_invoker = on) as
select
  r.kloter_nomor    as kloter,
  r.nomor_dada,
  r.nama_regu,
  s.nama            as nama_sekolah,
  r.golongan,
  r.disisipkan_pada,
  r.alasan_sisip,
  k.jam_berangkat is not null as sudah_berangkat
from regu r
join kloter k      on k.nomor = r.kloter_nomor
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
where r.disisipkan_pada is not null
  and not r.batal
order by r.kloter_nomor, r.nomor_dada;

grant select on v_sisipan_kloter to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Hak eksekusi
-- ---------------------------------------------------------------------------

revoke execute on function pindah_kloter(integer, text, smallint) from public, anon;
grant execute on function pindah_kloter(integer, text, smallint) to authenticated;
