-- ============================================================================
-- hrcd-rekap : tests/sql/58_kontrak_dari_gerbang.sql — migrasi 0097.
--
-- PETUGAS GARIS START HARUS BISA MENGISI KONTRAK WAKTU.
--
-- Bentuknya mengikuti tes 30-36 (CLAUDE.md 13.8): panggilan yang SAMA PERSIS
-- dijalankan dua kali oleh akun yang sama, dan yang berubah di antaranya cuma
-- satu baris `akun_hak` — persis yang dilakukan centang di layar Akun. Kalau
-- pesannya tidak berubah, pagarnya bukan centang itu.
--
-- Yang dijaga bukan sekadar "gerbang boleh". Yang dijaga adalah RANTAINYA:
-- layar Keberangkatan digerbangi hak `keberangkatan`, jadi RPC yang hanya
-- bisa dipanggil dari layar itu tidak boleh menuntut hak yang pemegang
-- `keberangkatan` tidak punya. Sebelum 0097 ia menuntut `daftar_ulang`, dan
-- akibatnya tidak ada satu peran pun selain admin yang bisa mengisi kontrak —
-- lalu `berangkatkan_kloter` menolak seluruh kloter karena regunya belum
-- berkontrak.
-- ============================================================================

\echo '--- 58. kontrak waktu bisa diisi dari garis start'

do $blok$
declare
  v_gerbang uuid := '00000000-0000-0000-0000-0000000000c1';
  v_regu    uuid;
  v_menit   smallint;
  v_semula  smallint;
  v_pesan   text;
  v_dapat   smallint;
begin
  -- Akun gerbang: belum ada di seed (01_seed_uji hanya punya admin, dua juri
  -- pos, dan tiga meja). Dibuat lewat PERGANTIAN PERAN, jalan yang sama dengan
  -- layar Akun, supaya centangnya diisi trigger hak_ikut_peran (0077) dari
  -- paket_peran('gerbang') — haknya jadi persis seperti akun gerbang
  -- sungguhan, bukan karangan tes ini.
  --
  -- Trigger itu `after update of peran`, jadi INSERT saja tidak mengisi
  -- apa-apa; barisnya lahir sebagai juri_pos lalu diganti. (Check 0058
  -- menuntut juri_pos punya pos dan peran lain tidak, jadi pos ikut diganti
  -- di pernyataan yang sama.)
  insert into auth.users (id, email) values (v_gerbang, 'gerbang.uji@uji.local')
  on conflict (id) do nothing;
  insert into akun_panitia (user_id, username, peran, pos, is_active)
  values (v_gerbang, 'gerbang.uji', 'juri_pos', 1, true)
  on conflict (user_id) do update set peran = 'juri_pos', pos = 1, is_active = true;
  update akun_panitia set peran = 'gerbang', pos = null where user_id = v_gerbang;

  select count(*)::int into v_dapat from akun_hak
  where user_id = v_gerbang and fitur = 'keberangkatan';
  assert v_dapat = 1,
    'akun gerbang tidak mendapat hak keberangkatan dari paket_peran()';
  select count(*)::int into v_dapat from akun_hak
  where user_id = v_gerbang and fitur = 'daftar_ulang';
  assert v_dapat = 0,
    'akun gerbang mendapat hak daftar_ulang — tes ini jadi tidak membuktikan '
    'apa pun, karena itulah hak yang dulu dituntut';

  -- Regu yang berkloter dan kloternya belum berangkat: pagar "sudah berangkat"
  -- adalah pagar lain, dan bukan itu yang diuji di sini.
  select r.id, r.kontrak_menit into v_regu, v_semula
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  join kloter k on k.nomor = r.kloter_nomor
  where not r.is_cancelled and d.status = 'lunas'
    and r.kloter_nomor is not null
    and k.jam_berangkat is null
    and not exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
  order by r.nomor_dada limit 1;
  assert v_regu is not null,
    '58 GAGAL: tidak ada regu berkloter yang belum berangkat untuk diuji';

  select menit into v_menit from kontrak_opsi
  where edisi = edisi_aktif() order by menit limit 1;
  assert v_menit is not null, '58 GAGAL: edisi ini tidak punya pilihan kontrak';

  -- ---------------------------------------------------------------------
  -- 58.1 Dengan centang `keberangkatan`, petugas gerbang berhasil.
  -- ---------------------------------------------------------------------
  perform set_config('app.uid', v_gerbang::text, true);
  perform konfirmasi_kontrak(v_regu, v_menit);

  select kontrak_menit into v_dapat from regu where id = v_regu;
  assert v_dapat = v_menit,
    format('58.1 GAGAL: kontrak tersimpan %s, seharusnya %s', v_dapat, v_menit);
  raise notice '58.1 OK — akun gerbang mengisi kontrak % menit.', v_menit;

  -- ---------------------------------------------------------------------
  -- 58.2 Centangnya dicabut, panggilan yang sama ditolak.
  --
  --      Inilah yang membuktikan pagarnya benar-benar `keberangkatan` dan
  --      bukan sesuatu yang kebetulan terbuka.
  -- ---------------------------------------------------------------------
  delete from akun_hak where user_id = v_gerbang and fitur = 'keberangkatan';
  begin
    perform konfirmasi_kontrak(v_regu, v_menit);
    assert false, '58.2 GAGAL: kontrak tetap bisa diisi tanpa satu hak pun';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%tidak berhak%',
    format('58.2 GAGAL: ditolak dengan pesan lain — %s', v_pesan);
  raise notice '58.2 OK — centang dicabut, pintunya tertutup: %', v_pesan;

  -- ---------------------------------------------------------------------
  -- 58.3 Meja daftar ulang tetap boleh. Perbaikan ini menambah pintu, bukan
  --      memindahkannya — sebelum 0058 satu orang mengerjakan keduanya.
  -- ---------------------------------------------------------------------
  insert into akun_hak (user_id, fitur) values (v_gerbang, 'daftar_ulang')
  on conflict do nothing;
  perform konfirmasi_kontrak(v_regu, v_menit);
  raise notice '58.3 OK — hak daftar_ulang saja juga masih membuka pintunya.';

  -- Kembalikan keadaan: hak gerbang seperti paketnya, dan kontrak regu uji
  -- seperti semula supaya penalti tes lain tidak bergeser.
  delete from akun_hak where user_id = v_gerbang and fitur = 'daftar_ulang';
  insert into akun_hak (user_id, fitur) values (v_gerbang, 'keberangkatan')
  on conflict do nothing;
  perform set_config('app.uid', '', true);
  update regu set kontrak_menit = v_semula
  where id = v_regu and kontrak_menit is distinct from v_semula;
end;
$blok$;

\echo '58 kontrak waktu dari garis start: LULUS'
