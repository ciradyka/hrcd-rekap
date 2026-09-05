-- ============================================================================
-- hrcd-rekap : tests/sql/81_migrasi_terlewat.sql — migrasi 0119.
--
-- Sepuluh migrasi (0091, 0098-0106) tidak pernah sampai ke produksi dan tidak
-- ada satu pun yang memberi tahu: yang menemukannya adalah pembina yang
-- mendaftarkan regu Internal dan ditolak `regu_golongan_check`.
--
-- Yang diuji di sini BUKAN "0119 pernah dijalankan" — di database uji seluruh
-- migrasi memang berurutan, jadi pertanyaan itu tidak berarti. Yang diuji
-- adalah JEJAK yang harus ada sesudah rantainya utuh, satu per satu, sehingga
-- migrasi berikutnya yang tanpa sengaja menghapus salah satunya berhenti di
-- sini alih-alih di layar pendaftaran.
--
-- Daftar yang sama dibaca terhadap produksi lewat
-- `supabase/checks/status_migrasi.sql`.
-- ============================================================================

\echo '--- 81. jejak sepuluh migrasi yang pernah terlewat'
\set ON_ERROR_STOP on

do $blok$
declare
  v_jumlah int;
begin
  -- 81.1 (0091) Golongan Internal sah di tabel regu. Inilah yang gagal di
  -- lapangan: constraint 0001 hanya mengenal empat golongan eksternal.
  assert exists (select 1 from pg_constraint
                 where conname = 'regu_golongan_check'
                   and pg_get_constraintdef(oid) like '%intern_pa%'),
    '81.1 GAGAL: regu_golongan_check belum mengenal intern_pa';

  assert exists (select 1 from pg_constraint
                 where conname = 'wahana_golongan_check'
                   and pg_get_constraintdef(oid) like '%intern_pa%'),
    '81.1 GAGAL: wahana_golongan_check belum mengenal golongan intern';

  -- 81.2 (0091) Sebuah regu Internal benar-benar bisa masuk, bukan hanya lolos
  -- pembacaan constraint. Di-rollback supaya tidak meninggalkan baris uji.
  assert exists (select 1 from pendaftaran),
    '81.2 GAGAL: tidak ada pendaftaran untuk disisipi — tes ini akan lulus '
    'tanpa menguji apa pun';
  begin
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    select id, 'UJI INTERN', 'Ketua Uji', 'intern_pa'
    from pendaftaran limit 1;
    get diagnostics v_jumlah = row_count;
    assert v_jumlah = 1,
      format('81.2 GAGAL: %s baris regu Internal masuk, seharusnya 1', v_jumlah);
  exception when others then
    if sqlerrm like '81.2 GAGAL%' then raise; end if;
    raise exception '81.2 GAGAL: regu Internal ditolak database — %', sqlerrm;
  end;

  -- 81.3 (0091) Komponen Internal: lima Soal Tulis punya varian sendiri, dan
  -- komponen umum TIDAK otomatis berlaku bagi mereka.
  select count(*) into v_jumlah
  from wahana where edisi = edisi_aktif() and kode like '%\_intern';
  assert v_jumlah = 5,
    format('81.3 GAGAL: varian wahana Internal ada %s, seharusnya 5', v_jumlah);

  assert komponen_berlaku('intern', 'intern_pa'),
    '81.3 GAGAL: komponen bertanda intern tidak berlaku untuk Intern PA';
  assert not komponen_berlaku(null, 'intern_pa'),
    '81.3 GAGAL: komponen umum ikut berlaku untuk Internal — lomba lapangan '
    'akan muncul di lembar mereka';

  -- 81.4 (0091) Klasemen Internal hanya Soal Tulis dikurangi penalti waktu.
  assert exists (select 1 from pg_class c
                 join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'v_total_skor'
                   and pg_get_viewdef(c.oid) like '%intern_pa%'),
    '81.4 GAGAL: v_total_skor masih mengenakan penalti lapangan ke Internal';

  -- 81.5 (0098) Layar Keberangkatan hanya memegang hak `keberangkatan`.
  assert exists (select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'pindah_kloter'
                   and pg_get_functiondef(p.oid) like '%keberangkatan%'),
    '81.5 GAGAL: pindah_kloter masih menuntut cetak_kloter saja';

  -- 81.6 (0099) anon tidak boleh membaca tabel operasional.
  assert not has_table_privilege('anon', 'public.regu', 'select'),
    '81.6 GAGAL: anon masih boleh membaca tabel regu';

  -- 81.7 (0100) Lookup gerbang berpagar haknya sendiri, bukan Live Score.
  assert exists (select 1 from pg_class c
                 join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'v_regu_ringkas'
                   and pg_get_viewdef(c.oid) like '%boleh_apa_saja%'),
    '81.7 GAGAL: v_regu_ringkas kehilangan pagar boleh_apa_saja';

  -- 81.8 (0101 + 0103) Kelengkapan pos: berpagar peran(), dan waktu nilai
  -- terakhir kembali ada untuk penanda pos yang diam.
  assert exists (select 1 from pg_class c
                 join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'v_kelengkapan_pos'
                   and pg_get_viewdef(c.oid) like '%peran()%'),
    '81.8 GAGAL: v_kelengkapan_pos terbuka untuk bukan panitia';
  assert exists (select 1 from information_schema.columns
                 where table_schema = 'public'
                   and table_name = 'v_kelengkapan_pos'
                   and column_name = 'terakhir_masuk'),
    '81.8 GAGAL: v_kelengkapan_pos kehilangan kolom terakhir_masuk';

  -- 81.9 (0104) Kelengkapan halaman peserta menghitung Eksternal saja.
  assert exists (select 1 from pg_class c
                 join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'v_kelengkapan_publik'
                   and pg_get_viewdef(c.oid) like '%intern_pa%'),
    '81.9 GAGAL: v_kelengkapan_publik masih ikut menghitung regu Internal';

  -- 81.10 (0105) 75 kloter tersedia, dan barisnya benar-benar ada.
  select kloter_maks into v_jumlah from edisi where is_active;
  assert v_jumlah >= 75,
    format('81.10 GAGAL: kloter_maks %s, seharusnya minimal 75', v_jumlah);
  assert (select count(*) from kloter) >= v_jumlah,
    '81.10 GAGAL: baris kloter lebih sedikit daripada kloter_maks';

  -- 81.11 (0106) Rentang Menaksir disebut dalam meter, satuan yang diketik.
  assert rentang_input_nilai(0, 10000, 'meter') = '0 - 100 meter',
    format('81.11 GAGAL: rentang meter berbunyi "%s"',
           rentang_input_nilai(0, 10000, 'meter'));
  assert exists (select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'simpan_nilai_massal'
                   and pg_get_functiondef(p.oid) like '%rentang_input_nilai%'),
    '81.11 GAGAL: simpan_nilai_massal masih memformat rentangnya sendiri';

  raise exception 'ROLLBACK UJI 81';
exception when others then
  if sqlerrm <> 'ROLLBACK UJI 81' then raise; end if;
end;
$blok$;

\echo '    81 LULUS'
