-- ============================================================================
-- hrcd-rekap : 0102_mark_printed_kloter_insertion.sql
-- Tandai regu yang masuk otomatis setelah daftar kloternya dicetak.
--
-- Daftar ulang otomatis tetap memilih kloter paling awal yang belum berangkat,
-- termasuk kloter yang kertasnya sudah dicetak. Penempatan itu benar, tetapi
-- petugas staging harus diberi tahu bahwa kertas lama belum memuat regu baru.
-- ============================================================================

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
      urutan_kloter = slot_kloter_berikutnya(v_kandidat),
      disisipkan_pada = case
        when exists (select 1 from kloter k
                     where k.nomor = v_kandidat and k.dicetak_pada is not null)
        then now() else disisipkan_pada end,
      alasan_sisip = case
        when exists (select 1 from kloter k
                     where k.nomor = v_kandidat and k.dicetak_pada is not null)
        then 'daftar ulang otomatis setelah daftar kloter dicetak'
        else alasan_sisip end
    where id = v_regu[v_i];
  end loop;

  return query
  select r.id, r.nama_regu, r.golongan, r.nomor_dada, r.kloter_nomor
  from regu r where r.id = any(v_regu) order by r.nomor_dada;
end;
$$;

comment on function daftar_ulang_batch(text, jsonb) is
  'Memberi nomor dada dan kloter FIFO; penempatan setelah daftar kloter dicetak ditandai sebagai sisipan.';
