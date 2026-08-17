-- ============================================================================
-- hrcd-rekap : tests/sql/29_sekolah_daftar_kurasi.sql
-- Daftar kurasi terpasang (migrasi 0063).
--
-- Yang dijaga bukan "188 baris masuk" — itu terbukti sendiri kalau migrasinya
-- jalan. Yang dijaga adalah tiga hal yang bisa rusak tanpa suara:
--
-- 1. **Tidak ada dua sekolah yang melebur.** 188 nama melewati
--    `kunci_sekolah()`, dan kalau dua di antaranya menghasilkan kunci yang
--    sama, `on conflict do update` akan menimpa yang satu dengan yang lain —
--    satu sekolah hilang, tanpa galat, dan yang menyadarinya adalah pembina
--    yang tidak menemukan sekolahnya di hari pendaftaran.
-- 2. **Sekolah yang sudah dirujuk pendaftaran tidak berpindah id.** Kalau
--    `on conflict` sampai menghapus-lalu-menyisipkan, pendaftaran yang sudah
--    ada akan menunjuk baris yang tidak ada lagi.
-- 3. **Bisa dijalankan dua kali.** Workflow Apply migration dipencet dari HP,
--    dan pencet dua kali itu wajar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Terpasang, dan tidak ada yang melebur.
-- ---------------------------------------------------------------------------
do $$
declare v_n int; v_kunci int;
begin
  select count(*) into v_n from sekolah;
  assert v_n >= 188, format('daftar kurasi seharusnya terpasang, baru %s baris', v_n);

  select count(distinct kunci_sekolah(name)) into v_kunci from sekolah;
  assert v_kunci = v_n,
         format('%s baris tapi cuma %s kunci — ada yang melebur', v_n, v_kunci);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Bentuk alamatnya seragam, dan sekolah contoh ada di tempatnya.
-- ---------------------------------------------------------------------------
do $$
declare v_alamat text; v_n int;
begin
  select address into v_alamat from sekolah where name = 'SMPN 1 Ciamis';
  assert v_alamat = 'Jl. Jenderal Sudirman No. 6, Ciamis, Kec. Ciamis, '
                    'Kabupaten Ciamis, Jawa Barat 46211, Indonesia',
         format('alamat SMPN 1 Ciamis tidak baku: %L', v_alamat);

  -- Dua sekolah senama di kabupaten berbeda tetap DUA baris. Ini aturan NPSN
  -- di runbook bagian 5, dan ia gagal diam-diam kalau kunci penyamaannya
  -- terlalu rakus.
  select count(*) into v_n from sekolah
   where name in ('MAN 3 Ciamis', 'MAN 3 Tasikmalaya');
  assert v_n = 2, format('MAN 3 Ciamis dan MAN 3 Tasikmalaya harus dua baris, ada %s', v_n);
  select count(*) into v_n from sekolah
   where name in ('MAN 6 Ciamis', 'MAN 6 Tasikmalaya');
  assert v_n = 2, format('MAN 6 Ciamis dan MAN 6 Tasikmalaya harus dua baris, ada %s', v_n);

  -- Yang sengaja ditahan memang tidak masuk. Memasang tebakan lebih buruk
  -- daripada tidak memasang apa-apa.
  select count(*) into v_n from sekolah
   where name in ('SMK Nusantara 1 Bekasi', 'SMPN 1 Kalijaya');
  assert v_n = 0, 'dua sekolah yang belum ketemu seharusnya TIDAK dipasang';

  -- Yang diperiksa: SELURUH daftar kurasi terpasang dalam bentuk baku. Bukan
  -- "tidak ada satu pun alamat di luar bentuk baku" — sekolah yang diketik
  -- pembina memang boleh ada dan alamatnya memang tulisan tangan. Menuntut
  -- seluruh tabel seragam akan menghukum jalan yang justru sengaja
  -- disediakan.
  select count(*) into v_n from sekolah where address like '%, Indonesia';
  assert v_n >= 188, format('baru %s alamat berbentuk baku, seharusnya >= 188', v_n);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Dijalankan ulang: tidak melahirkan baris kedua, dan id-nya tetap.
-- ---------------------------------------------------------------------------
do $$
declare v_id_awal uuid; v_id_akhir uuid; v_awal int; v_akhir int;
begin
  select count(*) into v_awal from sekolah;
  select id into v_id_awal from sekolah where name = 'SMPN 1 Ciamis';

  -- Sekolah yang sama, ejaan pembina, alamat asal-asalan — persis bentuk yang
  -- dulu melahirkan baris keempat.
  insert into sekolah (name, address)
  values ('SMP NEGERI 1 CIAMIS', 'jl sudirman no 6')
  on conflict (kunci_sekolah(name)) do update
    set name = excluded.name, address = excluded.address;

  select count(*) into v_akhir from sekolah;
  assert v_akhir = v_awal, format('seharusnya tidak bertambah, jadi %s', v_akhir);

  select id into v_id_akhir from sekolah
   where kunci_sekolah(name) = kunci_sekolah('SMPN 1 Ciamis');
  assert v_id_awal = v_id_akhir,
         'id sekolah berubah — pendaftaran yang sudah merujuknya akan putus';

  -- Kembalikan ke bentuk baku; baris di atas sengaja menimpanya.
  update sekolah
     set name = 'SMPN 1 Ciamis',
         address = 'Jl. Jenderal Sudirman No. 6, Ciamis, Kec. Ciamis, '
                   'Kabupaten Ciamis, Jawa Barat 46211, Indonesia'
   where id = v_id_akhir;
end $$;

\echo '29 sekolah daftar kurasi: LULUS'
