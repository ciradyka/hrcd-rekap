-- ============================================================================
-- hrcd-rekap : tests/sql/57_kelengkapan_intern.sql — migrasi 0096.
--
-- PENYEBUT KELENGKAPAN HARUS MEMAKAI ATURAN GOLONGAN YANG SAMA DENGAN
-- PENILAIAN.
--
-- Ada dua salinan aturan itu di sistem: `komponen_berlaku()` yang dipakai
-- v_lembar_pos dan simpan_nilai_massal, dan satu lagi yang dulu diketik ulang
-- di dalam `komponen_pos_golongan()`. 0091 mengubah yang pertama dan
-- melewatkan yang kedua, jadi regu Internal tidak pernah bisa terhitung lengkap
-- di pos mana pun — dan di Pos 4 dan Pos 5, tempat mereka memang tidak
-- berlomba, mereka dihitung 'kosong' selamanya lalu ikut jadi 'hilang'
-- sesudah checkout.
--
-- Yang diuji di sini bukan angkanya, melainkan KESAMAAN aturannya: penyebut
-- kelengkapan harus sama persis dengan apa yang boleh diisi juri. Tes ini
-- bersandar pada regu Internal yang dibuat tes 52.
-- ============================================================================

\echo '--- 57. penyebut kelengkapan mengikuti aturan golongan penilaian'

do $blok$
declare
  v_regu    uuid;
  v_gol     text;
  v_pos_ada smallint;   -- pos tempat regu Internal memang berlomba
  v_pos_tak smallint;   -- pos tempat ia tidak punya komponen sama sekali
  v_wajib   int;
  v_terisi  int;
  v_lengkap int;
  v_sesudah int;
  v_total   int;
  v_semua   int;
  v_intern  int;
  v_wahana  uuid;
  v_n1      numeric;
  v_n2      numeric;
  v_sumber  text;
  v_oleh    uuid;
  v_tambah  uuid[];
