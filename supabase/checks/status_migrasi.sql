-- ============================================================================
-- hrcd-rekap : status_migrasi.sql — TIDAK mengubah apa pun.
--
-- Berkas ini menjawab satu pertanyaan yang tidak bisa dijawab dari git:
-- "migrasi mana yang isinya benar-benar sudah ada di produksi?"
--
-- Sebabnya: apply-migration.yml menerapkan SATU berkas per jalan, manual, dan
-- tidak ada tabel yang mencatat mana yang sudah dijalankan. Kalau satu berkas
-- terlewat, tidak ada satu pun galat sampai lapangan menabraknya. Itulah yang
-- terjadi pada 0091 — pendaftaran Internal ditolak `regu_golongan_check`
-- karena constraint-nya masih milik 0001.
--
-- YANG DIPERIKSA BUKAN NAMA BERKASNYA MELAINKAN JEJAKNYA
--
-- Nama berkas tidak disimpan di mana pun, jadi tidak ada yang bisa dicocokkan.
-- Yang dicari sebuah constraint, kolom, potongan definisi fungsi, atau baris
-- konfigurasi yang HANYA lahir dari migrasi itu.
--
-- CAKUPANNYA DISEBUTKAN, TIDAK DIDIAMKAN
--
-- Sampai 30 Agustus 2026 berkas ini hanya memeriksa SEPULUH migrasi — 0091 dan
-- 0098-0106, yang memang jadi sebabnya ia ditulis — sementara kepalanya
-- berbunyi seperti pemeriksa umum. Seratus lima puluh dua migrasi lain tidak
-- diperiksa sama sekali dan laporannya tetap hijau. Itu persis bentuk kesalahan
-- yang dicatat CLAUDE.md bagian 13.3: pemeriksaan yang cakupannya lebih sempit
-- daripada masalahnya lebih berbahaya daripada tidak ada pemeriksaan, karena ia
-- menutup pertanyaannya.
--
-- Sekarang keduanya disebutkan: 117 migrasi punya jejak yang diperiksa
-- (bagian 1), dan 54 tidak punya (bagian 2). 117 + 54 = 171, yaitu SELURUH
-- migrasi yang ada — dan angka itu yang harus dijaga tiap kali berkas migrasi
-- baru mendarat. Yang di bagian 2 bukan berarti belum diterapkan — berarti
-- tidak ada yang tersisa untuk diperiksa.
--
-- Pernah tidak begitu: sampai 2 September 2026 kedua daftar berhenti di 0163,
-- jadi 0164-0169 tidak disebut di mana pun dan pemeriksanya melapor hijau atas
-- enam migrasi yang tidak pernah dilihatnya — bentuk kesalahan yang sama, satu
-- edisi lebih muda. Nomor yang tidak ada di kedua daftar TIDAK muncul sebagai
-- BELUM; ia tidak muncul sama sekali, dan itulah yang membuatnya sulit
-- terlihat.
--
-- DARI MANA JEJAKNYA DATANG, DAN KENAPA BOLEH DIPERCAYA
--
-- Tidak ditulis tangan satu per satu, dan tidak ditebak. Database dibangun dari
-- nol mengikuti urutan `tests/run.sh`, dan katalog beserta tabel konfigurasinya
-- dipotret sesudah SETIAP migrasi. Sebuah potongan baru diterima jadi jejak
-- kalau ia lolos dua syarat, diuji terhadap seluruh 164 potret:
--
--   1. TIDAK ada di SATU PUN potret sebelum migrasinya — jadi ia memang lahir
--      dari migrasi itu, bukan dari yang lebih tua;
--   2. ADA di potret terakhir — jadi ia masih berdiri, belum ditulis ulang.
--
-- `tests/status_migrasi_check.sh` menguji berkas ini dari DUA arah: sesudah
-- migrasi N jejaknya harus ADA, dan sebelum migrasi N jejaknya harus BELUM.
-- Arah kedua yang biasanya hilang — tanpa itu, `select true` pun lulus. Dua
-- puluh jejak sempat lolos syarat yang lebih longgar dan ketahuan oleh harness
-- itu; semuanya dibuang atau diganti.
--
-- EMPAT HAL YANG MEMBUAT JEJAK TERLIHAT HILANG PADAHAL TIDAK
--
-- 1. **Versi PostgreSQL.** `pg_get_functiondef` dan kawan-kawannya DIBUAT ULANG
--    server dan bentuknya berbeda antar versi, jadi yang dibandingkan di sini
--    `prosrc` — teks yang disimpan apa adanya dari migrasinya.
-- 2. **Constraint NOT NULL.** PostgreSQL 18 mencatatnya di `pg_constraint`,
--    versi sebelumnya tidak. Tidak satu pun jejak di bawah bersandar padanya.
--    Bagian 0 mencetak versi servernya supaya perbedaan itu kelihatan.
-- 3. **Akhiran baris.** Berkas migrasi yang di-checkout di Windows berakhiran
--    CRLF, jadi `prosrc` di laptop memuat \r yang tidak ada di produksi. Semua
--    potongan di bawah satu baris penuh, tanpa \r.
-- 4. **Objek yang belum ada sama sekali.** Tiap pemeriksaan dijalankan lewat
--    EXECUTE dengan penangkap galat: tabel yang tidak ada menjawab BELUM, bukan
--    menggagalkan seluruh berkas.
--
-- KENAPA JEJAK BERBENTUK "SUDAH TIDAK ADA" TIDAK DIPAKAI
--
-- Migrasi yang tugasnya membuang sesuatu — view yang dipensiunkan, policy yang
-- ternyata salah, baris sekolah yang dilebur — tidak bisa diperiksa dari sini.
-- "Objeknya sudah tidak ada" tidak bisa dibedakan dari "objeknya belum pernah
-- ada", jadi jejak seperti itu berbunyi ADA sejak migrasi pertama. Itu justru
-- laporan hijau palsu yang jadi alasan seluruh berkas ini ditulis ulang.
--
-- Cara pakai: Actions -> "Apply migration to Supabase" -> Run workflow, isi
--   supabase/checks/status_migrasi.sql
-- ============================================================================

\pset border 2
\echo ''
\echo '=== 0. Versi server ==='
\echo '    Dicetak karena ia mengubah arti sebagian jejak: PostgreSQL 18 mencatat'
\echo '    constraint NOT NULL di pg_constraint, versi sebelumnya tidak. Kalau'
\echo '    versi di sini berbeda dari laptop yang merakit jejaknya, BELUM yang'
\echo '    muncul belum tentu soal migrasi.'
select version();

