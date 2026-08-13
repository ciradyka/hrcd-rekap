-- ============================================================================
-- hrcd-rekap : 0012_rename_audit_columns.sql
--
-- Menyeragamkan penamaan TEKNIS di database ke bahasa Inggris (CLAUDE.md 5.4,
-- 5.5, 5.9). Kolom audit adalah kasus paling jelas: `created_at` adalah
-- konvensi yang dipakai seluruh dunia, sementara `dibuat_pada` tidak bisa
-- dicari di dokumentasi mana pun — persis alasan yang ditulis aturan 5.5.
--
-- Kosakata DOMAIN tidak disentuh sama sekali (aturan 5.3): regu, kloter,
-- nomor_dada, golongan, sekolah, pembayaran, pendaftaran, wahana, pos,
-- barak, kwitansi semuanya tetap. Yang berubah hanya kata teknis di
-- sekitarnya.
--
-- KENAPA FUNGSI IKUT DIBUAT ULANG: PostgreSQL menyimpan view, policy RLS,
-- constraint, dan index sebagai pohon parse, jadi semuanya ikut ter-update
-- sendiri saat RENAME. Tapi body fungsi plpgsql disimpan sebagai TEKS —
-- ia TIDAK ikut berubah, dan baru meledak saat dipanggil di lapangan.
-- Karena itu kesepuluh fungsi yang menyentuh kolom-kolom ini dibuat ulang
-- di sini, isinya disalin terprogram dari migrasi aslinya.
--
-- Trigger tidak perlu disentuh: ALTER FUNCTION ... RENAME membuat seluruh
-- trigger yang memakainya ikut menunjuk ke nama baru.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Kolom audit di tabel-tabel biasa
-- --------------------------------------------------------------------------
alter table sekolah rename column dibuat_pada to created_at;
alter table pendaftaran rename column dibuat_pada to created_at;
alter table keberangkatan_regu rename column dicatat_pada to recorded_at;
alter table keberangkatan_regu rename column dicatat_oleh to recorded_by;
alter table closing_regu rename column dicatat_pada to recorded_at;
alter table closing_regu rename column dicatat_oleh to recorded_by;
alter table nilai_mentah rename column diinput_pada to created_at;
alter table nilai_mentah rename column diinput_oleh to created_by;
alter table pembayaran rename column diverifikasi_pada to verified_at;
alter table pembayaran rename column diverifikasi_oleh to verified_by;
alter table nomor_dada_pensiun rename column pada to retired_at;

-- --------------------------------------------------------------------------
-- 2. Tabel riwayat -> history, berikut kolomnya
-- --------------------------------------------------------------------------
alter table riwayat rename to history;
alter table history rename column tabel to table_name;
alter table history rename column baris_id to row_id;
alter table history rename column aksi to action;
alter table history rename column nilai_lama to old_value;
alter table history rename column nilai_baru to new_value;
alter table history rename column oleh to changed_by;
alter table history rename column pada to changed_at;

-- --------------------------------------------------------------------------
-- 3. Fungsi yang body-nya menyebut kolom di atas (disalin dari migrasi
--    asli, identifier-nya diganti). Tanpa ini semuanya meledak saat
--    dipanggil, bukan saat migrasi dijalankan.
-- --------------------------------------------------------------------------

-- dari 0002_functions.sql
create or replace function catat_riwayat()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_lama  jsonb;
  v_baru  jsonb;
  v_baris text;
  v_regu  uuid;
begin
  if tg_op <> 'INSERT' then v_lama := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_baru := to_jsonb(new); end if;

  -- Kunci baris sebagai teks (PK tabel bersangkutan).
  v_baris := coalesce(
    v_baru ->> 'id', v_lama ->> 'id',
    v_baru ->> 'regu_id', v_lama ->> 'regu_id',
    v_baru ->> 'nomor', v_lama ->> 'nomor',
    '?');

  -- regu_id supaya riwayat bisa dicari per regu (rancangan-b.md 11.11).
  v_regu := coalesce(
    (v_baru ->> 'regu_id')::uuid, (v_lama ->> 'regu_id')::uuid,
    case when tg_table_name = 'regu'
      then coalesce((v_baru ->> 'id')::uuid, (v_lama ->> 'id')::uuid) end);

  insert into history (table_name, row_id, regu_id, action, old_value, new_value, changed_by)
  values (tg_table_name, v_baris, v_regu, tg_op, v_lama, v_baru, auth.uid());

  return coalesce(new, old);
