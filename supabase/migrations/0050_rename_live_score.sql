-- ============================================================================
-- hrcd-rekap : 0050_rename_live_score.sql
--
-- `v_klasemen_pratinjau` (0049) jadi `v_klasemen_live_score`.
--
-- ---------------------------------------------------------------------------
-- KENAPA DIGANTI
--
-- Layarnya disebut "Live Score" oleh panitia, dan itu memang kata yang mereka
-- pakai — CLAUDE.md pasal 5 ayat 7: pakai kata yang orang benar-benar
-- ucapkan, termasuk kalau itu serapan Inggris. "Pratinjau" bukan salah, cuma
-- tidak pernah terucap.
--
-- Nama di database ikut berganti, bukan cuma nama di layar. Satu hal dengan
-- dua nama — "Live Score" di menu, `pratinjau` di kode — memaksa setiap
-- percakapan berikutnya membayar ongkos penerjemahan, dan pemelihara
-- berikutnya adalah siswa SMA yang tidak ikut percakapan ini.
--
-- ---------------------------------------------------------------------------
-- KENAPA `alter view ... rename`, BUKAN drop + create
--
-- Rename memindahkan view yang sama beserta hak aksesnya; drop + create
-- MENGHAPUS grant-nya, dan `grant select ... to authenticated` yang lupa
-- ditulis ulang menghasilkan layar yang kosong tanpa galat apa pun — persis
-- kegagalan yang paling sulit dilihat.
--
-- Dibungkus supaya menjalankannya dua kali tidak apa-apa: kalau nama barunya
-- sudah ada, tidak ada yang perlu dikerjakan.
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_views
             where schemaname = 'public' and viewname = 'v_klasemen_live_score') then
    raise notice '0050: v_klasemen_live_score sudah ada — dilewati.';
  elsif exists (select 1 from pg_views
                where schemaname = 'public' and viewname = 'v_klasemen_pratinjau') then
    alter view v_klasemen_pratinjau rename to v_klasemen_live_score;
    raise notice '0050: v_klasemen_pratinjau -> v_klasemen_live_score.';
  else
    raise exception '0050: v_klasemen_pratinjau tidak ada. Jalankan 0049 dulu.';
  end if;
end;
$$;

comment on view v_klasemen_live_score is
  'Klasemen yang akan dilihat peserta, dibuka lebih awal untuk ADMIN SAJA. '
  'Bentuk kolomnya sengaja sama persis dengan v_klasemen_publik supaya layar '
  'Live Score dan halaman peserta tidak pernah berbeda diam-diam.';
