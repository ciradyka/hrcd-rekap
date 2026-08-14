-- ============================================================================
-- hrcd-rekap : tests/sql/03_alur.sql
-- Alur lengkap lewat RPC + RLS + kecocokan mesin skor dengan contoh di
-- docs/rancangan-b.md. Identitas berpindah lewat app.uid + set role.
-- Hasil submit disimpan di tabel bantu uji_kode (psql tidak menginterpolasi
-- variabel di dalam dollar-quote).
-- ============================================================================

\echo '== 03: alur lengkap =='

create table uji_kode (label text primary key, hasil jsonb);
grant all on uji_kode to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3.1 Pendaftaran (jalur gateway Worker = service_role).
--     A: 12 regu penegak_pa, butuh barak. B: 5 regu penegak_pa, butuh barak.
--     C: 2 regu penegak_pi (uji tie-break). D: 1 regu (uji pembatalan).
-- ---------------------------------------------------------------------------

set role service_role;

insert into uji_kode values ('A', submit_pendaftaran(
  'SMAN 1 Ciamis', 'Jl. Gunung Galuh 37', true, '081200000001',
  (select jsonb_agg(jsonb_build_object(
     'nama_regu', format('Regu A%s', lpad(i::text, 2, '0')),
     'nama_ketua', format('Ketua A%s', i),
     'golongan', 'penegak_pa'))
   from generate_series(1, 12) i)));

insert into uji_kode values ('B', submit_pendaftaran(
  'SMAN 2 Banjar', 'Jl. Raya Banjar 2', true, '081200000002',
  (select jsonb_agg(jsonb_build_object(
     'nama_regu', format('Regu B%s', lpad(i::text, 2, '0')),
     'nama_ketua', format('Ketua B%s', i),
     'golongan', 'penegak_pa'))
   from generate_series(1, 5) i)));

