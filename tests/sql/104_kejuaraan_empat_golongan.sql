\echo '--- 104. Kostum, Yel Yel dan Terfavorit dibagi empat golongan'

-- Lima regu uji: dua Penegak PA supaya Yel Yel benar-benar harus memilih di
-- dalam golongan, dan satu di tiap golongan lain supaya keempat baris Yel Yel
-- pasti terisi apa pun isi database sebelum tes ini.

do $blok$
declare
  v_sekolah uuid := gen_random_uuid();
  v_daftar uuid := gen_random_uuid();
  v_pa_kalah uuid := gen_random_uuid();
  v_pa_menang uuid := gen_random_uuid();
  v_pi uuid := gen_random_uuid();
  v_penggalang_pa uuid := gen_random_uuid();
  v_penggalang_pi uuid := gen_random_uuid();
  v_petugas uuid := '00000000-0000-0000-0000-00000000000a';
  v_jam_lama timestamptz;
  v_wahana uuid;
  v_salah integer;
  v_jumlah integer;
  v_nomor integer;
begin
  select jam_berangkat into v_jam_lama from kloter where nomor = 75;
  update kloter set jam_berangkat = timestamptz '2026-08-29 07:00+07'
  where nomor = 75;

  insert into sekolah (id, name, address)
  values (v_sekolah, 'SEKOLAH UJI 104', 'Alamat uji');
  insert into pendaftaran
    (id, sekolah_id, kode_pembayaran, butuh_barak, jumlah_menginap,
     jumlah_regu, kontak_wa, status, kunci_kirim)
  values
    (v_daftar, v_sekolah, 'UJI104', false, 0, 5,
     '086666666666', 'lunas', gen_random_uuid());
  insert into regu
    (id, pendaftaran_id, nama_regu, nama_ketua, golongan,
     nomor_dada, kloter_nomor, urutan_kloter)
  values
    (v_pa_kalah, v_daftar, 'UJI KEJUARAAN PA 1', 'KETUA UJI',
     'penegak_pa', 491, 75, 1),
    (v_pa_menang, v_daftar, 'UJI KEJUARAAN PA 2', 'KETUA UJI',
     'penegak_pa', 492, 75, 2),
    (v_pi, v_daftar, 'UJI KEJUARAAN PI 3', 'KETUA UJI',
     'penegak_pi', 493, 75, 3),
    (v_penggalang_pa, v_daftar, 'UJI KEJUARAAN GALANG PA 4', 'KETUA UJI',
     'penggalang_pa', 494, 75, 4),
    (v_penggalang_pi, v_daftar, 'UJI KEJUARAAN GALANG PI 5', 'KETUA UJI',
     'penggalang_pi', 495, 75, 5);

  insert into keberangkatan_regu (regu_id, recorded_by)
  select id, v_petugas from regu where pendaftaran_id = v_daftar;
  insert into closing_regu (regu_id, jam_datang, anggota_hadir, recorded_by)
  select id, timestamptz '2026-08-29 10:00+07', 5, v_petugas
  from regu where pendaftaran_id = v_daftar;

  -- Sandi Morse adalah komponen Pos 5 di database uji: benar_kurang_salah,
  -- +10 per benar, dipotong di 100. Sepuluh benar = 100 poin, tiga = 30.
  select id into strict v_wahana from wahana
  where edisi = edisi_aktif() and kode = 'sandi_morse';
  insert into nilai_mentah (regu_id, wahana_id, nilai_1, nilai_2, source, created_by)
  values
    (v_pa_kalah, v_wahana, 3, 0, 'manual', v_petugas),
    (v_pa_menang, v_wahana, 10, 0, 'manual', v_petugas),
    (v_pi, v_wahana, 10, 0, 'manual', v_petugas),
    (v_penggalang_pa, v_wahana, 10, 0, 'manual', v_petugas),
    (v_penggalang_pi, v_wahana, 10, 0, 'manual', v_petugas);

  set local role authenticated;
  perform set_config('app.uid', v_petugas::text, true);

  -- 104.1 sampai 104.3 — bentuk daftarnya
  create temp table hasil_104 as select * from hasil_kejuaraan();

  select count(*) into v_jumlah from hasil_104 where kode like 'kostum\_%';
  assert v_jumlah = 4, format('104.1 GAGAL: baris Kostum = %s', v_jumlah);
  select count(*) into v_jumlah from hasil_104 where kode like 'yel\_yel\_%';
  assert v_jumlah = 4, format('104.2 GAGAL: baris Yel Yel = %s', v_jumlah);
  select count(*) into v_jumlah from hasil_104 where kode like 'terfavorit\_%';
  assert v_jumlah = 4, format('104.3 GAGAL: baris Terfavorit = %s', v_jumlah);

  -- 104.4 — Terjauh, Terbanyak dan 24 gelar golongan tidak ikut terbelah
  select count(*) into v_jumlah from hasil_104
  where kode in ('terjauh', 'peserta_terbanyak');
  assert v_jumlah = 2, format('104.4 GAGAL: Terjauh + Terbanyak = %s', v_jumlah);
  select count(*) into v_jumlah from hasil_104
  where kode ~ '^(penegak|penggalang)_(pa|pi)_[1-6]$';
  assert v_jumlah = 24, format('104.5 GAGAL: gelar golongan = %s', v_jumlah);

  -- 104.6 — kode lama benar-benar hilang, bukan sekadar tidak dipakai layar
  select count(*) into v_jumlah from hasil_104
  where kode in ('kostum', 'yel_yel', 'terfavorit');
  assert v_jumlah = 0, format('104.6 GAGAL: %s kode lama masih terbit', v_jumlah);

  -- 104.7 — tiap pemenang Yel Yel benar-benar poin Pos 5 tertinggi DI
  -- GOLONGANNYA. Diperiksa terhadap isi database, bukan terhadap nomor dada
  -- yang ditulis di tes ini, supaya tetap benar walau tes lain menambah regu.
  reset role;
  select count(*) into v_salah from hasil_104 hk
  where hk.kode like 'yel\_yel\_%'
    and exists (
      select 1 from v_klasemen k
      join v_poin_pos pp on pp.regu_id = k.regu_id and pp.pos = 5
      where k.golongan = replace(hk.kode, 'yel_yel_', '')
        and pp.poin_pos > coalesce(hk.total, -1));
  assert v_salah = 0,
    format('104.7 GAGAL: %s Juara Yel Yel bukan poin Pos 5 tertinggi di golongannya', v_salah);

  select count(*) into v_salah from hasil_104
  where kode like 'yel\_yel\_%' and nomor_dada is null;
  assert v_salah = 0,
    format('104.8 GAGAL: %s baris Yel Yel kosong padahal golongannya ada pesertanya', v_salah);

  select nomor_dada into v_nomor from hasil_104 where kode = 'yel_yel_penegak_pa';
  assert v_nomor <> 491,
    '104.9 GAGAL: Yel Yel Penegak PA jatuh ke regu dengan poin Pos 5 lebih rendah';

  -- 104.10 — golongan penghargaan dan golongan regu harus cocok
  set local role authenticated;
  perform set_config('app.uid', v_petugas::text, true);
  begin
    perform simpan_kejuaraan_manual('kostum_penegak_pa', v_penggalang_pi);
    assert false, '104.10 GAGAL: regu Penggalang PI diterima sebagai Kostum Penegak PA';
  exception when others then
    assert sqlerrm like 'regu ini golongan %',
      format('104.10 GAGAL: penolakannya salah: %s', sqlerrm);
  end;

  -- 104.11 — kode lama tidak bisa lagi disimpan
  begin
    perform simpan_kejuaraan_manual('kostum', v_pa_menang);
    assert false, '104.11 GAGAL: kode Kostum lama masih diterima';
  exception when others then
    assert sqlerrm = 'penghargaan manual tidak dikenal',
      format('104.11 GAGAL: penolakannya salah: %s', sqlerrm);
  end;

  -- 104.12 — jalur normal: simpan, terbit, lalu dikosongkan lagi
  perform simpan_kejuaraan_manual('terfavorit_penggalang_pi', v_penggalang_pi);
  select nomor_dada into v_nomor from hasil_kejuaraan()
  where kode = 'terfavorit_penggalang_pi';
  assert v_nomor = 495,
    format('104.12 GAGAL: Terfavorit Penggalang PI = %s', v_nomor);

  perform simpan_kejuaraan_manual('terfavorit_penggalang_pi', null);
  reset role;
  select count(*) into v_jumlah from kejuaraan_manual
  where edisi = edisi_aktif() and kode = 'terfavorit_penggalang_pi';
  assert v_jumlah = 0, '104.13 GAGAL: pilihan Terfavorit tidak terhapus';

  -- 104.14 — akun tanpa live_score tidak melihat apa pun, Juara Umum termasuk
  set local role authenticated;
  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000ff', true);
  select count(*) into v_jumlah from hasil_kejuaraan();
  assert v_jumlah = 0,
    format('104.14 GAGAL: akun tanpa live_score membaca %s baris', v_jumlah);

  reset role;
  drop table hasil_104;
  delete from nilai_mentah where regu_id in
    (select id from regu where pendaftaran_id = v_daftar);
  delete from closing_regu where regu_id in
    (select id from regu where pendaftaran_id = v_daftar);
  delete from keberangkatan_regu where regu_id in
    (select id from regu where pendaftaran_id = v_daftar);
  delete from regu where pendaftaran_id = v_daftar;
  delete from pendaftaran where id = v_daftar;
  delete from sekolah where id = v_sekolah;
  update kloter set jam_berangkat = v_jam_lama where nomor = 75;
end;
$blok$;

\echo '104 kejuaraan empat golongan: LULUS'
