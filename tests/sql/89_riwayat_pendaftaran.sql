-- ============================================================================
-- hrcd-rekap : tests/sql/89_riwayat_pendaftaran.sql
--
-- Riwayat pendaftaran (migrasi 0137) terbaca oleh yang berhak, dan tertutup
-- untuk yang tidak.
--
-- Migrasinya sendiri hanya bisa membuktikan BENTUK datanya: ia berjalan tanpa
-- kursi pengguna, jadi `boleh()` selalu false di sana. Yang menguji hak harus
-- menempati kursi (CLAUDE.md 13.8), dan itu di sini.
--
--   89.1  petugas registrasi melihat riwayatnya
--   89.2  isinya menyebut APA yang berubah, siapa, dan kapan
--   89.3  ketiga tabel ikut — pendaftaran, regu, pembayaran
--   89.4  mencabut seluruh centangnya menutup view-nya
--   89.5  perubahan tanpa pelaku mengembalikan NULL, bukan sebuah kata
-- ============================================================================

\set ON_ERROR_STOP on

begin;

do $blok$
declare
  v_registrasi uuid := '00000000-0000-0000-0000-0000000000b1';
  v_kunci uuid := gen_random_uuid();
  v_kode  text;
  v_regu  uuid;
  v_n     integer;
  v_teks  text;
  v_tabel text;
begin
  perform set_config('app.uid', v_registrasi::text, true);

  select (submit_pendaftaran(
    'SMA Negeri 1 Ciamis', '', false, '081200000089',
    jsonb_build_array(jsonb_build_object(
      'nama_regu', 'UJI RIWAYAT DELAPAN', 'nama_ketua', 'Ketua Lama',
      'golongan', 'intern_pa')),
    0::smallint, v_kunci, 'Bu Lama', 'tunai', null) ->> 'kode_pembayaran')
  into v_kode;

  select r.id into v_regu
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v_kode;

  -- Tiga perbuatan yang benar-benar dilakukan panitia di tiga layar berbeda.
  perform ubah_identitas_regu(v_regu, 'UJI RIWAYAT DELAPAN', 'Ketua Baru', null, null);
  perform ubah_kontak_pendaftaran(v_kode, 'Bu Baru', '081299990089');
  perform verifikasi_pembayaran(v_kode, tagihan_pendaftaran(
    (select id from pendaftaran where kode_pembayaran = v_kode)), 'tunai');

  -- 89.1  Terbaca oleh pemegang hak.
  select count(*) into v_n from v_riwayat_pendaftaran
  where kode_pembayaran = v_kode;
  assert v_n > 0, '89.1 GAGAL: riwayatnya kosong untuk petugas registrasi';
  raise notice '89.1 LULUS: petugas registrasi melihat % baris riwayat.', v_n;

  -- 89.2  Menyebut APA yang berubah, siapa, dan kapan.
  select (perubahan -> 'nama_ketua' ->> 'lama') || ' -> '
      || (perubahan -> 'nama_ketua' ->> 'baru') || ' oleh ' || oleh
    into v_teks
  from v_riwayat_pendaftaran
  where kode_pembayaran = v_kode and table_name = 'regu' and action = 'UPDATE'
    and perubahan ? 'nama_ketua'
  order by changed_at desc limit 1;

  -- ->> mengembalikan TEKSNYA, tanpa tanda kutip JSON. Asersi pertama
  -- menuntut tanda kutipnya ada dan gagal atas data yang sudah benar.
  assert v_teks like 'Ketua Lama -> Ketua Baru oleh %',
    format('89.2 GAGAL: berbunyi %s', coalesce(v_teks, '<NULL>'));
  assert v_teks not like '%(tidak dikenal)%',
    format('89.2 GAGAL: pelakunya tidak terbaca — %s', v_teks);
  raise notice '89.2 LULUS: riwayat menyebut perubahan, pelaku, dan waktunya.';

  -- 89.3  Ketiga tabel ikut. Yang paling penting `pembayaran`: itu jawaban
  --       atas "siapa yang menandai lunas".
  select string_agg(distinct table_name, ',' order by table_name) into v_tabel
  from v_riwayat_pendaftaran where kode_pembayaran = v_kode;
  assert v_tabel = 'pembayaran,pendaftaran,regu',
    format('89.3 GAGAL: tabel yang tercatat %s', v_tabel);
  raise notice '89.3 LULUS: pendaftaran, regu, dan pembayaran semuanya tercatat.';

  -- 89.4  Centang dicabut seluruhnya — view-nya ikut tertutup. Panggilan yang
  --       SAMA PERSIS dijalankan dua kali; yang berubah cuma baris akun_hak.
  delete from akun_hak where user_id = v_registrasi
    and fitur in ('pengaturan', 'pembayaran', 'daftar_ulang', 'pendaftaran');

  select count(*) into v_n from v_riwayat_pendaftaran
  where kode_pembayaran = v_kode;
  assert v_n = 0,
    format('89.4 GAGAL: masih terbaca % baris tanpa satu centang pun', v_n);
  raise notice '89.4 LULUS: mencabut centangnya menutup riwayatnya.';

  -- 89.5  Pelaku kosong = TIDAK ADA orang yang melakukannya (migrasi impor),
  --       bukan orang yang gagal dikenali. Kolomnya harus NULL supaya layar
  --       bisa membuang bagiannya; sebuah kata apa pun akan tercetak.
  --       Haknya dikembalikan dulu — 89.4 baru saja mencabut semuanya.
  insert into akun_hak (user_id, fitur) values (v_registrasi, 'pendaftaran');
  perform set_config('app.uid', null, true);
  update regu set nama_ketua = 'Ketua Tanpa Kursi' where id = v_regu;
  perform set_config('app.uid', v_registrasi::text, true);

  select oleh into v_teks from v_riwayat_pendaftaran
  where kode_pembayaran = v_kode and table_name = 'regu'
    and perubahan -> 'nama_ketua' ->> 'baru' = 'Ketua Tanpa Kursi';
  assert v_teks is null,
    format('89.5 GAGAL: pelaku seharusnya kosong, berbunyi %s', v_teks);
  raise notice '89.5 LULUS: perubahan tanpa pelaku tidak menuliskan kata apa pun.';
end;
$blok$;

rollback;
