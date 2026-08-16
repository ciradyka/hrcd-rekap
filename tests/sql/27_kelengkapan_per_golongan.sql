-- ============================================================================
-- hrcd-rekap : tests/sql/27_kelengkapan_per_golongan.sql
-- Kelengkapan pos dihitung per golongan (migrasi 0060).
--
-- Yang dijaga: pos yang komponennya berbeda per golongan TIDAK boleh terjebak
-- di 0%. Sebelum 0060, Pos 1 menunjukkan nol sepanjang hari karena penyebutnya
-- seluruh komponen pos (6) sementara satu regu hanya mengisi tiga.
-- ============================================================================

do $$
declare
  v_pos1 int;
  v_n    int;
begin
  -- Fixture dibuat SENDIRI, tidak menunggu konfigurasi edisi kebetulan punya
  -- komponen per golongan. Versi pertama tes ini melewati dirinya sendiri di
  -- database uji — yang memakai konfigurasi pos lama — jadi ia lulus tanpa
  -- menyentuh satu baris pun dari yang diperbaiki 0060.
  select count(*) into v_n from wahana
   where edisi = edisi_aktif() and pos = 1 and golongan is not null;
  if v_n = 0 then
    insert into wahana (edisi, pos, kode, name, type, form, poin_maks,
                        raw_terbaik, raw_terburuk, rentang_mentah_min,
                        rentang_mentah_maks, sort_order, golongan)
    select edisi_aktif(), 1, 'uji_simpul_' || g, 'Uji Simpul ' || g, 'wahana',
           'besar_baik', 100, 5, 0, 0, 5, 90 + i, g
      from unnest(array['penegak_pa','penegak_pi','penggalang_pa','penggalang_pi'])
           with ordinality as t(g, i);
    raise notice '27: fixture komponen per golongan dibuat untuk pos 1';
  end if;

  -- Penyebutnya berbeda per golongan, dan lebih kecil daripada jumlah komponen
  -- pos itu. Kalau sama, tidak ada yang diperbaiki.
  assert komponen_pos_golongan(1::smallint, 'penegak_pa')
         < (select jumlah_komponen from v_pos where nomor = 1),
    'penyebut per golongan harus lebih kecil daripada seluruh komponen pos 1';
  assert komponen_pos_golongan(1::smallint, 'penegak_pa')
         = komponen_pos_golongan(1::smallint, 'penggalang_pi'),
    'tiap golongan mengisi jumlah komponen yang sama di pos 1';

  -- Golongan yang tidak dikenal hanya mendapat komponen milik semua orang —
  -- bukan nol, dan bukan seluruhnya.
  assert komponen_pos_golongan(1::smallint, 'tidak_ada') > 0,
    'komponen tanpa golongan tetap dihitung untuk golongan asing';
  assert komponen_pos_golongan(1::smallint, 'tidak_ada')
         < komponen_pos_golongan(1::smallint, 'penegak_pa'),
    'golongan asing tidak boleh dapat komponen milik golongan lain';

  -- Dan inilah cacat yang sebenarnya dikeluhkan, diuji langsung: SEBELUM 0060
  -- penyebutnya seluruh komponen pos, jadi tidak ada regu yang bisa lengkap.
  -- Sesudahnya, regu yang mengisi bagiannya sendiri terhitung lengkap.
  select count(*) into v_n from wahana where edisi = edisi_aktif() and pos = 1;
  assert komponen_pos_golongan(1::smallint, 'penegak_pa') < v_n,
    format('penyebut penegak_pa (%s) harus lebih kecil dari %s komponen pos 1',
           komponen_pos_golongan(1::smallint, 'penegak_pa'), v_n);

  -- Bersihkan fixture kalau kita yang membuatnya.
  delete from nilai_mentah n using wahana w
   where w.id = n.wahana_id and w.kode like 'uji_simpul_%';
  delete from wahana where kode like 'uji_simpul_%';
end $$;

\echo '27 kelengkapan per golongan: LULUS'
