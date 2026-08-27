-- ============================================================================
-- hrcd-rekap : status_migrasi.sql — TIDAK mengubah apa pun.
--
-- Berkas ini menjawab satu pertanyaan yang tidak bisa dijawab dari git:
-- "migrasi mana yang isinya benar-benar sudah ada di produksi?"
--
-- Sebabnya: apply-migration.yml menerapkan SATU berkas per jalan, manual, dan
-- tidak ada tabel yang mencatat mana yang sudah dijalankan. Kalau satu berkas
-- terlewat, tidak ada satu pun galat sampai lapangan menabraknya. Itulah yang
-- terjadi pada 0091 — pendaftaran Internal ditolak
-- `regu_golongan_check` karena constraint-nya masih milik 0001.
--
-- Yang diperiksa BUKAN nama berkasnya melainkan JEJAKNYA di database: sebuah
-- constraint, kolom view, atau potongan definisi fungsi yang hanya lahir dari
-- migrasi itu. Objek yang sudah ditulis ulang oleh migrasi yang lebih muda
-- sengaja tidak diperiksa di sini — jejaknya sudah tergantikan.
--
-- Cara pakai: Actions -> "Apply migration to Supabase" -> Run workflow, isi
--   supabase/checks/status_migrasi.sql
-- ============================================================================

\pset border 2

select
  nomor,
  case when hasil then 'ADA' else '>>> BELUM <<<' end as status,
  jejak
from (values

  ('0091', 'regu_golongan_check mengizinkan intern_pa', (
    select exists (select 1 from pg_constraint
                   where conname = 'regu_golongan_check'
                     and pg_get_constraintdef(oid) like '%intern_pa%'))),

  ('0091', 'wahana_golongan_check mengizinkan intern', (
    select exists (select 1 from pg_constraint
                   where conname = 'wahana_golongan_check'
                     and pg_get_constraintdef(oid) like '%intern_pa%'))),

  ('0091', 'komponen_berlaku mengenal golongan intern', (
    select exists (select 1 from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'komponen_berlaku'
                     and pg_get_functiondef(p.oid) like '%intern%'))),

  ('0091', 'lima wahana varian _intern ada di edisi aktif', (
    select count(*) = 5 from wahana
     where edisi = edisi_aktif() and kode like '%\_intern')),

  ('0091', 'v_total_skor menolkan penalti lapangan untuk intern', (
    select exists (select 1 from pg_class c
                   join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = 'v_total_skor'
                     and pg_get_viewdef(c.oid) like '%intern_pa%'))),

  ('0098', 'pindah_kloter menerima hak keberangkatan', (
    select exists (select 1 from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'pindah_kloter'
                     and pg_get_functiondef(p.oid) like '%keberangkatan%'))),

  ('0099', 'anon TIDAK boleh select tabel regu', (
    select not has_table_privilege('anon', 'public.regu', 'select'))),

  ('0100', 'v_regu_ringkas definer dan berpagar boleh_apa_saja', (
    select exists (select 1 from pg_class c
                   join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = 'v_regu_ringkas'
                     and pg_get_viewdef(c.oid) like '%boleh_apa_saja%'
                     and coalesce(array_to_string(c.reloptions, ','), '')
                         not like '%security_invoker=on%'))),

  ('0101', 'v_kelengkapan_pos menuntut peran() is not null', (
    select exists (select 1 from pg_class c
                   join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = 'v_kelengkapan_pos'
                     and pg_get_viewdef(c.oid) like '%peran()%'))),

  ('0103', 'v_kelengkapan_pos punya kolom terakhir_masuk', (
    select exists (select 1 from information_schema.columns
                   where table_schema = 'public'
                     and table_name = 'v_kelengkapan_pos'
                     and column_name = 'terakhir_masuk'))),

  ('0104', 'v_kelengkapan_publik membuang regu intern', (
    select exists (select 1 from pg_class c
                   join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = 'v_kelengkapan_publik'
                     and pg_get_viewdef(c.oid) like '%intern_pa%'))),

  ('0105', 'edisi aktif menyediakan 75 kloter', (
    select coalesce((select kloter_maks >= 75 from edisi where is_active), false))),

  ('0105', 'baris kloter sudah sebanyak kloter_maks', (
    select (select count(*) from kloter)
           >= coalesce((select kloter_maks from edisi where is_active), 0))),

  ('0106', 'rentang_input_nilai ada', (
    select exists (select 1 from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'rentang_input_nilai'))),

  ('0106', 'simpan_nilai_massal memakai rentang_input_nilai', (
    select exists (select 1 from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'simpan_nilai_massal'
                     and pg_get_functiondef(p.oid) like '%rentang_input_nilai%')))

) as t(nomor, jejak, hasil)
order by nomor, jejak;
