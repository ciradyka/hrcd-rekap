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
-- ============================================================================

-- Baris lama yang melanggar disebutkan namanya, dan migrasi ini BERHENTI.
-- Menambahkan constraint sambil diam-diam membiarkan barisnya berarti aturan
-- itu berlaku untuk pendaftar berikutnya saja, dan regu yang sudah terlanjur
-- bernama satu huruf akan tetap dipanggil dengan satu huruf di lapangan.
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
    raise exception '0120: nama regu berikut kurang dari tiga huruf — ganti dulu lewat layar meja, baru jalankan ulang migrasi ini: %', v_regu;
  end if;
  raise notice '0120: data yang ada lolos — semua nama regu tiga huruf atau lebih.';
end;
$$;

alter table regu drop constraint if exists regu_nama_regu_tiga_huruf;
alter table regu add constraint regu_nama_regu_tiga_huruf
  check (length(regexp_replace(nama_regu, '[^[:alpha:]]', '', 'g')) >= 3);

comment on constraint regu_nama_regu_tiga_huruf on regu is
  'Nama regu dibacakan di lapangan; satu atau dua huruf tidak terdengar '
  'sebagai nama. Yang dihitung hurufnya, bukan panjang karakternya — spasi '
  'dan tanda baca dibuang dulu.';