insert into uji_kode values ('C', submit_pendaftaran(
  'SMAN 3 Tasikmalaya', 'Jl. Siliwangi 3', false, '081200000003',
  '[{"nama_regu":"Cendrawasih 1","nama_ketua":"Ketua C1","golongan":"penegak_pi"},
    {"nama_regu":"Cendrawasih 2","nama_ketua":"Ketua C2","golongan":"penegak_pi"}]'));

insert into uji_kode values ('D', submit_pendaftaran(
  'SMP Uji Batal', 'Jl. Batal 1', false, '081200000004',
  '[{"nama_regu":"Regu D01","nama_ketua":"Ketua D1","golongan":"penggalang_pa"}]'));

do $$
declare v jsonb;
begin
  select hasil into strict v from uji_kode where label = 'A';
  assert v ->> 'jumlah_regu' = '12', 'jumlah regu A salah';
  assert (v ->> 'total_tagihan')::int = 12 * 250000, 'tagihan A salah';
  assert v ->> 'kode_pembayaran' like 'HRCD37-%', 'format kode salah';

  -- Validasi server menolak golongan liar (walau form sudah memvalidasi).
  begin
    perform submit_pendaftaran('X', 'X', false, '0812000000xx',
      '[{"nama_regu":"X","nama_ketua":"X","golongan":"dewasa"}]');
    raise exception 'GAGAL: golongan liar diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  -- IDEMPOTENSI (temuan review tahap 2): kiriman ulang dengan kunci yang
  -- sama — sinyal putus lalu pendaftar menekan Kirim lagi — TIDAK boleh
  -- melahirkan batch kedua.
  declare
    v1 jsonb; v2 jsonb; v_kunci uuid := gen_random_uuid();
  begin
    v1 := submit_pendaftaran('SMP Uji Idem', 'Jl. Idem 1', false, '081200009999',
      '[{"nama_regu":"Idem","nama_ketua":"Idem","golongan":"penegak_pa"}]',
      0::smallint, v_kunci);
    v2 := submit_pendaftaran('SMP Uji Idem', 'Jl. Idem 1', false, '081200009999',
      '[{"nama_regu":"Idem","nama_ketua":"Idem","golongan":"penegak_pa"}]',
      0::smallint, v_kunci);
    assert v1 ->> 'kode_pembayaran' = v2 ->> 'kode_pembayaran',
           'kiriman ulang melahirkan kode kedua';
    assert (v2 ->> 'terkirim_ulang') = 'true', 'kiriman ulang tidak ditandai';
    assert (select count(*) from pendaftaran where kunci_kirim = v_kunci) = 1,
           'ada dua batch untuk satu kunci kirim';
  end;
end;
$$;

reset role;

-- Fungsi bantu pengambil kode — dipakai semua blok berikutnya.
create function uji(p text) returns text language sql as
  $$ select hasil ->> 'kode_pembayaran' from uji_kode where label = p $$;
grant execute on function uji(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3.2 Pembayaran (meja). Nominal kurang = tolak (semua-atau-tidak).
-- ---------------------------------------------------------------------------

select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;

do $$
begin
  -- daftar ulang sebelum lunas: tolak
  begin
    perform daftar_ulang_batch(uji('A'), uji_dada(uji('A')));
    raise exception 'GAGAL: daftar ulang sebelum lunas diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
  -- bayar sebagian: tolak
  begin
    perform verifikasi_pembayaran(uji('A'), 250000 * 3, 'transfer');
    raise exception 'GAGAL: pembayaran sebagian diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
  -- bayar penuh: jalan, kwitansi terbit
  assert (verifikasi_pembayaran(uji('A'), 250000 * 12, 'transfer')) ->> 'nomor_kwitansi'
         like 'KW-HRCD37-%', 'kwitansi tidak terbit';
  -- verifikasi dobel: tolak
  begin
    perform verifikasi_pembayaran(uji('A'), 250000 * 12, 'transfer');
    raise exception 'GAGAL: verifikasi dobel diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  perform verifikasi_pembayaran(uji('B'), 250000 * 5, 'tunai');
  perform verifikasi_pembayaran(uji('C'), 250000 * 2, 'transfer');
  perform verifikasi_pembayaran(uji('D'), 250000 * 1, 'tunai');

  -- Batalkan verifikasi D (salah pencet) — status kembali menunggu.
  perform batalkan_verifikasi(uji('D'), 'salah klik saat uji');
  assert (select status from pendaftaran where kode_pembayaran = uji('D'))
         = 'menunggu_pembayaran', 'status D tidak kembali';
  assert not exists (select 1 from pembayaran b
          join pendaftaran d on d.id = b.pendaftaran_id
          where d.kode_pembayaran = uji('D')), 'pembayaran D masih ada';

  -- Akun login TIDAK bisa memanggil submit_pendaftaran — hanya gateway
  -- Worker (temuan review, blocker).
  begin
    perform submit_pendaftaran('Selundup', 'X', false, '0812999',
      '[{"nama_regu":"S","nama_ketua":"S","golongan":"penegak_pa"}]');
    raise exception 'GAGAL: submit_pendaftaran terbuka untuk akun login';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3.3 Daftar ulang batch: nomor dada + kloter sekaligus.
-- ---------------------------------------------------------------------------

do $$
declare v_a uuid;
begin
  perform daftar_ulang_batch(uji('A'), uji_dada(uji('A')));
  perform daftar_ulang_batch(uji('B'), uji_dada(uji('B')));
  perform daftar_ulang_batch(uji('C'), uji_dada(uji('C')));

  select d.id into v_a from pendaftaran d where d.kode_pembayaran = uji('A');

  -- A: 12 nomor pertama, kloter semua berbeda & ganjil (lompatan 2), <= 30.
  assert (select array_agg(nomor_dada order by nomor_dada)
          from regu where pendaftaran_id = v_a)
         = array[1,2,3,4,5,6,7,8,9,10,11,12], 'dada A bukan 1..12';
  assert (select count(distinct kloter_nomor) from regu where pendaftaran_id = v_a) = 12,
         'sekolah A menumpuk di satu kloter';
  assert (select bool_and(kloter_nomor % 2 = 1) from regu where pendaftaran_id = v_a),
         'lompatan 2 tidak dihormati untuk A';
  assert (select max(kloter_nomor) from regu where pendaftaran_id = v_a) <= 30,
         'A menyentuh kloter cadangan padahal 1-30 belum penuh';
  -- B: tak ada dua regu B sekloter.
  assert (select count(distinct r.kloter_nomor) = count(*)
          from regu r join pendaftaran d on d.id = r.pendaftaran_id
          where d.kode_pembayaran = uji('B')), 'sekolah B menumpuk';
  -- Daftar ulang dobel: tolak.
  begin
    perform daftar_ulang_batch(uji('A'), uji_dada(uji('A')));
    raise exception 'GAGAL: daftar ulang dobel diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  -- Batalkan verifikasi SETELAH daftar ulang: tolak keras (temuan review —
  -- mencegah regu yatim bernomor-dada-tapi-belum-bayar).
  begin
    perform batalkan_verifikasi(uji('C'), 'coba-coba');
    raise exception 'GAGAL: batalkan verifikasi setelah daftar ulang diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  -- Tukar nomor dada (nomor rusak): 17 -> 250. Nomor 17 PENSIUN dan tidak
  -- pernah terbit ulang (temuan review: foto lama masih menulis 17).
  perform tukar_nomor_dada((select id from regu where nomor_dada = 17), 250,
                           'nomor sobek saat uji');
  assert exists (select 1 from regu where nomor_dada = 250), 'tukar nomor gagal';
  assert exists (select 1 from nomor_dada_pensiun where nomor = 17),
         'nomor lama tidak pensiun';

  -- Sekolah D menyusul: nomor berikutnya harus MELOMPATI 17 yang pensiun.
  perform verifikasi_pembayaran(uji('D'), 250000, 'tunai');
  perform daftar_ulang_batch(uji('D'), uji_dada(uji('D')));
  assert (select r.nomor_dada from regu r
          join pendaftaran d on d.id = r.pendaftaran_id
          where d.kode_pembayaran = uji('D')) = 20,
         'nomor pensiun 17 terbit ulang (atau urutan stok salah)';
end;
$$;

-- Saklar tutup daftar ulang menghentikan meja.
reset role;
update status_acara set daftar_ulang_ditutup = true;
set role authenticated;
do $$
begin
  begin
    perform daftar_ulang_batch(uji('D'), uji_dada(uji('D')));
    raise exception 'GAGAL: daftar ulang tembus saat ditutup';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;
reset role;
update status_acara set daftar_ulang_ditutup = false;
set role authenticated;

-- ---------------------------------------------------------------------------
-- 3.4 Garis start. Kloter 1 = dada 1 (A), 13 (B), 18 (C1); kloter 3 = dada
--     2, 14, 19 (C2). Kontrak wajib sebelum berangkat; jam DIKETIK.
-- ---------------------------------------------------------------------------

do $$
begin
  perform ceklis_berangkat(1);
  perform ceklis_berangkat(13);
  perform ceklis_berangkat(18);

  -- Belum ada kontrak -> berangkat ditolak.
  begin
    perform berangkatkan_kloter(1::smallint, timestamptz '2027-02-21 07:00+07');
    raise exception 'GAGAL: berangkat tanpa kontrak diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
  -- Kontrak di luar pilihan edisi -> tolak.
  begin
    perform konfirmasi_kontrak((select id from regu where nomor_dada = 1), 300::smallint);
    raise exception 'GAGAL: kontrak liar diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  perform konfirmasi_kontrak((select id from regu where nomor_dada = 1),  240::smallint);
  perform konfirmasi_kontrak((select id from regu where nomor_dada = 13), 240::smallint);
  perform konfirmasi_kontrak((select id from regu where nomor_dada = 18), 240::smallint);
  perform berangkatkan_kloter(1::smallint, timestamptz '2027-02-21 07:00+07');

  -- Kloter 3: hanya C2 (dada 19) — jalur no-show untuk A02/B02.
  perform ceklis_berangkat(19);
  perform konfirmasi_kontrak((select id from regu where nomor_dada = 19), 240::smallint);
  perform berangkatkan_kloter(3::smallint, timestamptz '2027-02-21 07:08+07');

  -- Papan turunan: setelah kloter 3 berangkat -> 5 siap, 7 menunggu.
  assert (select posisi from v_keberangkatan where nomor = 5) = 'siap',
         'kloter 5 seharusnya siap';
  assert (select posisi from v_keberangkatan where nomor = 7) = 'menunggu',
         'kloter 7 seharusnya menunggu';

  -- Berangkat dobel & jam kosong: tolak.
  begin
    perform berangkatkan_kloter(1::smallint, timestamptz '2027-02-21 07:30+07');
    raise exception 'GAGAL: berangkat dobel diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
  begin
    perform berangkatkan_kloter(5::smallint, null);
    raise exception 'GAGAL: jam kosong diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
  -- Melompati kloter berisi regu yang belum berangkat: tolak (temuan review
  -- — satu ketukan salah merusak papan turunan).
  begin
    perform berangkatkan_kloter(7::smallint, timestamptz '2027-02-21 07:20+07');
    raise exception 'GAGAL: lompat kloter diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  -- Ceklis MENYUSUL (kloter 3 sudah berangkat): dada 14 belum berkontrak —
  -- ceklis ditolak sampai kontrak diisi admin (temuan review, blocker:
  -- tanpa ini regu lolos penalti waktu selamanya).
  begin
    perform ceklis_berangkat(14);
    raise exception 'GAGAL: ceklis menyusul tanpa kontrak diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
  -- Prasyarat dibuat EKSPLISIT, tidak diwarisi dari langkah di atas: aturan
  -- 0018 berbicara tentang catatan berangkat REGU ini, jadi tesnya harus
  -- memastikan catatan itu memang tidak ada. Sekaligus membuktikan jalur
  -- pemulihan salah klik: meja boleh menghapus centang kapan pun.
  -- SEJAK 0018: meja BOLEH mengisi kontrak regu yang KETINGGALAN — kloternya
  -- sudah jalan, tapi regu ini tidak ikut. Aturan lama memakai patokan kloter
  -- saja, sehingga regu itu tidak bisa ditolong siapa pun di meja: kontrak
  -- ditolak, lalu ceklis ditolak karena tidak berkontrak.
  perform konfirmasi_kontrak((select id from regu where nomor_dada = 14), 240::smallint);
  assert (select kontrak_menit from regu where nomor_dada = 14) = 240,
    'meja tidak bisa mengisi kontrak regu yang tertinggal';
end;
$$;

-- Kontrak sudah terisi, ceklis susulan jalan — dan meja tidak berhak lagi.
select ceklis_berangkat(14);

do $$
begin
  -- Sekarang dada 14 dicentang DAN kloternya sudah jalan — barulah ia terhitung
  -- berangkat, dan kontraknya menentukan penalti yang sudah berjalan: koreksi
  -- hanya lewat admin (0018). Centang saja tidak pernah cukup; kalau cukup,
  -- alur meja yang biasa (centang dulu, pilih kontrak sesudahnya) ikut terkunci.
  begin
    perform konfirmasi_kontrak((select id from regu where nomor_dada = 14), 210::smallint);
    raise exception 'GAGAL: meja mengubah kontrak regu yang sudah tercatat berangkat';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;

-- Admin tetap boleh membetulkannya.
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
select konfirmasi_kontrak((select id from regu where nomor_dada = 14), 240::smallint);
select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);

