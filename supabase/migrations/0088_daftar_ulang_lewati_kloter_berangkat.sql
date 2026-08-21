-- ============================================================================
-- hrcd-rekap : 0088_daftar_ulang_lewati_kloter_berangkat.sql
-- Pengacakan daftar ulang hanya memilih kloter yang belum berangkat.
--
-- Peserta yang baru menerima nomor dada setelah lomba dimulai harus masuk ke
-- kloter paling awal yang masih layak DAN belum berangkat. Sebelumnya 0066
-- membuang penyaring jam_berangkat bersama penyaring dicetak_pada, sehingga
-- slot kosong di kloter lama dipilih lebih dahulu walaupun kloternya sudah
-- jalan. Di produksi, nomor dada 169 karena itu masuk kloter 3 alih-alih
-- kloter 11 yang belum berangkat.
--
-- Perubahan ini hanya berlaku pada daftar_ulang_batch, yaitu pengacakan
-- otomatis saat nomor dada diberikan. Kloter yang sudah dicetak tetap boleh
-- dipilih dan jalur sisipan manual tidak ditutup: petugas masih dapat memakai
-- pindah_kloter ketika memang bermaksud mencatat regu seakan-akan berangkat
-- bersama kloter lama.
-- ============================================================================

create or replace function daftar_ulang_batch(
  p_kode  text,
  -- [{"regu_id": "...", "nomor_dada": 12}, ...] — satu entri per regu yang
  -- belum bernomor di batch ini, tidak boleh kurang dan tidak boleh lebih.
  p_nomor jsonb
)
returns table (regu_id uuid, nama_regu text, golongan text, nomor_dada integer, kloter smallint)
language plpgsql security definer
set search_path = public
as $$
declare
  v_batch      pendaftaran%rowtype;
  v_berhak     uuid[];
  v_regu       uuid[];
  v_nomor      integer[];
  v_n          int;
  v_cfg        edisi%rowtype;
  v_terpakai   int[];      -- kloter yang sudah berisi sekolah ini
  v_kandidat   int;
  v_mulai      int;
  v_i          int;
  v_langkah    int;
  v_salah      text;
