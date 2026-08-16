-- ============================================================================
-- hrcd-rekap : tests/sql/23_perkiraan_zona_wib.sql
-- Perkiraan jam berangkat berdiri di WIB, bukan di zona sesi database (0056).
--
-- Yang dijaga: jam dinding yang dibaca panitia. `jam_mulai_berangkat` = 07:00
-- harus terbaca 07:00 di Tasikmalaya, apa pun zona yang dipakai server saat
-- query dijalankan.
--
-- Tes ini SENGAJA dijalankan dua kali dengan timezone sesi berbeda. Versi
-- lama lulus kalau sesinya kebetulan Asia/Jakarta dan gagal di UTC — dan
-- produksi berjalan di UTC, jadi menguji satu zona saja adalah cara cacat ini
-- lolos untuk kedua kalinya.
-- ============================================================================

do $$
declare
  v_tanggal date;
  v_mulai   time;
  v_interval int;
  v_jam     time;
  v_nomor   int;
  v_zona    text;
begin
  select tanggal_lomba, jam_mulai_berangkat, interval_berangkat_menit
    into v_tanggal, v_mulai, v_interval
  from edisi where is_active;

  assert v_tanggal is not null, 'tidak ada edisi aktif';

  -- Kloter harus ada supaya viewnya menghasilkan baris.
  if not exists (select 1 from v_keberangkatan) then
    raise notice '23: tidak ada kloter di edisi aktif — tes dilewati';
    return;
  end if;

  foreach v_zona in array array['UTC', 'Asia/Jakarta', 'America/New_York'] loop
    execute format('set local timezone = %L', v_zona);

    select nomor, (perkiraan_berangkat at time zone 'Asia/Jakarta')::time
      into v_nomor, v_jam
    from v_keberangkatan order by nomor limit 1;

    assert v_jam is not null, format('perkiraan kosong di zona %s', v_zona);

    -- Dicocokkan PERSIS, bukan sekadar "kelipatan interval". Pergeseran tujuh
    -- jam kebetulan habis dibagi interval 4 menit (25200 / 240 = 105), jadi
    -- uji kelipatan meloloskan justru cacat yang dicari.
    assert v_jam = v_mulai + make_interval(mins => v_interval * (v_nomor - 1)),
      format('kloter %s: perkiraan %s, seharusnya %s (zona sesi %s) — '
             'selisihnya adalah pergeseran zona',
             v_nomor, v_jam,
             v_mulai + make_interval(mins => v_interval * (v_nomor - 1)),
             v_zona);
  end loop;

  reset timezone;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kertas barak membaca rumus yang sama dan harus sepakat dengan papan. Kalau
-- keduanya berbeda, petugas garis start dan petugas barak merencanakan pagi
-- yang berlainan.
-- ---------------------------------------------------------------------------
do $$
declare v_papan timestamptz; v_kertas timestamptz; v_kloter int;
begin
  set local timezone = 'UTC';

  select kloter into v_kloter
  from v_daftar_kloter
  where jam_berangkat is null
  order by kloter limit 1;

  if v_kloter is null then
    raise notice '23: semua kloter sudah berangkat — perbandingan dilewati';
    return;
  end if;

  select perkiraan_berangkat into v_papan
  from v_keberangkatan where nomor = v_kloter;

  select distinct perkiraan_berangkat into v_kertas
  from v_daftar_kloter where kloter = v_kloter;

  assert v_papan = v_kertas,
    format('papan %s dan kertas %s tidak sepakat untuk kloter %s',
           v_papan, v_kertas, v_kloter);

  reset timezone;
end;
$$;
