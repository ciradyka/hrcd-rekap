-- ============================================================================
-- hrcd-rekap : 0074_foto_jawaban.sql
--
-- FOTO JAWABAN: foto lembar jawaban yang diunggah BORONGAN dari pos, nomor
-- dadanya ditautkan belakangan.
--
-- ---------------------------------------------------------------------------
-- KENAPA ADA, DAN KENAPA IA MELUNAKKAN 0047
--
-- 0047 memutuskan foto diambil DI MEJA IT sambil mengetik nilainya, dan
-- menolak foto borongan di pos dengan alasan yang masih benar: "backup yang
-- tidak bisa ditemukan kembali bukan backup". Alasan itu berdiri di atas satu
-- anggapan — bahwa tidak ada cara menemukan kembali gambar borongan selain
-- membukanya satu per satu.
--
-- Migrasi ini tidak membantah alasannya, ia mencabut anggapannya. Foto
-- borongan sekarang punya DUA jalan pulang: panitia menautkan sendiri satu per
-- satu, atau gambarnya dibaca mesin lalu usulannya dicentang. Yang ditolak
-- 0047 tetap ditolak — foto yang menganggur tanpa tautan tetap bukan backup,
-- dan justru itu yang dihitung dan ditampilkan sebagai angka di layar.
--
-- Yang dibeli: 0047 sendiri mengakui satu lubang yang tidak ia lindungi —
-- "slip yang HILANG DI JALAN antara pos dan meja IT tidak pernah difoto sama
-- sekali". Difoto di pos, slip itu sudah terekam sebelum perjalanannya
-- dimulai. Dialog per regu di meja IT TIDAK diganti; ia tetap jalur utama,
-- karena di sana fotonya tertaut sendiri tanpa pekerjaan tambahan.
--
-- ---------------------------------------------------------------------------
-- KENAPA SATU TABEL, BUKAN TABEL PENAMPUNG
--
-- Godaannya besar: tabel `foto_masuk` yang isinya pindah ke `foto_lembar`
-- begitu tertaut. Ditolak karena pagar baca `foto_lembar` bertumpu pada kolom
-- `pos` DI TABEL ITU SENDIRI (sel_foto, 0064), bukan pada regunya — jadi baris
-- tanpa regu sudah terpagari benar tanpa mekanisme kedua. Tabel penampung
-- berarti dua tabel, dua pagar, dua path convention, dan dua tempat yang harus
-- dicari orang yang bertanya "fotonya mana?".
--
-- Harganya: `regu_id` tidak lagi `not null`. Yang menjaga artinya sekarang
-- check constraint di bawah — tertaut berarti ADA catatan siapa, kapan, dan
-- dengan cara apa. Baris yang setengah tertaut tidak mungkin ada.
--
-- ---------------------------------------------------------------------------
-- KENAPA PATH-NYA TIDAK MENYEBUT KEADAAN TAUTAN
--
-- `pos3/kim/1787.....jpg`, tanpa segmen `belum/`. Sebabnya bukan selera:
-- bucket `lembar` tidak punya policy UPDATE maupun DELETE sama sekali (0047,
-- 0064), jadi objeknya TIDAK AKAN PERNAH bisa dipindah. Folder bernama
-- "belum tertaut" akan berbohong sejak detik foto itu tertaut, dan berbohong
-- selamanya. Keadaan tautan hidup di baris database; path-nya netral.
--
-- Yang TETAP wajib di path adalah segmen pertama `pos<n>` — itulah yang
-- dipagari policy storage.objects, dan RPC di bawah memagarinya untuk kedua
-- kalinya karena skema `storage` tidak ada di database uji.
--
-- ---------------------------------------------------------------------------
-- KODE LOMBA: SATU SLIP = SATU LOMBA
--
-- CLAUDE.md 11.5 sudah menyatakannya, dan 0047 mengulangnya: satu slip adalah
-- satu LOMBA, bukan satu penilaian. Pembidaian punya lima kriteria di SATU
-- kertas. `catat_foto_masuk` di bawah menolak kode lomba yang bukan
-- `slug_lomba(coalesce(wahana.lomba, wahana.name))` untuk pos itu — jadi pintu
-- borongan tidak bisa melahirkan kode yang tidak dikenali pintu satunya.
--
-- Baris LAMA tidak disentuh. Sebagian di antaranya menyandang slug nama
-- PENILAIAN, bukan lomba, karena layar lama mengelompokkan per kolom. Menulis
-- ulang catatan bukti untuk merapikan penamaan adalah harga yang tidak sepadan;
-- yang dilakukan migrasi ini cuma MELAPORKAN berapa banyak (raise notice di
-- bawah), supaya angkanya diketahui dan bukan ditemukan sebagai kejutan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Slug lomba, versi server.
--
-- Cermin `slugLomba()` di app.js. Dua implementasi untuk satu aturan memang
-- mahal, tapi yang menentukan adalah yang di server: tanpa pemeriksaan di
-- sini, satu bug klien menaruh foto di lomba yang tidak ada, dan foto itu
-- tidak pernah ditemukan lagi oleh layar mana pun.
-- ---------------------------------------------------------------------------
create or replace function slug_lomba(p_nama text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(lower(coalesce(p_nama, '')),
                                             '[^a-z0-9]+', '-', 'g')), ''),
    'lomba');
