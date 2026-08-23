-- ============================================================================
-- hrcd-rekap : 0105_expand_kloter_capacity.sql
-- Sediakan 75 kloter agar kuota Eksternal tidak habis tepat di batas rencana.
--
-- Enam puluh kloter hanya memuat tepat 300 Eksternal. Setiap tempat kosong
-- pada kloter yang telanjur berangkat tidak dapat dipakai lagi oleh pembagian
-- otomatis, sehingga satu tempat yang hangus dapat menggagalkan seluruh batch
-- daftar ulang terakhir. Lima belas kloter cadangan memberi 75 tempat
-- Eksternal tambahan tanpa mengubah kuota 5 Eksternal + 3 Intern per kloter.
--
-- Seluruh 75 kloter tetap mempunyai perkiraan di dalam jendela edisi. Fungsi
-- sebelumnya membagi waktu menurut jumlah regu perkiraan (60 kloter), sehingga
-- K61 dan seterusnya jatuh sesudah batas pukul 10:00.
-- ============================================================================

update edisi
set kloter_dasar = greatest(kloter_dasar, 75),
    kloter_maks = greatest(kloter_maks, 75)
where is_active;

insert into kloter (nomor)
select generate_series(
  1,
  (select kloter_maks from edisi where is_active)
)::smallint
on conflict (nomor) do nothing;

create or replace function perkiraan_berangkat_kloter(p_kloter integer)
returns timestamptz
language sql stable
set search_path = public
as $$
  with cfg as (
    select e.*,
      greatest(e.kloter_maks, 1)::int as jumlah_kloter
    from edisi e
    where e.is_active
  )
  select ((tanggal_lomba + jam_mulai_berangkat) at time zone 'Asia/Jakarta')
    + case when jumlah_kloter = 1 then interval '0'
           else (jam_batas_berangkat - jam_mulai_berangkat)
             * ((p_kloter - 1)::double precision / (jumlah_kloter - 1))
      end
  from cfg
$$;

comment on function perkiraan_berangkat_kloter(integer) is
  'Perkiraan FIFO yang membagi seluruh kloter edisi secara merata di dalam jendela keberangkatan.';
