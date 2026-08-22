-- ============================================================================
-- hrcd-rekap : 0092_fifo_kloter_eksternal_intern.sql
-- Kloter otomatis FIFO: 5 regu Eksternal + 3 regu Intern.
--
-- Daftar ulang yang selesai lebih dahulu selalu mengisi kloter paling awal
-- yang kuota jenis regunya belum penuh. Penyebaran sekolah dan lompatan dua
-- kloter tidak lagi dipakai. Pemindahan manual sengaja tidak dibatasi kuota
-- ataupun jumlah regu karena petugas perlu dapat mencatat keadaan lapangan.
-- Perkiraan 300 Eksternal + 50 Intern membutuhkan 60 kloter; rentang 07:00
-- sampai 10:00 dibagi merata terhadap 60 kloter itu.
-- ============================================================================

alter table edisi
  add column maks_eksternal_per_kloter smallint not null default 5
    check (maks_eksternal_per_kloter >= 1),
  add column maks_intern_per_kloter smallint not null default 3
    check (maks_intern_per_kloter >= 1),
  add column perkiraan_regu_eksternal smallint not null default 300
    check (perkiraan_regu_eksternal >= 0),
  add column perkiraan_regu_intern smallint not null default 50
    check (perkiraan_regu_intern >= 0);

alter table kloter drop constraint if exists kloter_nomor_check;
alter table kloter add constraint kloter_nomor_check check (nomor >= 1);

-- Urutan tetap unik dan positif, tetapi tidak lagi menjadi pagar kapasitas.
alter table regu drop constraint if exists regu_urutan_kloter_check;
alter table regu add constraint regu_urutan_kloter_check
  check (urutan_kloter is null or urutan_kloter >= 1);

create or replace function slot_kloter_berikutnya(p_kloter smallint)
returns smallint
language sql stable
set search_path = public
as $$
  select min(s)::smallint
  from generate_series(
    1,
    greatest(1, coalesce((select max(urutan_kloter) + 1
                          from regu where kloter_nomor = p_kloter), 1))
  ) s
  where not exists (
    select 1 from regu r
    where r.kloter_nomor = p_kloter and r.urutan_kloter = s
  )
$$;

create or replace function perkiraan_berangkat_kloter(p_kloter integer)
returns timestamptz
language sql stable
set search_path = public
as $$
  with cfg as (
    select e.*,
      greatest(
        ceil(e.perkiraan_regu_eksternal::numeric / e.maks_eksternal_per_kloter),
        ceil(e.perkiraan_regu_intern::numeric / e.maks_intern_per_kloter),
        1
      )::int as jumlah_kloter
    from edisi e where e.is_active
  )
  select ((tanggal_lomba + jam_mulai_berangkat) at time zone 'Asia/Jakarta')
    + case when jumlah_kloter = 1 then interval '0'
           else (jam_batas_berangkat - jam_mulai_berangkat)
             * ((p_kloter - 1)::double precision / (jumlah_kloter - 1))
      end
  from cfg
$$;

comment on function perkiraan_berangkat_kloter(integer) is
  'Perkiraan FIFO yang membagi jendela keberangkatan berdasarkan 300 Eksternal, 50 Intern, dan kuota per jenis.';

create or replace function daftar_ulang_batch(p_kode text, p_nomor jsonb)
returns table (regu_id uuid, nama_regu text, golongan text, nomor_dada integer, kloter smallint)
language plpgsql security definer
set search_path = public
as $$
declare
  v_batch pendaftaran%rowtype;
  v_berhak uuid[];
  v_regu uuid[];
  v_nomor integer[];
  v_n int;
  v_cfg edisi%rowtype;
  v_kandidat smallint;
  v_i int;
  v_salah text;
  v_intern boolean;
