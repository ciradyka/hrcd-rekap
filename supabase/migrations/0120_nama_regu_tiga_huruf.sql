-- ============================================================================
-- hrcd-rekap : 0120_nama_regu_tiga_huruf.sql
--
-- Nama regu sekurang-kurangnya tiga huruf.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Batas nama regu selama ini hanya di ujung ATAS: maksimal 20 karakter (0051),
-- tanpa angka (0052), dan tidak boleh kembar. Ujung bawahnya satu karakter,
-- jadi "A" dan "-" sama-sama lolos.
--
-- Nama sependek itu tidak dapat dipanggil. Nama regu dibacakan di lapangan
-- saat pemberangkatan dan saat juara diumumkan, dan satu huruf yang diteriakkan
-- di antara puluhan regu tidak terdengar sebagai nama. Ia juga tidak dapat
-- dibedakan di lembar per pos, tempat kolomnya bersebelahan dengan nomor dada
-- yang justru memang pendek.
--
-- ---------------------------------------------------------------------------
-- YANG DIHITUNG ADALAH HURUFNYA, BUKAN PANJANG KARAKTERNYA
--
-- "A B" panjangnya tiga karakter tetapi hurufnya dua, dan yang dibacakan di
-- lapangan adalah hurufnya. Karena itu tanda baca dan spasi dibuang dulu, baru
-- sisanya dihitung — sejalan dengan 0052 yang juga menyempitkan syaratnya
-- seketat mungkin supaya nama sungguhan tidak ikut tertolak: "Ma'ruf" dan
-- "Siti Nur-Aini" tetap lolos, karena hurufnya jauh lebih dari tiga.
--
-- Batas atas 20 di `regu_nama_panjang` sengaja TIDAK diutak-atik. Ia menghitung
-- karakter karena yang dijaganya adalah lebar kolom di kertas, dan di sana
-- spasi memang memakan tempat.
--
-- ---------------------------------------------------------------------------
-- KENAPA DI DATABASE, BUKAN CUKUP DI FORM
--
-- Alasan yang sama dengan 0052: form pendaftaran menolaknya sambil diketik,
-- tetapi RPC-nya terbuka dan panitia juga menulis nama lewat layar meja. Yang
-- menegakkan aturan harus yang paling akhir menyentuh datanya.
--
-- Berlaku untuk SELURUH golongan, Internal maupun Eksternal. Constraint-nya
-- duduk di kolom `regu.nama_regu` dan tidak menyebut golongan sama sekali,
-- jadi tidak ada satu jalur pun yang lolos: form pendaftaran, layar meja, dan
-- RPC ketiganya menulis ke kolom yang sama.
--
-- ---------------------------------------------------------------------------
-- BARIS LAMA DIBIARKAN — `NOT VALID`, DAN ITU KEPUTUSAN PEMILIK ACARA
--
-- Empat regu di produksi bernama satu huruf (D, H, S, Y). Versi pertama
-- migrasi ini BERHENTI dan menyuruh menggantinya dulu; jalannya ditolak
-- 27 Agustus 2026, lalu pemilik acara memutuskan: biarkan yang lama, yang
-- penting yang baru minimal tiga huruf.
--
-- `NOT VALID` mengerjakan persis itu. Ia melewati pemindaian baris yang sudah
-- ada, tetapi TETAP menegakkan syaratnya pada setiap INSERT dan UPDATE — jadi
-- pendaftaran baru tidak bisa lagi bernama satu huruf, dan keempat baris lama
-- itu tetap ada apa adanya sampai ada yang menyentuhnya.
--
-- Konsekuensinya, dan panitia perlu tahu: MENGUBAH salah satu dari keempat
-- baris itu menuntut namanya sekalian dibetulkan. Mengganti nama ketua regu
-- "D" tanpa memanjangkan "D" akan ditolak database.
--
-- Jangan menjalankan `validate constraint` di kemudian hari tanpa mengganti
-- keempat nama itu lebih dulu — perintah itu memindai seluruh tabel dan akan
-- gagal dengan pesan yang jauh lebih sulit dibaca daripada daftar di bawah.
-- ============================================================================

-- Baris lama yang melanggar tetap DISEBUTKAN namanya — dibiarkan bukan berarti
-- tidak dicatat. Yang membacanya adalah panitia yang memanggil nama itu di
-- lapangan, dan daftar ini satu-satunya tempat keempatnya pernah tertulis.
do $$
declare v_regu text;
begin
  select string_agg(format('%s (%s huruf)', nama_regu,
                           length(regexp_replace(nama_regu, '[^[:alpha:]]', '', 'g'))),
                    ', ' order by nama_regu)
    into v_regu
  from regu
  where not is_cancelled
    and length(regexp_replace(nama_regu, '[^[:alpha:]]', '', 'g')) < 3;

  if v_regu is not null then
    raise notice '0120: nama regu berikut kurang dari tiga huruf dan SENGAJA dibiarkan (NOT VALID): %', v_regu;
    raise notice '0120: mengubah baris itu di kemudian hari menuntut namanya sekalian dipanjangkan.';
  else
    raise notice '0120: data yang ada lolos — semua nama regu tiga huruf atau lebih.';
  end if;
end;
$$;

alter table regu drop constraint if exists regu_nama_regu_tiga_huruf;
alter table regu add constraint regu_nama_regu_tiga_huruf
  check (length(regexp_replace(nama_regu, '[^[:alpha:]]', '', 'g')) >= 3)
  not valid;

comment on constraint regu_nama_regu_tiga_huruf on regu is
  'Nama regu dibacakan di lapangan; satu atau dua huruf tidak terdengar '
  'sebagai nama. Yang dihitung hurufnya, bukan panjang karakternya — spasi '
  'dan tanda baca dibuang dulu. NOT VALID: berlaku untuk setiap baris baru '
  'dan setiap perubahan, sementara empat baris satu huruf dari sebelum '
  '27 Agustus 2026 dibiarkan apa adanya.';