end;
$$;

-- dari 0004_rpcs.sql
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
  select v_batch.jumlah_regu * biaya_per_regu into v_tagihan from edisi where aktif;
  if p_nominal <> v_tagihan then
    raise exception 'nominal % tidak sama dengan tagihan % — pembayaran sebagian tidak dilayani; sarankan daftar batch lebih kecil',
      p_nominal, v_tagihan;
  end if;

  v_kwitansi := 'KW-HRCD' || edisi_aktif() || '-' ||
                lpad(nextval('kwitansi_seq')::text, 4, '0');

  insert into pembayaran (pendaftaran_id, nominal, metode, nomor_kwitansi, verified_by)
  values (v_batch.id, p_nominal, p_metode, v_kwitansi, auth.uid());

  update pendaftaran set status = 'lunas' where id = v_batch.id;

  return jsonb_build_object('nomor_kwitansi', v_kwitansi);
end;
$$;

-- dari 0004_rpcs.sql
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

-- dari 0004_rpcs.sql
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
  if v_regu.batal then
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
  insert into nomor_dada_pensiun (nomor, alasan)
  values (v_regu.nomor_dada, p_alasan);

  update regu set nomor_dada = p_nomor_baru where id = p_regu;
end;
$$;

-- dari 0004_rpcs.sql
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

-- dari 0004_rpcs.sql
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
      where nomor_dada = (v_r ->> 'nomor_dada')::integer and not batal;
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

      insert into nilai_mentah (regu_id, wahana_id, nilai_1, nilai_2, sumber, created_by)
      values (v_regu.id, v_wahana.id, v_n1, v_n2, p_sumber, auth.uid())
      on conflict (regu_id, wahana_id) do update set
        nilai_1 = excluded.nilai_1,
        nilai_2 = excluded.nilai_2,
        sumber  = excluded.sumber,
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

-- dari 0004_rpcs.sql
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
  if v_regu.batal then
    raise exception 'regu % berstatus batal', p_nomor_dada;
  end if;
  if not exists (select 1 from keberangkatan_regu where regu_id = v_regu.id) then
    raise exception 'regu % belum tercatat berangkat', p_nomor_dada;
  end if;

  insert into closing_regu (regu_id, jam_datang, anggota_hadir, recorded_by, catatan)
  values (v_regu.id, p_jam_datang, p_anggota_hadir, auth.uid(), p_catatan)
  on conflict (regu_id) do update set
    jam_datang    = excluded.jam_datang,
    anggota_hadir = excluded.anggota_hadir,
    recorded_by  = excluded.recorded_by,
    recorded_at  = now(),
    catatan       = excluded.catatan
  -- Simpan ulang tanpa perubahan tidak menulis (kepengarangan & riwayat).
  where closing_regu.jam_datang    is distinct from excluded.jam_datang
     or closing_regu.anggota_hadir is distinct from excluded.anggota_hadir
     or closing_regu.catatan       is distinct from excluded.catatan;
end;
$$;

-- dari 0004_rpcs.sql
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
  select id into v_id from regu where nomor_dada = p_nomor_dada and not batal;
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

-- dari 0008_cetak_kloter.sql
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

-- dari 0009_sisip_kloter.sql
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

-- --------------------------------------------------------------------------
-- 4. Nama fungsi trigger audit ikut Inggris. Trigger yang memakainya
--    otomatis menunjuk ke nama baru.
-- --------------------------------------------------------------------------
alter function catat_riwayat() rename to record_history;
