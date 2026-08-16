-- ============================================================================
-- hrcd-rekap : 0059_nilai_mentah_bulat.sql
-- Nilai mentah tidak punya koma.
--
-- KENAPA
--
-- Tidak ada satu pun komponen di edisi ini yang nilai mentahnya pecahan.
-- Semuanya salah satu dari tiga hal, dan ketiganya bulat menurut sifatnya:
--
--   hitungan  — berapa huruf semaphore benar, berapa simpul benar (0-5, 0-10)
--   skor juri — angka yang dilingkari juri di blangko (0-20, 0-30)
--   detik     — dicatat dari stopwatch dan diketik sebagai MM:SS
--
-- `menaksir` pun bulat: selisih taksir dihitung per meter, dan tangganya
-- (migrasi 0035) turun 20 poin tiap meter penuh — 2,5 m tidak pernah punya
-- tempat di tangga itu.
--
-- Sampai sekarang tidak ada yang menahannya. Kolomnya `numeric`, kotak
-- isiannya `step="any"` dengan `inputmode="decimal"` — dua-duanya MENGUNDANG
-- koma. Juri yang mengetik 4,85 untuk Semaphore diterima tanpa sepatah kata,
-- dan angka itu lalu ikut dihitung ke klasemen sebagai kalau-kalau ia berarti.
--
-- YANG DIJAGA CONSTRAINT INI, DAN YANG TIDAK
--
-- Ia menjaga bentuk angkanya, bukan besarnya. Rentang tetap dijaga
-- `rentang_mentah_min/maks` seperti sebelumnya — 99.999.999 tetap sah untuk
-- menaksir, karena rentang itu memang sengaja longgar supaya isian sah apa pun
-- diterima dan yang menghukum kelewatan adalah tangganya, bukan penolakan.
--
-- KALAU SUATU HARI ADA KOMPONEN YANG MEMANG PECAHAN
--
-- Jangan melonggarkan constraint ini diam-diam. Yang benar: simpan angkanya
-- dalam satuan terkecil yang bulat — sentimeter alih-alih meter, atau
-- persepuluh detik — persis seperti `detik` yang sudah disimpan sebagai detik
-- bulat, bukan menit pecahan. Pecahan yang masuk ke satu kolom akan menyebar
-- ke setiap tempat yang membacanya.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Laporkan dulu kalau ada yang tidak lolos. Constraint yang gagal hanya
--    menyebut nama constraint-nya; yang dibutuhkan orang yang menjalankannya
--    adalah baris MANA yang salah.
-- ---------------------------------------------------------------------------
do $$
declare v_n int; r record;
begin
  select count(*) into v_n from nilai_mentah
   where nilai_1 <> round(nilai_1)
      or (nilai_2 is not null and nilai_2 <> round(nilai_2));
  if v_n > 0 then
    for r in
      select n.regu_id, w.kode, n.nilai_1, n.nilai_2
        from nilai_mentah n join wahana w on w.id = n.wahana_id
       where n.nilai_1 <> round(n.nilai_1)
          or (n.nilai_2 is not null and n.nilai_2 <> round(n.nilai_2))
       limit 20
    loop
      raise notice '0059: pecahan — regu % komponen % : % / %',
        r.regu_id, r.kode, r.nilai_1, r.nilai_2;
    end loop;
    raise exception '0059: % nilai mentah masih pecahan (20 pertama di atas). '
      'Bulatkan dulu, atau periksa apakah komponennya memang perlu pecahan.', v_n;
  end if;
  raise notice '0059: semua nilai mentah sudah bulat.';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Pagarnya.
-- ---------------------------------------------------------------------------
alter table nilai_mentah add constraint nilai_mentah_bulat
  check (nilai_1 = round(nilai_1)
         and (nilai_2 is null or nilai_2 = round(nilai_2)));

comment on constraint nilai_mentah_bulat on nilai_mentah is
  'Nilai mentah selalu bulat: hitungan, skor juri, atau detik. Komponen pecahan disimpan dalam satuan terkecilnya, bukan dengan melonggarkan ini.';