-- ---------------------------------------------------------------------------
-- 3.5 Input nilai. RLS pos harus menggigit.
-- ---------------------------------------------------------------------------

select set_config('app.uid', '00000000-0000-0000-0000-000000000001', false);

do $$
declare v jsonb; v_history int;
begin
  -- pos1: satu paste berisi baris sah + semua jenis baris bermasalah.
  v := simpan_nilai_massal('[
    {"nomor_dada": 1,    "kode": "lari_zigzag",    "nilai_1": 40},
    {"nomor_dada": 18,   "kode": "lari_zigzag",    "nilai_1": 40},
    {"nomor_dada": 19,   "kode": "lari_zigzag",    "nilai_1": 40},
    {"nomor_dada": 9999, "kode": "lari_zigzag",    "nilai_1": 40},
    {"nomor_dada": 1,    "kode": "lari_zigzag",    "nilai_1": 400},
    {"nomor_dada": 1,    "kode": "lempar_sasaran", "nilai_1": 3},
    {"nomor_dada": 18,   "kode": "Lari Zigzag",    "nilai_1": 40},
    {"nomor_dada": 20,   "kode": "lari_zigzag",    "nilai_1": "abc"}
  ]'::jsonb, 'upload');
  assert v -> 0 ->> 'status' = 'tersimpan', 'baris sah 1: ' || coalesce(v -> 0 ->> 'alasan', '?');
  assert v -> 1 ->> 'status' = 'tersimpan', 'baris sah 2 gagal';
  assert v -> 2 ->> 'status' = 'tersimpan', 'baris sah 3 gagal';
  assert v -> 3 ->> 'status' = 'ditolak'
     and v -> 3 ->> 'alasan' like '%tidak dikenal%', 'dada liar lolos';
  -- catatan: baris 5 (dada 1, 400) tertangkap sebagai baris ganda lebih dulu
  -- (dada 1 + lari_zigzag sudah muncul di baris 1) — tetap ditolak.
  assert v -> 4 ->> 'status' = 'ditolak', 'baris ganda/di luar rentang lolos';
  assert v -> 5 ->> 'status' = 'ditolak'
     and v -> 5 ->> 'alasan' like '%pos%', 'komponen pos lain lolos di pos 1';
  -- "Lari Zigzag" ternormalisasi = lari_zigzag -> ganda terhadap baris 2.
  assert v -> 6 ->> 'status' = 'ditolak'
     and v -> 6 ->> 'alasan' like '%ganda%', 'normalisasi header tidak jalan';
  -- Format angka rusak menolak BARISNYA SAJA, bukan seluruh paste.
  assert v -> 7 ->> 'status' = 'ditolak', 'format rusak lolos';

  -- Tembak tabel langsung: kini tertutup untuk SEMUA non-admin.
  begin
    insert into nilai_mentah (regu_id, wahana_id, nilai_1, source, created_by)
    values ((select id from regu where nomor_dada = 1),
            (select id from wahana where kode = 'lari_zigzag'),
            3, 'manual', auth.uid());
    raise exception 'GAGAL: tulisan langsung ke nilai_mentah tembus';
  exception when insufficient_privilege then null;
  end;

  -- pos1 hanya melihat nilai pos-nya sendiri.
  assert not exists (
    select 1 from nilai_mentah n join wahana w on w.id = n.wahana_id
    where w.pos <> 1), 'pos1 melihat nilai pos lain';

  -- Timpa nilai (kuning yang disetujui): 40 -> 45 -> 40; lalu simpan ulang
  -- nilai yang sama TIDAK menulis apa pun (riwayat tidak banjir).
  perform simpan_nilai_massal('[{"nomor_dada":1,"kode":"lari_zigzag","nilai_1":45}]'::jsonb, 'manual');
  perform simpan_nilai_massal('[{"nomor_dada":1,"kode":"lari_zigzag","nilai_1":40}]'::jsonb, 'manual');
  select count(*) into v_history from history where table_name = 'nilai_mentah';
  perform simpan_nilai_massal('[{"nomor_dada":1,"kode":"lari_zigzag","nilai_1":40}]'::jsonb, 'manual');
  assert (select count(*) from history where table_name = 'nilai_mentah') = v_history,
         'simpan ulang tanpa perubahan membanjiri riwayat';