\echo ''
\echo '=== 1. Migrasi yang jejaknya bisa diperiksa ==='

drop table if exists status_migrasi_hasil;
create temporary table status_migrasi_hasil (nomor text, jejak text, ada boolean);

do $$
declare t record; v_ada boolean;
begin
  for t in select * from (values
  ('0001', 'constraint akun_panitia.akun_panitia_pkey: PRIMARY KEY (user_id)',
   $c$select exists (select 1 from pg_constraint where conrelid = 'akun_panitia'::regclass and conname = 'akun_panitia_pkey' and position('PRIMARY KEY (user_id)' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0002', 'trigger edisi.kunci_edisi: CREATE TRIGGER kunci_edisi BEFORE INSERT OR DELETE OR UPDA',
   $c$select exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname = 'edisi' and t.tgname = 'kunci_edisi' and position('CREATE TRIGGER kunci_edisi BEFORE INSERT OR DELETE OR UPDATE ON public.edisi FOR EACH ROW EXECUTE FUNCTION tolak_saat_terkunci()' in pg_get_triggerdef(t.oid)) > 0)$c$),
  ('0003', 'policy akun_panitia.sel_akun_sendiri: SELECT (user_id = auth.uid()) ~ -',
   $c$select exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'akun_panitia' and policyname = 'sel_akun_sendiri' and position('SELECT (user_id = auth.uid()) ~ -' in cmd || ' ' || coalesce(qual, '-') || ' ~ ' || coalesce(with_check, '-')) > 0)$c$),
  ('0005', 'view v_barak: COALESCE(sum(p.jumlah_orang), (0)::bigint) AS terisi',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_barak' and position('COALESCE(sum(p.jumlah_orang), (0)::bigint) AS terisi' in definition) > 0)$c$),
  ('0006', 'index pendaftaran_kunci_kirim_uniq: CREATE UNIQUE INDEX pendaftaran_kunci_kirim_uniq ON public',
   $c$select exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pendaftaran_kunci_kirim_uniq' and position('CREATE UNIQUE INDEX pendaftaran_kunci_kirim_uniq ON public.pendaftaran USING btree (kunci_kirim) WHERE (kunci_kirim IS NOT NULL)' in indexdef) > 0)$c$),
  ('0008', 'view v_daftar_kloter: r.golongan',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_daftar_kloter' and position('r.golongan' in definition) > 0)$c$),
  ('0009', 'view v_daftar_kloter: r.alasan_sisip',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_daftar_kloter' and position('r.alasan_sisip' in definition) > 0)$c$),
  ('0010', 'view v_regu_ringkas: r.golongan',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_regu_ringkas' and position('r.golongan' in definition) > 0)$c$),
  ('0011', 'function daftar_ulang_batch/2',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'daftar_ulang_batch' and p.pronargs = 2 and true)$c$),
  ('0012', 'constraint closing_regu.closing_regu_dicatat_oleh_fkey: FOREIGN KEY (recorded_by) REFERENCES auth.users(id)',
   $c$select exists (select 1 from pg_constraint where conrelid = 'closing_regu'::regclass and conname = 'closing_regu_dicatat_oleh_fkey' and position('FOREIGN KEY (recorded_by) REFERENCES auth.users(id)' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0013', 'column pendaftaran.nama_kontak: text - YES',
   $c$select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pendaftaran' and column_name = 'nama_kontak' and position('text - YES' in data_type || ' ' || coalesce(column_default, '-') || ' ' || is_nullable) > 0)$c$),
  ('0014', 'constraint nilai_mentah.nilai_mentah_sumber_check: CHECK ((source = ANY (ARRAY[''manual''::text, ''upload''::text',
   $c$select exists (select 1 from pg_constraint where conrelid = 'nilai_mentah'::regclass and conname = 'nilai_mentah_sumber_check' and position('CHECK ((source = ANY (ARRAY[''manual''::text, ''upload''::text])))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0015', 'column v_kwitansi.verified_at: timestamp with time zone - YES',
   $c$select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'v_kwitansi' and column_name = 'verified_at' and position('timestamp with time zone - YES' in data_type || ' ' || coalesce(column_default, '-') || ' ' || is_nullable) > 0)$c$),
  ('0017', 'function koreksi_jam_berangkat/3',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'koreksi_jam_berangkat' and p.pronargs = 3 and true)$c$),
  ('0018', 'function regu_sudah_berangkat/1',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'regu_sudah_berangkat' and p.pronargs = 1 and true)$c$),
  ('0021', 'constraint akun_panitia.akun_panitia_pos_check: CHECK (((pos >= 1) AND (pos <= 20)))',
   $c$select exists (select 1 from pg_constraint where conrelid = 'akun_panitia'::regclass and conname = 'akun_panitia_pos_check' and position('CHECK (((pos >= 1) AND (pos <= 20)))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0022', 'constraint wahana.wahana_form_check: CHECK ((form = ANY (ARRAY[''kecil_baik''::text, ''besar_baik''',
   $c$select exists (select 1 from pg_constraint where conrelid = 'wahana'::regclass and conname = 'wahana_form_check' and position('CHECK ((form = ANY (ARRAY[''kecil_baik''::text, ''besar_baik''::text, ''biner''::text, ''benar_per_total''::text, ''benar_kurang_salah''::text, ''bertingkat''::text])))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0023', 'view v_lembar_pos: COALESCE(( SELECT jsonb_object_agg(w.kode, jsonb_build_obj',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_lembar_pos' and position('COALESCE(( SELECT jsonb_object_agg(w.kode, jsonb_build_object(''nilai_1'', n.nilai_1, ''nilai_2'', n.nilai_2)) AS jsonb_object_agg' in definition) > 0)$c$),
  ('0024', 'constraint pos.pos_nomor_check: CHECK (((nomor >= 0) AND (nomor <= 20)))',
   $c$select exists (select 1 from pg_constraint where conrelid = 'pos'::regclass and conname = 'pos_nomor_check' and position('CHECK (((nomor >= 0) AND (nomor <= 20)))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0028', 'view v_kelengkapan_pos: FROM ((v_pos p',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kelengkapan_pos' and position('FROM ((v_pos p' in definition) > 0)$c$),
  ('0037', 'row wahana: petunjuk": null',
   $c$select exists (select 1 from wahana t where position('petunjuk": null' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0039', 'row wahana: judul_isian": null',
   $c$select exists (select 1 from wahana t where position('judul_isian": null' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0042', 'view v_riwayat_nilai: ((h.old_value ->> ''nilai_1''::text))::numeric AS nilai_lama',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_riwayat_nilai' and position('((h.old_value ->> ''nilai_1''::text))::numeric AS nilai_lama' in definition) > 0)$c$),
  ('0043', 'constraint nilai_terkunci.nilai_terkunci_locked_by_fkey: FOREIGN KEY (locked_by) REFERENCES auth.users(id)',
   $c$select exists (select 1 from pg_constraint where conrelid = 'nilai_terkunci'::regclass and conname = 'nilai_terkunci_locked_by_fkey' and position('FOREIGN KEY (locked_by) REFERENCES auth.users(id)' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0044', 'view v_lembar_pos: nilai_tergembok(r.id, p.nomor) AS terkunci',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_lembar_pos' and position('nilai_tergembok(r.id, p.nomor) AS terkunci' in definition) > 0)$c$),
  ('0046', 'constraint nilai_terkunci.nilai_terkunci_regu_id_fkey: FOREIGN KEY (regu_id) REFERENCES regu(id) ON DELETE CASCAD',
   $c$select exists (select 1 from pg_constraint where conrelid = 'nilai_terkunci'::regclass and conname = 'nilai_terkunci_regu_id_fkey' and position('FOREIGN KEY (regu_id) REFERENCES regu(id) ON DELETE CASCADE' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0047', 'constraint foto_lembar.foto_lembar_diunggah_oleh_fkey: FOREIGN KEY (diunggah_oleh) REFERENCES auth.users(id)',
   $c$select exists (select 1 from pg_constraint where conrelid = 'foto_lembar'::regclass and conname = 'foto_lembar_diunggah_oleh_fkey' and position('FOREIGN KEY (diunggah_oleh) REFERENCES auth.users(id)' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0048', 'view v_kelengkapan_publik: WHEN (count(ri.id) = 0) THEN 0',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kelengkapan_publik' and position('WHEN (count(ri.id) = 0) THEN 0' in definition) > 0)$c$),
  ('0050', 'view v_klasemen_live_score: golongan',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_klasemen_live_score' and position('golongan' in definition) > 0)$c$),
  ('0051', 'index regu_nama_unik: CREATE UNIQUE INDEX regu_nama_unik ON public.regu USING bt',
   $c$select exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'regu_nama_unik' and position('CREATE UNIQUE INDEX regu_nama_unik ON public.regu USING btree (lower(regexp_replace(TRIM(BOTH FROM nama_regu), ''\s+''::text, '' ''::text, ''g''::text))) WHERE (NOT is_cancelled)' in indexdef) > 0)$c$),
  ('0052', 'constraint pendaftaran.pendaftaran_nama_kontak_tanpa_angka: CHECK ((nama_kontak !~ ''[0-9]''::text))',
   $c$select exists (select 1 from pg_constraint where conrelid = 'pendaftaran'::regclass and conname = 'pendaftaran_nama_kontak_tanpa_angka' and position('CHECK ((nama_kontak !~ ''[0-9]''::text))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0053', 'view v_keberangkatan: CROSS JOIN edisi e)',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_keberangkatan' and position('CROSS JOIN edisi e)' in definition) > 0)$c$),
  ('0054', 'row wahana: lomba": null',
   $c$select exists (select 1 from wahana t where position('lomba": null' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0055', 'view v_kemajuan_hari: WITH siap AS (',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kemajuan_hari' and position('WITH siap AS (' in definition) > 0)$c$),
  ('0056', 'comment_rel v_daftar_kloter: Kertas barak. `perkiraan_berangkat` dibangun di WIB — sebe',
   $c$select exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'v_daftar_kloter' and position('Kertas barak. `perkiraan_berangkat` dibangun di WIB — sebelumnya di zona sesi database, yang mencetak 14:00 untuk kloter yang berangkat 07:00.' in coalesce(obj_description(c.oid, 'pg_class'), '')) > 0)$c$),
  ('0057', 'constraint akun_hak.akun_hak_fitur_fkey: FOREIGN KEY (fitur) REFERENCES fitur(kode)',
   $c$select exists (select 1 from pg_constraint where conrelid = 'akun_hak'::regclass and conname = 'akun_hak_fitur_fkey' and position('FOREIGN KEY (fitur) REFERENCES fitur(kode)' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0058', 'constraint akun_panitia.akun_panitia_check: CHECK (((peran = ''juri_pos''::text) = (pos IS NOT NULL)))',
   $c$select exists (select 1 from pg_constraint where conrelid = 'akun_panitia'::regclass and conname = 'akun_panitia_check' and position('CHECK (((peran = ''juri_pos''::text) = (pos IS NOT NULL)))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0059', 'constraint nilai_mentah.nilai_mentah_bulat: CHECK (((nilai_1 = round(nilai_1)) AND ((nilai_2 IS NULL) ',
   $c$select exists (select 1 from pg_constraint where conrelid = 'nilai_mentah'::regclass and conname = 'nilai_mentah_bulat' and position('CHECK (((nilai_1 = round(nilai_1)) AND ((nilai_2 IS NULL) OR (nilai_2 = round(nilai_2)))))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0060', 'view v_kelengkapan_pos: (count(ri.id) FILTER (WHERE (COALESCE(t.jumlah, 0) = kompo',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kelengkapan_pos' and position('(count(ri.id) FILTER (WHERE (COALESCE(t.jumlah, 0) = komponen_pos_golongan(p.nomor, ri.golongan))))::integer AS lengkap' in definition) > 0)$c$),
  ('0061', 'index sekolah_kunci_unik: CREATE UNIQUE INDEX sekolah_kunci_unik ON public.sekolah U',
   $c$select exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'sekolah_kunci_unik' and position('CREATE UNIQUE INDEX sekolah_kunci_unik ON public.sekolah USING btree (kunci_sekolah(name))' in indexdef) > 0)$c$),
  ('0062', 'comment_fn kunci_sekolah/1: Penyamaan nama sekolah untuk unique index. Sengaja jinak: ',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'kunci_sekolah' and p.pronargs = 1 and position('Penyamaan nama sekolah untuk unique index. Sengaja jinak: besar-kecil huruf, tanda baca, bentuk "Negeri", dan huruf status Dapodik (Swasta). TIDAK membuang singkatan seperti SMAT/SMAI — itu bisa memisahkan dua sekolah yang berbeda.' in coalesce(obj_description(p.oid, 'pg_proc'), '')) > 0)$c$),
  ('0063', 'row sekolah: {"name": "SMK Ma''arif NU Ciamis", "address": "Jl. Panamun ',
   $c$select exists (select 1 from sekolah t where position('{"name": "SMK Ma''arif NU Ciamis", "address": "Jl. Panamun No. 92, Sukamaju, Kec. Baregbeg, Kabupaten Ciamis, Jawa Barat 46274, Indonesia"}' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0064', 'policy closing_regu.adm_closing: ALL boleh(''pengaturan''::text) ~ -',
   $c$select exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'closing_regu' and policyname = 'adm_closing' and position('ALL boleh(''pengaturan''::text) ~ -' in cmd || ' ' || coalesce(qual, '-') || ' ~ ' || coalesce(with_check, '-')) > 0)$c$),
  ('0065', 'view v_foto_lembar: WHERE (boleh(''rekap''::text) OR (boleh(''pos''::text) AND ((p',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_foto_lembar' and position('WHERE (boleh(''rekap''::text) OR (boleh(''pos''::text) AND ((pos_saya() IS NULL) OR (f.pos = pos_saya()))))' in definition) > 0)$c$),
  ('0067', 'view v_klasemen_live_score: FROM klasemen_live_score() klasemen_live_score(peringkat, ',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_klasemen_live_score' and position('FROM klasemen_live_score() klasemen_live_score(peringkat, nomor_dada, nama_regu, nama_sekolah, golongan, total_pos, penalti_waktu, penalti_checkout, penalti_anggota, total, poin_per_pos, selisih_menit)' in definition) > 0)$c$),
  ('0068', 'comment_fn atur_fase_live/1: Buka/tutup klasemen untuk peserta. TIDAK menerbitkan apa p',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'atur_fase_live' and p.pronargs = 1 and position('Buka/tutup klasemen untuk peserta. TIDAK menerbitkan apa pun sendiri: halaman peserta membaca live.json dan rekap.json, yang ditulis ulang oleh publish-live.yml.' in coalesce(obj_description(p.oid, 'pg_proc'), '')) > 0)$c$),
  ('0069', 'view v_rekap_penuh: WHERE boleh_apa_saja(VARIADIC ARRAY[''rekap''::text, ''live_s',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_rekap_penuh' and position('WHERE boleh_apa_saja(VARIADIC ARRAY[''rekap''::text, ''live_score''::text])' in definition) > 0)$c$),
  ('0070', 'view v_fase_live: SELECT fase_live',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_fase_live' and position('SELECT fase_live' in definition) > 0)$c$),
  ('0071', 'view v_publik_ringkas: FROM regu r',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_publik_ringkas' and position('FROM regu r' in definition) > 0)$c$),
  ('0072', 'view v_progres_publik: ELSE ''{}''::jsonb',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_progres_publik' and position('ELSE ''{}''::jsonb' in definition) > 0)$c$),
  ('0073', 'row sekolah: {"name": "MA Al-Azhar Citangkolo Kota Banjar", "address": ',
   $c$select exists (select 1 from sekolah t where position('{"name": "MA Al-Azhar Citangkolo Kota Banjar", "address": "Jl. Pesantren No. 02, Kujangsari, Kec. Langensari, Kota Banjar, Jawa Barat 46345, Indonesia"}' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0074', 'constraint foto_lembar.foto_lembar_cara_taut_sah: CHECK (((cara_taut IS NULL) OR (cara_taut = ANY (ARRAY[''un',
   $c$select exists (select 1 from pg_constraint where conrelid = 'foto_lembar'::regclass and conname = 'foto_lembar_cara_taut_sah' and position('CHECK (((cara_taut IS NULL) OR (cara_taut = ANY (ARRAY[''unggah''::text, ''tangan''::text, ''mesin''::text]))))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0075', 'constraint akun_panitia.akun_panitia_peran_check: CHECK ((peran = ANY (ARRAY[''admin''::text, ''registrasi''::te',
   $c$select exists (select 1 from pg_constraint where conrelid = 'akun_panitia'::regclass and conname = 'akun_panitia_peran_check' and position('CHECK ((peran = ANY (ARRAY[''admin''::text, ''registrasi''::text, ''gerbang''::text, ''juri_pos''::text, ''koordinator_pos''::text])))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0076', 'row wahana: sort_order": 8',
   $c$select exists (select 1 from wahana t where position('sort_order": 8' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0077', 'trigger akun_panitia.hak_ikut_peran: CREATE TRIGGER hak_ikut_peran AFTER UPDATE OF peran ON pub',
   $c$select exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname = 'akun_panitia' and t.tgname = 'hak_ikut_peran' and position('CREATE TRIGGER hak_ikut_peran AFTER UPDATE OF peran ON public.akun_panitia FOR EACH ROW EXECUTE FUNCTION isi_ulang_hak_peran()' in pg_get_triggerdef(t.oid)) > 0)$c$),
  ('0078', 'index akun_kunci_unik: CREATE UNIQUE INDEX akun_kunci_unik ON public.akun_panitia',
   $c$select exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'akun_kunci_unik' and position('CREATE UNIQUE INDEX akun_kunci_unik ON public.akun_panitia USING btree (kunci_akun(username))' in indexdef) > 0)$c$),
  ('0079', 'comment_fn kode_lomba_wahana/3: Kunci lomba sebuah baris wahana: kolomnya kalau ada, hitun',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'kode_lomba_wahana' and p.pronargs = 3 and position('Kunci lomba sebuah baris wahana: kolomnya kalau ada, hitungan lama kalau belum. Satu tempat supaya RPC dan pemeriksaan tidak berbeda pendapat.' in coalesce(obj_description(p.oid, 'pg_proc'), '')) > 0)$c$),
  ('0080', 'comment_fn catat_foto_lembar/6: Foto per regu: nomor dadanya sudah diketik sebelum gambarn',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'catat_foto_lembar' and p.pronargs = 6 and position('Foto per regu: nomor dadanya sudah diketik sebelum gambarnya diambil, jadi barisnya lahir sudah tertaut dengan cara_taut = ''unggah''.' in coalesce(obj_description(p.oid, 'pg_proc'), '')) > 0)$c$),
  ('0081', 'comment_fn hapus_foto_lembar/2: Hapus satu foto slip beserta alasannya. Mengembalikan path',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'hapus_foto_lembar' and p.pronargs = 2 and position('Hapus satu foto slip beserta alasannya. Mengembalikan path-nya supaya objek di bucket ikut dihapus pemanggil — SQL tidak menjangkau storage.' in coalesce(obj_description(p.oid, 'pg_proc'), '')) > 0)$c$),
  ('0083', 'row edisi: tahun": 2026',
   $c$select exists (select 1 from edisi t where position('tahun": 2026' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0084', 'row edisi: biaya_per_regu": 175000',
   $c$select exists (select 1 from edisi t where position('biaya_per_regu": 175000' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0085', 'view v_lembar_pos: round((COALESCE(( SELECT sum(hitung_poin(w.form, n.nilai_1',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_lembar_pos' and position('round((COALESCE(( SELECT sum(hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks, w.raw_terbaik, w.raw_terburuk, w.poin_benar, w.poin_salah, w.total_soal, w.tingkat, w.jawaban_benar)) AS sum' in definition) > 0)$c$),
  ('0087', 'row wahana: kode_lomba": "kim-cium"',
   $c$select exists (select 1 from wahana t where position('kode_lomba": "kim-cium"' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0089', 'column konfig_penalti.blok_menit: smallint 1 NO',
   $c$select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'konfig_penalti' and column_name = 'blok_menit' and position('smallint 1 NO' in data_type || ' ' || coalesce(column_default, '-') || ' ' || is_nullable) > 0)$c$),
  ('0091', 'constraint regu.regu_golongan_check: CHECK ((golongan = ANY (ARRAY[''penegak_pa''::text, ''penegak',
   $c$select exists (select 1 from pg_constraint where conrelid = 'regu'::regclass and conname = 'regu_golongan_check' and position('CHECK ((golongan = ANY (ARRAY[''penegak_pa''::text, ''penegak_pi''::text, ''penggalang_pa''::text, ''penggalang_pi''::text, ''intern_pa''::text, ''intern_pi''::text])))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0092', 'constraint edisi.edisi_maks_eksternal_per_kloter_check: CHECK ((maks_eksternal_per_kloter >= 1))',
   $c$select exists (select 1 from pg_constraint where conrelid = 'edisi'::regclass and conname = 'edisi_maks_eksternal_per_kloter_check' and position('CHECK ((maks_eksternal_per_kloter >= 1))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0093', 'row edisi: lompatan_kloter": 1',
   $c$select exists (select 1 from edisi t where position('lompatan_kloter": 1' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0096', 'view v_kelengkapan_pos: LEFT JOIN regu_ikut ri ON ((komponen_pos_golongan(p.nomor,',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kelengkapan_pos' and position('LEFT JOIN regu_ikut ri ON ((komponen_pos_golongan(p.nomor, ri.golongan) > 0)))' in definition) > 0)$c$),
  ('0097', 'comment_fn konfirmasi_kontrak/2: Mencatat kontrak waktu satu regu. Boleh dari garis start (',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'konfirmasi_kontrak' and p.pronargs = 2 and position('Mencatat kontrak waktu satu regu. Boleh dari garis start (hak keberangkatan) maupun dari meja daftar ulang (hak daftar_ulang) — keduanya menanyakannya, dan sebelum 0058 keduanya satu peran.' in coalesce(obj_description(p.oid, 'pg_proc'), '')) > 0)$c$),
  ('0098', 'comment_fn pindah_kloter/3: Memindahkan regu secara manual dari meja registrasi atau g',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'pindah_kloter' and p.pronargs = 3 and position('Memindahkan regu secara manual dari meja registrasi atau garis start; hak cetak_kloter dan keberangkatan sama-sama membuka pintu.' in coalesce(obj_description(p.oid, 'pg_proc'), '')) > 0)$c$),
  ('0100', 'view v_regu_ringkas: WHERE ((NOT r.is_cancelled) AND (d.status = ''lunas''::text)',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_regu_ringkas' and position('WHERE ((NOT r.is_cancelled) AND (d.status = ''lunas''::text) AND (r.nomor_dada IS NOT NULL) AND boleh_apa_saja(VARIADIC ARRAY[''keberangkatan''::text, ''kedatangan''::text, ''daftar_ulang''::text, ''pengaturan''::text]))' in definition) > 0)$c$),
  ('0101', 'view v_kelengkapan_pos: WHERE ((p.jumlah_komponen > 0) AND (peran() IS NOT NULL))',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kelengkapan_pos' and position('WHERE ((p.jumlah_komponen > 0) AND (peran() IS NOT NULL))' in definition) > 0)$c$),
  ('0102', 'comment_fn daftar_ulang_batch/2: Memberi nomor dada dan kloter FIFO; penempatan setelah daf',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'daftar_ulang_batch' and p.pronargs = 2 and position('Memberi nomor dada dan kloter FIFO; penempatan setelah daftar kloter dicetak ditandai sebagai sisipan.' in coalesce(obj_description(p.oid, 'pg_proc'), '')) > 0)$c$),
  ('0103', 'comment_rel v_kelengkapan_pos: Agregat kelengkapan dan waktu nilai terakhir seluruh pos u',
   $c$select exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'v_kelengkapan_pos' and position('Agregat kelengkapan dan waktu nilai terakhir seluruh pos untuk panitia aktif. Definer agar agregat lintas pos tidak menuntut hak baca nilai mentah; badan view wajib menjaga peran() is not null.' in coalesce(obj_description(c.oid, 'pg_class'), '')) > 0)$c$),
  ('0104', 'view v_kelengkapan_publik: WHERE ((NOT r.is_cancelled) AND (d.status = ''lunas''::text)',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kelengkapan_publik' and position('WHERE ((NOT r.is_cancelled) AND (d.status = ''lunas''::text) AND (r.nomor_dada IS NOT NULL) AND (r.golongan <> ALL (ARRAY[''intern_pa''::text, ''intern_pi''::text])))' in definition) > 0)$c$),
  ('0105', 'row edisi: kloter_maks": 75',
   $c$select exists (select 1 from edisi t where position('kloter_maks": 75' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0106', 'comment_fn rentang_input_nilai/3: Rentang validasi dalam satuan yang diketik petugas; nilai ',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rentang_input_nilai' and p.pronargs = 3 and position('Rentang validasi dalam satuan yang diketik petugas; nilai meter tersimpan sebagai sentimeter.' in coalesce(obj_description(p.oid, 'pg_proc'), '')) > 0)$c$),
  ('0107', 'view v_progres_publik: FROM status_acara) = ''penuh''::text) THEN ( SELECT COALESCE',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_progres_publik' and position('FROM status_acara) = ''penuh''::text) THEN ( SELECT COALESCE(jsonb_object_agg(((w.pos || ''.''::text) || w.kode), hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks, w.raw_terbaik, w.raw_terburuk, w.poin_benar, w.poin_salah, w.total_soal, w.tingkat, w.jawaban_benar)), ''{}''::jsonb) AS "coalesce"' in definition) > 0)$c$),
  ('0108', 'view v_progres_publik: c.anggota_hadir',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_progres_publik' and position('c.anggota_hadir' in definition) > 0)$c$),
  ('0110', 'constraint edisi.edisi_biaya_per_regu_intern_check: CHECK ((biaya_per_regu_intern >= 0))',
   $c$select exists (select 1 from pg_constraint where conrelid = 'edisi'::regclass and conname = 'edisi_biaya_per_regu_intern_check' and position('CHECK ((biaya_per_regu_intern >= 0))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0111', 'view v_sisipan_kloter: WHERE ((r.disisipkan_pada IS NOT NULL) AND (NOT r.is_cance',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_sisipan_kloter' and position('WHERE ((r.disisipkan_pada IS NOT NULL) AND (NOT r.is_cancelled) AND boleh_apa_saja(VARIADIC ARRAY[''keberangkatan''::text, ''cetak_kloter''::text, ''daftar_ulang''::text, ''pengaturan''::text]))' in definition) > 0)$c$),
  ('0113', 'constraint status_acara.status_acara_planning_urut: CHECK (((planning_berangkat_pertama IS NULL) OR (planning_',
   $c$select exists (select 1 from pg_constraint where conrelid = 'status_acara'::regclass and conname = 'status_acara_planning_urut' and position('CHECK (((planning_berangkat_pertama IS NULL) OR (planning_berangkat_terakhir IS NULL) OR (planning_berangkat_terakhir > planning_berangkat_pertama)))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0114', 'constraint regu.regu_anggota_maks_empat: CHECK (((anggota IS NULL) OR (COALESCE(array_length(anggot',
   $c$select exists (select 1 from pg_constraint where conrelid = 'regu'::regclass and conname = 'regu_anggota_maks_empat' and position('CHECK (((anggota IS NULL) OR (COALESCE(array_length(anggota, 1), 0) <= 4)))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0116', 'constraint edisi.edisi_nomor_dada_intern_mulai_check: CHECK ((nomor_dada_intern_mulai > 1))',
   $c$select exists (select 1 from pg_constraint where conrelid = 'edisi'::regclass and conname = 'edisi_nomor_dada_intern_mulai_check' and position('CHECK ((nomor_dada_intern_mulai > 1))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0118', 'row edisi: interval_berangkat_menit": 5',
   $c$select exists (select 1 from edisi t where position('interval_berangkat_menit": 5' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0120', 'constraint regu.regu_nama_regu_tiga_huruf: CHECK ((length(regexp_replace(nama_regu, ''[^[:alpha:]]''::t',
   $c$select exists (select 1 from pg_constraint where conrelid = 'regu'::regclass and conname = 'regu_nama_regu_tiga_huruf' and position('CHECK ((length(regexp_replace(nama_regu, ''[^[:alpha:]]''::text, ''''::text, ''g''::text)) >= 3)) NOT VALID' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0121', 'constraint pendaftaran.pendaftaran_metode_bayar_check: CHECK (((metode_bayar IS NULL) OR (metode_bayar = ANY (ARR',
   $c$select exists (select 1 from pg_constraint where conrelid = 'pendaftaran'::regclass and conname = 'pendaftaran_metode_bayar_check' and position('CHECK (((metode_bayar IS NULL) OR (metode_bayar = ANY (ARRAY[''transfer''::text, ''tunai''::text]))))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0124', 'constraint pendaftaran.pendaftaran_jumlah_pendamping_check: CHECK ((jumlah_menginap >= 0))',
   $c$select exists (select 1 from pg_constraint where conrelid = 'pendaftaran'::regclass and conname = 'pendaftaran_jumlah_pendamping_check' and position('CHECK ((jumlah_menginap >= 0))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0126', 'trigger regu.regu_kapital: CREATE TRIGGER regu_kapital BEFORE INSERT OR UPDATE OF nam',
   $c$select exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname = 'regu' and t.tgname = 'regu_kapital' and position('CREATE TRIGGER regu_kapital BEFORE INSERT OR UPDATE OF nama_regu ON public.regu FOR EACH ROW EXECUTE FUNCTION regu_nama_kapital()' in pg_get_triggerdef(t.oid)) > 0)$c$),
  ('0127', 'constraint regu.regu_nama_panjang: CHECK (((length(TRIM(BOTH FROM nama_regu)) >= 1) AND (leng',
   $c$select exists (select 1 from pg_constraint where conrelid = 'regu'::regclass and conname = 'regu_nama_panjang' and position('CHECK (((length(TRIM(BOTH FROM nama_regu)) >= 1) AND (length(TRIM(BOTH FROM nama_regu)) <= 25)))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0128', 'constraint regu.regu_nama_regu_angka_di_belakang: CHECK ((TRIM(BOTH FROM nama_regu) ~ ''^[^0-9]+[0-9]*$''::tex',
   $c$select exists (select 1 from pg_constraint where conrelid = 'regu'::regclass and conname = 'regu_nama_regu_angka_di_belakang' and position('CHECK ((TRIM(BOTH FROM nama_regu) ~ ''^[^0-9]+[0-9]*$''::text))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0131', 'constraint regu.regu_kelas_organisasi_bentuk: CHECK (((kelas_organisasi IS NULL) OR ((kelas_organisasi ~',
   $c$select exists (select 1 from pg_constraint where conrelid = 'regu'::regclass and conname = 'regu_kelas_organisasi_bentuk' and position('CHECK (((kelas_organisasi IS NULL) OR ((kelas_organisasi ~ ''^[A-Za-z0-9 ]+$''::text) AND (length(kelas_organisasi) <= 80))))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0137', 'view v_riwayat_pendaftaran: WHEN (h.table_name = ''pendaftaran''::text) THEN COALESCE(((',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_riwayat_pendaftaran' and position('WHEN (h.table_name = ''pendaftaran''::text) THEN COALESCE(((h.new_value ->> ''id''::text))::uuid, ((h.old_value ->> ''id''::text))::uuid)' in definition) > 0)$c$),
  ('0138', 'view v_riwayat_pendaftaran: a.username AS oleh',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_riwayat_pendaftaran' and position('a.username AS oleh' in definition) > 0)$c$),
  ('0139', 'constraint kejuaraan_manual.kejuaraan_manual_diubah_oleh_fkey: FOREIGN KEY (diubah_oleh) REFERENCES auth.users(id)',
   $c$select exists (select 1 from pg_constraint where conrelid = 'kejuaraan_manual'::regclass and conname = 'kejuaraan_manual_diubah_oleh_fkey' and position('FOREIGN KEY (diubah_oleh) REFERENCES auth.users(id)' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0140', 'function hasil_kejuaraan_dasar/0',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'hasil_kejuaraan_dasar' and p.pronargs = 0 and true)$c$),
  ('0143', 'view v_klasemen: FROM closing_regu c',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_klasemen' and position('FROM closing_regu c' in definition) > 0)$c$),
  ('0144', 'view v_klasemen_publik: t.golongan',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_klasemen_publik' and position('t.golongan' in definition) > 0)$c$),
  -- Jejak 0145 dulu constraint fase-nya sendiri, dan 0163 menulis ulang
  -- constraint itu untuk menyelipkan 'juara' — jejaknya lalu melapor BELUM
  -- untuk migrasi yang jelas-jelas sudah jalan. Yang dipakai sekarang
  -- `urutan_top` di v_klasemen_publik: sama-sama lahir dari 0145, dan 0163
  -- tidak menyentuhnya. Pelajaran umumnya: jangan menjejaki objek yang
  -- memang dibuat untuk ditulis ulang setiap ada keadaan baru.
  ('0145', 'view v_klasemen_publik: urutan_top',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_klasemen_publik' and position('urutan_top' in definition) > 0)$c$),
  ('0146', 'constraint cache_live_score.cache_live_score_pkey: PRIMARY KEY (tunggal)',
   $c$select exists (select 1 from pg_constraint where conrelid = 'cache_live_score'::regclass and conname = 'cache_live_score_pkey' and position('PRIMARY KEY (tunggal)' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0150', 'view v_kejuaraan: poin_juara',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kejuaraan' and position('poin_juara' in definition) > 0)$c$),
  ('0152', 'constraint kejuaraan_manual.kejuaraan_manual_kode_check: CHECK ((kode = ANY (ARRAY[''kostum_penegak_pa''::text, ''kost',
   $c$select exists (select 1 from pg_constraint where conrelid = 'kejuaraan_manual'::regclass and conname = 'kejuaraan_manual_kode_check' and position('CHECK ((kode = ANY (ARRAY[''kostum_penegak_pa''::text, ''kostum_penegak_pi''::text, ''kostum_penggalang_pa''::text, ''kostum_penggalang_pi''::text, ''terfavorit_penegak_pa''::text, ''terfavorit_penegak_pi''::text, ''terfavorit_penggalang_pa''::text, ''terfavorit_penggalang_pi''::text, ''terjauh''::text])))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0153', 'constraint kejuaraan_manual.kejuaraan_manual_isi_check: WHEN (kode = ''terjauh''::text) THEN ((sekolah_id IS NOT NUL',
   $c$select exists (select 1 from pg_constraint where conrelid = 'kejuaraan_manual'::regclass and conname = 'kejuaraan_manual_isi_check' and position('WHEN (kode = ''terjauh''::text) THEN ((sekolah_id IS NOT NULL) AND (regu_id IS NULL))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0154', 'row sekolah: {"name": "SMAN 1 Sindangkasih", "address": "Jl. Raya Sinda',
   $c$select exists (select 1 from sekolah t where position('{"name": "SMAN 1 Sindangkasih", "address": "Jl. Raya Sindangkasih Cikoneng, Sindangkasih, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat 46268, Indonesia"}' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0155', 'row sekolah: {"name": "SMA Terpadu Al-Mu''aawanah", "address": "Jl. KH. ',
   $c$select exists (select 1 from sekolah t where position('{"name": "SMA Terpadu Al-Mu''aawanah", "address": "Jl. KH. Ahmad Romli No. 26, Rajadesa, Kec. Rajadesa, Kabupaten Ciamis, Jawa Barat 46254, Indonesia"}' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0156', 'row sekolah: {"name": "SMK LPS 2 Ciamis", "address": "Jl. R.E. Martadin',
   $c$select exists (select 1 from sekolah t where position('{"name": "SMK LPS 2 Ciamis", "address": "Jl. R.E. Martadinata No. 23, Maleber, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46214, Indonesia"}' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0157', 'row sekolah: {"name": "MTsN 11 Ciamis"',
   $c$select exists (select 1 from sekolah t where position('{"name": "MTsN 11 Ciamis"' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0158', 'row sekolah: {"name": "SMK Al-Asyariah", "address": "Jl. Rancawiru Utam',
   $c$select exists (select 1 from sekolah t where position('{"name": "SMK Al-Asyariah", "address": "Jl. Rancawiru Utama, Utama, Kec. Cijeungjing, Kabupaten Ciamis, Jawa Barat 46271, Indonesia"}' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0159', 'row sekolah: {"name": "SMAN 2 Banjarsari", "address": "Jl. Sukadana No.',
   $c$select exists (select 1 from sekolah t where position('{"name": "SMAN 2 Banjarsari", "address": "Jl. Sukadana No. 239, Cigayam, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat 46384, Indonesia"}' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0160', 'row sekolah: {"name": "MTs Ma''arif Darulhikam", "address": "Cieurih, Ke',
   $c$select exists (select 1 from sekolah t where position('{"name": "MTs Ma''arif Darulhikam", "address": "Cieurih, Kec. Cipaku, Kabupaten Ciamis, Jawa Barat 46252, Indonesia"}' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0161', 'row sekolah: {"name": "SMPN Satu Atap 1 Banjarsari", "address": "Banjar',
   $c$select exists (select 1 from sekolah t where position('{"name": "SMPN Satu Atap 1 Banjarsari", "address": "Banjaranyar, Kec. Banjaranyar, Kabupaten Ciamis, Jawa Barat 46384, Indonesia"}' in (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'dibuat_pada' - 'edisi' - 'sekolah_id')::text) > 0)$c$),
  ('0163', 'view v_kejuaraan_publik ada',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kejuaraan_publik')$c$),
  ('0164', 'view v_kejuaraan_publik: poin_juara di DAFTAR SELECT-nya, bukan cuma di tanda tangan fungsinya',
   $c$select exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_kejuaraan_publik' and position('    poin_juara,' in definition) > 0)$c$),
  ('0165', 'function minta_segarkan_live_score ada',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'minta_segarkan_live_score')$c$),
  ('0166', 'constraint nilai_terkunci.nilai_terkunci_pkey: PRIMARY KEY (regu_id, pos, kode_lomba)',
   $c$select exists (select 1 from pg_constraint where conrelid = 'nilai_terkunci'::regclass and conname = 'nilai_terkunci_pkey' and position('PRIMARY KEY (regu_id, pos, kode_lomba)' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0167', 'constraint foto_lembar.foto_lembar_putaran_check: CHECK ((putaran = ANY (ARRAY[0, 90, 180, 270])))',
   $c$select exists (select 1 from pg_constraint where conrelid = 'foto_lembar'::regclass and conname = 'foto_lembar_putaran_check' and position('CHECK ((putaran = ANY (ARRAY[0, 90, 180, 270])))' in pg_get_constraintdef(oid)) > 0)$c$),
  ('0170', 'function set_centang_sprint ada',
   $c$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_centang_sprint')$c$)
) as t(nomor, jejak, cek)
  loop
    begin
      execute t.cek into v_ada;
    exception when others then
      -- Objek atau tabelnya sama sekali tidak ada. Itu JAWABAN, bukan galat:
      -- migrasi yang membuatnya memang belum dijalankan.
      v_ada := false;
    end;
    insert into status_migrasi_hasil values (t.nomor, t.jejak, coalesce(v_ada, false));
  end loop;
end $$;

select nomor,
       case when ada then 'ADA' else '>>> BELUM <<<' end as status,
       jejak
  from status_migrasi_hasil
 order by nomor;

\echo ''
\echo '=== 2. Migrasi yang TIDAK bisa diperiksa dari sini ==='
\echo '    Bukan berarti belum diterapkan — berarti tidak ada yang tersisa'
\echo '    untuk diperiksa. Dua sebab, dan keduanya wajar:'
\echo '      - objeknya sudah ditulis ulang migrasi yang lebih muda, atau'
\echo '      - ia hanya menyentuh data operasional (regu, nilai, kloter,'
\echo '        pendaftaran) yang bisa dihapus "Bersihkan data".'
\echo '    Kalau salah satunya dicurigai terlewat, periksa lewat migrasi'
\echo '    TERMUDA yang menyentuh objek yang sama.'

select nomor, berkas from (values
  ('0004', 'rpcs'),
  ('0007', 'kunci_daftar_ulang'),
  ('0016', 'nama_edisi_romawi'),
  ('0019', 'tukar_nomor_patokan_cetak'),
  ('0020', 'nomor_dada_tiga_digit'),
  ('0025', 'pos_keberangkatan_kedatangan'),
  ('0026', 'rekap_publik'),
  ('0027', 'rekap_penuh'),
  ('0029', 'pesan_rentang'),
  ('0030', 'komponen_per_golongan'),
  ('0031', 'tolak_komponen_golongan_lain'),
  ('0032', 'konfigurasi_xxxvii'),
  ('0033', 'nama_pos_xxxvii'),
  ('0034', 'nama_pos_final'),
  ('0035', 'tangga_menaksir'),
  ('0036', 'kriteria_bidai'),
  ('0038', 'petunjuk_menaksir'),
  ('0040', 'daftar_ulang_hormati_kloter_tercetak'),
  ('0041', 'tukar_nomor_tanpa_pensiun'),
  ('0045', 'pos_boleh_buka_gembok'),
  ('0049', 'pratinjau_live_admin'),
  ('0066', 'kloter_boleh_ditambah'),
  ('0082', 'pesan_rentang_menyebut_komponen'),
  ('0086', 'menaksir_sentimeter'),
  ('0088', 'daftar_ulang_lewati_kloter_berangkat'),
  ('0090', 'reset_event_times'),
  ('0094', 'kloter_bisa_dicetak_ulang'),
  ('0095', 'lembar_pos_jawaban_benar'),
  ('0099', 'anon_default_privileges'),
  ('0109', 'kontrak_waktu_tiga_pilihan'),
  ('0112', 'buang_v_klasemen_pratinjau'),
  ('0115', 'sekolah_baku_dua_baris'),
  ('0117', 'dada_empat_digit_berangkat'),
  ('0119', 'terapkan_migrasi_terlewat'),
  ('0122', 'tuntut_cara_bayar'),
  ('0123', 'policy_storage_per_peran'),
  ('0125', 'bukti_transfer_tanpa_policy_ganti'),
  ('0129', 'impor_pendaftaran_xxxvii'),
  ('0130', 'bukti_transfer_link_drive'),
  ('0132', 'impor_pendaftaran_xxxvii_lanjutan'),
  ('0133', 'kelas_organisasi_regu'),
  ('0134', 'kelas_organisasi_tanpa_simbol'),
  ('0135', 'ubah_data_peserta'),
  ('0136', 'tanggal_daftar_dari_form'),
  ('0141', 'peserta_terbanyak_eksternal'),
  ('0142', 'kejuaraan_tanpa_intern'),
  ('0147', 'waktu_nol_pos_2'),
  ('0148', 'juara_umum_berdasarkan_poin'),
  ('0149', 'juara_umum_tanpa_poin_di_bawah'),
  ('0151', 'skor_juara_umum_enam_besar'),
  ('0162', 'lebur_smp_al_fadliliyah'),
  ('0168', 'judul_isian_menaksir'),
  ('0169', 'judul_isian_soal'),
  -- 0171 mengembalikan argumen ke-11 `w.jawaban_benar` yang 0166 jatuhkan
  -- dari v_lembar_pos. Jejaknya BUKAN jejak baru: yang membuktikannya persis
  -- jejak 0085 di bagian 1, yang memuat panggilan hitung_poin sebelas argumen
  -- di dalam v_lembar_pos. Alasan yang sama menempatkan 0095 di daftar ini.
  -- Kalau 0085 melapor BELUM di atas database yang dibangun dari nol, yang
  -- dilaporkannya bukan migrasi terlewat melainkan regresi itu, lagi.
  ('0171', 'lembar_pos_jawaban_benar_kembali')
) as t(nomor, berkas)
order by nomor;

\echo ''
\echo 'KOSONG di bagian 1 = semua jejak ADA.'
\echo 'BELUM di bagian 1  = isi migrasi itu TIDAK ada di database ini. Jalankan'
\echo '                     berkasnya lewat apply-migration.yml, sesudah memeriksa'
\echo '                     apakah ada migrasi lebih muda yang sudah menggantikan'
\echo '                     objeknya (CLAUDE.md 7.8).'
