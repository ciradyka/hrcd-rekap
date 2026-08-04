-- ============================================================================
-- hrcd-rekap : 0008_cetak_kloter.sql
--
-- Panitia: "nanti kloter final akan diprint."
--
-- Begitu daftar kloter dicetak dan dibagikan, KERTAS menjadi kebenaran di
-- lapangan — panitia garis start memanggil regu dari kertas, bukan dari layar.
-- Karena itu setiap perubahan kloter SETELAH cetak membuat kertas berbohong
-- tanpa ada yang menyadarinya.
--
-- Kejadian nyatanya: sekolah datang terlambat, daftar ulang setelah cetakan
-- dibagikan, dan regunya diselipkan ke kloter yang sudah tercetak. Di garis
-- start, kloter itu memanggil 10 nama padahal kertas hanya memuat 9 — atau
-- lebih buruk, regu itu tidak pernah dipanggil sama sekali.
--
-- PERLINDUNGAN: kloter yang sudah dicetak DIBEKUKAN. Pendaftar susulan hanya
-- boleh masuk kloter yang belum pernah tercetak (cadangan 31-40), lalu
-- dicetakkan lembar tambahan untuk kloter itu saja.
-- ============================================================================

-- Penanda per kloter: kapan daftar isinya dicetak. NULL = belum pernah.
alter table kloter add column dicetak_pada timestamptz;

comment on column kloter.dicetak_pada is
  'Waktu daftar isi kloter ini dicetak. Setelah terisi, isi kloter dibekukan '
  'karena kertas sudah beredar di garis start.';

-- ---------------------------------------------------------------------------
-- 1. View cetak: satu baris per regu, urut kloter lalu nomor dada.
--    Kolomnya persis yang dibutuhkan panitia garis start untuk memanggil.
-- ---------------------------------------------------------------------------

create view v_daftar_kloter with (security_invoker = on) as
select
  r.kloter_nomor                        as kloter,
  r.urutan_kloter                       as urutan,
  r.nomor_dada,
  r.nama_regu,
  s.nama                                as nama_sekolah,
  r.golongan,
  k.dicetak_pada,
  k.jam_berangkat
from regu r
join kloter k       on k.nomor = r.kloter_nomor
join pendaftaran d  on d.id = r.pendaftaran_id
join sekolah s      on s.id = d.sekolah_id
where not r.batal
  and d.status = 'lunas'
  and r.kloter_nomor is not null
order by r.kloter_nomor, r.urutan_kloter;

grant select on v_daftar_kloter to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tandai kloter sebagai sudah dicetak.
--    Dipanggil layar cetak SETELAH pengguna menekan cetak — jadi penandaan
--    hanya terjadi kalau kertasnya memang benar-benar keluar.
-- ---------------------------------------------------------------------------

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
                where r.kloter_nomor = k.nomor and not r.batal
                  and d.status = 'lunas');
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;

-- Jalan mundur bila cetakan gagal/kertas macet — hanya admin, dengan alasan.
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
  insert into riwayat (tabel, baris_id, aksi, nilai_baru, oleh)
  values ('kloter', p_kloter::text, 'UPDATE',
          jsonb_build_object('alasan_batal_tanda_cetak', p_alasan), auth.uid());
  update kloter set dicetak_pada = null where nomor = p_kloter;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. daftar_ulang_batch: hormati kloter yang sudah dicetak.