end;
$$;

-- pos2 mengisi lempar; admin mengisi pos 3-5 dengan p_pos eksplisit.
select set_config('app.uid', '00000000-0000-0000-0000-000000000002', false);
select simpan_nilai_massal('[{"nomor_dada":1,"kode":"lempar_sasaran","nilai_1":3}]'::jsonb, 'upload');

select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
select simpan_nilai_massal('[{"nomor_dada":1,"kode":"impk","nilai_1":1}]'::jsonb,      'upload', 3::smallint);
select simpan_nilai_massal('[{"nomor_dada":1,"kode":"soal_umum","nilai_1":7}]'::jsonb, 'upload', 4::smallint);
select simpan_nilai_massal('[{"nomor_dada":1,"kode":"sandi_morse","nilai_1":8,"nilai_2":3}]'::jsonb, 'upload', 5::smallint);

do $$
declare v jsonb;
begin
  -- Admin tanpa p_pos: tolak.
  begin
    perform simpan_nilai_massal('[{"nomor_dada":1,"kode":"impk","nilai_1":1}]'::jsonb, 'upload');
    raise exception 'GAGAL: admin tanpa p_pos diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
  -- nilai_2 di luar rentang: tolak (temuan review).
  -- Kalimatnya menyebut "Jumlah salah", bukan nama kolomnya: sejak migrasi
  -- 0029 pesan galat ditulis untuk operator, bukan untuk yang membaca skema
  -- (`nilai_2` tidak pernah muncul di kertas mana pun).
  v := simpan_nilai_massal('[{"nomor_dada":1,"kode":"sandi_morse","nilai_1":8,"nilai_2":99}]'::jsonb,
                           'upload', 5::smallint);
  assert v -> 0 ->> 'status' = 'ditolak'
     and v -> 0 ->> 'alasan' like 'Jumlah salah harus antara%',
     'nilai_2 liar lolos: ' || coalesce(v -> 0 ->> 'alasan', '(tanpa alasan)');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3.6 Closing: jam DIKETIK, upsert = edit sah; wajib sudah berangkat.
