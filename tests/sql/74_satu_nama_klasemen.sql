-- ============================================================================
-- hrcd-rekap : tests/sql/74_satu_nama_klasemen.sql — migrasi 0112.
-- Klasemen punya SATU nama, dan nama lamanya tidak hidup lagi.
--
-- Kenapa dijaga: nama itu sudah dinyatakan mati oleh 0050, lalu lahir kembali
-- di 0065 sebagai view kedua berpagar hak BERBEDA — tanpa satu pun galat, dan
-- tanpa ada yang membacanya. Yang menahan itu terulang bukan ingatan orang,
-- melainkan pemeriksaan yang menyalak.
-- ============================================================================

\echo '--- 74. klasemen satu nama'
\set ON_ERROR_STOP on

do $blok$
declare v_lain text;
begin
  assert not exists (select 1 from pg_views
                     where schemaname = 'public'
                       and viewname = 'v_klasemen_pratinjau'),
    '74.1 GAGAL: v_klasemen_pratinjau hidup lagi';

  assert exists (select 1 from pg_views
                 where schemaname = 'public'
                   and viewname = 'v_klasemen_live_score'),
    '74.2 GAGAL: v_klasemen_live_score tidak ada';

  -- Pemeriksaan yang lebih luas daripada satu nama: tidak boleh ada view lain
  -- yang namanya menjanjikan klasemen. Memeriksa satu nama saja akan tetap
  -- hijau pada hari seseorang membuat `v_klasemen_admin` (CLAUDE.md 13.3).
  select string_agg(viewname, ', ' order by viewname) into v_lain
  from pg_views
  where schemaname = 'public'
    and viewname like 'v_klasemen%'
    and viewname not in ('v_klasemen', 'v_klasemen_live_score',
                         'v_klasemen_publik');

  assert v_lain is null,
    format('74.3 GAGAL: ada view klasemen lain yang tidak dikenal — %s', v_lain);
end;
$blok$;

select '74_satu_nama_klasemen OK' as hasil;