begin
  select r.id, r.golongan into v_regu, v_gol
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where r.golongan in ('intern_pa', 'intern_pi')
    and r.nomor_dada is not null
    and not r.is_cancelled
    and d.status = 'lunas'
  order by r.nomor_dada limit 1;
  assert v_regu is not null,
    '57 GAGAL: tidak ada regu Internal bernomor dada — tes 52 seharusnya membuatnya';

  -- ---------------------------------------------------------------------
  -- 57.1 Penyebutnya = jumlah komponen yang BOLEH diisi juri untuk regu itu.
  --
  --      Dua sisi dari satu aturan: `komponen_berlaku()` menentukan apa yang
  --      boleh diisi, `komponen_pos_golongan()` menghitung apa yang harus
  --      diisi. Kalau keduanya berbeda, regu itu tidak akan pernah lengkap
  --      tanpa satu pun galat muncul.
  -- ---------------------------------------------------------------------
  for v_pos_ada, v_wajib in
    select p.nomor, komponen_pos_golongan(p.nomor, v_gol)
    from v_pos p where p.jumlah_komponen > 0 order by p.nomor
  loop
    select count(*)::int into v_terisi
    from wahana w
    where w.edisi = edisi_aktif() and w.pos = v_pos_ada
      and komponen_berlaku(w.golongan, v_gol);
    assert v_wajib = v_terisi,
      format('57.1 GAGAL: Pos %s menuntut %s komponen dari %s, padahal yang '
             'berlaku untuknya %s', v_pos_ada, v_wajib, v_gol, v_terisi);
  end loop;
  raise notice '57.1 OK — penyebut tiap pos sama dengan komponen yang berlaku untuk %.', v_gol;

  -- ---------------------------------------------------------------------
  -- 57.2 Regu Internal yang sudah mengisi seluruh komponennya TERHITUNG
  --      lengkap.
  --
  --      Dibaca dua kali dengan satu baris nilai dihapus di antaranya —
  --      kalau angkanya tidak bergerak, regu itu memang tidak pernah ikut
  --      dihitung lengkap sejak awal.
  -- ---------------------------------------------------------------------
  select p.nomor into v_pos_ada
  from v_pos p
  where p.jumlah_komponen > 0 and komponen_pos_golongan(p.nomor, v_gol) > 0
  order by p.nomor limit 1;
  assert v_pos_ada is not null,
    format('57 GAGAL: %s tidak berlomba di pos mana pun', v_gol);

  -- Nilainya diisi DI SINI, bukan diwarisi dari tes sebelumnya: beberapa tes
  -- membuat regu Internal untuk keperluan lain (tes 53 mengujinya sebagai kuota
  -- FIFO) dan mana yang kebetulan sudah dinilai bukan sesuatu yang boleh
  -- diandalkan. Yang ditambahkan di sini dibongkar lagi di akhir.
  select array_agg(w.id) into v_tambah
  from wahana w
  where w.edisi = edisi_aktif() and w.pos = v_pos_ada
    and komponen_berlaku(w.golongan, v_gol)
    and not exists (select 1 from nilai_mentah n
                    where n.regu_id = v_regu and n.wahana_id = w.id);

  if v_tambah is not null then
    insert into nilai_mentah (regu_id, wahana_id, nilai_1, source, created_by)
    select v_regu, w.id, greatest(w.rentang_mentah_min, 0), 'manual',
           (select id from auth.users order by id limit 1)
    from wahana w where w.id = any(v_tambah);
  end if;

  select lengkap into v_lengkap from v_kelengkapan_pos where pos = v_pos_ada;

  select n.wahana_id, n.nilai_1, n.nilai_2, n.source, n.created_by
    into v_wahana, v_n1, v_n2, v_sumber, v_oleh
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  where n.regu_id = v_regu and w.pos = v_pos_ada and w.edisi = edisi_aktif()
  limit 1;
  assert v_wahana is not null,
    format('57 GAGAL: regu Internal belum punya nilai di Pos %s', v_pos_ada);

  delete from nilai_mentah where regu_id = v_regu and wahana_id = v_wahana;
  select lengkap into v_sesudah from v_kelengkapan_pos where pos = v_pos_ada;
  insert into nilai_mentah (regu_id, wahana_id, nilai_1, nilai_2, source, created_by)
  values (v_regu, v_wahana, v_n1, v_n2, v_sumber, v_oleh);

  assert v_lengkap - v_sesudah = 1,
    format('57.2 GAGAL: menghapus satu nilai regu Internal mengubah "lengkap" '
           'Pos %s dari %s jadi %s — seharusnya turun satu. Regu Internal tidak '
           'ikut terhitung lengkap.', v_pos_ada, v_lengkap, v_sesudah);
  raise notice '57.2 OK — regu Internal terhitung lengkap di Pos %.', v_pos_ada;

  -- ---------------------------------------------------------------------
  -- 57.3 Di pos yang tidak ia ikuti, ia tidak dihitung sama sekali.
  --
  --      Penyebut nol bukan "belum selesai" melainkan "tidak ikut". Dihitung
  --      'kosong' di sana membuat papan mengirim panitia mencari juri yang
  --      tidak punya pekerjaan.
  -- ---------------------------------------------------------------------
  select p.nomor into v_pos_tak
  from v_pos p
  where p.jumlah_komponen > 0 and komponen_pos_golongan(p.nomor, v_gol) = 0
  order by p.nomor limit 1;
  assert v_pos_tak is not null,
    '57 GAGAL: tidak ada pos yang tidak diikuti Internal — fikstur tes berubah, '
    'tes 57.3 tidak lagi memeriksa apa pun';

  select regu_total into v_total from v_kelengkapan_pos where pos = v_pos_tak;
  select count(*)::int into v_semua
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled and d.status = 'lunas' and r.nomor_dada is not null
    and komponen_pos_golongan(v_pos_tak, r.golongan) > 0;

  assert v_total = v_semua,
    format('57.3 GAGAL: Pos %s menghitung %s regu, padahal yang berlomba di '
           'sana %s', v_pos_tak, v_total, v_semua);

  select count(*)::int into v_intern
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled and d.status = 'lunas' and r.nomor_dada is not null
    and r.golongan in ('intern_pa', 'intern_pi');
  assert v_intern > 0,
    '57.3 GAGAL: tidak ada regu Internal yang dikecualikan, jadi angka di atas '
    'sama saja dengan sebelum perbaikan';

  raise notice '57.3 OK — Pos % menghitung % regu, % regu Internal dikecualikan.',
    v_pos_tak, v_total, v_intern;

  -- Nilai yang ditambahkan tes ini dibongkar lagi.
  if v_tambah is not null then
    delete from nilai_mentah where regu_id = v_regu and wahana_id = any(v_tambah);
  end if;
end;
$blok$;

\echo '57 kelengkapan mengenal Internal: LULUS'
