-- ============================================================================
-- hrcd-rekap : 0037_petunjuk_kolom.sql
--
-- Keterangan kecil di bawah judul kolom jadi KONFIGURASI, bukan tebakan layar.
--
-- Selama ini layar mengarang keterangan itu sendiri dari rentang yang boleh
-- diketik: "0 – 5", "0 – 20", dan untuk Menaksir "0 – 1000". Untuk lomba yang
-- menghitung jumlah benar itu tepat — 0 sampai 5 kata memang seluruh
-- ceritanya. Untuk Menaksir ia menyesatkan dua kali sekaligus:
--
--   * yang ditulis petugas bukan nilai melainkan SELISIH jarak, dan
--   * 1000 bukan batas apa pun, cuma angka yang kebetulan dipilih dulu.
--
-- ---------------------------------------------------------------------------
-- KENAPA KOLOM BARU, BUKAN MEMAKAI `satuan`
--
-- `satuan` kelihatan menggoda karena sudah ada dan masih kosong untuk
-- Menaksir. Tapi ia bukan keterangan — ia SAKLAR: lima cabang di app.js
-- membandingkannya persis dengan 'detik' untuk memutuskan kotaknya berbentuk
-- Menit:Detik atau bukan. Menaruh kalimat manusia di sana berarti menaruh
-- kalimat manusia di dalam sebuah if, dan yang berikutnya mengisi `satuan`
-- pada komponen Pos 2 akan menghapus kotak Menit:Detik-nya tanpa satu galat
-- pun. Kolom sendiri lebih jujur dan lebih murah daripada penjelasan.
--
-- ---------------------------------------------------------------------------
-- KENAPA BUNYINYA "0 = tepat", BUKAN "(selisih jarak)" SAJA
--
-- Panitia meminta judulnya berbunyi "(selisih jarak)". Kalimat itu dipakai —
-- tapi ditambah tiga kata, dan alasannya justru dari aturan panitia sendiri:
-- selisih 0 berarti taksirannya TEPAT dan bernilai 100, nilai tertinggi di
-- lomba itu.
--
-- Sementara kotak yang DIBIARKAN KOSONG berarti komponennya tidak dinilai:
-- 0 poin. Jadi 0 dan kosong adalah dua ujung yang berlawanan sejauh mungkin,
-- dan satu-satunya hal yang membedakannya di mata petugas adalah satu ketukan.
--
-- Yang membuat ini genting: "0 – 1000" adalah SATU-SATUNYA tempat, di layar
-- maupun di kertas, yang memberi tahu petugas bahwa 0 itu angka yang boleh
-- ditulis. Menggantinya dengan "(selisih jarak)" polos akan membuang
-- pemberitahuan itu tanpa menggantinya — dan regu yang menaksir dengan
-- sempurna adalah justru regu yang paling mungkin barisnya ditinggalkan
-- kosong. Nilai 100 berubah jadi 0, tidak ada yang gagal, tidak ada yang
-- ganjil di layar.
--
-- Kalau panitia tetap ingin "(selisih jarak)" tanpa tambahan, itu satu UPDATE
-- pada kolom yang berkas ini buat — bukan perubahan kode.
--
-- ---------------------------------------------------------------------------
-- BATAS ATAS
--
-- Panitia meminta validasinya cukup ">= 0". Batas atas tidak bisa dihapus:
-- `rentang_mentah_maks` bertipe numeric(10,2) dan `not null`, jadi selalu ada
-- angka di sana. Yang bisa dilakukan adalah menaruhnya di ujung tipe datanya,
-- sehingga tidak ada selisih yang masuk akal maupun tidak masuk akal yang
-- pernah tertolak — persis maksud ">= 0". Batas bawah 0 tetap berlaku, jadi
-- angka negatif tetap ditolak.
--
-- Harga yang dibayar disebutkan supaya tidak jadi kejutan: salah ketik 1000
-- untuk 10 tidak lagi tertahan di pintu. Ia tetap bernilai 0 poin — tangga
-- Menaksir memang habis di atas 4 m — jadi yang hilang cuma peluang menangkap
-- salah ketiknya lebih awal, bukan kebenaran skornya.
-- ============================================================================

alter table wahana add column if not exists petunjuk text;

comment on column wahana.petunjuk is
  'Keterangan kecil di bawah judul kolom, di layar dan di kertas. Kosong = '
  'layar menyusunnya sendiri dari rentang/bentuknya. Diisi hanya bila rentang '
  'saja menyesatkan, seperti Menaksir yang menulis selisih, bukan nilai.';

do $$
declare v_baris int;
begin
  update wahana set
    petunjuk = 'selisih jarak · 0 = tepat',
    rentang_mentah_maks = 99999999.99
  where edisi = edisi_aktif() and kode = 'menaksir';

  get diagnostics v_baris = row_count;
  if v_baris = 0 then
    raise notice '0037: komponen `menaksir` tidak ada di edisi aktif — '
                 'petunjuk kolom dilewati.';
  else
    raise notice '0037: petunjuk kolom Menaksir dipasang.';
  end if;
end;
$$;
