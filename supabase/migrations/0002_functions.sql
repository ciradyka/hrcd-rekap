-- ============================================================================
-- hrcd-rekap : 0002_functions.sql
-- Fungsi helper, mesin konversi poin, dan trigger.
-- Acuan: docs/rancangan-b.md bagian 3 (akses) dan 5 (mesin skor).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper akses — dipakai seluruh policy RLS
-- ---------------------------------------------------------------------------

-- Peran akun yang sedang login; null bila tidak punya akun aktif.
create or replace function peran()
returns text
language sql stable security definer
set search_path = public
as $$
  select peran from akun_panitia
  where user_id = auth.uid() and aktif
$$;

-- Nomor pos milik operator_pos yang sedang login; null untuk peran lain.
create or replace function pos_saya()
returns smallint
language sql stable security definer
set search_path = public
as $$
  select pos from akun_panitia
  where user_id = auth.uid() and aktif
$$;

-- Edisi yang sedang aktif (tepat satu — index edisi_satu_aktif).
create or replace function edisi_aktif()
returns smallint
language sql stable
set search_path = public
as $$
  select nomor from edisi where aktif
$$;

-- ---------------------------------------------------------------------------
-- 2. Mesin konversi — satu fungsi IMMUTABLE untuk lima bentuk
--    (rancangan-b.md 5.2.1). Semua skor dihitung saat dibaca; tidak ada
--    angka turunan yang disimpan.
-- ---------------------------------------------------------------------------

create or replace function hitung_poin(
  p_bentuk       text,
  p_nilai_1      numeric,
  p_nilai_2      numeric,
  p_poin_maks    numeric,
  p_raw_terbaik  numeric,
  p_raw_terburuk numeric,
  p_poin_benar   numeric,
  p_poin_salah   numeric,
  p_total_soal   numeric
) returns numeric
language sql immutable
as $$
  select round(case p_bentuk
    -- Interpolasi linear raw_terburuk→0 .. raw_terbaik→poin_maks, di-clamp.
    -- Satu rumus untuk dua arah: kecil_baik punya terbaik < terburuk,
    -- besar_baik sebaliknya — pembaginya ikut bertanda.
    when 'kecil_baik' then
      least(greatest(
        p_poin_maks * (p_nilai_1 - p_raw_terburuk) / (p_raw_terbaik - p_raw_terburuk),
        0), p_poin_maks)
    when 'besar_baik' then
      least(greatest(
        p_poin_maks * (p_nilai_1 - p_raw_terburuk) / (p_raw_terbaik - p_raw_terburuk),
        0), p_poin_maks)
    -- Biner: kena/benar (nilai_1 > 0) atau tidak.
    when 'biner' then
      case when p_nilai_1 > 0 then p_poin_benar else p_poin_salah end
    -- Proporsi jawaban benar.
    when 'benar_per_total' then
      least(greatest(p_poin_maks * p_nilai_1 / p_total_soal, 0), p_poin_maks)
    -- Benar menambah, salah mengurangi (poin_salah disimpan negatif);
    -- di-clamp supaya tidak minus.
    when 'benar_kurang_salah' then
      least(greatest(
        p_poin_benar * p_nilai_1 + p_poin_salah * coalesce(p_nilai_2, 0),
        0), p_poin_maks)
  end, 2)
$$;

-- ---------------------------------------------------------------------------
-- 3. Audit — trigger generik ke tabel riwayat (rancangan-b.md 2.1).
--    SECURITY DEFINER supaya bisa menulis riwayat dari konteks peran mana pun;
--    riwayat sendiri tidak menerima INSERT langsung dari klien.
-- ---------------------------------------------------------------------------

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

  insert into riwayat (tabel, baris_id, regu_id, aksi, nilai_lama, nilai_baru, oleh)
  values (tg_table_name, v_baris, v_regu, tg_op, v_lama, v_baru, auth.uid());

  return coalesce(new, old);
end;
$$;

-- Audit menempel di semua tabel yang menyangkut nilai atau keputusan.
create trigger audit_regu               after insert or update or delete on regu               for each row execute function catat_riwayat();
create trigger audit_pendaftaran        after insert or update or delete on pendaftaran        for each row execute function catat_riwayat();
create trigger audit_pembayaran         after insert or update or delete on pembayaran         for each row execute function catat_riwayat();
create trigger audit_nilai_mentah       after insert or update or delete on nilai_mentah       for each row execute function catat_riwayat();
create trigger audit_closing_regu       after insert or update or delete on closing_regu       for each row execute function catat_riwayat();
create trigger audit_keberangkatan      after insert or update or delete on keberangkatan_regu for each row execute function catat_riwayat();
create trigger audit_kloter             after update on kloter                                 for each row execute function catat_riwayat();
create trigger audit_penempatan_barak   after insert or update or delete on penempatan_barak   for each row execute function catat_riwayat();
create trigger audit_status_acara       after update on status_acara                           for each row execute function catat_riwayat();
create trigger audit_edisi              after insert or update or delete on edisi              for each row execute function catat_riwayat();
create trigger audit_pos                after insert or update or delete on pos                for each row execute function catat_riwayat();
create trigger audit_wahana             after insert or update or delete on wahana             for each row execute function catat_riwayat();
create trigger audit_kontrak_opsi       after insert or update or delete on kontrak_opsi       for each row execute function catat_riwayat();
create trigger audit_konfig_penalti     after insert or update or delete on konfig_penalti     for each row execute function catat_riwayat();
-- Temuan review: akun_panitia adalah peta otorisasi seluruh sistem — tabel
-- paling wajib beraudit; sekolah tampil ke publik (autocomplete); ruangan &
-- stok menentukan kapasitas fisik.
create trigger audit_akun_panitia       after insert or update or delete on akun_panitia       for each row execute function catat_riwayat();
create trigger audit_sekolah            after insert or update or delete on sekolah            for each row execute function catat_riwayat();
create trigger audit_ruangan            after insert or update or delete on ruangan            for each row execute function catat_riwayat();
create trigger audit_nomor_dada_pensiun after insert or delete on nomor_dada_pensiun          for each row execute function catat_riwayat();

-- ---------------------------------------------------------------------------
-- 4. Kunci konfigurasi hari-H (rancangan-b.md 2.1 status_acara).
--    Saat terkunci, SEMUA tulisan ke tabel konfigurasi tertolak — termasuk
--    admin. Perlindungan dua langkah yang disengaja: admin harus membuka
--    kunci dulu di status_acara, baru bisa mengedit. Mencegah edit refleks
--    di tengah lomba.
-- ---------------------------------------------------------------------------

create or replace function tolak_saat_terkunci()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select konfigurasi_terkunci from status_acara) then
    raise exception 'konfigurasi sedang terkunci (hari-H) — buka kunci di layar Konfigurasi dulu'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger kunci_edisi          before insert or update or delete on edisi          for each row execute function tolak_saat_terkunci();
create trigger kunci_pos            before insert or update or delete on pos            for each row execute function tolak_saat_terkunci();
create trigger kunci_wahana         before insert or update or delete on wahana         for each row execute function tolak_saat_terkunci();
create trigger kunci_kontrak_opsi   before insert or update or delete on kontrak_opsi   for each row execute function tolak_saat_terkunci();
create trigger kunci_konfig_penalti before insert or update or delete on konfig_penalti for each row execute function tolak_saat_terkunci();