begin
  if not boleh('daftar_ulang') then raise exception 'tidak berhak: daftar_ulang'; end if;
  if (select daftar_ulang_ditutup from status_acara) then
    raise exception 'daftar ulang sudah ditutup';
  end if;

  select * into v_cfg from edisi where is_active;
  select * into v_batch from pendaftaran where kode_pembayaran = p_kode for update;
  if not found then raise exception 'kode pembayaran tidak dikenal: %', p_kode; end if;
  if v_batch.status <> 'lunas' then
    raise exception 'batch belum lunas (status: %)', v_batch.status;
  end if;

  select array_agg(r.id order by r.nama_regu, r.id) into v_berhak
  from regu r
  where r.pendaftaran_id = v_batch.id
    and not r.is_cancelled and r.nomor_dada is null;
  v_n := coalesce(array_length(v_berhak, 1), 0);
  if v_n = 0 then
    raise exception 'tidak ada regu yang menunggu nomor dada di batch ini (sudah daftar ulang, atau semua batal)';
  end if;

  select array_agg(x.regu_id order by r.nama_regu, r.id),
         array_agg(x.nomor_dada order by r.nama_regu, r.id)
    into v_regu, v_nomor
  from jsonb_to_recordset(coalesce(p_nomor, '[]'::jsonb))
       as x(regu_id uuid, nomor_dada integer)
  join regu r on r.id = x.regu_id;

  if coalesce(array_length(v_regu, 1), 0) <> v_n
     or (select count(distinct g) from unnest(v_regu) t(g)) <> v_n
     or exists (select 1 from unnest(v_regu) t(g) where not (t.g = any(v_berhak))) then
    raise exception 'nomor dada harus diisi untuk SEMUA % regu batch ini, satu regu satu nomor', v_n;
  end if;
  if exists (select 1 from unnest(v_nomor) t(nomor)
             where t.nomor is null or t.nomor <= 0) then
    raise exception 'nomor dada harus angka lebih besar dari 0';
  end if;
  if (select count(distinct nomor) from unnest(v_nomor) t(nomor)) <> v_n then
    raise exception 'nomor dada yang sama diketik untuk dua regu sekaligus';
  end if;

  perform 1 from nomor_dada_stok s
  where s.nomor = any(v_nomor) order by s.nomor for update;

  select string_agg(distinct nomor::text, ', ' order by nomor::text) into v_salah
  from unnest(v_nomor) t(nomor)
  where not exists (select 1 from nomor_dada_stok s where s.nomor = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada di luar stok yang disiapkan admin: %', v_salah;
  end if;
  select string_agg(distinct nomor::text, ', ' order by nomor::text) into v_salah
  from unnest(v_nomor) t(nomor)
  where exists (select 1 from nomor_dada_pensiun p where p.nomor = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada sudah dipensiunkan (bekas tukar) dan tidak boleh terbit lagi: %', v_salah;
  end if;
  select string_agg(distinct nomor::text, ', ' order by nomor::text) into v_salah
  from unnest(v_nomor) t(nomor)
  where exists (select 1 from regu r where r.nomor_dada = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada sudah dipakai regu lain: %', v_salah;
  end if;

  -- Gerbang ini membuat urutan transaksi daftar ulang sekaligus urutan kloter.
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  for v_i in 1..v_n loop
    select r.golongan in ('intern_pa', 'intern_pi') into v_intern
    from regu r where r.id = v_regu[v_i];

    select k.nomor into v_kandidat
    from kloter k
    where k.jam_berangkat is null
      and k.nomor <= v_cfg.kloter_maks
      and (select count(*) from regu r
           where r.kloter_nomor = k.nomor and not r.is_cancelled
             and (r.golongan in ('intern_pa', 'intern_pi')) = v_intern)
          < case when v_intern then v_cfg.maks_intern_per_kloter
                 else v_cfg.maks_eksternal_per_kloter end
    order by k.nomor
    limit 1;

    if v_kandidat is null then
      raise exception 'semua kuota kloter yang belum berangkat penuh — tambah kloter atau periksa konfigurasi';
    end if;

    update regu set
      nomor_dada = v_nomor[v_i],
      kloter_nomor = v_kandidat,
      urutan_kloter = slot_kloter_berikutnya(v_kandidat)
    where id = v_regu[v_i];
  end loop;

  return query
  select r.id, r.nama_regu, r.golongan, r.nomor_dada, r.kloter_nomor
  from regu r where r.id = any(v_regu) order by r.nomor_dada;
end;
$$;

-- Jalur manual: p_kloter kosong maupun terisi tidak memakai kuota otomatis.
create or replace function pindah_kloter(
  p_nomor_dada integer, p_alasan text, p_kloter smallint default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu regu%rowtype;
  v_cfg edisi%rowtype;
  v_tujuan smallint;
  v_perlu_diumumkan boolean;
  v_tercetak boolean;
  v_lama smallint;
  v_tujuan_berangkat boolean;
begin
  if not boleh('cetak_kloter') then raise exception 'tidak berhak: cetak_kloter'; end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan pemindahan wajib diisi — tercatat di riwayat';
  end if;
  select * into v_cfg from edisi where is_active;
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));
  select * into v_regu from regu where nomor_dada = p_nomor_dada for update;
  if not found then raise exception 'nomor dada % tidak dikenal', p_nomor_dada; end if;
  if v_regu.is_cancelled then raise exception 'regu % berstatus batal', p_nomor_dada; end if;
  v_lama := v_regu.kloter_nomor;
  if regu_sudah_berangkat(v_regu.id) then
    raise exception 'regu % ikut berangkat bersama kloter % — kalau itu keliru, batalkan dulu keberangkatan kloter itu lewat admin', p_nomor_dada, v_lama;
  end if;

  if p_kloter is null then
    select k.nomor into v_tujuan from kloter k
    where k.jam_berangkat is null and k.nomor <= v_cfg.kloter_maks
    order by k.nomor desc limit 1;
  else
    v_tujuan := p_kloter;
    if not exists (select 1 from kloter where nomor = v_tujuan) then
      raise exception 'kloter % tidak ada', v_tujuan;
    end if;
  end if;
  if v_tujuan is null then raise exception 'tidak ada kloter tersisa yang belum berangkat'; end if;
  if v_tujuan = v_lama then raise exception 'regu % sudah ada di kloter %', p_nomor_dada, v_tujuan; end if;

  select dicetak_pada is not null or jam_berangkat is not null,
         dicetak_pada is not null, jam_berangkat is not null
    into v_perlu_diumumkan, v_tercetak, v_tujuan_berangkat
  from kloter where nomor = v_tujuan;
  perform set_config('hrcd.izin_pindah', '1', true);
  update regu set
    kloter_nomor = v_tujuan,
    urutan_kloter = slot_kloter_berikutnya(v_tujuan),
    disisipkan_pada = case when v_perlu_diumumkan then now() else disisipkan_pada end,
    alasan_sisip = case when v_perlu_diumumkan then p_alasan else alasan_sisip end
  where id = v_regu.id;
  perform set_config('hrcd.izin_pindah', '0', true);

  insert into history (table_name, row_id, regu_id, action, old_value, new_value, changed_by)
  values ('regu', v_regu.id::text, v_regu.id, 'UPDATE',
    jsonb_build_object('kloter_nomor', v_lama, 'urutan_kloter', v_regu.urutan_kloter),
    jsonb_build_object('pindah_kloter', jsonb_build_object(
      'nomor_dada', p_nomor_dada, 'dari', v_lama, 'ke', v_tujuan,
      'alasan', p_alasan, 'kloter_tujuan_sudah_dicetak', v_tercetak,
      'kloter_tujuan_sudah_berangkat', v_tujuan_berangkat)), auth.uid());

  return jsonb_build_object(
    'nomor_dada', p_nomor_dada, 'kloter_lama', v_lama, 'kloter_baru', v_tujuan,
    'sisipan', v_perlu_diumumkan, 'tujuan_sudah_berangkat', v_tujuan_berangkat,
    'peringatan', nullif(concat_ws(' ',
      case when v_perlu_diumumkan then format(
        'Nomor %s TIDAK ADA di kertas kloter %s. Beri tahu petugas staging.',
        p_nomor_dada, v_tujuan) end,
      case when v_tujuan_berangkat then format(
        'Kloter %s sudah berangkat, jadi nomor %s dinilai dari jam berangkat kloter itu.',
        v_tujuan, p_nomor_dada) end), ''));
end;
$$;

create or replace view v_keberangkatan with (security_invoker = on) as
with terakhir as (
  select coalesce(max(nomor), 0) as n from kloter where jam_berangkat is not null
)
select k.nomor, k.jam_berangkat,
  case when k.jam_berangkat is not null then 'berangkat'
       when k.nomor <= t.n + 2 then 'siap'
       when k.nomor = t.n + 3 then 'konfirmasi_kontrak'
       else 'menunggu' end as posisi,
  (select count(*) from regu r where r.kloter_nomor = k.nomor and not r.is_cancelled) as jumlah_regu,
  (select count(*) from regu r join keberangkatan_regu kb on kb.regu_id = r.id
   where r.kloter_nomor = k.nomor) as sudah_ceklis,
  (select count(*) from regu r where r.kloter_nomor = k.nomor and not r.is_cancelled
   and r.kontrak_menit is not null) as sudah_kontrak,
  perkiraan_berangkat_kloter(k.nomor) as perkiraan_berangkat,
  (perkiraan_berangkat_kloter(k.nomor) at time zone 'Asia/Jakarta')::time
    > e.jam_batas_berangkat as lewat_batas
from kloter k cross join terakhir t cross join edisi e
where e.is_active and (exists (select 1 from regu r where r.kloter_nomor = k.nomor)
  or k.jam_berangkat is not null);

create or replace view v_daftar_kloter with (security_invoker = on) as
select r.kloter_nomor as kloter, r.urutan_kloter as urutan, r.nomor_dada,
  r.nama_regu, s.name as nama_sekolah, r.golongan, k.dicetak_pada,
  k.jam_berangkat,
  -- Perkiraan tidak pernah berubah menjadi catatan nyata. Kertas yang belum
  -- dicetak selalu menyebut perkiraan; jam_berangkat tetap kolom terpisah.
  perkiraan_berangkat_kloter(k.nomor) as perkiraan_berangkat,
  k.jam_berangkat is not null as sudah_berangkat,
  r.disisipkan_pada is not null as sisipan, r.alasan_sisip
from regu r join kloter k on k.nomor = r.kloter_nomor
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s on s.id = d.sekolah_id cross join edisi e
where e.is_active and not r.is_cancelled and d.status = 'lunas'
  and r.kloter_nomor is not null
order by r.kloter_nomor, r.urutan_kloter;
