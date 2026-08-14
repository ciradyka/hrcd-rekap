-- ============================================================================
-- hrcd-rekap : tests/sql/12_pesan_rentang.sql
-- Kalimat galat saat nilai di luar rentang (migrasi 0029).
--
-- Kenapa sebuah KALIMAT dijaga tes: kalimat ini satu-satunya hal yang dibaca
-- operator saat ia salah ketik di tengah antrean, dan ia gampang sekali rusak
-- tanpa ada yang menyadarinya. Fungsi `simpan_nilai_massal` disalin utuh tiap
-- kali ada migrasi baru yang menyentuhnya (`create or replace` menuntut
-- definisi penuh), jadi versi lama pesannya bisa ikut tersalin balik dari
-- berkas yang salah — dan tidak satu pun tes lain akan gagal karenanya.
--
-- Yang dijaga tiga hal:
--   1. bunyinya persis "Input harus antara 0 - 20." — bukan diagnosis;
--   2. angkanya TANPA nol di belakang koma (kolomnya numeric(10,2));
--   3. nilai yang ditolak TIDAK diulang di dalam kalimat.
-- ============================================================================

select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

do $$
declare
  v_dada   int;
  v_maks   numeric;
  v_hasil  jsonb;
  v_alasan text;
begin
  -- Komponen pertama Pos 1 apa pun namanya tahun ini — rentangnya dibaca dari
  -- konfigurasi, bukan ditulis di sini. Tes yang menyebut "20" sendiri akan
  -- lulus tahun depan sambil menyembunyikan pesan yang sudah salah.
  select rentang_mentah_maks into strict v_maks
  from wahana where edisi = edisi_aktif() and pos = 1 and kode = 'kepramukaan_keagamaan';

  select min(r.nomor_dada) into strict v_dada
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where r.nomor_dada is not null and not r.is_cancelled and d.status = 'lunas';

  v_hasil := simpan_nilai_massal(
    jsonb_build_array(jsonb_build_object(
      'nomor_dada', v_dada,
      'kode', 'kepramukaan_keagamaan',
      'nilai_1', v_maks + 11)),   -- jelas di luar rentang
    'manual', 1::smallint);

  assert v_hasil -> 0 ->> 'status' = 'ditolak',
    'nilai di luar rentang malah diterima';

  v_alasan := v_hasil -> 0 ->> 'alasan';

  assert v_alasan = format('Input harus antara 0 - %s.', trim_scale(v_maks)),
    format('kalimatnya berubah: %L', v_alasan);

  -- Nol di belakang koma tidak boleh muncul: "0.00 - 20.00" adalah bentuk
  -- yang membuat orang ragu apakah pecahan diterima.
  assert v_alasan not like '%.00%',
    format('rentang tercetak dengan nol di belakang koma: %L', v_alasan);

  -- Angka yang ditolak tidak diulang — ia masih terlihat di kotak yang baru
  -- saja diketik, dan mengulangnya cuma memanjangkan kalimat.
  assert v_alasan not like '%' || (v_maks + 11)::text || '%',
    format('nilai yang ditolak ikut diulang di pesan: %L', v_alasan);
end;
$$;

reset role;
select '12_pesan_rentang OK' as hasil;
