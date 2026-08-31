-- ============================================================================
-- hrcd-rekap : tests/dev/bentuk_lomba_produksi.sql
-- CLAUDE.md bagian 11 ditulis sebagai kode: berapa lomba di tiap pos, dan
-- berapa kriteria di tiap lomba.
--
-- DI LUAR tests/sql/, dan itu disengaja: ia BUKAN bagian dari suite bernomor
-- di tests/run.sh. Database yang dibangun run.sh memakai konfigurasi edisi
-- lama dengan sengaja (Kompas, Poros Bumi, PBB di Pos 2, KIM di Pos 4),
-- karena itulah yang menguji migrasi terhadap data yang sudah berisi —
-- memaksakan bentuk produksi di sana cuma akan memaksa fixture-nya berbohong.
--
-- Tempatnya di tests/dev/ dan bukan tests/sql/ supaya pagar pendaftaran di
-- kepala run.sh tetap berlaku penuh atas seluruh isi tests/sql/. Yang
-- menjalankan berkas ini tests/dev_database.sh.
--
-- KENAPA INI PERLU DIUJI PADAHAL TIDAK ADA KODENYA
--
-- Pengelompokan lomba bukan kode; ia DATA — kolom `wahana.lomba`, dibaca
-- `coalesce(lomba, name)` (CLAUDE.md 11.8). Yang mengubahnya cuma UPDATE di
-- dalam migrasi, dan sebuah UPDATE yang mengenai nol baris TIDAK BERBUNYI.
-- Jadi seluruh bentuk lomba bisa bergeser tanpa satu pun galat, dan yang
-- terlihat cuma blangko yang tercetak dengan jumlah lembar yang aneh atau
-- kolom foto yang menampung dua lomba sekaligus.
--
-- Itu sudah terjadi: sampai 1 September 2026 `tests/dev_database.sh`
-- menjalankan 0054 SESUDAH 0087, jadi `lomba = 'KIM'` yang sengaja
-- dikosongkan 0087 terpasang kembali dan KIM tergambar sebagai satu lomba
-- berkriteria dua. Seluruh tes lulus selama itu, karena tidak ada satu pun
-- yang menanyakan bentuknya.
--
-- KRITERIA DIHITUNG DARI NAMA BERBEDA, BUKAN JUMLAH BARIS. Satu penilaian
-- yang ditawarkan ke beberapa golongan menempati beberapa baris `wahana`
-- (CLAUDE.md 11.9), jadi menghitung barisnya akan melaporkan Logika
-- berkriteria dua.
-- ============================================================================

do $penjaga$
declare
  r           record;
  v_lihat     text;
  v_cium      text;
  v_diperiksa integer := 0;
begin
  for r in
    select coalesce(lomba, name) as lomba, count(distinct name) as kriteria
    from wahana
    where edisi = edisi_aktif()
    group by coalesce(lomba, name)
  loop
    -- Yang diperiksa hanya lomba yang dipatok CLAUDE.md bagian 11. Isi Pos 1
    -- dan Pos 2 memang berganti tiap edisi, jadi mematoknya di sini akan
    -- membuat tes ini gagal setiap kali panitia berikutnya mengubah lomba.
    if r.lomba = 'Pembidaian' then
      assert r.kriteria = 5,
        format('Pembidaian %s kriteria, seharusnya 5 (CLAUDE.md 11.2)', r.kriteria);
      v_diperiksa := v_diperiksa + 1;
    elsif r.lomba = 'PBB' then
      assert r.kriteria = 4,
        format('PBB %s kriteria, seharusnya 4 (CLAUDE.md 11.4)', r.kriteria);
      v_diperiksa := v_diperiksa + 1;
    elsif r.lomba = 'Yel-Yel' then
      assert r.kriteria = 4,
        format('Yel-Yel %s kriteria, seharusnya 4 (CLAUDE.md 11.5)', r.kriteria);
      v_diperiksa := v_diperiksa + 1;
    elsif r.lomba = 'KIM' then
      raise exception
        'KIM masih SATU lomba. Kim Lihat dan Kim Cium dua lomba terpisah '
        'sejak migrasi 0087 — periksa urutan daftar ULANG di dev_database.sh.';
    end if;
  end loop;

  assert v_diperiksa = 3,
    format('%s dari 3 lomba berkriteria banyak ditemukan — Pembidaian, PBB '
           'dan Yel-Yel semestinya ada di edisi ini', v_diperiksa);

  -- Keduanya harus berdiri sebagai lomba tersendiri, bukan sekadar tidak
  -- bernama "KIM".
  assert (select count(distinct coalesce(lomba, name)) from wahana
          where edisi = edisi_aktif() and kode in ('kim_lihat', 'kim_cium')) = 2,
         'Kim Lihat dan Kim Cium tidak berdiri sebagai dua lomba.';

  -- Kunci fotonya harus BERBEDA. Kalau sama, keduanya berbagi satu kolom foto
  -- dan lembar jawaban Cium tergambar di bawah nilai Lihat — kerusakan yang
  -- tidak terlihat sampai seseorang mempertanyakan sebuah nilai.
  select kode_lomba into v_lihat
    from wahana where edisi = edisi_aktif() and kode = 'kim_lihat';
  select kode_lomba into v_cium
    from wahana where edisi = edisi_aktif() and kode = 'kim_cium';
  assert v_lihat is not null and v_cium is not null,
         'Kunci foto KIM kosong — foto tidak akan ketemu dari layar mana pun.';
  assert v_lihat is distinct from v_cium,
         format('Kim Lihat dan Kim Cium berbagi kunci foto %L', v_lihat);

  -- `raise notice` memakai % polos; %L cuma milik format(), dan di sini ia
  -- mencetak "kim-lihatL".
  raise notice 'bentuk lomba sesuai CLAUDE.md 11 — KIM dua lomba, '
               'kunci foto % dan %.', v_lihat, v_cium;
end;
$penjaga$;