--    Satu-satunya perubahan dari 0007 adalah syarat `dicetak_pada is null`
--    pada keempat putaran pemilihan kloter.
-- ---------------------------------------------------------------------------

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

  -- Gerbang tunggal (0007): tidak ada dua meja yang melihat stok yang sama.
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  select array_agg(r.id order by r.nama_regu, r.id) into v_regu
  from regu r
  where r.pendaftaran_id = v_batch.id
    and not r.batal and r.nomor_dada is null;
  v_n := coalesce(array_length(v_regu, 1), 0);
  if v_n = 0 then
    raise exception 'tidak ada regu yang menunggu nomor dada di batch ini (sudah daftar ulang, atau semua batal)';
  end if;

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

  select coalesce(array_agg(distinct r.kloter_nomor), '{}') into v_terpakai
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where d.sekolah_id = v_batch.sekolah_id and r.kloter_nomor is not null;

  v_mulai := null;
  for v_i in 1..v_n loop
    v_kandidat := null;
    if v_mulai is null then v_langkah := 1; else v_langkah := v_cfg.lompatan_kloter; end if;

    -- Putaran 1: lompatan + hindari sekolah sama, kloter dasar, BELUM DICETAK.
    select k.nomor into v_kandidat
    from kloter k
    where k.nomor <= v_cfg.kloter_dasar
      and k.jam_berangkat is null
      and k.dicetak_pada is null
      and (v_mulai is null or k.nomor >= v_mulai + v_langkah)
      and not (k.nomor = any (v_terpakai))
      and (select count(*) from regu r where r.kloter_nomor = k.nomor)
          < v_cfg.maks_regu_per_kloter
    order by k.nomor
    limit 1;

    -- Putaran 2: abaikan lompatan, masih hindari sekolah sama.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor <= v_cfg.kloter_dasar
        and k.jam_berangkat is null
        and k.dicetak_pada is null
        and not (k.nomor = any (v_terpakai))
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by k.nomor
      limit 1;
    end if;

    -- Putaran 3: berkumpul di kloter dasar sebelum membuka cadangan.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor <= v_cfg.kloter_dasar
        and k.jam_berangkat is null
        and k.dicetak_pada is null
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (select count(*) from regu r where r.kloter_nomor = k.nomor), k.nomor
      limit 1;
    end if;

    -- Putaran 4: kloter cadangan (31..maks) — jalur normal bagi pendaftar
    -- susulan setelah daftar kloter dicetak.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor between v_cfg.kloter_dasar + 1 and v_cfg.kloter_maks
        and k.jam_berangkat is null
        and k.dicetak_pada is null
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (k.nomor = any (v_terpakai)),
               (select count(*) from regu r where r.kloter_nomor = k.nomor),
               k.nomor
      limit 1;
    end if;

    if v_kandidat is null then
      raise exception 'tidak ada kloter yang masih bisa diisi — semua penuh, sudah berangkat, atau daftarnya sudah dicetak. Tambah kloter cadangan lewat admin.';
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

-- ---------------------------------------------------------------------------
-- 4. Jaring terakhir: trigger menolak perubahan kloter pada regu yang
--    kloternya SUDAH dicetak. Melindungi dari jalur mana pun — termasuk
--    koreksi admin lewat SQL langsung yang lupa aturan ini.
-- ---------------------------------------------------------------------------

create or replace function tolak_ubah_kloter_tercetak()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Pindah KELUAR dari kloter yang sudah dicetak.
  if old.kloter_nomor is not null
     and old.kloter_nomor is distinct from new.kloter_nomor
     and exists (select 1 from kloter where nomor = old.kloter_nomor
                 and dicetak_pada is not null) then
    raise exception 'kloter % sudah dicetak — isinya tidak boleh berubah. Batalkan tanda cetak lewat admin bila memang perlu cetak ulang.',
      old.kloter_nomor;
  end if;
  -- Masuk KE DALAM kloter yang sudah dicetak.
  if new.kloter_nomor is not null
     and new.kloter_nomor is distinct from old.kloter_nomor
     and exists (select 1 from kloter where nomor = new.kloter_nomor
                 and dicetak_pada is not null) then
    raise exception 'kloter % sudah dicetak — regu baru tidak boleh disisipkan ke sana.',
      new.kloter_nomor;
  end if;
  return new;
end;
$$;

create trigger jaga_kloter_tercetak
  before update of kloter_nomor on regu
  for each row execute function tolak_ubah_kloter_tercetak();

-- ---------------------------------------------------------------------------
-- 5. Hak eksekusi (model per-fungsi dari 0004).
-- ---------------------------------------------------------------------------

revoke execute on function tandai_kloter_dicetak(smallint[]) from public, anon;
revoke execute on function batalkan_tanda_cetak(smallint, text) from public, anon;
grant execute on function tandai_kloter_dicetak(smallint[]) to authenticated;
grant execute on function batalkan_tanda_cetak(smallint, text) to authenticated;
