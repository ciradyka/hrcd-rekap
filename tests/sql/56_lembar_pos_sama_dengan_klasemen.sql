-- ============================================================================
-- hrcd-rekap : tests/sql/56_lembar_pos_sama_dengan_klasemen.sql — migrasi 0095.
--
-- SATU ANGKA, DUA LAYAR, DAN TIDAK BOLEH BERBEDA.
--
-- Poin tidak pernah disimpan; ia diturunkan tiap kali dibaca, dan diturunkan
-- di dua tempat yang berbeda berkasnya:
--
--   v_lembar_pos.nilai_pos                      -> layar Input Nilai Pos
--   v_poin_wahana -> ... -> v_klasemen          -> Rekap dan Live Score
--
-- Keduanya memanggil hitung_poin() sendiri-sendiri, jadi keduanya bisa
-- menyimpang tanpa satu galat pun: hasilnya tetap angka, di kolom yang memang
-- berisi angka, pada regu yang memang ikut lomba. Itu sudah terjadi. 0085
-- menambahkan argumen `jawaban_benar` ke keduanya dan menulis peringatannya di
-- kepala berkasnya sendiri; 0091 membangun ulang v_lembar_pos dari salinan
-- pra-0085 dan menjatuhkan argumen itu lagi. Karena argumennya `default null`,
-- tidak ada yang gagal — juri melihat 0 untuk taksiran yang di klasemen
-- bernilai penuh.
--
-- Tes ini karena itu tidak memeriksa satu rumus. Ia memeriksa KESAMAAN kedua
-- jalur untuk setiap baris yang ada, sehingga rebuild berikutnya yang lupa
-- satu argumen jatuh di CI, bukan di layar juri pada hari lomba.
--
-- ---------------------------------------------------------------------------
-- KENAPA KOMPONENNYA DIBUAT SENDIRI DI SINI
--
-- Yang membedakan kedua jalur hanya komponen ber-`jawaban_benar`, dan di
-- database uji komponen seperti itu TIDAK ADA: 0032 dan 0085 sama-sama
-- melewati bagian datanya kalau `nilai_mentah` sudah berisi, dan di sini ia
-- memang penuh sejak tes 02. Bersandar pada Menaksir membuat tes ini lulus
-- tanpa pernah menyentuh perbedaannya — jadi komponennya dipasang sendiri,
-- dipakai, lalu dibongkar lagi. Sekalian itu membuat tes ini tidak ikut
-- membeku kalau tahun depan Menaksir diganti nama atau tangganya diatur ulang.
-- ============================================================================

\echo '--- 56. Nilai Pos di layar juri = angka yang dipakai klasemen'

do $blok$
declare
  -- admin.ciradyka dari 01_seed_uji.sql: boleh('pos') dan pos_saya() NULL,
  -- jadi ia melihat kelima pos — kursi yang sama dipakai tes 52.
  v_admin    uuid := '00000000-0000-0000-0000-00000000000a';
  v_terkunci boolean;
  v_regu     uuid;
  v_wahana   uuid;
  v_pos      smallint;
  v_bobot    numeric;
  v_jawaban  numeric := 855;   -- 8,55 m dalam sentimeter
  v_taksiran numeric := 734;   -- 7,34 m -> selisih 121 cm -> tingkat kedua
  v_poin     numeric;
  v_layar_sebelum numeric;
  v_layar_sesudah numeric;
  v_klas_sebelum  numeric;
  v_klas_sesudah  numeric;
  v_beda     int;
  v_periksa  int;
  v_berjawab int;
  v_dada     integer;
  v_kloter   smallint;
  v_jam_asli timestamptz;
  v_fase_asli text;
  v_ceklis   boolean := false;
  v_b numeric; v_c numeric; v_d numeric; v_e numeric;
  v_total_c numeric; v_total_d numeric; v_total_e numeric;
