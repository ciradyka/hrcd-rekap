-- ============================================================================
-- hrcd-rekap : 0014_rename_common_columns.sql
--
-- Lanjutan 0012: kata UMUM di database ikut Inggris. Ini kosakata biasa yang
-- kebetulan dipakai sebagai nama kolom (nama, aktif, alasan, catatan), bukan
-- istilah lomba. Kosakata DOMAIN tetap utuh (CLAUDE.md 5.3): regu, kloter,
-- nomor_dada, golongan, sekolah, pembayaran, pendaftaran, wahana, pos, barak,
-- kwitansi, daftar_ulang.
--
-- View, policy RLS, constraint, dan index ikut ter-update sendiri saat RENAME
-- (pohon parse). Yang TIDAK ikut adalah body fungsi plpgsql — disimpan sebagai
-- teks — jadi ketujuh belas fungsi di bawah dibuat ulang, disalin terprogram
-- dari definisi TERBARU masing-masing (beberapa sudah ditulis ulang di 0011,
-- 0012, dan 0013; menyalin dari 0004 akan memundurkannya).
--
-- Penggantian dilakukan sadar konteks: dilewati di dalam komentar dan di dalam
-- literal string. Itu wajib — `alasan`, `batal`, dan `nama` juga muncul sebagai
-- KUNCI JSON (jsonb_build_object('alasan', ...)) dan sebagai NILAI status
-- ('batal'); mengubahnya akan merusak bentuk audit dan logika status tanpa ada
-- yang gagal saat migrasi dijalankan.
-- ============================================================================

-- 1. Kolom -------------------------------------------------------------
alter table edisi rename column nama to name;
alter table edisi rename column aktif to is_active;
alter table pos rename column nama to name;
alter table wahana rename column nama to name;
alter table wahana rename column jenis to type;
alter table wahana rename column bentuk to form;
alter table wahana rename column urutan to sort_order;
alter table kontrak_opsi rename column urutan to sort_order;
alter table sekolah rename column nama to name;
alter table sekolah rename column alamat to address;
alter table nomor_dada_pensiun rename column alasan to reason;
alter table regu rename column batal to is_cancelled;
alter table pembayaran rename column nominal to amount;
alter table pembayaran rename column metode to method;
alter table nilai_mentah rename column sumber to source;
alter table closing_regu rename column catatan to note;
alter table ruangan rename column nama to name;
alter table ruangan rename column kapasitas to capacity;
alter table penempatan_barak rename column ruangan_id to room_id;
alter table akun_panitia rename column aktif to is_active;

-- 2. Tabel ruangan -> room ---------------------------------------------
alter table ruangan rename to room;

-- 3. Fungsi yang body-nya menyebut kolom di atas -----------------------

-- terbaru dari 0002_functions.sql
create or replace function peran()
returns text
language sql stable security definer
set search_path = public
as $$
  select peran from akun_panitia
  where user_id = auth.uid() and is_active
$$;

-- terbaru dari 0002_functions.sql
create or replace function pos_saya()
returns smallint
language sql stable security definer
set search_path = public
as $$
  select pos from akun_panitia
  where user_id = auth.uid() and is_active
$$;

-- terbaru dari 0002_functions.sql
create or replace function edisi_aktif()
returns smallint
language sql stable
set search_path = public
as $$
  select nomor from edisi where is_active
$$;

