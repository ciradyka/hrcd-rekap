-- ============================================================================
-- hrcd-rekap : tests/sql/69_poin_per_komponen.sql
-- Poin per komponen terbit ke kedua papan, dan TIDAK terbit sebelum waktunya.
--
-- Yang diuji bukan "kolomnya ada" — itu sudah diperiksa assert di dalam 0107.
-- Yang diuji di sini ANGKANYA: poin yang keluar dari view harus sama persis
-- dengan yang dihitung hitung_poin(), dan pagar fase pada view publik harus
-- benar-benar menahan.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Kursi admin: v_rekap_penuh dipagari boleh('rekap') / boleh('live_score').
-- ---------------------------------------------------------------------------
select set_config('app.uid', (select user_id::text from akun_panitia
                              where peran = 'admin' and is_active limit 1), true);

-- 69.1 poin per komponen = hitung_poin() atas baris nilai_mentah yang sama.
--
-- Dibandingkan baris per baris, bukan cuma jumlahnya: dua komponen yang
-- poinnya tertukar menghasilkan total yang sama dan tabel yang salah.
do $$
declare
  v_beda int;
begin
  select count(*) into v_beda
  from v_rekap_penuh rp
  join regu r on r.id = rp.regu_id
  join nilai_mentah n on n.regu_id = r.id
  join wahana w on w.id = n.wahana_id and w.edisi = edisi_aktif()
  where (rp.poin ->> (w.pos || '.' || w.kode))::numeric is distinct from
        hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
                    w.raw_terbaik, w.raw_terburuk, w.poin_benar,
                    w.poin_salah, w.total_soal, w.tingkat, w.jawaban_benar);
  assert v_beda = 0,
    format('69.1: %s komponen di v_rekap_penuh berbeda dengan hitung_poin()', v_beda);
end $$;

-- 69.2 Kunci `poin` sama persis dengan kunci `nilai`.
--
-- Layar membaca keduanya dengan kunci yang sama (`pos.kode`). Kunci yang
-- bergeser tidak menggagalkan apa pun — ia cuma membuat setiap sel kosong.
do $$
declare
  v_beda int;
begin
  select count(*) into v_beda
  from v_rekap_penuh
  where (select coalesce(array_agg(k order by k), '{}')
         from jsonb_object_keys(nilai) k)
     is distinct from
        (select coalesce(array_agg(k order by k), '{}')
         from jsonb_object_keys(poin) k);
  assert v_beda = 0,
    format('69.2: %s regu punya kunci `poin` yang berbeda dari kunci `nilai`', v_beda);
end $$;

-- 69.3 Angkanya memang POIN, bukan angka mentah yang menyamar.
--
-- Rumusnya sengaja TIDAK diturunkan ulang di sini. 69.1 sudah membandingkan
-- setiap baris dengan hitung_poin(), dan menuliskan rumusnya lagi di tes
-- berarti membangun mesin skor kedua di tempat yang justru ditugasi menjaga
-- agar mesin skor cuma ada satu. Versi pertama tes ini melakukannya dan
-- langsung terjatuh: ia memakai `rentang_mentah_maks` sebagai penyebut,
-- sementara `besar_baik` menskala dari `raw_terbaik` — dan pada
-- `kepramukaan_keagamaan` keduanya berbeda jauh (20 lawan 10000, karena 0037
-- melebarkan rentang isiannya). Yang salah tesnya, bukan view-nya.
--
-- Yang diuji di sini tinggal KLAIMNYA: angka yang keluar berskala poin, bukan
-- skala isian. Diambil dari komponen `besar_baik` yang poin_maks-nya memang
-- berbeda dari raw_terbaik — persis bentuk Semaphore (mentah 0-5, poin 0-100).
do $$
declare
  v_kode    text;
  v_mentah  numeric;
  v_poin    numeric;
  v_terbaik numeric;
  v_maks    numeric;
