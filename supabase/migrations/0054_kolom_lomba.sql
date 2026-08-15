-- ============================================================================
-- hrcd-rekap : 0054_kolom_lomba.sql
--
-- Tingkat LOMBA jadi data, bukan kebiasaan penamaan.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- CLAUDE.md bagian 11: satu pos berisi beberapa lomba, satu lomba berisi satu
-- atau lebih penilaian. Sistem ini hanya pernah memodelkan dua tingkat — `pos`
-- dan `wahana` — jadi tiap kriteria berdiri sendiri seolah ia satu lomba.
--
-- Akibatnya paling terlihat di blangko: pencetaknya menghasilkan satu master
-- per KRITERIA, jadi Pos 3 keluar tujuh lembar padahal dua, dan Pos 4 empat
-- padahal satu. Satu regu dinilai SEKALI di satu lomba dan jurinya menulis
-- semua kriteria di kertas yang ada di depannya — selembar per kriteria
-- menyerahkan lima kertas kepada regu yang sama di satu tempat.
--
-- ---------------------------------------------------------------------------
-- KENAPA TIDAK MEMBELAH AWALAN KODE SAJA
--
-- Karena `bidai_`, `kim_`, `pbb_`, `yel_` adalah kebiasaan menamai, bukan
-- sesuatu yang dijaga database (bagian 11.7). Ia bekerja sampai ada edisi yang
-- menamai dua komponen tidak berhubungan dengan kata pertama yang sama —
-- `pbb_dasar` dan `pbb_gerakan` kebetulan satu lomba, tapi tidak ada yang
-- menjamin `kim_cium` dan `kimia_dasar` tidak muncul bersamaan suatu hari.
--
-- Jadi kolomnya eksplisit, dan pengisian awalnya menyebut nama lombanya satu
-- per satu untuk edisi yang ada sekarang. Edisi berikutnya mengisinya sendiri
-- saat admin menyusun komponen.
--
-- ---------------------------------------------------------------------------
-- BAWAAN: SATU KOMPONEN = SATU LOMBA
--
-- Kolomnya boleh NULL, dan NULL berarti "komponen ini lomba tersendiri".
-- Itu keadaan yang benar untuk sebagian besar baris — Semaphore, Menaksir,
-- Bakiak — dan membuat kolom ini hanya perlu diisi pada yang memang
-- berkelompok. Layar membaca `coalesce(lomba, name)`.
-- ============================================================================

alter table wahana add column if not exists lomba text;

comment on column wahana.lomba is
  'Nama LOMBA yang menaungi komponen ini. NULL = komponen ini lomba '
  'tersendiri. Satu blangko dicetak per lomba, bukan per komponen.';

-- ---------------------------------------------------------------------------
-- Pengisian awal untuk edisi aktif. Disebut satu per satu, bukan dibelah dari
-- awalan kode — lihat kepala berkas.
--
-- Dipagari `where lomba is null` supaya menjalankannya dua kali tidak menimpa
-- perubahan yang sudah dilakukan admin sesudahnya.
-- ---------------------------------------------------------------------------
do $$
declare
  peta jsonb := jsonb_build_object(
    'bidai', 'Pembidaian',
    'kim',   'KIM',
    'pbb',   'PBB',
    'yel',   'Yel-Yel'
  );
  awalan text;
  v_baris int;
  v_total int := 0;
begin
  for awalan in select jsonb_object_keys(peta) loop
    update wahana
    set lomba = peta ->> awalan
    where edisi = edisi_aktif()
      and lomba is null
      and kode like awalan || '\_%';
    get diagnostics v_baris = row_count;
    v_total := v_total + v_baris;
    if v_baris > 0 then
      raise notice '0054: % komponen jadi lomba "%".', v_baris, peta ->> awalan;
    end if;
  end loop;

  if v_total = 0 then
    raise notice '0054: tidak ada komponen berkelompok di edisi aktif — '
      'setiap komponen berdiri sebagai lombanya sendiri.';
  end if;
end;
$$;
