-- ============================================================================
-- hrcd-rekap : 0075_koordinator_pos.sql
--
-- PERAN KELIMA: `koordinator_pos` — juri pos yang tidak terikat satu pos.
--
-- ---------------------------------------------------------------------------
-- KENAPA ADA
--
-- Satu orang berkeliling lima pos: menutup pos yang jurinya belum datang,
-- membetulkan nilai yang salah ketik, dan menyapu lembar yang tertinggal
-- menjelang tutup. Sampai sekarang ia harus memakai akun admin — dan akun
-- admin membawa serta pembayaran, daftar ulang, keberangkatan, akun, dan
-- pengaturan. Memberi lima pekerjaan kepada orang yang butuh satu adalah cara
-- data rusak oleh tangan yang tidak berniat merusaknya.
--
-- ---------------------------------------------------------------------------
-- KENAPA CUKUP MENAMBAH NAMA, TANPA MENYENTUH SATU POLICY PUN
--
-- Yang mengunci juri pos ke posnya BUKAN nama perannya, melainkan
-- `pos_saya()` — yang membaca kolom `akun_panitia.pos`. Seluruh pagar pos
-- sudah berbentuk sama sejak 0064:
--
--     boleh('pos') and (pos_saya() is null or pos = pos_saya())
--
-- Artinya akun yang memegang fitur `pos` dengan kolom `pos` KOSONG sudah
-- berhak atas kelima pos, hari ini juga, tanpa satu baris policy pun diubah.
-- Yang belum ada cuma namanya.
--
-- Dan namanya bukan hiasan: peran adalah yang dipilih panitia di layar Akun,
-- dan "admin dengan centang dikurangi" bukan sesuatu yang bisa dipilih — ia
-- harus dirakit tangan, satu centang salah dan orangnya kehilangan aksesnya
-- di tengah lomba.
--
-- ---------------------------------------------------------------------------
-- YANG MENJAGA KOLOM POS TETAP KOSONG SUDAH ADA, DAN TIDAK DISENTUH
--
-- 0058 memasang `check ((peran = 'juri_pos') = (pos is not null))` — dua arah.
-- Peran apa pun SELAIN juri_pos wajib berpos kosong, jadi koordinator_pos
-- otomatis tidak bisa dikunci ke satu pos bahkan kalau ada yang mencoba.
-- Aturan itu dibiarkan apa adanya: ia sudah mengatakan hal yang benar tentang
-- peran yang belum ada waktu ia ditulis.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Namanya diterima database.
-- ---------------------------------------------------------------------------
alter table akun_panitia drop constraint if exists akun_panitia_peran_check;
alter table akun_panitia add constraint akun_panitia_peran_check
  check (peran in ('admin', 'registrasi', 'gerbang', 'juri_pos',
                   'koordinator_pos'));

-- ---------------------------------------------------------------------------
-- 2. Centang awalnya SAMA PERSIS dengan juri pos.
--
-- Bedanya kedua peran ini bukan apa yang boleh dikerjakan, melainkan DI MANA:
-- keduanya menilai, yang satu di satu pos dan yang lain di semuanya. Memberi
-- koordinator satu centang lebih banyak berarti membuat dua pertanyaan dari
-- satu, dan yang kedua tidak pernah ditanyakan siapa pun.
--
-- Badan fungsinya disalin UTUH dari 0058 dan hanya ditambah satu cabang —
-- `create or replace` mengganti seluruhnya, jadi cabang yang lupa disalin
-- akan hilang tanpa satu galat pun.
-- ---------------------------------------------------------------------------
create or replace function paket_peran(p_peran text)
returns text[]
language sql immutable
as $$
  select case p_peran
    when 'admin' then array[
      'pendaftaran','pembayaran','daftar_ulang','cetak_kloter',
      'keberangkatan','kedatangan','pos','live_score','rekap','akun',
      'pengaturan']
    when 'registrasi' then array[
      'pendaftaran','pembayaran','daftar_ulang','cetak_kloter','live_score']
    when 'gerbang' then array[
      'keberangkatan','kedatangan','live_score']
    -- Posnya sendiri yang membatasi barisnya — pos_saya(), tidak disentuh.
    when 'juri_pos' then array['pos','live_score']
    -- Sama persis dengan juri_pos. Yang membedakan cuma kolom `pos` yang
    -- kosong, dan itu yang membuka kelima pos lewat pos_saya() yang NULL.
    when 'koordinator_pos' then array['pos','live_score']
    else array[]::text[]
  end
$$;

comment on function paket_peran(text) is
  'Centang awal per peran. Sumber hak yang sesungguhnya tetap akun_hak — ini '
  'hanya mengisi kotak pertama kali. koordinator_pos = juri_pos tanpa pos.';

-- ---------------------------------------------------------------------------
-- 3. Laporan, bukan perubahan.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_pagar text;
  v_koor  integer;
begin
  -- Pagar dua arah dari 0058 dicari dari ISINYA, bukan dari namanya. Namanya
  -- `akun_panitia_check` — nama otomatis Postgres, yang berubah kalau suatu
  -- hari constraintnya ditulis ulang. Yang tidak boleh hilang adalah
  -- aturannya, dan aturan itulah yang dicari di sini.
  select pg_get_constraintdef(oid) into v_pagar
  from pg_constraint
  where conrelid = 'akun_panitia'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%pos IS NOT NULL%';

  if v_pagar is null then
    raise exception '0075: pagar "(peran = juri_pos) = (pos is not null)" tidak '
      'ada. Tanpa itu koordinator_pos bisa dikunci ke satu pos, dan seluruh '
      'gunanya hilang tanpa satu galat pun.';
  end if;

  select count(*) into v_koor from akun_panitia where peran = 'koordinator_pos';
  raise notice '0075: peran koordinator_pos siap (% akun). Pagar pos: %',
               v_koor, v_pagar;

  assert paket_peran('koordinator_pos') @> array['pos','live_score'],
    '0075: paket koordinator_pos tidak lengkap';
  assert paket_peran('juri_pos') @> array['pos','live_score'],
    '0075: paket juri_pos ikut hilang saat fungsinya ditulis ulang';
  assert paket_peran('admin') @> array['akun','pengaturan'],
    '0075: paket admin ikut hilang saat fungsinya ditulis ulang';
end;
$blok$;