-- ---------------------------------------------------------------------------

select set_config('app.uid', '00000000-0000-0000-0000-0000000000b2', false);

do $$
begin
  begin
    perform catat_closing(2, timestamptz '2027-02-21 11:00+07', 5::smallint, null);
    raise exception 'GAGAL: closing regu belum berangkat diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  -- Tulisan langsung ke closing (memalsukan pencatat / melompati guard):
  -- tertutup untuk meja — hanya lewat catat_closing.
  begin
    insert into closing_regu (regu_id, jam_datang, recorded_by)
    values ((select id from regu where nomor_dada = 13),
            timestamptz '2027-02-21 11:00+07', auth.uid());
    raise exception 'GAGAL: tulisan langsung ke closing tembus';
  exception when insufficient_privilege then null;
  end;

  -- A1: salah ketik 11:08, dikoreksi 11:18 (upsert); 4 anggota hadir.
  perform catat_closing(1, timestamptz '2027-02-21 11:08+07', 4::smallint, null);
  perform catat_closing(1, timestamptz '2027-02-21 11:18+07', 4::smallint, 'koreksi salah ketik');
  -- C1: 11:11 (selisih 11). C2: target 11:08, datang 11:26 (selisih 18).
  -- B1 (dada 13): TIDAK checkout.
  perform catat_closing(18, timestamptz '2027-02-21 11:11+07', 5::smallint, null);
  perform catat_closing(19, timestamptz '2027-02-21 11:26+07', 5::smallint, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3.7 Mesin skor: angka harus PERSIS contoh dokumen (rancangan-b.md).
-- ---------------------------------------------------------------------------

select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);