$$;

comment on function slug_lomba(text) is
  'Nama lomba -> slug aman untuk nama berkas. Cermin slugLomba() di app.js.';

-- ---------------------------------------------------------------------------
-- 2. Foto boleh belum punya regu.
-- ---------------------------------------------------------------------------
alter table foto_lembar alter column regu_id drop not null;

alter table foto_lembar
  add column if not exists ditaut_oleh uuid references auth.users (id),
  add column if not exists ditaut_pada timestamptz,
  add column if not exists cara_taut   text;

-- Baris lama semuanya tertaut sejak lahir — fotonya diambil sesudah nomor
-- dadanya diketik. WHERE-nya berarti, bukan hiasan: `update` tanpa `where`
-- ditolak safeupdate di produksi (CLAUDE.md 14.6).
update foto_lembar
set cara_taut   = coalesce(cara_taut, 'unggah'),
    ditaut_oleh = coalesce(ditaut_oleh, diunggah_oleh),
    ditaut_pada = coalesce(ditaut_pada, diunggah_pada)
where regu_id is not null and cara_taut is null;

-- Tiga cara sebuah foto sampai ke regunya, dan ketiganya perlu dibedakan saat
-- membetulkan tautan yang salah:
--   unggah  fotonya sudah tertaut sejak diunggah (dialog per regu, 0047)
--   tangan  panitia menautkannya sendiri di layar Foto Jawaban
--   mesin   usulan pembacaan gambar yang dicentang panitia
do $blok$
begin
  alter table foto_lembar
    add constraint foto_lembar_cara_taut_sah
    check (cara_taut is null or cara_taut in ('unggah', 'tangan', 'mesin'));
exception when duplicate_object then
  raise notice '0074: constraint foto_lembar_cara_taut_sah sudah ada.';
end;
$blok$;

-- Tertaut berarti ADA catatannya. Tidak ada keadaan setengah tertaut: baris
-- yang punya regu tapi tidak punya jejak siapa yang menautkannya adalah baris
-- yang tidak bisa dipertanggungjawabkan, dan foto ini gunanya justru untuk
-- dipertanggungjawabkan.
do $blok$
begin
  alter table foto_lembar
    add constraint foto_lembar_taut_utuh
    check ((regu_id is null) = (cara_taut is null));
exception when duplicate_object then
  raise notice '0074: constraint foto_lembar_taut_utuh sudah ada.';
end;
$blok$;

