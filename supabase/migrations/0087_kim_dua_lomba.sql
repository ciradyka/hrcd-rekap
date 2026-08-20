-- ============================================================================
-- hrcd-rekap : 0087_kim_dua_lomba.sql
--
-- KIM LIHAT DAN KIM CIUM ADALAH DUA LOMBA, BUKAN DUA KRITERIA SATU LOMBA.
--
-- ---------------------------------------------------------------------------
-- APA YANG BERBEDA
--
-- Keduanya bernaung di bawah `lomba = 'KIM'`, jadi seluruh sistem
-- memperlakukannya seperti Pembidaian: SATU lomba dengan dua kriteria yang
-- dinilai satu juri di satu meja, satu blangko, satu kolom foto.
--
-- Di lapangan bukan begitu. Keduanya lomba tersendiri: peserta mengerjakan
-- sepuluh soal Lihat, lalu sepuluh soal Cium, dan masing-masing punya lembar
-- jawaban sendiri yang diisi PESERTA — bentuk yang sama dengan Tebak Simpul,
-- bukan bentuk kolom-kolom yang diisi juri.
--
-- ---------------------------------------------------------------------------
-- YANG BERUBAH KARENA ITU
--
-- `lomba` dikosongkan. Membacanya `coalesce(lomba, name)` (CLAUDE.md 11.8),
-- jadi keduanya langsung berdiri sebagai lomba bernama "Kim Lihat" dan
-- "Kim Cium". Tiga hal ikut terpisah tanpa satu baris kode pun:
--
--   blangko      dua master, masing-masing bernomor 1-10
--   kolom foto   dua kolom, bukan satu tumpukan bernama KIM
--   Live Score   dua lomba di papan, sesuai yang diumumkan
--
-- POIN TIDAK BERUBAH. `lomba` cuma pengelompokan tampilan; yang menghitung
-- skor `poin_maks` dan `form` tiap baris wahana, dan keduanya tidak disentuh
-- di sini. Klasemen sesudah migrasi ini sama persis dengan sebelumnya.
--
-- ---------------------------------------------------------------------------
-- KUNCI FOTO IKUT BERPINDAH, DAN ITU DISENGAJA
--
-- `kode_lomba` dibekukan 0079 supaya mengganti NAMA lomba tidak memutus foto
-- yang sudah diunggah. Yang terjadi di sini bukan penggantian nama melainkan
-- PEMISAHAN: satu lomba jadi dua, dan kunci tunggal `kim` tidak bisa lagi
-- menunjuk keduanya sekaligus. Kuncinya karena itu dipisah jadi `kim-lihat`
-- dan `kim-cium`.
--
-- Konsekuensinya foto yang terlanjur diunggah dengan kunci `kim` tidak lagi
-- ketemu dari layar mana pun. Jumlahnya dilaporkan di bawah supaya yang
-- menjalankan tahu persis berapa — bukan diperkirakan sesudahnya. Foto itu
-- masih ada di bucket; kalau perlu, kuncinya bisa dipindahkan tangan dengan
-- satu UPDATE ke `foto_lembar`.
-- ============================================================================

do $blok$
declare
  v_edisi smallint := edisi_aktif();
  v_baris integer;
  v_foto  integer;
begin
  select count(*) into v_foto
  from foto_lembar f
  where f.pos = 3 and f.kode_lomba = 'kim';

  update wahana set
    lomba      = null,
    kode_lomba = case kode when 'kim_lihat' then 'kim-lihat'
                           when 'kim_cium'  then 'kim-cium' end
  where edisi = v_edisi and kode in ('kim_lihat', 'kim_cium');

  get diagnostics v_baris = row_count;

  if v_baris = 0 then
    raise notice '0087: komponen KIM tidak ada di edisi % — dilewati.', v_edisi;
    return;
  end if;

  assert v_baris = 2,
    format('0087: %s baris KIM diubah, seharusnya 2 — periksa kodenya', v_baris);

  raise notice '0087: Kim Lihat dan Kim Cium kini dua lomba terpisah.';
  if v_foto > 0 then
    raise notice '0087: % foto masih berkunci "kim" dan tidak akan ketemu '
                 'dari layar. Berkasnya masih ada di bucket.', v_foto;
  end if;
end;
$blok$;