do $$
declare t record;
begin
  -- A1: 71.43 + 60 + 50 + 70 + 65 = 316.43; -10 (18 mnt); -20 (hadir 4).
  select * into strict t from v_total_skor where nomor_dada = 1;
  assert t.total_pos = 316.43,   'total pos A1 = ' || t.total_pos || ', harusnya 316.43';
  assert t.selisih_menit = 18,   'selisih A1 = ' || t.selisih_menit || ', harusnya 18';
  assert t.penalti_waktu = 10,   'penalti waktu A1 = ' || t.penalti_waktu;
  assert t.penalti_checkout = 0, 'A1 kena -100 padahal checkout';
  assert t.penalti_anggota = 20, 'penalti anggota A1 = ' || t.penalti_anggota;
  assert t.total = 286.43,       'total A1 = ' || t.total || ', harusnya 286.43';

  -- B1: tanpa checkout -> -100; penalti waktu 0 (tak terhitung).
  select * into strict t from v_total_skor where nomor_dada = 13;
  assert t.penalti_checkout = 100, 'B1 tidak kena -100';
  assert t.penalti_waktu = 0,      'B1 kena penalti waktu padahal tak terhitung';
  assert t.total = -100,           'total B1 = ' || t.total || ', harusnya -100';

  -- Klasemen 4 golongan + tie-break presisi menit.
  assert (select peringkat from v_klasemen where nomor_dada = 1)  = 1, 'A1 bukan rank 1';
  assert (select peringkat from v_klasemen where nomor_dada = 13) = 2, 'B1 bukan rank 2';
  assert (select total from v_klasemen where nomor_dada = 18)
       = (select total from v_klasemen where nomor_dada = 19), 'C1/C2 harusnya seri';
  assert (select peringkat from v_klasemen where nomor_dada = 18) = 1,
         'tie-break gagal: C1 (|11|) harus di atas C2 (|18|)';
  -- Regu tak pernah berangkat tidak diperingkat — tanpa -100 hantu.
  assert not exists (select 1 from v_klasemen where nomor_dada = 2),
         'regu tak berangkat ikut klasemen';

  -- Riwayat merekam koreksi nilai & closing.
  assert (select count(*) from history
          where table_name = 'nilai_mentah' and action = 'UPDATE') >= 2,
         'riwayat timpa nilai tidak terekam';
  assert (select count(*) from history
          where table_name = 'closing_regu' and action = 'UPDATE') >= 1,
         'riwayat koreksi closing tidak terekam';

  -- Monitoring.
  assert (select sudah_input from v_monitoring_input where nomor_dada = 1 and pos = 1),
         'monitoring: pos 1 dada 1 harusnya sudah';
  assert not (select sudah_input from v_monitoring_input where nomor_dada = 13 and pos = 1),
         'monitoring: pos 1 dada 13 harusnya belum';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3.8 Barak: A butuh 60 (12x5); B butuh 27 (5x5 + 2 pendamping).
