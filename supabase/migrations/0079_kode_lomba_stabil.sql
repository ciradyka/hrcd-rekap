-- ============================================================================
-- hrcd-rekap : 0079_kode_lomba_stabil.sql
--
-- MENGGANTI NAMA LOMBA TIDAK BOLEH MENGHILANGKAN FOTONYA.
--
-- ---------------------------------------------------------------------------
-- APA YANG RUSAK SEBELUM INI
--
-- `foto_lembar.kode_lomba` (0047) menyimpan SLUG DARI NAMA lomba: "Semaphore"
-- disimpan sebagai `semaphore`. Kuncinya diturunkan ulang tiap kali dibaca —
-- `slug_lomba(coalesce(w.lomba, w.name))` di `catat_foto_masuk` (0074:238) dan
-- di layar lewat `slugLomba()`.
--
-- Artinya nama lomba adalah IDENTITASNYA. Ganti "Semaphore" jadi "Bendera" —
-- satu UPDATE yang terlihat tidak berbahaya, dan memang itu yang diminta kalau
-- lombanya berganti — dan seluruh foto yang sudah diunggah untuk lomba itu
-- lenyap dari layar: dialog mencari `bendera`, barisnya menyandang `semaphore`.
-- RPC-nya pun menolak kode lama, jadi foto lama tidak bisa ditulis ulang.
-- Tidak ada galat. Fotonya masih ada di storage, tidak ada satu pun layar yang
-- menemukannya lagi.
--
-- Itu jenis kerusakan yang paling mahal di acara ini: bukti yang hilang justru
-- saat ada yang mempertanyakan sebuah nilai.
--
-- ---------------------------------------------------------------------------
-- YANG DIKERJAKAN: KUNCINYA DIBEKUKAN, BUKAN DIHITUNG ULANG
--
-- `wahana.kode_lomba` menyimpan kunci itu SEBAGAI DATA. Isinya diisi persis
-- dengan yang dihitung hari ini — `slug_lomba(coalesce(lomba, name))` — jadi
-- pada saat migrasi ini jalan TIDAK ADA satu pun kunci yang berubah, dan
-- seluruh foto yang sudah ada tetap ketemu. Yang berubah cuma sifatnya:
-- sesudah ini nama boleh berganti dan kuncinya diam.
--
-- Dibekukan, bukan diganti jadi `kode`. Menurunkan kunci dari `wahana.kode`
-- terdengar lebih bersih, tapi itu MEMUTUS foto yang sudah ada: Tebak Simpul
-- bernama sama di empat baris dengan kode berbeda (tebak_simpul_pg_pa dan
-- kawan-kawan), jadi kuncinya hari ini `tebak-simpul` dan bukan salah satu
-- kodenya. Migrasi yang membetulkan kerusakan tidak boleh membuat kerusakan
-- yang sama arah.
--
-- Kolomnya BOLEH NULL, dan pembacanya memakai
-- `coalesce(kode_lomba, slug_lomba(coalesce(lomba, name)))`. Baris yang lahir
-- dari migrasi lama yang tidak menyebut kolom ini karena itu tetap bekerja
-- seperti sebelumnya — dan trigger di bawah mengisinya begitu ia masuk, jadi
-- baris baru langsung ikut terlindungi.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolomnya.
-- ---------------------------------------------------------------------------
alter table wahana add column if not exists kode_lomba text;

comment on column wahana.kode_lomba is
  'Kunci TETAP lomba tempat komponen ini bernaung, dipakai foto_lembar. '
  'Dibekukan saat 0079 dari slug nama lomba yang berlaku waktu itu; sesudah '
  'itu nama boleh berganti tanpa memutus foto yang sudah diunggah.';

-- ---------------------------------------------------------------------------
-- 2. Diisi dengan yang berlaku HARI INI, supaya tidak ada yang berubah.
-- ---------------------------------------------------------------------------
update wahana
set kode_lomba = slug_lomba(coalesce(lomba, name))
where kode_lomba is null;

-- ---------------------------------------------------------------------------
-- 3. Baris baru ikut terisi sendiri.
--
-- Tanpa ini, komponen yang ditambahkan migrasi berikutnya lahir tanpa kunci
-- dan kembali bersandar pada namanya — lubang yang sama, cuma lebih sepi.
-- ---------------------------------------------------------------------------
create or replace function isi_kode_lomba()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kode_lomba is null then
    new.kode_lomba := slug_lomba(coalesce(new.lomba, new.name));
  end if;
  return new;