-- Antrean "belum tertaut" adalah satu-satunya pertanyaan yang layar baru
-- tanyakan berulang kali. Index parsial: barisnya sedikit dan menyusut terus,
-- jadi index penuh cuma membayar ongkos tulis untuk baris yang tidak dicari.
create index if not exists foto_lembar_belum_taut_idx
  on foto_lembar (pos, kode_lomba)
  where regu_id is null;

comment on column foto_lembar.regu_id is
  'NULL = foto borongan yang belum ditautkan ke nomor dada. Lihat cara_taut.';
comment on column foto_lembar.cara_taut is
  'unggah | tangan | mesin. NULL berarti belum tertaut.';

-- ---------------------------------------------------------------------------
-- 3. Jejak audit.
--
-- Menautkan foto ke regu yang salah lalu membetulkannya TIDAK boleh lewat
-- tanpa bekas. 0001 menolak menerbitkan ulang nomor dada pensiun dengan alasan
-- harfiah "foto susulan akan menilai regu yang salah" — penautan yang menyusul
-- adalah foto susulan yang dimaksud kalimat itu.
-- ---------------------------------------------------------------------------
-- Nama fungsinya TIDAK ditulis di sini, ia dibaca dari trigger yang sudah ada
-- di tabel `regu`. Sebabnya sudah terjadi sekali di migrasi ini sendiri:
-- versi pertama mencari `catat_riwayat`, nama yang dipakai 0002 — dan 0012
-- baris 605 sudah me-rename-nya jadi `record_history`. Pemeriksaannya melapor
-- "tidak ada", trigger auditnya dilewati, dan migrasinya tetap SUKSES dengan
-- sebaris warning yang lewat begitu saja di log. Membaca nama dari trigger
-- yang pasti hidup membuat rename berikutnya tidak bisa mengulanginya.
--
-- Dan kalau ia benar-benar tidak ketemu, migrasinya BERHENTI. Penautan foto
-- tanpa jejak audit adalah tepat hal yang bagian ini janjikan; menjanjikannya
-- lewat warning berarti tidak menjanjikan apa pun.
do $blok$
declare v_fungsi text;
begin
  select p.proname into v_fungsi
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = 'regu'::regclass
    and not t.tgisinternal
    and t.tgname = 'audit_regu';

  if v_fungsi is null then
    raise exception '0074: fungsi audit tidak ketemu lewat trigger audit_regu. '
      'Cari nama barunya, jangan tebak — penautan foto tanpa jejak tidak boleh '
      'tayang.';
  end if;

  drop trigger if exists audit_foto_lembar on foto_lembar;
  execute format(
    'create trigger audit_foto_lembar after insert or update or delete '
    'on foto_lembar for each row execute function %I()', v_fungsi);
  raise notice '0074: trigger audit_foto_lembar terpasang (fungsi %).', v_fungsi;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 4. Mencatat foto borongan.
