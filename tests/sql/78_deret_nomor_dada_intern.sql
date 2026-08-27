-- ============================================================================
-- hrcd-rekap : tests/sql/78_deret_nomor_dada_intern.sql — migrasi 0116.
-- Dua deret nomor dada, dan KEDUA pintu yang memberi nomor harus menjaganya.
--
-- Kain nomor dada dicetak dalam dua set yang sama-sama mulai dari 001, jadi
-- Intern diketik 1001-1250. Yang diuji di sini bukan bahwa nomornya tersimpan
-- — itu sudah dijaga unique sejak 0001 — melainkan bahwa nomor dari deret yang
-- SALAH ditolak, dan bahwa pesannya menyebut deret yang benar. Petugas yang
-- salah ketik butuh tahu harus mengetik apa.
--
-- Dua pintu, dan yang kedua paling mudah terlupa: `daftar_ulang_batch` memberi
-- nomor pertama kali, `tukar_nomor_dada` menggantinya saat kainnya sobek.
-- Menutup yang pertama saja meninggalkan pintu samping yang terbuka lebar.
-- ============================================================================

\echo '--- 78. dua deret nomor dada: Eksternal dan Intern'
\set ON_ERROR_STOP on

begin;

do $blok$
declare
  v_sekolah    uuid;
  v_daftar     uuid;
  v_regu_intern uuid;
  v_regu_ext   uuid;
  v_eks        int;
  v_eks_lain   int;
  v_intern     int;
  v_intern_lain int;
  v_tolak      boolean;
  v_pesan      text;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  update status_acara set daftar_ulang_ditutup = false where id;

  -- ---------------------------------------------------------------------
  -- 78.0 Rentangnya persis seperti yang diputuskan pemilik acara.
  -- ---------------------------------------------------------------------
  assert (select intern_mulai = 1001 and intern_sampai = 1250
          from v_rentang_nomor_dada),
    '78.0 GAGAL: stok Intern bukan 1001-1250';
  assert (select eksternal_sampai < 1001 and eksternal_mulai = 1
          from v_rentang_nomor_dada),
    '78.0 GAGAL: deret Eksternal bocor ke wilayah Intern';

  -- Nomor bebas dari masing-masing deret. Diambil dari stok, bukan ditulis
  -- angkanya: tes yang mematok 7 dan 1001 akan gugur setiap kali fixture di
  -- atasnya kebetulan memakai nomor itu.
  select min(s.nomor) into v_eks from nomor_dada_stok s
   where s.nomor < 1001
     and not exists (select 1 from regu r where r.nomor_dada = s.nomor)
     and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);
  select min(s.nomor) into v_eks_lain from nomor_dada_stok s
   where s.nomor < 1001 and s.nomor > v_eks
     and not exists (select 1 from regu r where r.nomor_dada = s.nomor)
     and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);
  select min(s.nomor) into v_intern from nomor_dada_stok s
   where s.nomor >= 1001
     and not exists (select 1 from regu r where r.nomor_dada = s.nomor)
     and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);
  select min(s.nomor) into v_intern_lain from nomor_dada_stok s
   where s.nomor >= 1001 and s.nomor > v_intern
     and not exists (select 1 from regu r where r.nomor_dada = s.nomor)
     and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);

  select id into v_sekolah from sekolah order by name limit 1;
  insert into pendaftaran
    (sekolah_id, kode_pembayaran, jumlah_regu, kontak_wa, status)
  values (v_sekolah, 'UJI-DERET-0116', 1, '081200000116', 'lunas')
  returning id into v_daftar;
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  values (v_daftar, 'DERET INTERN UJI', 'Ketua Uji', 'intern_pa')
  returning id into v_regu_intern;

  -- ---------------------------------------------------------------------
  -- 78.1 Regu Intern + nomor Eksternal: DITOLAK, dan pesannya menyebut
  --      1001-1250. Inilah kekeliruan yang benar-benar akan terjadi di meja
  --      — kain Intern bertulis 001, dan mengetik apa yang terbaca adalah
  --      hal paling wajar sedunia.
  -- ---------------------------------------------------------------------
  v_tolak := false;
  begin
    perform * from daftar_ulang_batch('UJI-DERET-0116', jsonb_build_array(
      jsonb_build_object('regu_id', v_regu_intern, 'nomor_dada', v_eks)));
    raise exception 'GAGAL: regu Intern menerima nomor dari deret Eksternal (%)', v_eks;
  exception when others then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true; v_pesan := sqlerrm;
  end;
  assert v_tolak, '78.1 GAGAL: nomor Eksternal untuk regu Intern tidak ditolak';
  assert v_pesan like '%1001 - 1250%',
    format('78.1 GAGAL: pesan tidak menyebut deret Intern yang benar: %s', v_pesan);
  assert v_pesan like '%intern%',
    format('78.1 GAGAL: pesan tidak menyebut deret mana yang dimaksud: %s', v_pesan);

  -- ---------------------------------------------------------------------
  -- 78.2 Nomor dari deretnya sendiri: diterima.
  --
  --      Tanpa langkah ini 78.1 bisa lulus karena alasan yang salah — RPC
  --      yang menolak SEMUA nomor juga menolak yang di deret Eksternal.
  -- ---------------------------------------------------------------------
  perform * from daftar_ulang_batch('UJI-DERET-0116', jsonb_build_array(
    jsonb_build_object('regu_id', v_regu_intern, 'nomor_dada', v_intern)));
  assert (select nomor_dada = v_intern from regu where id = v_regu_intern),
    '78.2 GAGAL: nomor Intern yang sah ikut ditolak';

  -- ---------------------------------------------------------------------
  -- 78.3 Arah sebaliknya. Aturannya satu kalimat dibaca dari dua sisi, jadi
  --      menguji satu sisi saja membiarkan separuhnya tanpa kursi.
  -- ---------------------------------------------------------------------
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  values (v_daftar, 'DERET EKSTERN UJI', 'Ketua Uji', 'penggalang_pa')
  returning id into v_regu_ext;

  v_tolak := false;
  begin
    perform * from daftar_ulang_batch('UJI-DERET-0116', jsonb_build_array(
      jsonb_build_object('regu_id', v_regu_ext, 'nomor_dada', v_intern_lain)));
    raise exception 'GAGAL: regu Eksternal menerima nomor dari deret Intern (%)', v_intern_lain;
  exception when others then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true; v_pesan := sqlerrm;
  end;
  assert v_tolak, '78.3 GAGAL: nomor Intern untuk regu Eksternal tidak ditolak';
  assert v_pesan like '%eksternal%',
    format('78.3 GAGAL: pesan tidak menyebut deret Eksternal: %s', v_pesan);

  perform * from daftar_ulang_batch('UJI-DERET-0116', jsonb_build_array(
    jsonb_build_object('regu_id', v_regu_ext, 'nomor_dada', v_eks)));
  assert (select nomor_dada = v_eks from regu where id = v_regu_ext),
    '78.3 GAGAL: nomor Eksternal yang sah ikut ditolak';

  -- ---------------------------------------------------------------------
  -- 78.4 Pintu kedua: tukar kain sobek. Regu Intern tidak boleh berpindah ke
  --      deret Eksternal lewat jalur ini.
  -- ---------------------------------------------------------------------
  v_tolak := false;
  begin
    perform tukar_nomor_dada(v_regu_intern, v_eks_lain, 'uji 78: kain sobek');
    raise exception 'GAGAL: tukar memindahkan regu Intern ke deret Eksternal (%)', v_eks_lain;
  exception when others then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true; v_pesan := sqlerrm;
  end;
  assert v_tolak, '78.4 GAGAL: tukar_nomor_dada menembus pagar deret';
  assert v_pesan like '%1001 - 1250%',
    format('78.4 GAGAL: pesan tukar tidak menyebut deret yang benar: %s', v_pesan);

  -- 78.5 Tukar ke sesama deret Intern tetap jalan — pagarnya menyaring deret,
  --      bukan mematikan penukaran.
  perform tukar_nomor_dada(v_regu_intern, v_intern_lain, 'uji 78: kain sobek');
  assert (select nomor_dada = v_intern_lain from regu where id = v_regu_intern),
    '78.5 GAGAL: tukar sesama deret Intern ikut ditolak';

  perform set_config('app.uid', '', true);
  raise notice '78 OK — Eksternal % / %, Intern % / % diuji dua arah, dua pintu.',
               v_eks, v_eks_lain, v_intern, v_intern_lain;
end;
$blok$;

rollback;

select '78_deret_nomor_dada_intern OK' as hasil;
