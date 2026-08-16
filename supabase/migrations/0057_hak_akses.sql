-- ============================================================================
-- hrcd-rekap : 0057_hak_akses.sql
-- Hak akses per fitur, menggantikan peran sebagai penentu boleh-tidaknya.
--
-- KENAPA
--
-- Sampai sekarang otorisasi bertumpu pada satu kolom: `akun_panitia.peran`,
-- bernilai 'admin' | 'meja' | 'operator_pos', dibaca fungsi `peran()`, dan
-- dipakai 43 policy RLS serta 21 RPC. Tiga peran itu adalah tiga PAKET yang
-- tidak bisa dibuka: panitia yang cuma boleh memverifikasi pembayaran harus
-- diberi peran 'meja', dan peran 'meja' ikut membawa daftar ulang, cetak
-- kloter, keberangkatan, dan kedatangan sekaligus.
--
-- Yang dibutuhkan koordinator adalah mencentang per orang per pekerjaan.
-- Karena itu hak akses jadi DATA, bukan satu kolom.
--
-- YANG TIDAK BERUBAH
--
-- `akun_panitia.peran` TETAP ADA, dan tetap diisi. Ia berhenti jadi penentu
-- hak dan berubah jadi PRESET: memilih "Meja" mencentangkan paket yang biasa
-- dipegang meja, lalu boleh disesuaikan per orang. Menyiapkan 20 akun untuk
-- edisi baru tanpa preset berarti mencentang ratusan kotak satu per satu.
--
-- `akun_panitia.pos` juga tetap satu angka, dan `pos_saya()` tidak disentuh.
-- Satu orang memegang satu pos sepanjang hari — itu yang terjadi di lapangan,
-- dan memecahnya jadi kolom per pos hanya menambah 20 kotak yang selalu
-- terisi satu.
--
-- URUTAN PEMASANGAN — dan ini yang membuat migrasi ini aman dijalankan di
-- tengah edisi: tabel dan fungsinya dibuat DULU dan diisi dari peran yang
-- sudah ada, sehingga sesudah migrasi ini setiap akun punya hak yang persis
-- sama dengan yang dipegangnya sebelumnya. Belum ada satu policy pun yang
-- berpindah ke `boleh()` di berkas ini; itu pekerjaan migrasi berikutnya,
-- dan sampai ia dipasang sistem berjalan seperti biasa.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Daftar fitur. Sengaja tabel, bukan enum atau check constraint: layar
--    Akun menggambar kolomnya DARI SINI, jadi menambah fitur tahun depan
--    cukup satu INSERT dan tidak perlu menyentuh kode mana pun.
--
--    `urutan` menentukan urutan kolom di layar, dan urutannya bukan selera:
--    ia mengikuti alur hari lomba — daftar, bayar, daftar ulang, cetak,
--    berangkat, datang, nilai — supaya matriksnya terbaca seperti jadwal.
-- ---------------------------------------------------------------------------
create table fitur (
  kode    text primary key check (kode ~ '^[a-z_]+$'),
  nama    text not null,
  urutan  smallint not null unique
);

insert into fitur (kode, nama, urutan) values
  ('pendaftaran',  'Pendaftaran',    1),
  ('pembayaran',   'Pembayaran',     2),
  ('daftar_ulang', 'Daftar Ulang',   3),
  ('cetak_kloter', 'Daftar Kloter',  4),
  ('keberangkatan','Keberangkatan',  5),
  ('kedatangan',   'Kedatangan',     6),
  ('pos',          'Input Nilai Pos',7),
  ('live_score',   'Live Score',     8),
  ('rekap',        'Rekapitulasi',   9),
  ('akun',         'Akun',          10);

-- ---------------------------------------------------------------------------
-- 2. Hak per akun. Baris ADA artinya boleh; baris tidak ada artinya tidak.
--    Tidak ada kolom `boleh boolean` — baris yang ada tapi bernilai false
--    adalah dua cara menuliskan hal yang sama, dan dua cara berarti suatu
--    hari keduanya tidak sepakat.
--
--    ON DELETE CASCADE pada akun: kalau suatu hari sebuah akun benar-benar
--    dihapus, haknya ikut. Layar Akun sendiri tidak pernah menghapus akun —
--    ia menonaktifkan (is_active = false) supaya `riwayat.oleh` tetap bisa
--    ditelusuri.
-- ---------------------------------------------------------------------------
create table akun_hak (
  user_id uuid not null references akun_panitia (user_id) on delete cascade,
  fitur   text not null references fitur (kode),
  primary key (user_id, fitur)
);

create index akun_hak_fitur_idx on akun_hak (fitur);

alter table fitur    enable row level security;
alter table akun_hak enable row level security;

