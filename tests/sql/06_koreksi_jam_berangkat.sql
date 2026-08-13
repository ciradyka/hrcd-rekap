-- ============================================================================
-- hrcd-rekap : tests/sql/06_koreksi_jam_berangkat.sql
-- Membetulkan jam berangkat yang salah ketik (migrasi 0017).
--
-- Yang WAJIB dibuktikan: jam lamanya tercatat di history, dan koreksi TIDAK
-- terkunci oleh jam kloter tetangga. Keduanya tidak kelihatan di layar — jam
-- berangkat yang salah tidak menimbulkan galat apa pun, ia hanya muncul
-- sebagai penalti yang keliru saat klasemen keluar.
-- ============================================================================

\echo '== 06: koreksi jam berangkat =='

select set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;

-- 6.1 Alasan wajib — koreksi tanpa alasan ditolak.
do $$
declare v_kloter smallint;
begin
  select nomor into v_kloter from kloter
  where jam_berangkat is not null order by nomor limit 1;
  assert v_kloter is not null, 'tidak ada kloter berangkat untuk diuji';
  begin
    perform koreksi_jam_berangkat(v_kloter, timestamptz '2027-02-21 07:05+07', '   ');
    raise exception 'GAGAL: koreksi tanpa alasan diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;

-- 6.2 Kloter yang BELUM berangkat ditolak — itu urusan berangkatkan_kloter,
--     dan mencampurnya berarti kloter bisa "berangkat" lewat pintu yang tidak
--     memeriksa kontrak waktu maupun urutan.
do $$
declare v_kloter smallint;
begin
  select nomor into v_kloter from kloter
  where jam_berangkat is null order by nomor limit 1;
  assert v_kloter is not null, 'tidak ada kloter belum berangkat untuk diuji';
  begin
    perform koreksi_jam_berangkat(v_kloter, timestamptz '2027-02-21 07:05+07', 'salah ketik');
    raise exception 'GAGAL: koreksi kloter belum berangkat diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
end;
$$;

-- 6.3 Koreksi yang sah: jam berubah, DAN jam lamanya tersimpan di history.
--     Bagian kedua yang penting — tanpa jejak jam lama, tidak ada cara
--     memastikan penalti sebuah kloter dihitung dari angka yang benar.
do $$
declare
  v_kloter smallint;
  v_lama   timestamptz;
  v_baru   timestamptz;
  v_catat  jsonb;
begin
  select nomor, jam_berangkat into v_kloter, v_lama
  from kloter where jam_berangkat is not null order by nomor limit 1;
  v_baru := v_lama - interval '3 minutes';

  perform koreksi_jam_berangkat(v_kloter, v_baru, 'salah ketik di meja');

  assert (select jam_berangkat from kloter where nomor = v_kloter) = v_baru,
    'jam berangkat tidak berubah setelah koreksi';

  -- history hanya boleh dibaca admin (policy sel_riwayat di 0003_rls.sql),
  -- jadi identitasnya ditukar dulu — sebagai meja, select-nya kosong dan
  -- assert di bawah akan gagal dengan alasan yang menyesatkan.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
  select old_value into v_catat from history
  where table_name = 'kloter' and row_id = v_kloter::text
  order by changed_at desc limit 1;
  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
  assert v_catat is not null, 'koreksi tidak tercatat di history';
  assert (v_catat->>'jam_berangkat')::timestamptz = v_lama,
    format('history menyimpan jam lama %s, harusnya %s',
           v_catat->>'jam_berangkat', v_lama);
end;
$$;

-- 6.4 Koreksi TIDAK boleh terkunci oleh jam kloter tetangga.
--     berangkatkan_kloter hanya menjaga urutan NOMOR kloter, bukan urutan jam
--     yang diketik, jadi data yang jamnya kacau memang bisa ada. Kalau fungsi
--     ini menolak jam yang melanggar urutan, dua kloter yang sama-sama salah
--     akan saling mengunci dan tidak satu pun bisa dibetulkan — tepat di
--     keadaan yang membuat panitia membuka layar ini.
do $$
declare
  v_awal smallint; v_akhir smallint; v_jam_akhir timestamptz;
begin
  select min(nomor), max(nomor) into v_awal, v_akhir
  from kloter where jam_berangkat is not null;
  if v_awal = v_akhir then
    raise notice '6.4 dilewati: hanya satu kloter yang berangkat';
    return;
  end if;
  select jam_berangkat into v_jam_akhir from kloter where nomor = v_akhir;

  -- Kloter pertama digeser ke SETELAH kloter terakhir: harus tetap diterima.
  perform koreksi_jam_berangkat(v_awal, v_jam_akhir + interval '5 minutes',
                                'jam kloter tetangga yang salah, ini dibetulkan belakangan');
  assert (select jam_berangkat from kloter where nomor = v_awal)
         = v_jam_akhir + interval '5 minutes',
    'koreksi terkunci oleh jam kloter tetangga';
end;
$$;

-- 6.5 Operator pos tidak boleh — jam berangkat menentukan penalti seluruh
--     kloter, dan pos hanya berurusan dengan nilai wahana.
do $$
declare v_kloter smallint;
begin
  select nomor into v_kloter from kloter
  where jam_berangkat is not null order by nomor limit 1;
  perform set_config('app.uid', '00000000-0000-0000-0000-000000000001', false);
  begin
    perform koreksi_jam_berangkat(v_kloter, timestamptz '2027-02-21 07:05+07', 'coba-coba');
    raise exception 'GAGAL: operator pos bisa mengoreksi jam berangkat';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;
  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000b1', false);
end;
$$;

reset role;
\echo '   06 lulus'
