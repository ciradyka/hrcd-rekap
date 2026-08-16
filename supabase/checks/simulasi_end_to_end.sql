-- ============================================================================
-- hrcd-rekap : supabase/checks/simulasi_end_to_end.sql
-- Isi satu edisi penuh — pendaftaran sampai juara — lewat RPC yang sebenarnya.
--
-- KENAPA ADA
--
-- Menjelang simulasi, panitia perlu melihat TAMPILAN AKHIR: Live Score dengan
-- juara terbit, bukan layar kosong yang harus dibayangkan. Papan itu hanya
-- muncul kalau seluruh rantainya lengkap — klasemen menuntut regu yang
-- berangkat DAN datang, poin pos menuntut nilai tersimpan, penalti menuntut
-- kontrak waktu yang dikonfirmasi.
--
-- Tiap langkah memanggil RPC yang sama dengan yang dipanggil layar panitia.
-- Tidak ada satu pun INSERT langsung ke tabel operasional: kalau ada, yang
-- tergambar bukan tampilan yang akan dipakai besok melainkan tampilan yang
-- kebetulan mirip.
--
-- ANGKANYA ACAK, DAN ITU HARUS DISEBUT
--
-- Nilai tiap komponen diacak dalam rentang sahnya dan jam datang diacak di
-- sekitar kontrak waktu, jadi JUARANYA TIDAK BERARTI APA-APA. Ia ada supaya
-- bentuk layarnya terlihat, bukan supaya ada yang menang. Nama ketua juga
-- bukan nama siapa-siapa — keempat edisi XXXIII-XXXVI tidak pernah punya
-- kolomnya.
--
-- FASE LIVE TIDAK DISENTUH. `v_klasemen_publik` menunggu
-- `status_acara.fase_live`, sedangkan `v_klasemen_live_score` cukup peran
-- admin. Berkas ini sengaja tidak mengubah fase, jadi yang berisi hanya papan
-- panitia — situs peserta tetap seperti sebelumnya sampai ada yang
-- menerbitkannya dengan sadar.
--
-- AMAN DIULANG. Tiap langkah melewati baris yang sudah beres, jadi
-- menjalankannya dua kali tidak melahirkan pendaftaran kedua.
--
-- MEMBERSIHKANNYA: lihat supabase/checks/hapus_simulasi.sql.
-- ============================================================================

do $$
declare
  v_admin   uuid;
  v_kode    text;
  v_regu    record;
  v_kloter  record;
  v_pos     record;
  v_baris   jsonb;
  v_n       int;
  v_i       int := 0;
  v_dada    int;
  v_opsi    smallint[];
  v_e       record;
  v_kloter_semua     int;
  v_kloter_berangkat int;
  v_pos_selesai      int;
  v_kloter_parkir    smallint;
  v_jml_pos          int;