-- terbaru dari 0013_nama_kontak.sql
create or replace function submit_pendaftaran(
  p_nama_sekolah   text,
  p_alamat_sekolah text,
  p_butuh_barak    boolean,
  p_kontak_wa      text,
  p_regu           jsonb,
  p_jumlah_pendamping smallint default 0,
  p_kunci_kirim    uuid default null,
  p_nama_kontak    text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_sekolah  uuid;
  v_batch    uuid;
  v_kode     text;
  v_n        int;
  v_r        jsonb;
  v_ada      pendaftaran%rowtype;
begin
  -- Kiriman ulang dengan kunci yang sama: kembalikan hasil yang dulu.
  if p_kunci_kirim is not null then
    select * into v_ada from pendaftaran where kunci_kirim = p_kunci_kirim;
    if found then
      return jsonb_build_object(
        'kode_pembayaran', v_ada.kode_pembayaran,
        'jumlah_regu', v_ada.jumlah_regu,
        'total_tagihan', v_ada.jumlah_regu * (select biaya_per_regu from edisi where is_active),
        'terkirim_ulang', true);
    end if;
  end if;

  v_n := jsonb_array_length(p_regu);
  if v_n is null or v_n < 1 then
    raise exception 'minimal satu regu';
  end if;
  if v_n > 30 then
    raise exception 'maksimal 30 regu per pendaftaran';
  end if;
  if p_kontak_wa is null or length(trim(p_kontak_wa)) < 8 then
    raise exception 'kontak WA wajib diisi';
  end if;

  for v_r in select * from jsonb_array_elements(p_regu) loop
    if coalesce(trim(v_r ->> 'nama_regu'), '') = '' then
      raise exception 'nama regu wajib diisi';
    end if;
    if coalesce(trim(v_r ->> 'nama_ketua'), '') = '' then
      raise exception 'nama ketua wajib diisi';
    end if;
    if coalesce(v_r ->> 'golongan', '') not in
       ('penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi') then
      raise exception 'golongan tidak dikenal: %', coalesce(v_r ->> 'golongan', '(kosong)');
    end if;
  end loop;

  insert into sekolah (name, address)
  values (trim(p_nama_sekolah), trim(p_alamat_sekolah))
  on conflict (name, address) do nothing;
  select id into v_sekolah from sekolah
  where name = trim(p_nama_sekolah) and address = trim(p_alamat_sekolah);

  loop
    v_kode := 'HRCD' || edisi_aktif() || '-' ||
              upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from pendaftaran where kode_pembayaran = v_kode);
  end loop;

  insert into pendaftaran (sekolah_id, kode_pembayaran, butuh_barak,
                           jumlah_pendamping, jumlah_regu, kontak_wa, kunci_kirim, nama_kontak)
  values (v_sekolah, v_kode, coalesce(p_butuh_barak, false),
          greatest(coalesce(p_jumlah_pendamping, 0), 0), v_n, trim(p_kontak_wa),
          p_kunci_kirim, nullif(trim(coalesce(p_nama_kontak, '')), ''))
  returning id into v_batch;

  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  select v_batch, trim(r ->> 'nama_regu'), trim(r ->> 'nama_ketua'), r ->> 'golongan'
  from jsonb_array_elements(p_regu) r;

  return jsonb_build_object(
    'kode_pembayaran', v_kode,
    'jumlah_regu', v_n,
    'total_tagihan', v_n * (select biaya_per_regu from edisi where is_active));
end;
$$;