grant select, insert, update, delete on fitur, akun_hak to authenticated;
grant select, insert, update, delete on fitur, akun_hak to service_role;
revoke all on fitur, akun_hak from anon;

-- ---------------------------------------------------------------------------
-- 3. boleh() — penerus peran() untuk pertanyaan "boleh tidak".
--
--    SECURITY DEFINER dan membaca tabel, sama persis dengan peran(): klaim di
--    JWT tidak dipakai, supaya hak yang baru dicabut langsung berlaku tanpa
--    menunggu tokennya kedaluwarsa (bisa satu jam).
--
--    Akun nonaktif tidak punya hak apa pun, apa pun isi akun_hak-nya — itu
--    syarat `a.is_active` di bawah, dan ia menjaga "nonaktifkan" benar-benar
--    berarti berhenti, bukan sekadar hilang dari daftar.
-- ---------------------------------------------------------------------------
create or replace function boleh(p_fitur text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from akun_hak h
    join akun_panitia a on a.user_id = h.user_id
    where h.user_id = auth.uid() and a.is_active and h.fitur = p_fitur
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. Paket preset per peran. Dipakai DUA kali: mengisi hak akun yang sudah
--    ada di bawah, dan mencentang otomatis waktu layar Akun membuat akun
--    baru. Satu tempat, supaya keduanya tidak pernah berbeda.
--
--    Isi paketnya diambil dari apa yang PERSIS bisa dilakukan tiap peran
--    hari ini, bukan dari apa yang sebaiknya — migrasi ini tidak boleh
--    menambah atau mengurangi akses siapa pun.
-- ---------------------------------------------------------------------------
create or replace function paket_peran(p_peran text)
returns text[]
language sql immutable
as $$
  select case p_peran
    when 'admin' then array[
      'pendaftaran','pembayaran','daftar_ulang','cetak_kloter',
      'keberangkatan','kedatangan','pos','live_score','rekap','akun']
    -- Meja hari ini memegang seluruh layar meja, dan TIDAK memegang input
    -- nilai pos, live score, maupun akun (lihat layarHome di web/js/app.js:
    -- ketiganya digambar hanya untuk peran admin).
    when 'meja' then array[
      'pendaftaran','pembayaran','daftar_ulang','cetak_kloter',
      'keberangkatan','kedatangan','rekap']
    -- Operator pos hanya punya satu layar, dan posnya sendiri yang membatasi
    -- barisnya (pos_saya(), tidak disentuh migrasi ini).
    when 'operator_pos' then array['pos']
    else array[]::text[]
  end
$$;

-- ---------------------------------------------------------------------------
-- 5. Isi hak akun yang sudah ada dari perannya. Sesudah baris ini, boleh()
--    menjawab persis sama dengan yang selama ini dijawab peran().
-- ---------------------------------------------------------------------------
insert into akun_hak (user_id, fitur)
select a.user_id, f
from akun_panitia a, unnest(paket_peran(a.peran)) as f
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 6. RLS untuk kedua tabel baru.
--
--    fitur: semua panitia membaca — layar mana pun boleh tahu daftar fitur.
--    akun_hak: tiap orang melihat haknya sendiri (supaya SPA bisa menggambar
--    menunya tanpa jadi admin), dan pemegang fitur 'akun' mengelola semuanya.
--
--    Perhatikan bahwa policy pengelolanya memakai boleh('akun'), BUKAN
--    peran() = 'admin'. Kalau ia memakai peran, mencabut centang 'akun' dari
--    seorang admin tidak akan menghentikannya — dan itu persis jenis
--    setengah-penguncian yang membuat centang berhenti dipercaya.
-- ---------------------------------------------------------------------------
create policy sel_fitur     on fitur    for select using (peran() is not null);
create policy adm_fitur     on fitur    for all    using (boleh('akun'));
create policy sel_hak_saya  on akun_hak for select using (user_id = auth.uid());
create policy adm_hak       on akun_hak for all    using (boleh('akun'));

-- Akun: policy lama `adm_akun` memakai peran() = 'admin'. Diganti supaya
-- pengelolaan akun ikut ditentukan centang, bukan peran. `sel_akun_sendiri`
-- dibiarkan — tiap orang tetap perlu membaca barisnya sendiri untuk login.
drop policy adm_akun on akun_panitia;
create policy adm_akun on akun_panitia for all using (boleh('akun'));

comment on table fitur is
  'Daftar fitur yang bisa dicentang di layar Akun. Layar menggambar kolomnya dari tabel ini.';
comment on table akun_hak is
  'Hak akses per akun per fitur. Baris ada = boleh. Menggantikan peran sebagai penentu.';
comment on function boleh(text) is
  'Apakah akun yang sedang login memegang fitur ini. Penerus peran() untuk RLS.';
