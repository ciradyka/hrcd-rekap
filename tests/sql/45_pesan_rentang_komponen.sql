-- ============================================================================
-- hrcd-rekap : tests/sql/45_pesan_rentang_komponen.sql — migrasi 0082.
--
-- KENAPA SEBUAH KALIMAT DIJAGA MESIN.
--
-- Kalimat ini satu-satunya yang dibaca petugas saat ia salah ketik di tengah
-- antrean, dan ia gampang sekali rusak tanpa ada yang menyadarinya:
-- `simpan_nilai_massal` disalin UTUH tiap kali ada migrasi yang menyentuhnya
-- (`create or replace` menuntut definisi penuh), jadi versi lama pesannya
-- bisa ikut tersalin balik dari berkas yang salah — dan tidak satu pun tes
-- lain akan gagal karenanya.
--
-- Tes 12 sudah menjaga bentuk lamanya di titik sejarahnya sendiri. Berkas ini
-- menjaga yang ditambahkan 0082: NAMA KOMPONENNYA. Di lembar pos satu baris
-- punya tiga sampai lima kotak berdampingan dengan rentang berbeda-beda, dan
-- kalimat tanpa nama kolom membuat petugas menebak kotak mana yang ditolak.
-- Tebakan yang salah menimpa angka yang sudah benar — dan angka itu
-- tersimpan, karena baris yang sah tetap dikirim.
--
-- KOMPONENNYA DICARI, TIDAK DITULIS. Tes yang menyebut "Semaphore" sendiri
-- akan lulus tahun depan sambil menyembunyikan pesan yang sudah salah, karena
-- konfigurasi penilaian diganti tiap edisi.
-- ============================================================================

\echo '--- 45. pesan rentang menyebut komponennya'

do $blok$
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
end;
$blok$;

set role authenticated;

do $blok$
declare
  v_regu   regu%rowtype;
  v_w      wahana%rowtype;
  v_hasil  jsonb;
  v_alasan text;
begin
  select r.* into strict v_regu
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where r.nomor_dada is not null and not r.is_cancelled and d.status = 'lunas'
  order by r.nomor_dada limit 1;

  -- ---------------------------------------------------------------------
  -- 45.1 nilai_1 di luar rentang: kalimatnya menyebut komponennya.
  --
  -- Komponennya harus BERLAKU untuk golongan regu ini. Kalau tidak,
  -- penolakannya berbunyi "Komponen ini untuk golongan lain." — pagar lain
  -- yang berdiri lebih dulu, dan tes ini akan gagal karena alasan yang sama
  -- sekali bukan yang sedang diuji.
  -- ---------------------------------------------------------------------
  select w.* into strict v_w
  from wahana w
  where w.edisi = edisi_aktif()
    and komponen_berlaku(w.golongan, v_regu.golongan)
  order by w.pos, w.sort_order limit 1;

  v_hasil := simpan_nilai_massal(
    jsonb_build_array(jsonb_build_object(
      'nomor_dada', v_regu.nomor_dada, 'kode', v_w.kode,
      'nilai_1', v_w.rentang_mentah_maks + 11)),
    'manual', v_w.pos);

  assert v_hasil -> 0 ->> 'status' = 'ditolak',
    'nilai di luar rentang malah diterima';

  v_alasan := v_hasil -> 0 ->> 'alasan';

  assert v_alasan = format('Input %s harus antara %s - %s.',
                           v_w.name, trim_scale(v_w.rentang_mentah_min),
                           trim_scale(v_w.rentang_mentah_maks)),
    format('45.1 GAGAL: kalimatnya %L', v_alasan);

  -- Namanya harus BENAR-BENAR ada di dalamnya. Assert di atas sudah
  -- membuktikannya, tapi pemeriksaan terpisah ini yang akan tetap gagal
  -- dengan pesan yang jelas kalau suatu hari formatnya dirapikan ulang.
  assert position(v_w.name in v_alasan) > 0,
    format('45.1 GAGAL: nama komponen "%s" hilang dari kalimat %L',
           v_w.name, v_alasan);

  -- Nol di belakang koma tidak boleh muncul: "0.00 - 20.00" adalah bentuk
  -- yang membuat orang ragu apakah pecahan diterima (migrasi 0029).
  assert v_alasan not like '%.00%',
    format('45.1 GAGAL: rentang tercetak dengan nol di belakang koma: %L', v_alasan);

  -- Angka yang ditolak tidak diulang — ia masih terlihat di kotak yang baru
  -- saja diketik, dan mengulangnya cuma memanjangkan kalimat.
  assert v_alasan not like '%' || trim_scale(v_w.rentang_mentah_maks + 11)::text || '%',
    format('45.1 GAGAL: nilai yang ditolak ikut diulang: %L', v_alasan);
  raise notice '45.1 OK — "%"', v_alasan;

  -- ---------------------------------------------------------------------
  -- 45.2 nilai_2 (jumlah salah) juga menyebut komponennya.
  --
  -- Dicari di SELURUH pos, bukan pos 1 saja: bentuk `benar_kurang_salah`
  -- cuma dipakai sebagian lomba, dan tes yang mencarinya di satu pos akan
  -- DILEWATI diam-diam begitu lomba itu pindah pos.
  -- ---------------------------------------------------------------------
  select w.* into v_w
  from wahana w
  where w.edisi = edisi_aktif()
    and w.form = 'benar_kurang_salah'
    and komponen_berlaku(w.golongan, v_regu.golongan)
  order by w.pos, w.sort_order limit 1;

  if not found then
    raise notice '45.2 DILEWATI — edisi ini tidak punya komponen '
                 'benar_kurang_salah yang berlaku untuk golongan %.',
                 v_regu.golongan;
    return;
  end if;

  v_hasil := simpan_nilai_massal(
    jsonb_build_array(jsonb_build_object(
      'nomor_dada', v_regu.nomor_dada, 'kode', v_w.kode,
      'nilai_1', v_w.rentang_mentah_min,
      'nilai_2', v_w.rentang_mentah_maks + 11)),
    'manual', v_w.pos);

  v_alasan := v_hasil -> 0 ->> 'alasan';
  assert v_hasil -> 0 ->> 'status' = 'ditolak'
     and v_alasan = format('Jumlah salah %s harus antara 0 - %s.',
                           v_w.name, trim_scale(v_w.rentang_mentah_maks)),
    format('45.2 GAGAL: kalimatnya %L', coalesce(v_alasan, '(diterima)'));
  raise notice '45.2 OK — "%"', v_alasan;
end;
$blok$;

reset role;
\echo '--- 45 SELESAI'