-- terbaru dari 0012_rename_audit_columns.sql
create or replace function verifikasi_pembayaran(
  p_kode    text,
  p_nominal integer,
  p_metode  text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_batch     pendaftaran%rowtype;
  v_tagihan   integer;
  v_kwitansi  text;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;

  select * into v_batch from pendaftaran where kode_pembayaran = p_kode for update;
  if not found then
    raise exception 'kode pembayaran tidak dikenal: %', p_kode;
  end if;
  if v_batch.status <> 'menunggu_pembayaran' then
    raise exception 'batch berstatus %, bukan menunggu_pembayaran', v_batch.status;
  end if;

  -- Semua-atau-tidak: nominal harus pas seluruh batch (alur 3.5).
  select v_batch.jumlah_regu * biaya_per_regu into v_tagihan from edisi where is_active;
  if p_nominal <> v_tagihan then
    raise exception 'nominal % tidak sama dengan tagihan % — pembayaran sebagian tidak dilayani; sarankan daftar batch lebih kecil',
      p_nominal, v_tagihan;
  end if;

  v_kwitansi := 'KW-HRCD' || edisi_aktif() || '-' ||
                lpad(nextval('kwitansi_seq')::text, 4, '0');

  insert into pembayaran (pendaftaran_id, amount, method, nomor_kwitansi, verified_by)
  values (v_batch.id, p_nominal, p_metode, v_kwitansi, auth.uid());

  update pendaftaran set status = 'lunas' where id = v_batch.id;

  return jsonb_build_object('nomor_kwitansi', v_kwitansi);
end;
$$;

-- terbaru dari 0012_rename_audit_columns.sql
create or replace function batalkan_verifikasi(
  p_kode   text,
  p_alasan text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_bayar pembayaran%rowtype;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan pembatalan wajib diisi';
  end if;

  select b.* into v_bayar
  from pembayaran b join pendaftaran d on d.id = b.pendaftaran_id
  where d.kode_pembayaran = p_kode
  for update;
  if not found then
    raise exception 'tidak ada pembayaran untuk kode %', p_kode;
  end if;

  -- Temuan review: membatalkan verifikasi SETELAH daftar ulang meninggalkan
  -- regu yatim — bernomor dada & berkloter tapi "belum bayar", hilang dari
  -- kwitansi dan tergusur dari barak. Tolak keras.
  if exists (select 1 from regu r
             where r.pendaftaran_id = v_bayar.pendaftaran_id
               and r.nomor_dada is not null) then
    raise exception 'batch sudah daftar ulang (nomor dada terbit) — pembatalan harus lewat admin dengan mengosongkan nomor dada dulu';
  end if;

  -- Hari yang sama dihitung dalam WIB, bukan zona server (temuan review).
  if peran() = 'meja'
     and (v_bayar.verified_at at time zone 'Asia/Jakarta')::date
         <> (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'meja hanya boleh membatalkan verifikasi di hari yang sama — hubungi admin';
  end if;

  -- Alasan ikut terekam riwayat lewat trigger audit pada DELETE + catatan ini.
  insert into history (table_name, row_id, action, new_value, changed_by)
  values ('pembayaran', v_bayar.id::text, 'DELETE',
          jsonb_build_object('alasan_pembatalan', p_alasan), auth.uid());

  delete from pembayaran where id = v_bayar.id;
  update pendaftaran set status = 'menunggu_pembayaran' where id = v_bayar.pendaftaran_id;
end;
$$;

-- terbaru dari 0011_nomor_dada_manual.sql
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
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
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
  perform pg_advisory_xact_lock(hashtext('hrcd_kloter_assign'));

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

    -- Putaran 1: hormati lompatan + hindari sekolah sama, dalam 1..kloter_dasar.
    if v_mulai is null then
      v_langkah := 1;  -- pencarian pertama: kloter layak termuda
    else
      v_langkah := v_cfg.lompatan_kloter;
    end if;
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

    -- Putaran 2: masih hindari sekolah sama tapi abaikan lompatan (wrap).
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

    -- Putaran 3: 1..kloter_dasar masih ada tempat tapi semuanya berisi
    -- sekolah ini — sekolah sama boleh berkumpul DULU sebelum membuka
    -- kloter cadangan (alur 5.2: 31-40 hanya bila 1-30 penuh; alur 5.4:
    -- "sesedikit mungkin", bukan larangan mutlak). Pilih yang paling kosong.
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

    -- Putaran 4: kloter dasar benar-benar penuh — buka cadangan
    -- (31..kloter_maks), hindari sekolah sama dulu lalu bebas.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor between v_cfg.kloter_dasar + 1 and v_cfg.kloter_maks
        and k.jam_berangkat is null
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (k.nomor = any (v_terpakai)),   -- false (bebas sekolah) dulu
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

-- terbaru dari 0012_rename_audit_columns.sql
create or replace function tukar_nomor_dada(
  p_regu       uuid,
  p_nomor_baru integer,
  p_alasan     text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu regu%rowtype;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan tukar wajib diisi';
  end if;

  select * into v_regu from regu where id = p_regu for update;
  if not found then
    raise exception 'regu tidak ditemukan';
  end if;
  if v_regu.is_cancelled then
    raise exception 'regu berstatus batal';
  end if;
  if v_regu.nomor_dada is null then
    raise exception 'regu belum punya nomor dada';
  end if;
  -- Setelah kloter berangkat, lembar kertas beredar memakai nomor lama —
  -- penukaran hanya boleh oleh admin yang paham konsekuensinya.
  if peran() <> 'admin' and exists (
       select 1 from kloter where nomor = v_regu.kloter_nomor
         and jam_berangkat is not null) then
    raise exception 'kloter sudah berangkat — tukar nomor hanya lewat admin';
  end if;
  if not exists (select 1 from nomor_dada_stok where nomor = p_nomor_baru) then
    raise exception 'nomor % tidak ada di stok', p_nomor_baru;
  end if;
  if exists (select 1 from regu where nomor_dada = p_nomor_baru)
     or exists (select 1 from nomor_dada_pensiun where nomor = p_nomor_baru) then
    raise exception 'nomor % sudah terpakai / pensiun', p_nomor_baru;
  end if;

  insert into history (table_name, row_id, regu_id, action, new_value, changed_by)
  values ('regu', p_regu::text, p_regu, 'UPDATE',
          jsonb_build_object('alasan_tukar_nomor', p_alasan,
                             'nomor_lama', v_regu.nomor_dada,
                             'nomor_baru', p_nomor_baru), auth.uid());

  -- Nomor lama PENSIUN — tidak pernah terbit ulang ke regu lain, supaya
  -- lembar/foto lama yang masih menuliskannya tidak menilai regu yang salah.
  insert into nomor_dada_pensiun (nomor, reason)
  values (v_regu.nomor_dada, p_alasan);

  update regu set nomor_dada = p_nomor_baru where id = p_regu;
end;
$$;

-- terbaru dari 0004_rpcs.sql
create or replace function berangkatkan_kloter(
  p_kloter smallint,
  p_jam    timestamptz
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tanpa_kontrak text;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if p_jam is null then
    raise exception 'jam berangkat wajib diketik';
  end if;
  if exists (select 1 from kloter where nomor = p_kloter and jam_berangkat is not null) then
    raise exception 'kloter % sudah berangkat', p_kloter;
  end if;
  -- Papan pipeline diturunkan dari max(nomor berangkat) — satu ketukan salah
  -- (memberangkatkan kloter kosong / melompati) merusak seluruh papan.
  -- Guard: kloter harus berisi regu, dan tidak boleh melompati kloter berisi
  -- regu yang belum berangkat (temuan review).
  if not exists (select 1 from regu r where r.kloter_nomor = p_kloter and not r.is_cancelled) then
    raise exception 'kloter % tidak berisi regu', p_kloter;
  end if;
  if exists (
       select 1 from kloter k
       where k.nomor < p_kloter and k.jam_berangkat is null
         and exists (select 1 from regu r
                     where r.kloter_nomor = k.nomor and not r.is_cancelled)) then
    raise exception 'masih ada kloter sebelum % yang belum berangkat — urutan keberangkatan wajib berurut', p_kloter;
  end if;

  -- Regu yang diceklis berangkat wajib sudah berkontrak — mencegah penalti
  -- waktu yang tak terhitung (NULL) di kemudian hari.
  select string_agg(r.nomor_dada::text, ', ') into v_tanpa_kontrak
  from regu r
  join keberangkatan_regu k on k.regu_id = r.id
  where r.kloter_nomor = p_kloter and r.kontrak_menit is null;
  if v_tanpa_kontrak is not null then
    raise exception 'regu nomor dada % belum konfirmasi kontrak waktu', v_tanpa_kontrak;
  end if;

  update kloter set jam_berangkat = p_jam where nomor = p_kloter;
end;
$$;

-- terbaru dari 0012_rename_audit_columns.sql
create or replace function batalkan_keberangkatan(p_kloter smallint, p_alasan text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if peran() <> 'admin' then
    raise exception 'hanya admin';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan wajib diisi';
  end if;
  if p_kloter <> (select max(nomor) from kloter where jam_berangkat is not null) then
    raise exception 'hanya kloter berangkat terakhir yang bisa dibatalkan';
  end if;
  insert into history (table_name, row_id, action, new_value, changed_by)
  values ('kloter', p_kloter::text, 'UPDATE',
          jsonb_build_object('alasan_batal_berangkat', p_alasan), auth.uid());
  update kloter set jam_berangkat = null where nomor = p_kloter;
end;
$$;

-- terbaru dari 0012_rename_audit_columns.sql
create or replace function simpan_nilai_massal(
  p_baris  jsonb,  -- [{"nomor_dada":1,"kode":"lari_zigzag","nilai_1":40,"nilai_2":null}, ...]
  p_sumber text default 'upload',
  p_pos    smallint default null  -- wajib untuk admin; operator memakai pos-nya sendiri
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_r      jsonb;
  v_regu   regu%rowtype;
  v_wahana wahana%rowtype;
  v_hasil  jsonb := '[]'::jsonb;
  v_status text;
  v_alasan text;
  v_idx    int := 0;
  v_pos    smallint;
  v_kunci  text;
  v_sudah  text[] := '{}';
  v_n1     numeric;
  v_n2     numeric;
begin
  if peran() = 'operator_pos' then
    v_pos := pos_saya();
  elsif peran() = 'admin' then
    v_pos := p_pos;
    if v_pos is null then
      raise exception 'admin wajib menyebut pos (p_pos)';
    end if;
  else
    raise exception 'hanya operator pos / admin';
  end if;
  if p_sumber not in ('manual', 'upload') then
    raise exception 'sumber tidak dikenal: %', p_sumber;
  end if;

  for v_r in select * from jsonb_array_elements(p_baris) loop
    v_idx := v_idx + 1;
    v_status := 'tersimpan'; v_alasan := null;

    -- Seluruh pemrosesan baris terlindungi: format angka rusak di baris 7
    -- tidak boleh menggagalkan 26 baris lain (temuan review).
    begin
      v_n1 := (v_r ->> 'nilai_1')::numeric;
      v_n2 := nullif(v_r ->> 'nilai_2', '')::numeric;

      -- Baris ganda dalam SATU paste = merah (bagian 6.3) — juga di server.
      v_kunci := (v_r ->> 'nomor_dada') || '|' ||
                 regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g');
      if v_kunci = any (v_sudah) then
        raise exception 'baris ganda dalam paste (nomor dada + komponen sama)';
      end if;
      v_sudah := v_sudah || v_kunci;

      -- Regu: harus dikenal, bernomor, tidak batal.
      select * into v_regu from regu
      where nomor_dada = (v_r ->> 'nomor_dada')::integer and not is_cancelled;
      if not found then
        raise exception 'nomor dada tidak dikenal / regu batal';
      end if;

      -- Komponen: HANYA pos ini (kode boleh kembar antar pos — temuan
      -- review); normalisasi dua arah supaya "Lari Zigzag" dari header foto
      -- cocok dengan kode lari_zigzag.
      select w.* into v_wahana from wahana w
      where w.edisi = edisi_aktif()
        and w.pos = v_pos
        and regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g')
            = regexp_replace(w.kode, '[^a-z0-9]', '', 'g');
      if not found then
        raise exception 'kode komponen tidak dikenal di pos % — mungkin ini lembar pos lain?', v_pos;
      end if;

      -- Rentang wajar dari konfigurasi (merah di preview = tolak di server).
      if v_n1 is null
         or v_n1 not between v_wahana.rentang_mentah_min and v_wahana.rentang_mentah_maks then
        raise exception 'nilai % di luar rentang wajar %-%',
          coalesce(v_r ->> 'nilai_1', '(kosong)'),
          v_wahana.rentang_mentah_min, v_wahana.rentang_mentah_maks;
      end if;
      -- nilai_2 (jumlah salah) ikut divalidasi (temuan review).
      if v_n2 is not null
         and v_n2 not between 0 and v_wahana.rentang_mentah_maks then
        raise exception 'nilai_2 % di luar rentang 0-%', v_n2, v_wahana.rentang_mentah_maks;
      end if;

      insert into nilai_mentah (regu_id, wahana_id, nilai_1, nilai_2, source, created_by)
      values (v_regu.id, v_wahana.id, v_n1, v_n2, p_sumber, auth.uid())
      on conflict (regu_id, wahana_id) do update set
        nilai_1 = excluded.nilai_1,
        nilai_2 = excluded.nilai_2,
        source  = excluded.source,
        created_by = excluded.created_by,
        created_at = now()
      -- Simpan ulang tanpa perubahan = tidak menulis apa pun: kepengarangan
      -- tidak tergeser, riwayat tidak dibanjiri (temuan review).
      where nilai_mentah.nilai_1 is distinct from excluded.nilai_1
         or nilai_mentah.nilai_2 is distinct from excluded.nilai_2;

    exception when others then
      v_status := 'ditolak';
      v_alasan := sqlerrm;
    end;

    v_hasil := v_hasil || jsonb_build_object(
      'baris', v_idx,
      'nomor_dada', v_r ->> 'nomor_dada',
      'kode', v_r ->> 'kode',
      'status', v_status,
      'alasan', v_alasan);
  end loop;

  return v_hasil;
end;
$$;

-- terbaru dari 0012_rename_audit_columns.sql
create or replace function catat_closing(
  p_nomor_dada    integer,
  p_jam_datang    timestamptz,
  p_anggota_hadir smallint default 5,
  p_catatan       text default null
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu regu%rowtype;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if p_jam_datang is null then
    raise exception 'jam datang wajib diketik';
  end if;

  select * into v_regu from regu where nomor_dada = p_nomor_dada;
  if not found then
    raise exception 'nomor dada % tidak dikenal', p_nomor_dada;
  end if;
  if v_regu.is_cancelled then
    raise exception 'regu % berstatus batal', p_nomor_dada;
  end if;
  if not exists (select 1 from keberangkatan_regu where regu_id = v_regu.id) then
    raise exception 'regu % belum tercatat berangkat', p_nomor_dada;
  end if;

  insert into closing_regu (regu_id, jam_datang, anggota_hadir, recorded_by, note)
  values (v_regu.id, p_jam_datang, p_anggota_hadir, auth.uid(), p_catatan)
  on conflict (regu_id) do update set
    jam_datang    = excluded.jam_datang,
    anggota_hadir = excluded.anggota_hadir,
    recorded_by  = excluded.recorded_by,
    recorded_at  = now(),
    note       = excluded.note
  -- Simpan ulang tanpa perubahan tidak menulis (kepengarangan & riwayat).
  where closing_regu.jam_datang    is distinct from excluded.jam_datang
     or closing_regu.anggota_hadir is distinct from excluded.anggota_hadir
     or closing_regu.note       is distinct from excluded.note;
end;
$$;

-- terbaru dari 0012_rename_audit_columns.sql
create or replace function ceklis_berangkat(p_nomor_dada integer)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  select id into v_id from regu where nomor_dada = p_nomor_dada and not is_cancelled;
  if not found then
    raise exception 'nomor dada % tidak dikenal / batal', p_nomor_dada;
  end if;
  -- Ceklis MENYUSUL (kloter sudah berangkat) wajib berkontrak dulu — tanpa
  -- ini regu lolos penalti waktu selamanya (temuan review, blocker).
  if exists (
       select 1 from regu r
       join kloter k on k.nomor = r.kloter_nomor
       where r.id = v_id and k.jam_berangkat is not null
         and r.kontrak_menit is null) then
    raise exception 'kloter sudah berangkat dan regu belum berkontrak — konfirmasi kontrak dulu (admin)';
  end if;
  insert into keberangkatan_regu (regu_id, recorded_by)
  values (v_id, auth.uid())
  on conflict (regu_id) do nothing;
end;
$$;

-- terbaru dari 0004_rpcs.sql
create or replace function susun_barak()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_b   record;
  v_r   record;
  v_sisa integer;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;

  delete from penempatan_barak;

  -- Kebutuhan per batch: regu aktif x 5 + pendamping, terbesar dulu.
  for v_b in
    select d.id, (count(r.id) filter (where not r.is_cancelled)) * 5
           + d.jumlah_pendamping as butuh
    from pendaftaran d
    join regu r on r.pendaftaran_id = d.id
    where d.butuh_barak and d.status = 'lunas'
    group by d.id, d.jumlah_pendamping
    having (count(r.id) filter (where not r.is_cancelled)) > 0
    order by butuh desc
  loop
    v_sisa := v_b.butuh;

    -- Urutan prioritas per sisa (temuan review: "pas-dulu" yang lama justru
    -- memecah sekolah yang sebenarnya muat satu ruangan):
    --   1) ruangan KOSONG terkecil yang MUAT seluruh sisa  -> 1 sekolah 1 ruangan
    --   2) ruangan KOSONG terbesar                          -> pecah seminimal mungkin
    --   3) sisa ruangan BERPENGHUNI terkecil yang muat      -> gabung, terpaksa
    --   4) sisa ruangan BERPENGHUNI terbesar                -> gabung + pecah
    while v_sisa > 0 loop
      select * into v_r from (
        select ru.id,
               ru.capacity - coalesce((select sum(p.jumlah_orang)
                 from penempatan_barak p where p.room_id = ru.id), 0) as longgar,
               not exists (select 1 from penempatan_barak p
                           where p.room_id = ru.id) as kosong
        from room ru
      ) x
      where x.longgar > 0
      order by
        case
          when x.kosong and x.longgar >= v_sisa then 1
          when x.kosong                          then 2
          when x.longgar >= v_sisa               then 3
          else 4
        end,
        case when x.longgar >= v_sisa then x.longgar end asc,   -- paling pas
        x.longgar desc                                          -- paling lapang
      limit 1;

      if v_r.id is null then
        raise exception 'kapasitas barak kurang % orang untuk batch % — tambah ruangan',
          v_sisa, v_b.id;
      end if;

      insert into penempatan_barak (pendaftaran_id, room_id, jumlah_orang)
      values (v_b.id, v_r.id, least(v_sisa, v_r.longgar));
      v_sisa := v_sisa - least(v_sisa, v_r.longgar);
      v_r := null;
    end loop;
  end loop;
end;
$$;

-- terbaru dari 0008_cetak_kloter.sql
create or replace function tandai_kloter_dicetak(p_kloter smallint[] default null)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_jumlah integer;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;

  update kloter k
  set dicetak_pada = now()
  where k.dicetak_pada is null
    and (p_kloter is null or k.nomor = any (p_kloter))
    and exists (select 1 from regu r
                join pendaftaran d on d.id = r.pendaftaran_id
                where r.kloter_nomor = k.nomor and not r.is_cancelled
                  and d.status = 'lunas');
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;

-- terbaru dari 0012_rename_audit_columns.sql
create or replace function batalkan_tanda_cetak(p_kloter smallint, p_alasan text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if peran() <> 'admin' then
    raise exception 'hanya admin';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan wajib diisi';
  end if;
  insert into history (table_name, row_id, action, new_value, changed_by)
  values ('kloter', p_kloter::text, 'UPDATE',
          jsonb_build_object('alasan_batal_tanda_cetak', p_alasan), auth.uid());
  update kloter set dicetak_pada = null where nomor = p_kloter;
end;
$$;

-- terbaru dari 0012_rename_audit_columns.sql
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

  select * into v_cfg from edisi where is_active;

  -- Serialisasi bersama daftar ulang: keduanya menyentuh isi kloter.
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  select * into v_regu from regu where nomor_dada = p_nomor_dada for update;
  if not found then
    raise exception 'nomor dada % tidak dikenal', p_nomor_dada;
  end if;
  if v_regu.is_cancelled then
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

  insert into history (table_name, row_id, regu_id, action, new_value, changed_by)
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

-- 4. Hak akses submit_pendaftaran ikut dipasang ulang: fungsi yang dibuat
--    ulang lahir dengan EXECUTE ke PUBLIC (default PostgreSQL), yang berarti
--    akun panitia mana pun bisa melewati gerbang Worker + Turnstile.
revoke execute on function
  submit_pendaftaran(text, text, boolean, text, jsonb, smallint, uuid, text)
  from public, anon, authenticated;
grant execute on function
  submit_pendaftaran(text, text, boolean, text, jsonb, smallint, uuid, text)
  to service_role;