end;
$$;

drop trigger if exists kode_lomba_terisi on wahana;
create trigger kode_lomba_terisi
  before insert on wahana
  for each row execute function isi_kode_lomba();

-- ---------------------------------------------------------------------------
-- 4. Pembacanya berhenti menurunkan kunci dari nama.
--
-- `catat_foto_masuk` memeriksa kode lomba yang dikirim layar benar-benar milik
-- pos itu. Pemeriksaannya kini memakai kolom, dengan cadangan perhitungan lama
-- supaya baris tanpa kolom tetap lolos.
-- ---------------------------------------------------------------------------
create or replace function kode_lomba_wahana(p_kode_lomba text, p_lomba text,
                                             p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(p_kode_lomba, slug_lomba(coalesce(p_lomba, p_name)));
$$;

comment on function kode_lomba_wahana(text, text, text) is
  'Kunci lomba sebuah baris wahana: kolomnya kalau ada, hitungan lama kalau '
  'belum. Satu tempat supaya RPC dan pemeriksaan tidak berbeda pendapat.';

do $blok$
declare
  v_n integer;
begin
  select count(*) into v_n from wahana where kode_lomba is null;
  assert v_n = 0, format('0079: %s baris wahana masih tanpa kode_lomba', v_n);

  -- Yang paling penting dibuktikan di sini: tidak ada foto yang berpindah.
  select count(*) into v_n
  from foto_lembar f
  where not exists (
    select 1 from wahana w
    where w.pos = f.pos
      and kode_lomba_wahana(w.kode_lomba, w.lomba, w.name) = f.kode_lomba
  );
  raise notice '0079: kode lomba dibekukan; % baris foto masih tidak cocok '
               '(angka ini harus sama dengan sebelum migrasi).', v_n;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 5. catat_foto_masuk memakai kunci beku.
--
-- Disalin UTUH dari 0074 dan hanya satu blok yang berubah — pemeriksaan "kode
-- lomba ini milik pos itu". `create or replace` mengganti seluruh badan, jadi
-- cabang yang lupa disalin akan hilang tanpa satu galat pun.
-- ---------------------------------------------------------------------------
create or replace function catat_foto_masuk(
  p_pos        smallint,
  p_kode_lomba text,
  p_nama_lomba text,
  p_path       text,
  p_ukuran     integer default null
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if pos_saya() is not null and p_pos is distinct from pos_saya() then
    raise exception 'operator pos % tidak boleh mengunggah foto pos %',
      pos_saya(), p_pos;
  end if;

  if coalesce(trim(p_kode_lomba), '') = '' or coalesce(trim(p_path), '') = '' then
    raise exception 'kode lomba dan path wajib diisi';
  end if;

  if split_part(p_path, '/', 1) <> 'pos' || p_pos::text then
    raise exception 'path % tidak berada di folder pos %', p_path, p_pos;
  end if;

  -- Kode lomba harus benar-benar milik pos itu. Tanpa ini, salah pilih di
  -- layar melahirkan tumpukan foto di lomba yang tidak pernah ada, dan tidak
  -- ada layar yang akan menampilkannya lagi.
  --
  -- SATU-SATUNYA yang berubah dari 0074: kuncinya dibaca dari kolom, bukan
  -- diturunkan lagi dari nama. Sesudah ini mengganti nama lomba tidak lagi
  -- membuat RPC ini menolak kode yang sudah dipakai fotonya.
  if not exists (
    select 1 from wahana w
    where w.pos = p_pos
      and kode_lomba_wahana(w.kode_lomba, w.lomba, w.name) = p_kode_lomba
  ) then
    raise exception 'lomba % bukan lomba di pos %', p_kode_lomba, p_pos;
  end if;

  -- Gambar diunggah LEBIH DULU, barisnya sesudahnya. Mengirim ulang berkas
  -- yang sama bukan galat — jaringan lapangan memutus jawaban, bukan
  -- permintaan. `do nothing` tidak mengembalikan baris, jadi id-nya diambil
  -- lagi sesudahnya.
  insert into foto_lembar
    (regu_id, pos, kode_lomba, nama_lomba, path, ukuran_bytes, diunggah_oleh)
  values
    (null, p_pos, p_kode_lomba, p_nama_lomba, p_path, p_ukuran, auth.uid())
  on conflict (path) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from foto_lembar where path = p_path;
  end if;
  return v_id;
end;
$$;

grant execute on function catat_foto_masuk(smallint, text, text, text, integer)
  to authenticated;