--
-- Pagarnya menyalin catat_foto_lembar versi 0064 — BUKAN versi 0047, yang
-- masih berbunyi 'meja' / 'operator_pos', nama peran yang mati sejak 0058
-- (CLAUDE.md 13.2).
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
  if not exists (
    select 1 from wahana w
    where w.pos = p_pos
      and slug_lomba(coalesce(w.lomba, w.name)) = p_kode_lomba
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

-- ---------------------------------------------------------------------------
-- 5. Menautkan foto ke nomor dada.
--
-- Ini UPDATE, bukan insert ulang. Mencatat ulang lewat catat_foto_masuk dengan
-- nomor dada yang benar TIDAK akan mengubah apa pun: `path` unik dan
-- `on conflict do nothing` membuat panggilannya berhasil tanpa menulis. Layar
-- akan tampak bekerja sementara tidak ada yang berubah.
-- ---------------------------------------------------------------------------
create or replace function tautkan_foto(
  p_foto_id    uuid,
  p_nomor_dada integer,
  p_cara       text default 'tangan'
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pos  smallint;
  v_regu uuid;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if p_cara not in ('tangan', 'mesin') then
    raise exception 'cara taut % tidak dikenal', p_cara;
  end if;

  select pos into v_pos from foto_lembar where id = p_foto_id;
  if not found then
    raise exception 'foto % tidak ada', p_foto_id;
  end if;
  if pos_saya() is not null and v_pos is distinct from pos_saya() then
    raise exception 'operator pos % tidak boleh menautkan foto pos %',
      pos_saya(), v_pos;
  end if;

  select id into v_regu from regu
  where nomor_dada = p_nomor_dada and not is_cancelled;
  if not found then
    raise exception 'nomor dada % tidak dikenal / regu batal',
      case when p_nomor_dada between 0 and 999
        then lpad(p_nomor_dada::text, 3, '0') else p_nomor_dada::text end;
  end if;

  -- Menautkan ulang DIBOLEHKAN, dan itu disengaja. Pembacaan mesin akan
  -- sesekali salah satu digit, dan pembetulnya harus orang yang sedang
  -- memegang kertasnya — bukan pemegang `pengaturan` yang tidak ada di
  -- lapangan. Yang menjaganya bukan larangan, melainkan trigger audit di
  -- bagian 3.
  update foto_lembar
  set regu_id     = v_regu,
      ditaut_oleh = auth.uid(),
      ditaut_pada = now(),
      cara_taut   = p_cara
  where id = p_foto_id;
end;
$$;

grant execute on function tautkan_foto(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. View: LEFT join, kalau tidak foto yang belum tertaut lenyap tanpa suara.
--
-- Badannya disalin utuh dari 0065; yang berubah hanya `join` -> `left join`
-- dan tiga kolom tambahan. View ini BUKAN security_invoker — ia membawa
-- pagarnya sendiri, jadi mengubah policy tabel saja tidak mengubah apa pun
-- yang terlihat di sini (CLAUDE.md 13.3).
-- ---------------------------------------------------------------------------
drop view if exists v_foto_lembar;
create or replace view v_foto_lembar as
select
  f.id, r.nomor_dada, f.pos, f.kode_lomba, f.nama_lomba, f.path,
  f.ukuran_bytes,
  coalesce(a.username, '(tidak dikenal)') as oleh,
  f.diunggah_pada,
  f.cara_taut,
  f.ditaut_pada,
  coalesce(t.username, '(tidak dikenal)') as ditaut_oleh
from foto_lembar f
left join regu r on r.id = f.regu_id
left join akun_panitia a on a.user_id = f.diunggah_oleh
left join akun_panitia t on t.user_id = f.ditaut_oleh
where boleh('rekap')
   or (boleh('pos') and (pos_saya() is null or f.pos = pos_saya()));

-- `drop view` ikut membuang GRANT-nya. Dilupakan sekali di 0065 dan ketahuan
-- lewat tes, bukan lewat layar.
grant select on v_foto_lembar to authenticated;

comment on view v_foto_lembar is
  'Foto lembar jawaban. nomor_dada NULL = belum ditautkan (foto borongan).';

-- ---------------------------------------------------------------------------
-- 7. Laporan, bukan perbaikan.
--
-- Berapa baris lama yang kode lombanya bukan slug lomba yang sah? Angkanya
-- diketahui sekarang, bukan ditemukan sebagai kejutan waktu foto lama dicari
-- lewat pintu baru dan tidak ketemu.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_semua  integer;
  v_asing  integer;
  v_kosong integer;
begin
  select count(*) into v_semua from foto_lembar;
  select count(*) into v_kosong from foto_lembar where regu_id is null;
  select count(*) into v_asing
  from foto_lembar f
  where not exists (
    select 1 from wahana w
    where w.pos = f.pos
      and slug_lomba(coalesce(w.lomba, w.name)) = f.kode_lomba
  );
  raise notice '0074: % baris foto, % belum tertaut, % berkode lomba yang '
               'tidak cocok dengan wahana pos itu (dibiarkan apa adanya).',
               v_semua, v_kosong, v_asing;
end;
$blok$;
