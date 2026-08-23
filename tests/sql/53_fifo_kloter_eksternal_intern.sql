-- ============================================================================
-- 0092: FIFO, kuota 5 Eksternal + 3 Intern, manual tanpa batas, dan 60 kloter.
-- ============================================================================

do $blok$
declare
  v_sekolah uuid;
  v_daftar uuid;
  v_daftar_lewat uuid;
  v_regu uuid;
  v_regu_lewat uuid;
  v_pasangan jsonb := '[]'::jsonb;
  v_nomor int;
  v_nomor_lewat int;
  v_i int;
  v_jumlah int;
  v_pindah int;
  v_k1 timestamptz;
  v_k2 timestamptz;
  v_k60 timestamptz;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  assert (select maks_eksternal_per_kloter = 5 and maks_intern_per_kloter = 3
          from edisi where is_active),
         'kuota otomatis bukan 5 Eksternal + 3 Intern';
  assert (select kloter_maks >= 60 from edisi where is_active),
         '300 Eksternal membutuhkan sedikitnya 60 kloter';
  assert (select count(*) from kloter where nomor between 1 and 60) = 60,
         'baris kloter 1-60 belum lengkap';

  -- Kosongkan penempatan fixture agar urutan FIFO bisa dibuktikan tepat.
  update kloter set jam_berangkat = null, dicetak_pada = null;
  update regu set kloter_nomor = null, urutan_kloter = null, nomor_dada = null
  where not is_cancelled;

  insert into sekolah (name, address)
  values ('Sekolah Uji FIFO 0092', 'Ciamis') returning id into v_sekolah;
  insert into pendaftaran
    (sekolah_id, kode_pembayaran, jumlah_regu, kontak_wa, status)
  values (v_sekolah, 'UJI-FIFO-0092', 13, '081200000092', 'lunas')
  returning id into v_daftar;

  -- Delapan Eksternal lalu lima Intern dalam satu transaksi. Urutan nama
  -- sengaja memastikan Eksternal diproses lebih dahulu; kuota tiap jenis tetap
  -- harus menghasilkan K1=5+3 dan K2=3+2.
  for v_i in 1..13 loop
    insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
    values (v_daftar, format('%s %s', case when v_i <= 8 then 'A Ext' else 'B Intern' end,
                    chr(64 + v_i)),
            'Ketua Uji', case when v_i <= 8 then 'penggalang_pa' else 'intern_pa' end)
    returning id into v_regu;
    select min(s.nomor) into v_nomor from nomor_dada_stok s
    where not exists (select 1 from regu r where r.nomor_dada = s.nomor)
      and not exists (select 1 from jsonb_array_elements(v_pasangan) x
                      where (x ->> 'nomor_dada')::int = s.nomor)
      and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);
    v_pasangan := v_pasangan || jsonb_build_array(
      jsonb_build_object('regu_id', v_regu, 'nomor_dada', v_nomor));
  end loop;

  perform * from daftar_ulang_batch('UJI-FIFO-0092', v_pasangan);
  select count(*) into v_jumlah from regu r where r.pendaftaran_id = v_daftar
    and r.kloter_nomor = 1 and r.golongan not like 'intern_%';
  assert v_jumlah = 5, format('K1 berisi %s Eksternal, seharusnya 5', v_jumlah);
  select count(*) into v_jumlah from regu r where r.pendaftaran_id = v_daftar
    and r.kloter_nomor = 1 and r.golongan like 'intern_%';
  assert v_jumlah = 3, format('K1 berisi %s Intern, seharusnya 3', v_jumlah);
  select count(*) into v_jumlah from regu r where r.pendaftaran_id = v_daftar
    and r.kloter_nomor = 2;
  assert v_jumlah = 5, format('sisa FIFO di K2 berjumlah %s, seharusnya 5', v_jumlah);

  -- K2 masih punya slot Eksternal, tetapi sudah berangkat. Fungsi TERBARU
  -- harus melewatinya saat menempatkan otomatis dan tetap membolehkan petugas
  -- memindahkan regu ke sana secara manual bila itulah kejadian lapangannya.
  update kloter set jam_berangkat = timestamptz '2026-08-29 07:05+07'
  where nomor = 2;
  insert into pendaftaran
    (sekolah_id, kode_pembayaran, jumlah_regu, kontak_wa, status)
  values (v_sekolah, 'UJI-LEWAT-0092', 1, '081200000093', 'lunas')
  returning id into v_daftar_lewat;
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  values (v_daftar_lewat, 'C Ext Lewat', 'Ketua Uji', 'penggalang_pa')
  returning id into v_regu_lewat;
  select min(s.nomor) into v_nomor_lewat from nomor_dada_stok s
  where not exists (select 1 from regu r where r.nomor_dada = s.nomor)
    and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);

  perform * from daftar_ulang_batch(
    'UJI-LEWAT-0092',
    jsonb_build_array(jsonb_build_object(
      'regu_id', v_regu_lewat, 'nomor_dada', v_nomor_lewat))
  );
  assert (select kloter_nomor = 3 from regu where id = v_regu_lewat),
         'otomatis memasukkan regu ke K2 yang sudah berangkat';

  perform pindah_kloter(v_nomor_lewat, 'uji manual ke kloter berangkat', 2::smallint);
  assert (select kloter_nomor = 2 from regu where id = v_regu_lewat),
         'pemindahan manual ke kloter berangkat ikut ditolak';
  -- Pulihkan fixture untuk tes gerbang berikutnya; test ini hanya membutuhkan
  -- K2 berstatus berangkat selama dua assertion di atas.
  update kloter set jam_berangkat = null where nomor = 2;

  -- Set manual ke K1 boleh melewati jumlah otomatis 8.
  select nomor_dada into v_pindah from regu
  where pendaftaran_id = v_daftar and kloter_nomor = 2 limit 1;
  perform pindah_kloter(v_pindah, 'uji manual tanpa batas', 1::smallint);
  select count(*) into v_jumlah from regu where kloter_nomor = 1 and not is_cancelled;
  assert v_jumlah = 9, format('set manual berhenti pada %s regu, seharusnya boleh 9', v_jumlah);
  assert (select max(urutan_kloter) from regu where kloter_nomor = 1) > 8,
         'urutan kloter masih membatasi kapasitas otomatis';

  select perkiraan_berangkat_kloter(1), perkiraan_berangkat_kloter(2),
         perkiraan_berangkat_kloter(60) into v_k1, v_k2, v_k60;
  assert (v_k1 at time zone 'Asia/Jakarta')::time = time '07:00',
         format('perkiraan K1 bukan 07:00: %s', v_k1);
  assert (v_k60 at time zone 'Asia/Jakarta')::time = time '10:00',
         format('perkiraan K60 bukan 10:00: %s', v_k60);
  assert extract(epoch from (v_k2 - v_k1)) between 182 and 184,
         format('jarak K1-K2 bukan sekitar 3 menit: %s detik', extract(epoch from (v_k2-v_k1)));

  update kloter set jam_berangkat = timestamptz '2026-08-29 07:30+07' where nomor = 1;
  assert (select distinct perkiraan_berangkat = v_k1
          from v_daftar_kloter where kloter = 1),
         'perkiraan di kertas berubah menjadi jam nyata';

  raise notice '53: FIFO 5+3, lewati kloter berangkat, manual tanpa batas, dan perkiraan 60 kloter teruji.';
end $blok$;

\echo '53 FIFO kloter Eksternal/Intern: LULUS'