--     Ruangan 60 + 40: pas-dulu -> A = R40 penuh + sisa 20 di R60;
--     B menggabung di sisa R60 (terpaksa).
-- ---------------------------------------------------------------------------

do $$
begin
  perform ubah_pendamping(uji('B'), 2::smallint);
  insert into room (name, capacity) values ('Kelas X-A', 50), ('Kelas X-B', 40);
  perform susun_barak();

  assert (select sum(jumlah_orang) from penempatan_barak) = 87,
         'total penempatan barak bukan 87';
  assert not exists (select 1 from v_barak where terisi > capacity),
         'ada ruangan kelebihan muatan';
  -- A (60 orang): tidak ada ruangan tunggal yang muat -> pecah 50 + 10.
  assert (select count(*) from penempatan_barak p
          join pendaftaran d on d.id = p.pendaftaran_id
          where d.kode_pembayaran = uji('A')) = 2,
         'sekolah besar tidak terpecah dua ruangan';
  -- B (27 orang): tidak ada ruangan kosong tersisa -> gabung terpaksa di
  -- sisa Kelas X-B, TANPA terpecah (algoritma muat-dulu, temuan review).
  assert (select count(*) from penempatan_barak p
          join pendaftaran d on d.id = p.pendaftaran_id
          where d.kode_pembayaran = uji('B')) = 1,
         'sekolah kecil ikut terpecah padahal muat satu ruangan';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3.9 Batas akses: akun nonaktif buta; anon hanya sekolah; view publik
--     mengikuti fase.
-- ---------------------------------------------------------------------------

select set_config('app.uid', '00000000-0000-0000-0000-0000000000ff', false);
do $$
begin
  assert (select count(*) from regu) = 0, 'akun nonaktif masih melihat regu';
  assert (select count(*) from nilai_mentah) = 0, 'akun nonaktif masih melihat nilai';
end;
$$;

select set_config('app.uid', '', false);
reset role;
set role anon;
do $$
begin
  assert (select count(*) from sekolah) > 0, 'anon tidak bisa autocomplete sekolah';
  begin
    perform count(*) from pendaftaran;
    raise exception 'GAGAL: anon membaca pendaftaran';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from regu;
    raise exception 'GAGAL: anon membaca regu';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- Fase live bertahap (dibaca service role, seperti GitHub Actions nanti).
set role service_role;
do $$
begin
  assert (select count(*) from v_progres_publik) = 0, 'progres bocor di fase pra';
  assert (select count(*) from v_klasemen_publik) = 0, 'klasemen bocor di fase pra';
end;
$$;
reset role;
update status_acara set fase_live = 'progres';
set role service_role;
do $$
begin
  -- SELURUH regu lunas yang bernomor dada, bukan hanya yang sudah berangkat
  -- (migrasi 0026). Syarat "sudah berangkat" dibuang dengan sengaja: regu
  -- yang sedang menunggu di staging membuka halaman rekap dan tidak
  -- menemukan dirinya sama sekali, padahal justru kloter dan kontraknya yang
  -- ingin ia periksa saat itu.
  assert (select count(*) from v_progres_publik) = 20,
         'fase progres: harusnya 20 regu lunas bernomor, dapat '
         || (select count(*) from v_progres_publik);
  assert (select count(*) from v_klasemen_publik) = 0, 'klasemen bocor di fase progres';
end;
$$;
reset role;
update status_acara set fase_live = 'penuh';
set role service_role;
do $$
begin
  assert (select count(*) from v_klasemen_publik) = 5, 'fase penuh: harusnya 5 baris klasemen';
end;
$$;
reset role;

-- Lembar nilai memuat semua regu lunas bernomor: 12 + 5 + 2 + 1 = 20.
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
begin
  assert (select count(*) from v_lembar_nilai) = 20,
         'v_lembar_nilai bukan 20 baris';
end;
$$;
reset role;

\echo '== 03: OK =='