begin
  select p.nomor, p.bobot into v_pos, v_bobot
  from pos p
  where p.edisi = edisi_aktif() and not p.bayangan
    and exists (select 1 from wahana w
                where w.edisi = p.edisi and w.pos = p.nomor)
  order by p.nomor limit 1;
  assert v_pos is not null, '56 GAGAL: tidak ada pos berkomponen di edisi aktif';

  -- Regu eksternal yang benar-benar muncul di v_lembar_pos: lunas, bernomor
  -- dada, tidak dibatalkan. Yang tergembok dilewati — jalur tulisnya memang
  -- menolak, dan tes ini tidak sedang menguji gembok.
  select r.id into v_regu
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where d.status = 'lunas'
    and r.nomor_dada is not null
    and not r.is_cancelled
    and r.golongan not in ('intern_pa', 'intern_pi')
    and not exists (select 1 from nilai_terkunci t
                    where t.regu_id = r.id and t.pos = v_pos)
  order by r.nomor_dada limit 1;
  assert v_regu is not null,
    '56 GAGAL: tidak ada regu lunas bernomor dada untuk diuji';

  -- Komponen bertingkat ber-jawaban benar, dipasang sementara. Bentuknya sama
  -- dengan Menaksir produksi: tangga sentimeter, yang masuk tangga SELISIH
  -- terhadap jawaban benar (0085).
  select konfigurasi_terkunci into v_terkunci from status_acara;
  update status_acara set konfigurasi_terkunci = false where konfigurasi_terkunci;

  insert into wahana
    (edisi, pos, kode, name, type, form, poin_maks,
     rentang_mentah_min, rentang_mentah_maks, sort_order,
     tingkat, satuan, jawaban_benar)
  values
    (edisi_aktif(), v_pos, 'uji_taksir_56', 'Uji Taksiran 56', 'wahana',
     'bertingkat', 100, 0, 10000, 99,
     '[{"sampai": 100, "poin": 100},
       {"sampai": 200, "poin": 80},
       {"sampai": 300, "poin": 60}]'::jsonb,
     'meter', v_jawaban)
  returning id into v_wahana;

  -- Poin yang SEHARUSNYA didapat taksiran ini menurut komponen barusan —
  -- dihitung dari wahana-nya, bukan diketik di sini.
  select hitung_poin(w.form, v_taksiran, null, w.poin_maks,
                     w.raw_terbaik, w.raw_terburuk,
                     w.poin_benar, w.poin_salah, w.total_soal, w.tingkat,
                     w.jawaban_benar)
    into v_poin
  from wahana w where w.id = v_wahana;
  assert v_poin > 0,
    format('56 GAGAL: taksiran %s bernilai %s poin, jadi tes ini tidak '
           'membuktikan apa pun', v_taksiran, v_poin);

  -- ---------------------------------------------------------------------
  -- 56.1 Angka di layar juri ikut bergerak saat taksiran masuk.
  --
  --      Dibaca DUA KALI dengan satu baris berubah di antaranya. Kalau
  --      pembacaan kedua sama dengan yang pertama, layar juri sedang
  --      menghitung tanpa jawaban benar: 734 lebih besar daripada seluruh
  --      batas tangga, jadi sumbangannya nol.
  -- ---------------------------------------------------------------------
  perform set_config('app.uid', v_admin::text, true);
  set local role authenticated;
  select nilai_pos into v_layar_sebelum from v_lembar_pos
  where regu_id = v_regu and pos = v_pos;
  select coalesce(sum(poin), 0) into v_klas_sebelum from v_poin_wahana
  where regu_id = v_regu and pos = v_pos;
  reset role;

  assert v_layar_sebelum is not null,
    '56 GAGAL: regu uji tidak muncul di v_lembar_pos, kursinya salah';

  insert into nilai_mentah (regu_id, wahana_id, nilai_1, source, created_by)
  values (v_regu, v_wahana, v_taksiran, 'manual', v_admin);

  perform set_config('app.uid', v_admin::text, true);
  set local role authenticated;
  select nilai_pos into v_layar_sesudah from v_lembar_pos
  where regu_id = v_regu and pos = v_pos;
  select coalesce(sum(poin), 0) into v_klas_sesudah from v_poin_wahana
  where regu_id = v_regu and pos = v_pos;
  reset role;

  assert v_klas_sesudah - v_klas_sebelum = v_poin,
    format('56.1 GAGAL: klasemen naik %s, seharusnya %s',
           v_klas_sesudah - v_klas_sebelum, v_poin);

  assert v_layar_sesudah <> v_layar_sebelum,
    format('56.1 GAGAL: taksiran %s cm masuk dan Nilai Pos di layar juri tetap '
           '%s, sementara klasemen naik jadi %s — layar menghitung tanpa '
           'jawaban benar', v_taksiran, v_layar_sebelum, v_klas_sesudah);

  assert v_layar_sesudah = round(v_klas_sesudah * v_bobot, 2),
    format('56.1 GAGAL: layar juri %s, klasemen %s untuk regu dan pos yang '
           'sama', v_layar_sesudah, round(v_klas_sesudah * v_bobot, 2));

  raise notice '56.1 OK — taksiran % cm: layar % = klasemen %.',
    v_taksiran, v_layar_sesudah, round(v_klas_sesudah * v_bobot, 2);

  -- ---------------------------------------------------------------------
  -- 56.2 Kesamaan itu berlaku untuk SELURUH baris, bukan cuma regu uji.
  --
  --      Dibaca sebagai pemilik supaya tidak ada baris yang tersembunyi RLS
  --      lalu terhitung "tidak berbeda". `app.uid` tetap dipasang karena
  --      pagar boleh('pos') ada di dalam badan view-nya sendiri.
  -- ---------------------------------------------------------------------
  perform set_config('app.uid', v_admin::text, true);

  select count(*) into v_periksa from v_lembar_pos;
  assert v_periksa > 0,
    '56.2 GAGAL: v_lembar_pos kosong, jadi perbandingan ini hampa';

  select count(*) into v_beda
  from v_lembar_pos l
  join pos p on p.edisi = edisi_aktif() and p.nomor = l.pos
  where l.nilai_pos <> round(coalesce((
          select sum(pw.poin) from v_poin_wahana pw
          where pw.regu_id = l.regu_id and pw.pos = l.pos), 0) * p.bobot, 2);
  assert v_beda = 0,
    format('56.2 GAGAL: %s dari %s baris v_lembar_pos menyebut Nilai Pos yang '
           'berbeda dari klasemen', v_beda, v_periksa);

  -- Perbandingan di atas hanya berarti kalau setidaknya satu baris memuat
  -- komponen ber-jawaban_benar — di situlah kedua jalur pernah menyimpang.
  select count(*) into v_berjawab
  from v_lembar_pos l
  where exists (
    select 1 from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = l.regu_id and w.pos = l.pos
      and w.edisi = edisi_aktif() and w.jawaban_benar is not null);
  assert v_berjawab > 0,
    '56.2 GAGAL: tidak ada baris ber-jawaban_benar yang dibandingkan, jadi '
    'tes ini lulus tanpa menyentuh perbedaan yang pernah terjadi';

  raise notice '56.2 OK — % baris v_lembar_pos sama dengan klasemen, % di '
               'antaranya memuat komponen ber-jawaban benar.',
    v_periksa, v_berjawab;

  -- ---------------------------------------------------------------------
  -- 56.3 EMPAT LAYAR, SATU ANGKA.
  --
  --      Sampai di sini yang dibandingkan baru dua jalur. Yang dijanjikan ke
  --      panitia lebih luas: angka yang sama harus muncul di Input Nilai Pos,
  --      Live Score panitia, Rekapitulasi, dan Live Score peserta. Keempatnya
  --      memang bersandar pada rantai yang sama hari ini — dan justru itu yang
  --      perlu dijaga, karena yang merusaknya bukan perubahan besar melainkan
  --      satu view yang dibangun ulang dari salinan lama.
  --
  --      Regu uji perlu dibuat "sudah berangkat" dulu: v_klasemen menolak regu
  --      tanpa ceklis keberangkatan dan tanpa jam berangkat kloter (0005:126),
  --      dan v_klasemen_publik hanya berisi saat fase `penuh` (0048:120).
  --      Keduanya dikembalikan di akhir.
  -- ---------------------------------------------------------------------
  select r.nomor_dada, r.kloter_nomor into v_dada, v_kloter
  from regu r where r.id = v_regu;
  select k.jam_berangkat into v_jam_asli from kloter k where k.nomor = v_kloter;
  update kloter set jam_berangkat = '2026-08-29 07:00:00+07'
  where nomor = v_kloter and jam_berangkat is null;
  if not exists (select 1 from keberangkatan_regu where regu_id = v_regu) then
    insert into keberangkatan_regu (regu_id, recorded_by) values (v_regu, v_admin);
    v_ceklis := true;
  end if;
  select fase_live into v_fase_asli from status_acara;
  update status_acara set fase_live = 'penuh' where fase_live is distinct from 'penuh';

  -- Ketiga layar panitia dibaca dari kursi panitia; berkas peserta dibaca
  -- sebagai pemilik, karena begitulah publish-live.yml menghasilkannya
  -- (v_klasemen_publik memang tidak diberikan ke authenticated).
  perform set_config('app.uid', v_admin::text, true);
  set local role authenticated;
  select nilai_pos into v_b from v_lembar_pos
  where regu_id = v_regu and pos = v_pos;
  select (poin_per_pos ->> v_pos::text)::numeric, total into v_c, v_total_c
  from klasemen_live_score() where nomor_dada = v_dada;
  select (poin_pos ->> v_pos::text)::numeric, total into v_d, v_total_d
  from v_rekap_penuh where regu_id = v_regu;
  reset role;

  select (poin_per_pos ->> v_pos::text)::numeric, total into v_e, v_total_e
  from v_klasemen_publik where nomor_dada = v_dada;

  assert v_b is not null and v_c is not null and v_d is not null
         and v_e is not null,
    format('56.3 GAGAL: regu uji tidak terbaca di keempat layar '
           '(pos: input=%s, live panitia=%s, rekap=%s, live peserta=%s)',
           v_b, v_c, v_d, v_e);

  assert v_b = v_c and v_b = v_d and v_b = v_e,
    format('56.3 GAGAL: Pos %s regu %s berbeda antar layar — Input Nilai Pos '
           '%s, Live Score panitia %s, Rekapitulasi %s, Live Score peserta %s',
           v_pos, v_dada, v_b, v_c, v_d, v_e);

  assert v_total_c = v_total_d and v_total_c = v_total_e,
    format('56.3 GAGAL: total regu %s berbeda antar layar — Live Score panitia '
           '%s, Rekapitulasi %s, Live Score peserta %s',
           v_dada, v_total_c, v_total_d, v_total_e);

  raise notice '56.3 OK — regu %: Pos % bernilai % di keempat layar, total %.',
    v_dada, v_pos, v_b, v_total_c;

  update status_acara set fase_live = v_fase_asli
  where fase_live is distinct from v_fase_asli;
  if v_ceklis then delete from keberangkatan_regu where regu_id = v_regu; end if;
  update kloter set jam_berangkat = v_jam_asli
  where nomor = v_kloter and jam_berangkat is distinct from v_jam_asli;

  -- Bongkar lagi: komponen uji tidak boleh ikut terbawa ke tes sesudahnya
  -- maupun ke hitungan kelengkapan pos.
  delete from nilai_mentah where wahana_id = v_wahana;
  delete from wahana where id = v_wahana;
  update status_acara set konfigurasi_terkunci = v_terkunci
  where konfigurasi_terkunci <> v_terkunci;
end;
$blok$;

\echo '56 nilai pos layar juri = klasemen: LULUS'