begin
  -- Identitas pelaku. Semua RPC mencatat `recorded_by`/`verified_by` dari
  -- auth.uid(), dan kolomnya NOT NULL — tanpa ini seluruh berkas gagal di
  -- langkah pembayaran dengan pesan yang tidak menyebut sebabnya.
  --
  -- Dua setting sekaligus dengan sengaja: Supabase membaca
  -- `request.jwt.claim.sub`, sedangkan harness uji lokal (tests/sql/00) punya
  -- auth.uid() tiruan yang membaca `app.uid`. Berkas yang sama harus jalan di
  -- dua tempat, kalau tidak yang diuji bukan yang dijalankan.
  select user_id into v_admin from akun_panitia
   where username = 'admin.ciradyka' and is_active;
  if v_admin is null then
    raise exception 'akun admin.ciradyka tidak ada / tidak aktif — tidak ada yang bisa jadi pelaku';
  end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('app.uid', v_admin::text, true);

  select count(distinct pos) into v_jml_pos from wahana where edisi = (select nomor from edisi where is_active);
  select * into v_e from edisi where is_active;
  raise notice 'edisi aktif: % (%)', v_e.name, v_e.nomor;

  -- ------------------------------------------------------------ 0. pendaftaran
  -- 50 regu dari Database HRCD XXXVI: nama regu, sekolah, dan golongan
  -- diambil apa adanya, karena bentuk nama yang sebenarnya (panjang, kapital,
  -- tanda baca) justru yang perlu diuji layarnya. Nama ketua placeholder —
  -- keempat edisi lampau tidak pernah punya kolomnya.
  --
  -- Dilewati kalau sudah ada regu: berkas ini aman diulang.
  if not exists (select 1 from regu) then
    perform submit_pendaftaran('SMAN 1 Maja', 'Jln prabuwangi',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Indi homogen', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('Smk bangkit indonesia talaga', 'nan',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Prampasu putra', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMAN 1 cirebon', 'Jl siliwangi no 12',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Kandang maung', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMK BANGKIT INDONESIA TALAGA', 'Jln, ganeas no 1 kec, talaga',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Pramapasu Putra', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa'),
        jsonb_build_object('nama_regu', 'Pramapasu Putri', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('MTs Rancah', 'Jl Cibeureum No. 50',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'SIREUM ATEUL', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('MTs Rancah', 'Jl Cibeureum No 50',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'GARUDA MUDA', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pa'),
        jsonb_build_object('nama_regu', 'WANOJA SUNDA', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pi'),
        jsonb_build_object('nama_regu', 'MOJANG GALUH', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('MA AL-AZHAR KOTA BANJAR', 'Jl. Pesantren No 2 Citangkolo, Desa Kujangsari, Kecamatan Langensari, Kota Banjar',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Skuad Ambyar', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMAN 1 CIHAURBEUTI', 'Jalan kartawijaya no. 600 Pamokolan-Cihaurbeuti,Pamokolan,Ciamis,Kabupaten Ciamis,Jawa Barat 46262',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Bombang Rarang', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMAN 1 Cihaurbeuti', 'Jalan kartawijaya no. 600 Pamokolan-Cihaurbeuti,Pamokolan,Ciamis,Ciamis,Jawa Barat 46262',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Bombang Kencana', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('MAS AL-KAUTSAR', 'jln. Pejuang No. 100, Karangpucung wetan, Desa Jajawar, Kecamatan Banjar, Kota Banjar, Provinsi Jawa Barat',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Khalid bin Walid', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('Mts Rijalul Hikam', 'Jatinagara',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Brighest Star', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('MA ASALIMIAH', 'jl. Kiayi Haji Salim, No 1 Rt 9 rw 7 Desa Darmacaang, Kec. cikoneng, Kab, Ciamis',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Abang pulan', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('MA ASALIMIAH', 'JL. Kiyai Haji Salim, no 1 rt 9 rw 7, Desa Darmacaang, kec. cikoneng',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Dewi Armina', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMA TERPADU CIKANYERE', 'Kec.Rajadesa,Kab.Ciamis',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'COLOR REMBO', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pi'),
        jsonb_build_object('nama_regu', 'PHAIS OREGH', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('MA YPI RIJALUL HIKAM', 'Jatinagara',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Nanya ka urang', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pi'),
        jsonb_build_object('nama_regu', 'ZAKORAYFLY', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('MA YPI Rijalul Hikam', 'Jatinagara',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'SagombayFly', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMA Islam Ainurrafiq', 'Kec. Cigandamekar Kab. Kuningan',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'No Mercy ARQ', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa'),
        jsonb_build_object('nama_regu', 'Zombie Ainurrafiq', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMP Islam Ainurrafiq', 'Kec. Cigandamekar Kab. Kuningan',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Oxsigen ARQ', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMKS GALUH RAHAYU', 'Jln Raya Sukaraja, Sindangkasih',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Putera Galuh', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMAI NURUL FIKRI', 'Serang Banten',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Pagoli NFBS', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa'),
        jsonb_build_object('nama_regu', 'Lastrada NFBS', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMA IT AL-FALAH', 'Jl. Raya Citalahab Ds.Mekarjaya Kec.Bungbulang Kab.Garut Kode Pos 44165',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'ADAM MALIK', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMKN 1 Losarang', 'Ds.santing kec.losarang kab.indramayu',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'KIWANA LAS', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMK Siliwangi AMS Banjarsari', 'Ciamis,banjarsari',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Dyah Pitaloka', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMK Siliwangi AMS Banjarsari', 'Banjarsari,Ciamis, Jawa barat',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Prabu Siliwangi', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa'),
        jsonb_build_object('nama_regu', 'Maung Bodas', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMAT RIYADLUL ULUM', 'Condong, Setianegara, Cibereum Kota Tasikmalaya',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Condong Rover Scout', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMPT RIYADLUL ULUM WADDAWAH', 'condong,setianegara,cibereum, kota Tasikmalaya',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Hileud Jengke', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMPN 2 CIPAKU', 'Jl. Desa Cipaku No.05 Desa/kec Cipaku',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Swag Partners', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMPN 2 CIPAKU', 'Dusun Desa Cipaku',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Angel Wings', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMPN 2 CIPAKU', 'Jalan Desa Cipaku no.5 desa/kec cipaku',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Badhrika Chandra', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMPN 2 CIPAKU', 'JL. Desa cipaku no.5 desa/kec cipaku',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Pandawa Lima', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMKN 2 CIAMIS', 'Jl. Sadananya no.21',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Agresi Cakra', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('MAS AL-KAUTSAR', 'Jl. Pejuang No. 100 Karangpucung Wetan. Ds. Jajawar Kec. Banjar Kota Banjar',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Fatimah Azzahra', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMPN 1 CIAMIS', 'Jl. Jenderal Sudirman No. 6',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Disconnect Eror', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMPN 1 CIAMIS', 'Jl. Jenderal Sudirman No. 6, Ciamis',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Reconnect Afk', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pa')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMPN 1 CIAMIS', 'nan',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Saliwang Sableng', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pa'),
        jsonb_build_object('nama_regu', 'Pacebuk Nesa', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pi'),
        jsonb_build_object('nama_regu', 'Disconnect Ngelag', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pi'),
        jsonb_build_object('nama_regu', 'Alah Siah Boy', 'nama_ketua', 'Ketua Regu', 'golongan', 'penggalang_pi')),
      0::smallint, null, 'Pembina');
    perform submit_pendaftaran('SMKN 1 Losarang', 'Jalan Raya Pantura Losarang Desa Santing Kel. Jumbleng, Santing, Kec. Losarang, Kabupaten Indramayu, Jawa Barat 45253',
      false, '0800000000', jsonb_build_array(
        jsonb_build_object('nama_regu', 'Wana Karwek', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa'),
        jsonb_build_object('nama_regu', 'NYI WANA KULTUR', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pi'),
        jsonb_build_object('nama_regu', 'Nyi Wanagri', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pi'),
        jsonb_build_object('nama_regu', 'KiWana Tok', 'nama_ketua', 'Ketua Regu', 'golongan', 'penegak_pa')),
      0::smallint, null, 'Pembina');

    -- Lunasi lalu beri nomor dada. Nominalnya harus PAS seluruh batch —
    -- verifikasi_pembayaran menolak pembayaran sebagian (alur 3.5).
    for v_kode in
      select kode_pembayaran from pendaftaran where status = 'menunggu_pembayaran'
    loop
      perform verifikasi_pembayaran(
        v_kode,
        (select p.jumlah_regu * v_e.biaya_per_regu from pendaftaran p
          where p.kode_pembayaran = v_kode),
        'tunai');
    end loop;

    -- daftar_ulang_batch menuntut nomor dada EKSPLISIT untuk tiap regu; ia
    -- tidak mengambil sendiri dari stok. Itu bentuk yang benar — di meja,
    -- nomornya dibacakan dari kain yang sudah dipegang panitia.
    v_dada := 1;
    for v_kode in select kode_pembayaran from pendaftaran order by kode_pembayaran
    loop
      select jsonb_agg(jsonb_build_object('regu_id', x.id, 'nomor_dada', x.n))
        into v_baris
        from (select r.id, v_dada - 1 + row_number() over (order by r.nama_regu) n
                from regu r join pendaftaran p on p.id = r.pendaftaran_id
               where p.kode_pembayaran = v_kode and r.nomor_dada is null) x;
      if v_baris is not null then
        perform daftar_ulang_batch(v_kode, v_baris);
        v_dada := v_dada + jsonb_array_length(v_baris);
      end if;
    end loop;
  end if;
  select count(*) into v_n from regu where nomor_dada is not null;
  raise notice '0. pendaftaran: % regu bernomor dada', v_n;

  -- --------------------------------------------------------------- 1. kontrak
  select array_agg(menit order by menit) into v_opsi
    from kontrak_opsi where edisi = v_e.nomor;
  if v_opsi is null then
    raise exception 'tidak ada kontrak_opsi untuk edisi %', v_e.nomor;
  end if;

  v_n := 0;
  for v_regu in
    select id from regu
     where nomor_dada is not null and not is_cancelled and kontrak_menit is null
  loop
    perform konfirmasi_kontrak(v_regu.id, v_opsi[1 + floor(random() * array_length(v_opsi, 1))::int]);
    v_n := v_n + 1;
  end loop;
  raise notice '1. kontrak waktu: % regu', v_n;

  -- ------------------------------------------------------- 2. kemajuan dibuang
  -- Kemajuan disetel ulang dulu supaya berkas ini bisa dijalankan lagi dengan
  -- pola yang berbeda. Yang dibuang HANYA jejak hari lomba; pendaftaran,
  -- pembayaran, dan nomor dada tetap — itu yang mahal dibuat ulang dan tidak
  -- ada alasan menyentuhnya.
  delete from closing_regu;
  delete from nilai_terkunci;
  delete from nilai_mentah;
  delete from keberangkatan_regu;
  update kloter set jam_berangkat = null where jam_berangkat is not null;

  -- Tanda cetak ikut dibuang. Kloter yang sudah DICETAK dilewati waktu daftar
  -- ulang membagi regu (0040) — dan sisa tanda cetak dari uji coba lama
  -- mendorong seluruh penomoran ke atas: produksi sempat mulai dari kloter 17,
  -- bukan 1, karena 24 kloter pertama masih bertanda tercetak dari percobaan
  -- sebelumnya. Papan yang mulai dari kloter 17 membuat panitia mencari
  -- keenam belas kloter yang tidak pernah ada.
  update kloter set dicetak_pada = null where dicetak_pada is not null;

  -- Penomoran kloter dirapatkan dari 1, mengikuti urutan nomor dada dan
  -- kapasitas per kloter.
  --
  -- Ini SATU-SATUNYA tempat berkas ini menulis langsung ke tabel, bukan lewat
  -- RPC. Alasannya disebut supaya tidak ditiru sembarangan: mengulang
  -- pembagian lewat daftar_ulang_batch menuntut nomor dada dilepas dulu, dan
  -- melepas nomor dada menyentuh stok serta pensiun — reset yang jauh lebih
  -- besar dan lebih berisiko daripada yang dibutuhkan sebuah contoh.
  -- DIPARKIR DULU, baru ditempatkan. Dua langkah, dan keduanya perlu.
  --
  -- Satu UPDATE sekaligus bentrok: `unique (kloter_nomor, urutan_kloter)`
  -- tidak deferrable, jadi ia diperiksa per baris dan keadaan ANTARA ikut
  -- dinilai walaupun keadaan akhirnya sah. Mengosongkannya dulu juga tidak
  -- bisa — `check ((nomor_dada is null) = (kloter_nomor is null))` melarang
  -- regu bernomor dada tanpa kloter. Dan memindahkan satu per satu urut dari
  -- petak terkecil hanya aman kalau penomorannya selalu merapat; ia tidak,
  -- karena regu bisa berpindah ke urutan yang lebih besar di kloter yang sama.
  --
  -- Yang tersisa: pindahkan semuanya ke satu kloter yang pasti kosong, lalu
  -- tempatkan dari sana. Tidak ada petak tujuan yang pernah ditempati di
  -- kedua langkah, jadi tidak ada keadaan antara yang melanggar.
  -- Parkirnya BEBERAPA kloter terakhir, bukan satu: `urutan_kloter` dibatasi
  -- 1..maks_regu_per_kloter, jadi menumpuk lima puluh regu di satu kloter
  -- melanggar batas itu.
  select count(*) into v_n from regu where nomor_dada is not null and not is_cancelled;
  select max(nomor) - ceil(v_n::numeric / v_e.maks_regu_per_kloter)::int + 1
    into v_kloter_parkir from kloter;
  if exists (select 1 from regu where kloter_nomor >= v_kloter_parkir) then
    raise exception 'petak parkir mulai % ternyata berisi', v_kloter_parkir;
  end if;

  with urut as (
    select id, row_number() over (order by nomor_dada) n
      from regu where nomor_dada is not null and not is_cancelled
  )
  update regu r
     set kloter_nomor = (v_kloter_parkir
                         + floor((u.n - 1) / v_e.maks_regu_per_kloter))::smallint,
         urutan_kloter = (((u.n - 1) % v_e.maks_regu_per_kloter) + 1)::smallint
    from urut u where u.id = r.id;

  with urut as (
    select id,
           ceil(row_number() over (order by kloter_nomor, urutan_kloter)::numeric
                / v_e.maks_regu_per_kloter)::smallint            kloter,
           (((row_number() over (order by kloter_nomor, urutan_kloter) - 1)
             % v_e.maks_regu_per_kloter) + 1)::smallint          urutan
      from regu
     where kloter_nomor >= v_kloter_parkir and nomor_dada is not null
  )
  update regu r set kloter_nomor = u.kloter, urutan_kloter = u.urutan
    from urut u where u.id = r.id;

  -- ---------------------------------------------------- 3. lomba yang BERJALAN
  --
  -- Bukan lomba yang sudah selesai. Papan yang semuanya 100% tidak
  -- memperlihatkan satu pun keadaan yang akan dihadapi panitia siang nanti:
  -- kloter yang belum berangkat, pos yang belum kebagian, regu yang masih di
  -- jalan. Yang perlu dilihat justru papan yang sedang bergerak.
  --
  -- Bentuknya mengikuti waktu: kloter yang berangkat lebih dulu sudah melewati
  -- lebih banyak pos. Jadi kemajuan tiap kloter ditentukan urutannya sendiri,
  -- bukan diacak — regu kloter 1 yang baru melewati satu pos sementara kloter
  -- 6 sudah selesai adalah pemandangan yang tidak mungkin ada di lapangan.
  select count(*) into v_kloter_semua
    from (select distinct kloter_nomor from regu
           where kloter_nomor is not null and not is_cancelled) x;
  -- 70% berangkat, dibulatkan ke atas: sisanya masih menunggu di lapangan.
  v_kloter_berangkat := ceil(v_kloter_semua * 0.7)::int;
  raise notice '2. kemajuan: % dari % kloter berangkat',
    v_kloter_berangkat, v_kloter_semua;

  v_i := 0;
  for v_kloter in
    select distinct kloter_nomor nomor from regu
     where kloter_nomor is not null and not is_cancelled
     order by 1
  loop
    exit when v_i >= v_kloter_berangkat;

    for v_dada in
      select nomor_dada from regu
       where kloter_nomor = v_kloter.nomor and nomor_dada is not null
         and not is_cancelled
    loop
      perform ceklis_berangkat(v_dada);
    end loop;
    -- `at time zone 'Asia/Jakarta'`, BUKAN `::timestamptz`. Cast itu
    -- menafsirkan waktu polos menurut zona SESI: di laptop yang berzona WIB ia
    -- benar, di Supabase yang berjalan UTC ia menyimpan 07:00 UTC — 14:00 WIB.
    -- Produksi sempat memuat seluruh keberangkatan tujuh jam meleset karena
    -- ini, dan migrasi 0056 lahir dari kekeliruan yang sama persis.
    perform berangkatkan_kloter(
      v_kloter.nomor,
      (v_e.tanggal_lomba + v_e.jam_mulai_berangkat
       + make_interval(mins => v_i * v_e.interval_berangkat_menit))
      at time zone 'Asia/Jakarta');

    -- Berapa pos yang sudah dilewati kloter ini. Yang berangkat pertama sudah
    -- melewati semuanya; yang terakhir baru satu.
    v_pos_selesai := greatest(1,
      v_jml_pos - floor(v_i::numeric * v_jml_pos / greatest(v_kloter_berangkat, 1))::int);

    for v_pos in
      select distinct pos from wahana where edisi = v_e.nomor order by pos
    loop
      exit when v_pos.pos > v_pos_selesai;
      select jsonb_agg(jsonb_build_object(
               'nomor_dada', d.nomor_dada,
               'kode', w.kode,
               -- Nilai mentah dibangkitkan dari ARTI komponennya, bukan dari
               -- rentang validasinya. Rentang validasi memang sengaja longgar
               -- — `menaksir` berbatas 99.999.999,99 supaya isian sah apa pun
               -- diterima — dan mengacak di dalamnya melahirkan selisih taksir
               -- puluhan juta meter. Semaphore pun jadi 4,85 padahal ia
               -- HITUNGAN huruf benar dari 5, bukan ukuran.
               --
               -- Semuanya bulat: di edisi ini tidak ada satu pun komponen yang
               -- nilai mentahnya pecahan — hitungan benar, skor juri, dan
               -- detik.
               'nilai_1', case
                 when w.form = 'biner' then (random() < 0.75)::int::numeric
                 -- besar_baik/kecil_baik: antara terburuk dan terbaik, condong
                 -- ke atas. Papan yang semua regunya biasa saja tidak
                 -- memperlihatkan jarak antar juara.
                 when w.form in ('besar_baik', 'kecil_baik') then
                   round(least(w.raw_terbaik, w.raw_terburuk)
                     + (0.35 + 0.65 * random())
                       * abs(w.raw_terbaik - w.raw_terburuk))
                 when w.form = 'benar_per_total' then
                   floor(random() * (coalesce(w.total_soal, 10) + 1))
                 -- bertingkat: tangganya yang menentukan rentang yang berarti.
                 -- Tingkat penutup berbatas sangat besar (100000) dilewati —
                 -- ia penampung, bukan target. Sedikit di ATAS tingkat terakhir
                 -- yang nyata supaya ada juga regu yang kebagian 0.
                 when w.form = 'bertingkat' then (
                   select case when w.satuan = 'detik'
                     -- durasi: tidak ada yang selesai dalam nol detik
                     then floor(b * 0.4 + random() * b * 0.9)
                     else floor(random() * (b * 1.25 + 1))
                   end
                   from (select max((t->>'sampai')::numeric) b
                           from jsonb_array_elements(w.tingkat) t
                          where (t->>'sampai')::numeric < 1000) x)
                 else round(w.rentang_mentah_min
                            + random() * (w.rentang_mentah_maks - w.rentang_mentah_min))
               end,
               'nilai_2', null))
        into v_baris
        from (select nomor_dada from regu
               where kloter_nomor = v_kloter.nomor and nomor_dada is not null
                 and not is_cancelled) d
       cross join (select * from wahana where edisi = v_e.nomor and pos = v_pos.pos) w;
      if v_baris is not null then
        perform simpan_nilai_massal(v_baris, 'manual', v_pos.pos);
      end if;
    end loop;

    -- Hanya yang sudah melewati SELURUH pos yang sampai garis finish. Sisanya
    -- masih di jalan, dan itulah yang membuat kolom Kedatangan bergerak.
    if v_pos_selesai >= v_jml_pos then
      for v_regu in
        select r.nomor_dada, r.kontrak_menit, kl.jam_berangkat
          from regu r join kloter kl on kl.nomor = r.kloter_nomor
         where r.kloter_nomor = v_kloter.nomor and r.nomor_dada is not null
           and not r.is_cancelled and kl.jam_berangkat is not null
      loop
        perform catat_closing(
          v_regu.nomor_dada,
          v_regu.jam_berangkat
            + make_interval(mins => coalesce(v_regu.kontrak_menit, 240)
                                    + (random() * 37 - 12)::int),
          5::smallint, null);
      end loop;
    end if;

    v_i := v_i + 1;
  end loop;

  select count(*) into v_n from keberangkatan_regu;
  raise notice '3. berangkat: % regu', v_n;
  select count(*) into v_n from nilai_mentah;
  raise notice '4. nilai: % baris', v_n;
  select count(*) into v_n from closing_regu;
  raise notice '5. sudah sampai: % regu', v_n;

  select count(*) into v_n from v_klasemen_live_score;
  raise notice 'klasemen: % baris. fase_live TIDAK diubah.', v_n;
end $$;
