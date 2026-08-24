-- ============================================================================
-- hrcd-rekap : tests/sql/72_biaya_intern.sql
-- Regu Intern ditagih Rp 100.000, Eksternal Rp 175.000, dan yang menghitung
-- tagihan adalah PENJUMLAHAN — bukan lagi perkalian.
--
-- Kenapa penjumlahan itu yang diuji, bukan angkanya: harga berganti tiap
-- edisi, jadi tes yang memaku 100000 adalah pekerjaan tahunan (0084 menulis
-- alasan yang sama). Yang TIDAK boleh berganti diam-diam adalah bentuk
-- hitungannya. Selama seluruh regu berharga sama, `jumlah_regu * harga` dan
-- `sum(harga tiap regu)` memberi angka yang sama persis — jadi satu batch
-- CAMPURAN adalah satu-satunya bentuk yang bisa membedakan keduanya, dan
-- itulah yang dipakai di 72.3 dan 72.4.
--
-- Angka edisi 37 tetap ikut diperiksa sekali di 72.1: kalau harganya memang
-- diganti tahun depan, tes ini gagal di satu baris yang menyebutkan angkanya
-- — bukan di lima baris yang tersebar.
-- ============================================================================

\echo '== 72: biaya intern =='
\set ON_ERROR_STOP on

select set_config('app.uid', (select user_id::text from akun_panitia
                              where peran = 'admin' and is_active limit 1), false);

-- Seluruh isi tes membuat pendaftaran, sekolah, dan kwitansi sendiri, lalu
-- dibatalkan di akhir. Tes sesudahnya membaca database yang sama.
begin;

-- ---------------------------------------------------------------------------
-- 72.1 Dua harga, dan biaya_regu() memilih yang benar untuk keenam golongan.
--
--      Keenamnya disebut satu per satu dengan sengaja. Menuliskannya sebagai
--      "yang bukan intern" akan tetap lulus pada hari seseorang menambahkan
--      golongan ketujuh yang harganya belum diputuskan.
-- ---------------------------------------------------------------------------
do $$
declare
  v_eksternal integer;
  v_intern    integer;
  v_g         text;
begin
  select biaya_per_regu, biaya_per_regu_intern into v_eksternal, v_intern
  from edisi where is_active;

  assert v_eksternal = 175000,
    format('72.1: biaya Eksternal %s, harusnya 175000', v_eksternal);
  assert v_intern = 100000,
    format('72.1: biaya Intern %s, harusnya 100000', v_intern);

  foreach v_g in array array['penegak_pa', 'penegak_pi',
                             'penggalang_pa', 'penggalang_pi'] loop
    assert biaya_regu(v_g) = v_eksternal,
      format('72.1: biaya_regu(%s) = %s, harusnya harga Eksternal %s',
             v_g, biaya_regu(v_g), v_eksternal);
  end loop;

  foreach v_g in array array['intern_pa', 'intern_pi'] loop
    assert biaya_regu(v_g) = v_intern,
      format('72.1: biaya_regu(%s) = %s, harusnya harga Intern %s',
             v_g, biaya_regu(v_g), v_intern);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 72.2 Batch seragam: angka yang dibaca pembina tetap seperti dulu.
-- ---------------------------------------------------------------------------
create temp table uji72 (label text primary key, hasil jsonb);

