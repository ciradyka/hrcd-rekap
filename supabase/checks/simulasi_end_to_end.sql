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

  -- ---------------------------------------------------------- 2. keberangkatan
  -- BERURUT: RPC-nya menolak kloter yang mendahului kloter sebelumnya.
  v_n := 0;
  for v_kloter in
    select distinct r.kloter_nomor nomor from regu r
     where r.kloter_nomor is not null and not r.is_cancelled
       and not exists (select 1 from kloter k
                        where k.nomor = r.kloter_nomor and k.jam_berangkat is not null)
     order by 1
  loop
    for v_dada in
      select nomor_dada from regu
       where kloter_nomor = v_kloter.nomor and nomor_dada is not null
         and not is_cancelled
         and id not in (select regu_id from keberangkatan_regu)
    loop
      perform ceklis_berangkat(v_dada);
    end loop;
    perform berangkatkan_kloter(
      v_kloter.nomor,
      (v_e.tanggal_lomba + v_e.jam_mulai_berangkat
       + make_interval(mins => v_i * v_e.interval_berangkat_menit))::timestamptz);
    v_i := v_i + 1;
    v_n := v_n + 1;
  end loop;
  raise notice '2. keberangkatan: % kloter', v_n;

  -- ------------------------------------------------------------- 3. nilai pos
  -- Rentangnya dari `wahana` — batas yang sama dengan yang divalidasi layar
  -- pos, jadi angka acak di dalamnya pasti diterima.
  v_n := 0;
  for v_pos in
    select distinct pos from wahana where edisi = v_e.nomor order by pos
  loop
    select jsonb_agg(jsonb_build_object(
             'nomor_dada', d.nomor_dada,
             'kode', w.kode,
             'nilai_1', case when w.form = 'biner' then (random() < 0.75)::int::numeric
                             else round((w.rentang_mentah_min
                                  + random() * (w.rentang_mentah_maks - w.rentang_mentah_min))::numeric, 2)
                        end,
             'nilai_2', null))
      into v_baris
      from (select r.nomor_dada from regu r
             join keberangkatan_regu k on k.regu_id = r.id
            where r.nomor_dada is not null) d
     cross join (select * from wahana where edisi = v_e.nomor and pos = v_pos.pos) w;

    if v_baris is not null then
      -- sumber 'manual' — itulah yang terjadi besok: juri mengetiknya di
      -- layar pos. Nilai lain ditolak check constraint.
      perform simpan_nilai_massal(v_baris, 'manual', v_pos.pos);
      v_n := v_n + jsonb_array_length(v_baris);
    end if;
  end loop;
  raise notice '3. nilai pos: % nilai', v_n;

  -- ------------------------------------------------------------ 4. kedatangan
  -- Jamnya diacak di sekitar kontrak waktunya sendiri supaya SEBAGIAN regu
  -- kena penalti dan sebagian tidak; papan yang semua regunya tepat waktu
  -- tidak memperlihatkan kolom penalti bekerja sama sekali.
  v_n := 0;
  for v_regu in
    select r.nomor_dada, r.kontrak_menit, kl.jam_berangkat
      from regu r
      join keberangkatan_regu k on k.regu_id = r.id
      join kloter kl on kl.nomor = r.kloter_nomor
      left join closing_regu c on c.regu_id = r.id
     where c.regu_id is null and r.nomor_dada is not null
       and kl.jam_berangkat is not null
  loop
    perform catat_closing(
      v_regu.nomor_dada,
      v_regu.jam_berangkat
        + make_interval(mins => coalesce(v_regu.kontrak_menit, 240)
                                + (random() * 37 - 12)::int),
      5::smallint, null);
    v_n := v_n + 1;
  end loop;
  raise notice '4. kedatangan: % regu', v_n;

  select count(*) into v_n from v_klasemen_live_score;
  raise notice 'klasemen: % baris. fase_live TIDAK diubah.', v_n;
end $$;
