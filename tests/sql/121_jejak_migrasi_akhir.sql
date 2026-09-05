-- ============================================================================
-- hrcd-rekap : tests/sql/121_jejak_migrasi_akhir.sql
--
-- SATU-SATUNYA TES YANG MEMERIKSA SKEMA AKHIR, BUKAN SKEMA PADA BARISNYA.
--
-- tests/run.sh menyelang migrasi dan tes menurut urutan, jadi setiap tes
-- membuktikan invariannya terhadap skema SEBAGAIMANA ADANYA DI BARIS ITU.
-- Tidak ada yang menjalankannya lagi sesudahnya. Migrasi yang membangun ulang
-- objek yang dijaga tes lebih tua karena itu bisa melanggar invariannya sambil
-- suite tetap hijau.
--
-- Itu bukan dugaan; begitulah #843 masuk:
--
--   run.sh baris 407  0095_lembar_pos_jawaban_benar.sql memasang invariannya
--   run.sh baris 408  56_lembar_pos_sama_dengan_klasemen.sql membuktikannya
--   run.sh baris 728  0166_gembok_per_lomba.sql membangun ulang v_lembar_pos
--                     dan menjatuhkan argumen ke-11 hitung_poin()
--
-- Tes 56 ada persis supaya "rebuild berikutnya yang lupa satu argumen jatuh di
-- CI". Ia tidak bisa: ia sudah selesai 320 baris sebelumnya. Yang menemukannya
-- supabase/checks/status_migrasi.sql, satu-satunya berkas yang membaca skema
-- sesudah semuanya mendarat — dan berkas itu cuma jalan kalau ada yang
-- men-dispatch-nya dengan tangan (CLAUDE.md 16.5), jadi tidak ada yang
-- memunculkannya selama seminggu.
--
-- ---------------------------------------------------------------------------
-- KENAPA status_migrasi, BUKAN MENJALANKAN ULANG TES 56 DI SINI
--
-- Menjalankan ulang tes 56 di kaki run.sh adalah jalan yang paling terpikir,
-- dan ia TIDAK JALAN: tes itu memasang komponennya sendiri tetapi meminjam
-- regu yang sudah ada — lunas, bernomor dada, tidak batal — dan di kaki
-- run.sh regu seperti itu sudah habis dihapus tes "Bersihkan data" di
-- atasnya. Dicoba: `56 GAGAL: tidak ada regu lunas bernomor dada untuk
-- diuji`. Membuatkannya regu sendiri berarti menulis ulang setengah tesnya
-- di tempat kedua yang akan menyimpang dari yang pertama.
--
-- Yang di bawah ini lebih murah DAN lebih luas. Di atas database yang
-- dibangun dari NOL, sebuah baris BELUM di bagian 1 hanya bisa berarti satu
-- hal: migrasi yang lebih muda menulis ulang objek milik migrasi yang lebih
-- tua dan tidak membawa serta keputusannya. Itu persis kelas kerusakan yang
-- dijaga di sini, dan diperiksa untuk 117 jejak sekaligus, bukan satu
-- invarian pilihan tangan.
--
-- Di PRODUKSI arti BELUM berbeda — di sana ia bisa berarti berkasnya memang
-- belum pernah dijalankan, dan itulah sebab berkas checks-nya melapor alih-
-- alih gagal. Di sini seluruh migrasi baru saja dijalankan berurutan oleh
-- run.sh, jadi kemungkinan itu tertutup dan BELUM boleh menggagalkan.
--
-- Kalau kelak sebuah migrasi memang SENGAJA membuang objek milik migrasi
-- lama, yang benar bukan melonggarkan tes ini: pindahkan nomor migrasi tua
-- itu dari bagian 1 ke bagian 2 status_migrasi.sql, di commit yang sama —
-- karena memang tidak ada lagi yang tersisa untuk diperiksa.
-- ============================================================================

\echo '--- 121. Jejak tiap migrasi masih berdiri sesudah seluruh migrasi'

-- Laporannya sendiri. Ia mengisi tabel sementara status_migrasi_hasil, dan
-- karena \ir berjalan di sesi psql YANG SAMA, blok di bawah bisa membacanya.
\ir ../../supabase/checks/status_migrasi.sql

do $blok$
declare
  v_hilang text;
  v_jumlah int;
begin
  select count(*) into v_jumlah from status_migrasi_hasil;
  assert v_jumlah > 100,
    format('121 GAGAL: status_migrasi cuma memeriksa %s jejak — bagian 1 '
           'tidak terisi, jadi tes ini tidak membuktikan apa pun', v_jumlah);

  select string_agg(nomor || ' (' || jejak || ')', E'\n           '
                    order by nomor)
    into v_hilang
    from status_migrasi_hasil where not ada;

  assert v_hilang is null,
    format('121 GAGAL: jejak migrasi berikut TIDAK berdiri di skema akhir. '
           'Database ini dibangun dari nol dan seluruh migrasi baru saja '
           'dijalankan, jadi ini bukan migrasi terlewat — ini migrasi yang '
           'lebih muda menulis ulang objeknya dan menjatuhkan keputusan '
           'migrasi yang lebih tua:%s           %s',
           E'\n           ', v_hilang);

  raise notice '121.1 LULUS: % jejak migrasi masih berdiri di skema akhir.',
    v_jumlah;
end $blok$;
