-- ============================================================================
-- hrcd-rekap : 0039_judul_isian.sql
--
-- Judul besar di atas kotak isian form per lomba jadi konfigurasi, dan judul
-- Menaksir diperbaiki jadi "Selisih taksir".
--
-- ---------------------------------------------------------------------------
-- KENAPA INI BUKAN SEKADAR SOAL KATA
--
-- Layar menurunkan judul itu dari bentuk komponennya: waktu jadi "Waktu
-- tempuh", hitungan jadi "Jumlah benar". Untuk Menaksir turunannya adalah
-- "Hasil ukur" — dan itu kata yang salah dengan cara yang paling mahal.
--
-- Yang harus ditulis petugas adalah SELISIH antara taksiran regu dan jarak
-- sebenarnya. "Hasil ukur" membaca seperti perintah menulis jarak yang
-- terukur. Kalau itu yang ditulis — 12 meter, bukan selisih 2 meter — tangga
-- Menaksir habis di atas 4 meter, jadi hampir setiap regu mendapat 0.
--
-- Tidak ada galat, tidak ada yang janggal di layar. Yang terlihat hanyalah
-- satu lomba yang seluruh pesertanya kebetulan buruk.
--
-- ---------------------------------------------------------------------------
-- KENAPA KOLOM BARU, BUKAN DITURUNKAN SAJA
--
-- Empat dari lima bentuk penilaian bisa diterjemahkan sendiri oleh layar,
-- karena bentuknya menentukan artinya: `satuan = detik` selalu berarti waktu,
-- `besar_baik` selalu berarti jumlah benar.
--
-- `bertingkat` tidak. Ia cuma tangga angka — angkanya bisa detik, meter,
-- selisih, atau apa pun yang panitia putuskan tahun itu. Sistem TIDAK BISA
-- tahu, dan menebak menghasilkan persis kekeliruan di atas. Jadi bentuk itu
-- membawa judulnya sendiri, dan kalau tidak diisi layar memakai "Data mentah"
-- yang tidak menyesatkan siapa pun karena tidak menjanjikan apa-apa.
--
-- Kolom ini bersaudara dengan `petunjuk` (0037), dan keduanya memang dua slot
-- berbeda di kertas yang sama: `judul_isian` huruf besar di kepala kotak,
-- `petunjuk` baris kecil di bawahnya.
-- ============================================================================

alter table wahana add column if not exists judul_isian text;

comment on column wahana.judul_isian is
  'Judul besar di atas kotak isian pada form per lomba. Kosong = layar '
  'menurunkannya dari bentuk komponen. WAJIB diisi untuk form=bertingkat '
  'tanpa satuan, karena bentuk itu tidak menentukan arti angkanya.';

do $$
declare v_baris int;
begin
  update wahana set judul_isian = 'Selisih taksir'
  where edisi = edisi_aktif() and kode = 'menaksir';

  get diagnostics v_baris = row_count;
  if v_baris = 0 then
    raise notice '0039: komponen `menaksir` tidak ada di edisi aktif — dilewati.';
  else
    raise notice '0039: judul isian Menaksir jadi "Selisih taksir".';
  end if;
end;
$$;
