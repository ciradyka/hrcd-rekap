-- ============================================================================
-- hrcd-rekap : perbaiki_nama_regu_panjang.sql
--
-- Sekali pakai. Memendekkan nama regu DATA UJI yang melewati 20 karakter,
-- supaya migrasi 0051 bisa diterapkan.
--
-- Dijalankan lewat workflow "Apply migration to Supabase" dengan path berkas
-- ini, TEPAT SEBELUM 0051.
--
-- ---------------------------------------------------------------------------
-- KENAPA INI BUKAN BAGIAN DARI 0051
--
-- Migrasi menegakkan aturan; ia tidak boleh diam-diam mengubah data orang
-- supaya aturannya muat. 0051 sengaja BERHENTI dan menyebut pelanggarnya,
-- lalu manusia memutuskan apa yang terjadi pada data itu. Keputusannya di
-- sini, terpisah, dan bisa dibaca sendiri.
--
-- ---------------------------------------------------------------------------
-- APA YANG DIBUANG DAN KENAPA
--
-- Ketiganya menempelkan nama sekolah ke nama regu:
--
--   PERKASA PUI CIJANTUNG  (21)  ->  PERKASA
--   PARADIS PUI CIJANTUNG  (21)  ->  PARADIS
--   VICTORIA PUI CIJANTUNG (22)  ->  VICTORIA
--
-- Yang dibuang justru bagian yang sudah punya kolomnya sendiri: lembar
-- penilaian memuat Sekolah di sebelah Nama Regu, jadi "PUI CIJANTUNG"
-- terulang di setiap baris tanpa membawa satu keterangan pun.
--
-- Sudah diperiksa: ketiga nama pendek itu belum dipakai regu lain.
-- ============================================================================

update regu set nama_regu = 'PERKASA'  where nama_regu = 'PERKASA PUI CIJANTUNG';
update regu set nama_regu = 'PARADIS'  where nama_regu = 'PARADIS PUI CIJANTUNG';
update regu set nama_regu = 'VICTORIA' where nama_regu = 'VICTORIA PUI CIJANTUNG';

-- Laporkan keadaan sesudahnya, supaya yang menjalankan tidak perlu menebak
-- apakah 0051 akan lolos.
do $$
declare v_panjang text; v_kembar text;
begin
  select string_agg(format('%s (%s)', nama_regu, length(trim(nama_regu))), ', ')
  into v_panjang from regu
  where not is_cancelled and length(trim(nama_regu)) > 20;

  select string_agg(n, ', ') into v_kembar from (
    select lower(regexp_replace(trim(nama_regu), '\s+', ' ', 'g')) as n
    from regu where not is_cancelled group by 1 having count(*) > 1) d;

  if v_panjang is null and v_kembar is null then
    raise notice 'BERSIH — tidak ada nama > 20 huruf, tidak ada kembar. 0051 siap diterapkan.';
  else
    raise warning 'MASIH ADA MASALAH. panjang: % | kembar: %',
      coalesce(v_panjang, '-'), coalesce(v_kembar, '-');
  end if;
end;
$$;