begin
  select w.kode, n.nilai_1, w.raw_terbaik, w.poin_maks,
         (rp.poin ->> (w.pos || '.' || w.kode))::numeric
    into v_kode, v_mentah, v_terbaik, v_maks, v_poin
  from v_rekap_penuh rp
  join nilai_mentah n on n.regu_id = rp.regu_id
  join wahana w on w.id = n.wahana_id and w.edisi = edisi_aktif()
  where w.form = 'besar_baik'
    and w.poin_maks is distinct from w.raw_terbaik
    and n.nilai_1 > 0
  limit 1;

  if v_kode is null then
    raise notice '69.3 dilewati: tidak ada komponen besar_baik berskala tidak 1:1 yang sudah dinilai.';
    return;
  end if;

  assert v_poin is distinct from v_mentah,
    format('69.3: %s memberi angka mentah (%s), bukan poin', v_kode, v_mentah);
  assert v_poin > 0 and v_poin <= v_maks,
    format('69.3: %s memberi %s, di luar skala poin 0-%s', v_kode, v_poin, v_maks);
  raise notice '69.3: % mentah % (skala 0-%) -> % poin (skala 0-%).',
               v_kode, v_mentah, v_terbaik, v_poin, v_maks;
end $$;

-- ---------------------------------------------------------------------------
-- 69.4 PAGAR FASE — poin peserta kosong sebelum hasil diumumkan.
--
-- Bentuknya menempati kursi, bukan memindai nama (CLAUDE.md 13.8): fase
-- diubah di antara dua pembacaan view yang SAMA.
--
-- Barisnya disiapkan sendiri, dan itu perlu. Di titik ini dalam suite, regu
-- yang punya nilai_mentah kebetulan belum bernomor dada — dan `v_progres_publik`
-- memang menuntut `nomor_dada is not null`. Tanpa langkah persiapan ini,
-- "fase penuh memberi poin" akan LULUS PALSU atas nol baris, yang berarti
-- pagar fasenya tidak pernah benar-benar diuji.
-- ---------------------------------------------------------------------------
do $$
declare
  v_asal   text;
  v_regu   uuid;
  v_isi    int;
begin
  select fase_live into v_asal from status_acara;

  -- Satu regu yang sudah dinilai, lunas, dan tidak batal — diberi nomor dada
  -- dari stok supaya ia masuk ke papan peserta. Seluruhnya di-rollback.
  select r.id into v_regu
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled and d.status = 'lunas' and r.nomor_dada is null
    and exists (select 1 from nilai_mentah n
                join wahana w on w.id = n.wahana_id
                where n.regu_id = r.id and w.edisi = edisi_aktif())
  limit 1;
  assert v_regu is not null,
    '69.4: tidak ada regu bernilai yang bisa dipakai — periksa urutan tes di run.sh';

  -- Ketiganya dipasang BERSAMA: `regu_check` menuntut nomor_dada dan
  -- kloter_nomor sama-sama terisi atau sama-sama kosong, dan `regu_check1`
  -- menuntut hal yang sama untuk urutan_kloter. Mengisi satu saja ditolak
  -- constraint, bukan diterima diam-diam.
  update regu set
    nomor_dada = (select max(s.nomor) from nomor_dada_stok s
                  where not exists (select 1 from regu r2
                                    where r2.nomor_dada = s.nomor)),
    kloter_nomor = 1,
    urutan_kloter = slot_kloter_berikutnya(1::smallint)
  where id = v_regu;

  update status_acara set fase_live = 'progres' where fase_live is not null;
  select count(*) into v_isi from v_progres_publik where poin <> '{}'::jsonb;
  assert v_isi = 0,
    format('69.4: %s baris membawa poin di fase progres — hasil bocor sebelum diumumkan', v_isi);

  update status_acara set fase_live = 'penuh' where fase_live is not null;
  select count(*) into v_isi from v_progres_publik where poin <> '{}'::jsonb;
  assert v_isi > 0,
    '69.4: fase penuh tetap tidak memberi satu pun poin — papan peserta akan kosong';

  -- Kunci `poin` dan `nilai` bergerak bersama: keduanya lahir dari baris
  -- nilai_mentah yang sama, jadi satu yang terisi sementara satunya kosong
  -- berarti salah satu subquery-nya menyimpang.
  select count(*) into v_isi from v_progres_publik
  where (poin <> '{}'::jsonb) is distinct from (nilai <> '{}'::jsonb);
  assert v_isi = 0,
    format('69.4: %s baris punya poin tanpa nilai (atau sebaliknya)', v_isi);

  update status_acara set fase_live = v_asal where fase_live is not null;
end $$;

select '69_poin_per_komponen OK' as hasil;

rollback;