begin
  if not boleh('daftar_ulang') then
    raise exception 'tidak berhak: daftar_ulang';
  end if;
  if (select daftar_ulang_ditutup from status_acara) then
    raise exception 'daftar ulang sudah ditutup';
  end if;

  select * into v_cfg from edisi where is_active;

  select * into v_batch from pendaftaran where kode_pembayaran = p_kode for update;
  if not found then
    raise exception 'kode pembayaran tidak dikenal: %', p_kode;
  end if;
  if v_batch.status <> 'lunas' then
    raise exception 'batch belum lunas (status: %)', v_batch.status;
  end if;

  -- Regu yang berhak: belum bernomor, tidak batal (rancangan-b.md, temuan 11).
  select array_agg(r.id order by r.nama_regu, r.id) into v_berhak
  from regu r
  where r.pendaftaran_id = v_batch.id
    and not r.is_cancelled and r.nomor_dada is null;
  v_n := coalesce(array_length(v_berhak, 1), 0);
  if v_n = 0 then
    raise exception 'tidak ada regu yang menunggu nomor dada di batch ini (sudah daftar ulang, atau semua batal)';
  end if;

  -- Pasangan regu -> nomor dari meja. Urutan deterministik (nama regu) supaya
  -- hasil yang dibacakan meja urut sama dengan kartu di layar.
  select array_agg(x.regu_id order by r.nama_regu, r.id),
         array_agg(x.nomor_dada order by r.nama_regu, r.id)
    into v_regu, v_nomor
  from jsonb_to_recordset(coalesce(p_nomor, '[]'::jsonb))
         as x(regu_id uuid, nomor_dada integer)
  join regu r on r.id = x.regu_id;

  if coalesce(array_length(v_regu, 1), 0) <> v_n
     or (select count(distinct g) from unnest(v_regu) as t(g)) <> v_n
     or exists (select 1 from unnest(v_regu) as t(g) where not (t.g = any (v_berhak))) then
    raise exception 'nomor dada harus diisi untuk SEMUA % regu batch ini, satu regu satu nomor', v_n;
  end if;

  if exists (select 1 from unnest(v_nomor) as t(nomor)
             where t.nomor is null or t.nomor <= 0) then
    raise exception 'nomor dada harus angka lebih besar dari 0';
  end if;
  if (select count(distinct t.nomor) from unnest(v_nomor) as t(nomor)) <> v_n then
    raise exception 'nomor dada yang sama diketik untuk dua regu sekaligus';
  end if;

  -- Kunci baris stok yang diminta, urut nomor supaya dua meja yang meminta
  -- himpunan bertumpang tindih tidak saling mengunci silang. Meja kedua
  -- menunggu sebentar lalu ditolak pemeriksaan "sudah dipakai" di bawah,
  -- dengan pesan yang bisa dibaca petugas — bukan galat unique mentah.
  perform 1 from nomor_dada_stok s
  where s.nomor = any (v_nomor)
  order by s.nomor
  for update;

  select string_agg(distinct t.nomor::text, ', ' order by t.nomor::text) into v_salah
  from unnest(v_nomor) as t(nomor)
  where not exists (select 1 from nomor_dada_stok s where s.nomor = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada di luar stok yang disiapkan admin: %', v_salah;
  end if;

  select string_agg(distinct t.nomor::text, ', ' order by t.nomor::text) into v_salah
  from unnest(v_nomor) as t(nomor)
  where exists (select 1 from nomor_dada_pensiun p where p.nomor = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada sudah dipensiunkan (bekas tukar) dan tidak boleh terbit lagi: %', v_salah;
  end if;

  select string_agg(distinct t.nomor::text, ', ' order by t.nomor::text) into v_salah
  from unnest(v_nomor) as t(nomor)
  where exists (select 1 from regu r where r.nomor_dada = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada sudah dipakai regu lain: %', v_salah;
  end if;

  -- Serialisasi bagian penempatan kloter (2-3 meja — advisory lock sederhana
  -- lebih terbaca daripada retry unique-violation; lepas otomatis di akhir tx).
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  -- Kloter yang sudah berisi regu sekolah yang sama (batch mana pun).
  select coalesce(array_agg(distinct r.kloter_nomor), '{}') into v_terpakai
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where d.sekolah_id = v_batch.sekolah_id and r.kloter_nomor is not null;

  -- Sebar N regu: mulai dari kloter termuda yang layak, melompat
  -- lompatan_kloter (alur 5.6); kloter 31.. dibuka hanya bila 1..30 tidak
  -- menyediakan slot layak (alur 5.2). "Layak" = belum penuh + belum berisi
  -- sekolah ini; bila tak terhindarkan, syarat sekolah dilonggarkan (alur 5.4
  -- "sesedikit mungkin", bukan "tidak boleh").
  v_mulai := null;
  for v_i in 1..v_n loop
    v_kandidat := null;

    -- Putaran 1: hormati lompatan + hindari sekolah sama, dalam
    -- 1..kloter_dasar. Tanda cetak tidak ikut menyaring, tetapi kloter yang
    -- sudah berangkat tidak boleh dipilih oleh pengacakan otomatis (0088).
    if v_mulai is null then
      v_langkah := 1;  -- pencarian pertama: kloter layak termuda
    else
      v_langkah := v_cfg.lompatan_kloter;
    end if;
    select k.nomor into v_kandidat
    from kloter k
    where k.jam_berangkat is null
      and k.nomor <= v_cfg.kloter_dasar
      and (v_mulai is null or k.nomor >= v_mulai + v_langkah)
      and not (k.nomor = any (v_terpakai))
      and (select count(*) from regu r where r.kloter_nomor = k.nomor)
          < v_cfg.maks_regu_per_kloter
    order by k.nomor
    limit 1;

    -- Putaran 2: masih hindari sekolah sama tapi abaikan lompatan (wrap).
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.jam_berangkat is null
        and k.nomor <= v_cfg.kloter_dasar
        and not (k.nomor = any (v_terpakai))
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by k.nomor
      limit 1;
    end if;

    -- Putaran 3: 1..kloter_dasar masih ada tempat tapi semuanya berisi
    -- sekolah ini — sekolah sama boleh berkumpul DULU sebelum membuka
    -- kloter cadangan (alur 5.2: 31-40 hanya bila 1-30 penuh; alur 5.4:
    -- "sesedikit mungkin", bukan larangan mutlak). Pilih yang paling kosong.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.jam_berangkat is null
        and k.nomor <= v_cfg.kloter_dasar
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (select count(*) from regu r where r.kloter_nomor = k.nomor), k.nomor
      limit 1;
    end if;

    -- Putaran 4: kloter dasar benar-benar penuh — buka cadangan
    -- (31..kloter_maks), hindari sekolah sama dulu lalu bebas.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.jam_berangkat is null
        and k.nomor between v_cfg.kloter_dasar + 1 and v_cfg.kloter_maks
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (k.nomor = any (v_terpakai)),   -- false (bebas sekolah) dulu
               (select count(*) from regu r where r.kloter_nomor = k.nomor),
               k.nomor
      limit 1;
    end if;

    if v_kandidat is null then
      raise exception 'semua kloter yang belum berangkat penuh — tambah kloter atau periksa konfigurasi';
    end if;

    update regu r set
      nomor_dada    = v_nomor[v_i],
      kloter_nomor  = v_kandidat,
      -- Slot terkecil yang kosong, bukan count+1: lubang bekas koreksi admin
      -- tidak boleh membuat slot palsu di atas 10 (temuan review).
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

-- Pastikan keempat putaran pemilihan membawa pagar yang sama. Pemeriksaan ini
-- sengaja menghitung sumber fungsi: satu putaran yang lupa dipagari baru akan
-- terlihat saat susunan sekolah/kapasitas tertentu memaksanya dipakai.
do $blok$
declare v_n int;
begin
  select count(*) into v_n
  from regexp_matches(
    (select p.prosrc
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'daftar_ulang_batch'
        and pg_get_function_identity_arguments(p.oid) = 'p_kode text, p_nomor jsonb'),
    'jam_berangkat is null',
    'g'
  );

  assert v_n = 4,
         format('empat putaran pemilihan kloter harus menyaring jam_berangkat; ditemukan %s', v_n);
  raise notice '0088: daftar ulang otomatis melewati kloter yang sudah berangkat.';
end $blok$;