insert into uji72 values ('eks', submit_pendaftaran(
  'SMPN Uji Biaya Eksternal', 'Jl. Uji Biaya', false, '081200007201',
  '[{"nama_regu":"Ujibiaya Eksalfa","nama_ketua":"Ketua Eksalfa","golongan":"penggalang_pa"},
    {"nama_regu":"Ujibiaya Eksbeta","nama_ketua":"Ketua Eksbeta","golongan":"penggalang_pa"},
    {"nama_regu":"Ujibiaya Eksgama","nama_ketua":"Ketua Eksgama","golongan":"penegak_pi"}]'));

insert into uji72 values ('int', submit_pendaftaran(
  'SMAN 1 Ciamis', 'Jl. Gunung Galuh 37', false, '081200007202',
  '[{"nama_regu":"Ujibiaya Intalfa","nama_ketua":"Ketua Intalfa","golongan":"intern_pa"},
    {"nama_regu":"Ujibiaya Intbeta","nama_ketua":"Ketua Intbeta","golongan":"intern_pa"},
    {"nama_regu":"Ujibiaya Intgama","nama_ketua":"Ketua Intgama","golongan":"intern_pi"}]'));

do $$
declare
  v_eksternal integer := biaya_regu('penegak_pa');
  v_intern    integer := biaya_regu('intern_pa');
  v           jsonb;
begin
  select hasil into strict v from uji72 where label = 'eks';
  assert (v ->> 'total_tagihan')::int = 3 * v_eksternal,
    format('72.2: tagihan 3 regu Eksternal %s, harusnya %s',
           v ->> 'total_tagihan', 3 * v_eksternal);

  select hasil into strict v from uji72 where label = 'int';
  assert (v ->> 'total_tagihan')::int = 3 * v_intern,
    format('72.2: tagihan 3 regu Intern %s, harusnya %s',
           v ->> 'total_tagihan', 3 * v_intern);
end $$;

-- ---------------------------------------------------------------------------
-- 72.3 Batch campuran: di sinilah perkalian lama dan penjumlahan baru berbeda.
--
--      Dua Eksternal + dua Intern. Perkalian lama memberi 4 x Eksternal, dan
--      pesan gagalnya menyebutkan angka itu supaya siapa pun yang membuat tes
--      ini merah tahu persis apa yang kembali.
-- ---------------------------------------------------------------------------
insert into uji72 values ('campur', submit_pendaftaran(
  'SMPN Uji Biaya Campuran', 'Jl. Uji Campur', false, '081200007203',
  '[{"nama_regu":"Ujibiaya Campeksa","nama_ketua":"Ketua Campeksa","golongan":"penegak_pa"},
    {"nama_regu":"Ujibiaya Campeksb","nama_ketua":"Ketua Campeksb","golongan":"penegak_pa"},
    {"nama_regu":"Ujibiaya Campinta","nama_ketua":"Ketua Campinta","golongan":"intern_pa"},
    {"nama_regu":"Ujibiaya Campintb","nama_ketua":"Ketua Campintb","golongan":"intern_pi"}]'));

do $$
declare
  v_eksternal integer := biaya_regu('penegak_pa');
  v_intern    integer := biaya_regu('intern_pa');
  v_benar     integer := 2 * v_eksternal + 2 * v_intern;
  v_lama      integer := 4 * v_eksternal;
  v           jsonb;
  v_id        uuid;
begin
  select hasil into strict v from uji72 where label = 'campur';
  assert (v ->> 'total_tagihan')::int = v_benar,
    format('72.3: tagihan campuran %s, harusnya %s (perkalian lama memberi %s)',
           v ->> 'total_tagihan', v_benar, v_lama);

  select id into strict v_id from pendaftaran
  where kode_pembayaran = v ->> 'kode_pembayaran';
  assert tagihan_pendaftaran(v_id) = v_benar,
    format('72.3: tagihan_pendaftaran %s, harusnya %s',
           tagihan_pendaftaran(v_id), v_benar);
end $$;

-- ---------------------------------------------------------------------------
-- 72.4 Meja Pembayaran: yang diterima hanya jumlah yang sama persis.
--
--      Nominal perkalian lama harus DITOLAK. Kalau ia diterima, artinya
--      server masih menagih dengan rumus lama dan setiap sekolah campuran
--      membayar kelebihan yang tidak pernah muncul di layar mana pun.
-- ---------------------------------------------------------------------------
do $$
declare
  v_eksternal integer := biaya_regu('penegak_pa');
  v_intern    integer := biaya_regu('intern_pa');
  v_benar     integer := 2 * v_eksternal + 2 * v_intern;
  v_lama      integer := 4 * v_eksternal;
  v_kode      text;
  v_tolak     boolean := false;
begin
  select hasil ->> 'kode_pembayaran' into strict v_kode
  from uji72 where label = 'campur';

  begin
    perform verifikasi_pembayaran(v_kode, v_lama, 'tunai');
  exception when others then
    v_tolak := true;
  end;
  assert v_tolak,
    format('72.4: nominal perkalian lama (%s) masih diterima', v_lama);

  assert (select status from pendaftaran where kode_pembayaran = v_kode)
         = 'menunggu_pembayaran',
    '72.4: penolakan tetap melunasi batch';

  assert verifikasi_pembayaran(v_kode, v_benar, 'tunai') ->> 'nomor_kwitansi'
         like 'KW-HRCD37-%',
    format('72.4: nominal yang benar (%s) tidak menerbitkan kwitansi', v_benar);
end $$;

-- ---------------------------------------------------------------------------
-- 72.5 Regu yang dibatalkan tidak ditagih.
--
--      Layar Meja Pembayaran selalu menghitung dari regu yang masih aktif
--      (`reguAktif` di app.js). Sebelum 0110 server memakai
--      `pendaftaran.jumlah_regu`, yang tidak pernah turun — jadi batch yang
--      salah satu regunya dibatalkan sebelum bayar tidak bisa dilunasi sama
--      sekali: nominal dari layar selalu kurang dari tagihan server, dan
--      tidak ada tombol yang bisa memperbaikinya.
-- ---------------------------------------------------------------------------
insert into uji72 values ('batal', submit_pendaftaran(
  'SMPN Uji Biaya Batal', 'Jl. Uji Batal', false, '081200007204',
  '[{"nama_regu":"Ujibiaya Batalsatu","nama_ketua":"Ketua Batalsatu","golongan":"penegak_pa"},
    {"nama_regu":"Ujibiaya Bataldua","nama_ketua":"Ketua Bataldua","golongan":"penegak_pa"},
    {"nama_regu":"Ujibiaya Bataltiga","nama_ketua":"Ketua Bataltiga","golongan":"intern_pa"}]'));

do $$
declare
  v_eksternal integer := biaya_regu('penegak_pa');
  v_intern    integer := biaya_regu('intern_pa');
  v_kode      text;
  v_id        uuid;
begin
  select hasil ->> 'kode_pembayaran' into strict v_kode
  from uji72 where label = 'batal';
  select id into strict v_id from pendaftaran where kode_pembayaran = v_kode;

  assert tagihan_pendaftaran(v_id) = 2 * v_eksternal + v_intern,
    format('72.5: tagihan awal %s, harusnya %s',
           tagihan_pendaftaran(v_id), 2 * v_eksternal + v_intern);

  update regu set is_cancelled = true
  where pendaftaran_id = v_id and nama_regu = 'Ujibiaya Bataltiga';

  assert tagihan_pendaftaran(v_id) = 2 * v_eksternal,
    format('72.5: regu Intern yang dibatalkan masih ditagih — %s, harusnya %s',
           tagihan_pendaftaran(v_id), 2 * v_eksternal);

  assert verifikasi_pembayaran(v_kode, 2 * v_eksternal, 'tunai')
         ->> 'nomor_kwitansi' like 'KW-HRCD37-%',
    '72.5: batch dengan satu regu batal tidak bisa dilunasi';
end $$;

-- ---------------------------------------------------------------------------
-- 72.6 Form pendaftaran publik melihat KEDUA harga tanpa login.
--
--      daftar.js memilih harganya sendiri dari jenis peserta yang dipilih
--      pembina, jadi angka yang hilang di sini berarti "Rp 0" di layar
--      pendaftaran — dan sekolah membawa uang sejumlah itu.
-- ---------------------------------------------------------------------------
set local role anon;

do $$
declare v record;
begin
  select * into strict v from v_edisi_publik;
  assert v.biaya_per_regu = 175000,
    format('72.6: anon membaca biaya Eksternal %s', v.biaya_per_regu);
  assert v.biaya_per_regu_intern = 100000,
    format('72.6: anon membaca biaya Intern %s', v.biaya_per_regu_intern);
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 72.7 Edisi masih bisa disisipkan TANPA menyebut kolom harga intern.
--
--      `supabase/seed.sql` menyisipkan edisi dengan daftar kolom yang ditulis
--      lengkap, dan daftar itu tidak menyebut `biaya_per_regu_intern` — tidak
--      bisa menyebutnya, karena di berkas run.sh ini seed berjalan jauh
--      sebelum 0110 dan kolomnya belum ada. `tests/dev_database.sh` berjalan
--      TERBALIK: seluruh glob migrasi dulu, seed sesudahnya. Tanpa DEFAULT,
--      insert itu menabrak not-null dan skrip penyiapan database dev berhenti
--      di sana — sesudah ia sempat men-drop hrcd_dev.
--
--      Kursi yang diduduki di sini persis kursi seed.sql: daftar kolom yang
--      sama, hanya nomor dan is_active yang diganti supaya tidak menabrak
--      edisi yang sedang aktif. Kalau seed.sql menambah kolom, samakan juga
--      daftar di bawah.
-- ---------------------------------------------------------------------------
do $$
declare v_biaya integer;
begin
  -- Trigger kunci_edisi menolak tulisan ke `edisi` saat konfigurasi terkunci,
  -- dan tes sebelumnya boleh saja meninggalkannya menyala. Seluruh blok ini
  -- ada di dalam transaksi yang dibatalkan di akhir berkas.
  update status_acara set konfigurasi_terkunci = false where id = true;

  insert into edisi (nomor, name, tahun, tanggal_lomba, biaya_per_regu,
                     maks_regu_per_kloter, kloter_dasar, kloter_maks,
                     lompatan_kloter, interval_berangkat_menit, is_active)
  values (99, 'HRCD UJI BIAYA', 2099, date '2099-01-01', 250000,
          10, 30, 40, 2, 4, false);

  select biaya_per_regu_intern into v_biaya from edisi where nomor = 99;
  assert v_biaya = 100000,
    format('72.7: edisi baru tanpa harga intern mendapat %s, harusnya 100000',
           coalesce(v_biaya::text, 'null'));
end $$;

rollback;

select '72_biaya_intern OK' as hasil;
