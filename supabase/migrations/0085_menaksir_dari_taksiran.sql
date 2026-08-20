-- ============================================================================
-- hrcd-rekap : 0085_menaksir_dari_taksiran.sql
--
-- MENAKSIR DINILAI DARI TAKSIRAN PESERTA, BUKAN DARI SELISIH YANG DIHITUNG
-- TANGAN.
--
-- ---------------------------------------------------------------------------
-- APA YANG BERUBAH DI LAPANGAN
--
-- Sebelumnya panitia menghitung sendiri selisih taksiran peserta terhadap
-- jawaban sebenarnya, lalu mengetik selisih itu. Sekarang yang diketik
-- ANGKA YANG DITULIS PESERTA apa adanya — 7.34 tetap 7.34 — dan mesin skor
-- yang menghitung `abs(8.55 - 7.34)`.
--
-- Dua hal yang hilang bersamaan: satu pengurangan yang dikerjakan tangan
-- ratusan kali di bawah matahari, dan satu kotak di blangko yang isinya bisa
-- salah tanpa ketahuan. Selisih yang salah hitung tetap berupa angka meter
-- yang masuk akal; ia tidak melanggar rentang mana pun, tidak memicu galat
-- apa pun, dan baru terlihat kalau ada yang menghitung ulang.
--
-- Blangkonya sudah lebih dulu berubah: lembar Menaksir kini tidak punya
-- bagian panitia sama sekali.
--
-- ---------------------------------------------------------------------------
-- JAWABAN SEBENARNYA JADI KONFIGURASI
--
-- `wahana.jawaban_benar` menyimpan angka yang benar untuk komponen itu —
-- 8.55 meter untuk Menaksir edisi XXXVII. Ia NULL untuk semua komponen lain,
-- dan itu yang membedakan dua arti `bertingkat`:
--
--   jawaban_benar NULL  -> tangga dibaca atas nilai_1 apa adanya
--                          (Pos 2: waktu tempuh, tidak berubah sedikit pun)
--   jawaban_benar ada   -> tangga dibaca atas abs(nilai_1 - jawaban_benar)
--
-- Dibuat begitu, bukan bentuk konversi baru, karena yang berubah cuma APA
-- yang masuk ke tangga — tangganya sendiri sama persis. Bentuk ketujuh
-- berarti tujuh cabang di hitung_poin dan satu lagi yang harus diingat
-- panitia saat mengatur komponen tahun depan.
--
-- ---------------------------------------------------------------------------
-- TANGGANYA BERGESER SATU METER
--
--   sebelum   selisih 0 m -> 100   1 m -> 80   2 m -> 60   3 m -> 40   4 m -> 20
--   sesudah   selisih <=1 -> 100   <=2 -> 80   <=3 -> 60   <=4 -> 40   <=5 -> 20
--
-- Sebabnya taksiran kini punya dua angka di belakang koma. Dengan tangga
-- lama, peserta yang menulis 8.56 — meleset SATU SENTIMETER — selisihnya 0.01
-- dan jatuh ke tingkat kedua: 80 poin, bukan 100. Hanya 8.55 persis yang
-- mendapat nilai penuh, dan lomba menaksir yang menuntut ketepatan
-- sentimeter bukan lomba menaksir lagi.
--
-- Keputusan pemilik acara: selisih sampai 1 meter tetap 100. Turunnya tetap
-- 20 poin tiap meter dan tetap menyentuh 0, sama seperti yang ditetapkan di
-- 0035 — yang bergeser batasnya, bukan polanya.
--
-- Tidak ada tingkat penutup: `bertingkat` memberi 0 untuk nilai di luar
-- seluruh tingkat (0022), dan di sini 0 memang jawabannya untuk selisih
-- lebih dari 5 meter.
--
-- ---------------------------------------------------------------------------
-- SKOR DITURUNKAN SAAT DIBACA
--
-- Tidak ada angka poin yang tersimpan; `v_poin_wahana` menghitungnya tiap
-- kali dibaca. Jadi migrasi ini mengubah peringkat yang sudah tampil di
-- layar, dan nilai mentah yang TERLANJUR diketik sebagai selisih akan
-- dibaca sebagai taksiran. Pada saat berkas ini ditulis seluruh isi produksi
-- masih data uji; kalau suatu hari tidak, nilai Menaksir yang sudah masuk
-- harus diketik ulang sebagai taksiran peserta.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolomnya.
-- ---------------------------------------------------------------------------
alter table wahana add column if not exists jawaban_benar numeric(10,2);

comment on column wahana.jawaban_benar is
  'Jawaban sebenarnya untuk komponen yang dinilai dari SELISIH — Menaksir. '
  'Kalau terisi, form=bertingkat membaca tangganya atas '
  'abs(nilai_1 - jawaban_benar), bukan atas nilai_1. NULL untuk komponen '
  'lain, dan di sana tangganya berlaku apa adanya.';

-- ---------------------------------------------------------------------------
-- 2. Mesin skornya.
--
-- Disalin UTUH dari 0022 dan hanya cabang `bertingkat` yang berubah.
-- `create or replace` mengganti seluruh badan, jadi cabang yang lupa disalin
-- akan hilang tanpa satu galat pun — dan yang hilang di sini bukan galat
-- melainkan poin yang jadi NULL di tengah klasemen.
-- ---------------------------------------------------------------------------
create or replace function hitung_poin(
  p_bentuk        text,
  p_nilai_1       numeric,
  p_nilai_2       numeric,
  p_poin_maks     numeric,
  p_raw_terbaik   numeric,
  p_raw_terburuk  numeric,
  p_poin_benar    numeric,
  p_poin_salah    numeric,
  p_total_soal    numeric,
  p_tingkat       jsonb,
  p_jawaban_benar numeric default null
) returns numeric
language sql immutable
as $$
  select round(case p_bentuk
    -- Interpolasi linear raw_terburuk→0 .. raw_terbaik→poin_maks, di-clamp.
    -- Satu rumus untuk dua arah: kecil_baik punya terbaik < terburuk,
    -- besar_baik sebaliknya — pembaginya ikut bertanda.
    when 'kecil_baik' then
      least(greatest(
        p_poin_maks * (p_nilai_1 - p_raw_terburuk) / (p_raw_terbaik - p_raw_terburuk),
        0), p_poin_maks)
    when 'besar_baik' then
      least(greatest(
        p_poin_maks * (p_nilai_1 - p_raw_terburuk) / (p_raw_terbaik - p_raw_terburuk),
        0), p_poin_maks)
    -- Biner: kena/benar (nilai_1 > 0) atau tidak.
    when 'biner' then
      case when p_nilai_1 > 0 then p_poin_benar else p_poin_salah end
    -- Proporsi jawaban benar.
    when 'benar_per_total' then
      least(greatest(p_poin_maks * p_nilai_1 / p_total_soal, 0), p_poin_maks)
    -- Benar menambah, salah mengurangi (poin_salah disimpan negatif);
    -- di-clamp supaya tidak minus.
    when 'benar_kurang_salah' then
      least(greatest(
        p_poin_benar * p_nilai_1 + p_poin_salah * coalesce(p_nilai_2, 0),
        0), p_poin_maks)
    -- Tangga poin: tingkat pertama (batas atas terkecil) yang masih memuat
    -- nilai mentahnya. Lebih besar dari semua batas = 0 — itu sebabnya
    -- coalesce ada di luar, bukan nilai default di dalam sub-query.
    --
    -- SATU-SATUNYA yang berubah dari 0022: kalau komponennya punya jawaban
    -- benar, yang masuk ke tangga adalah SELISIHNYA. Tanpa jawaban benar
    -- (Pos 2 dan seterusnya) nilai_1 dipakai apa adanya, persis seperti dulu.
    when 'bertingkat' then
      coalesce((
        select (t ->> 'poin')::numeric
        from jsonb_array_elements(p_tingkat) t
        where case when p_jawaban_benar is null then p_nilai_1
                   else abs(p_nilai_1 - p_jawaban_benar) end
              <= (t ->> 'sampai')::numeric
        order by (t ->> 'sampai')::numeric
        limit 1), 0)
  end, 2)
$$;

grant execute on function hitung_poin(text, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, jsonb, numeric)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. View meneruskan kolom barunya.
--
-- Daftar kolom KELUARANNYA tidak berubah, jadi v_poin_pos yang bertumpu
-- padanya tidak perlu ikut dibuat ulang (alasan yang sama seperti 0022).
-- ---------------------------------------------------------------------------
create or replace view v_poin_wahana with (security_invoker = on) as
select
  n.regu_id,
  w.pos,
  w.id   as wahana_id,
  w.kode,
  n.nilai_1,
  n.nilai_2,
  hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
              w.raw_terbaik, w.raw_terburuk,
              w.poin_benar, w.poin_salah, w.total_soal, w.tingkat,
              w.jawaban_benar) as poin
from nilai_mentah n
join wahana w on w.id = n.wahana_id
where w.edisi = edisi_aktif();

-- ---------------------------------------------------------------------------
-- 3b. v_lembar_pos IKUT DIBUAT ULANG, dan ini bukan kerapian.
--
-- Ia menghitung `nilai_pos` dengan hitung_poin sendiri — jadi kalau ia
-- ditinggalkan memakai bentuk lama, layar Input Nilai Pos menampilkan Nilai
-- Pos yang dihitung TANPA jawaban benar sementara klasemen memakai yang
-- dengan. Dua angka untuk satu regu di dua layar, keduanya tanpa galat, dan
-- yang menemukannya orang yang kebetulan membandingkan.
--
-- Disalin UTUH dari 0065; satu-satunya yang berubah argumen tambahan pada
-- hitung_poin. `create or replace view` menolak daftar kolom yang berubah
-- urutan atau tipenya, jadi kolomnya harus sama persis — dan memang begitu.
-- ---------------------------------------------------------------------------
create or replace view v_lembar_pos as
select
  p.nomor       as pos,
  p.name        as nama_pos,
  p.bayangan,
  r.id          as regu_id,
  r.nomor_dada,
  r.nama_regu,
  s.name        as nama_sekolah,
  r.golongan,

  coalesce((
    select jsonb_object_agg(w.kode, jsonb_build_object(
             'nilai_1', n.nilai_1, 'nilai_2', n.nilai_2))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), '{}'::jsonb) as nilai,

  (select count(*) from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor)::int
                as jumlah_terisi,

  -- INI yang berubah: hanya komponen yang berlaku untuk golongan regu ini.
  (select count(*) from wahana w
   where w.edisi = p.edisi and w.pos = p.nomor
     and komponen_berlaku(w.golongan, r.golongan))::int
                as jumlah_komponen,

  round(coalesce((
    select sum(hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
                           w.raw_terbaik, w.raw_terburuk,
                           w.poin_benar, w.poin_salah, w.total_soal, w.tingkat,
                           w.jawaban_benar))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), 0) * p.bobot, 2) as nilai_pos,

  -- Gembok (0043). Kolom BARU ditaruh paling belakang: `create or replace
  -- view` menolak daftar kolom yang berubah urutan atau tipenya, dan hanya
  -- mengizinkan penambahan di ujung.
  nilai_tergembok(r.id, p.nomor) as terkunci

from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
cross join pos p
where p.edisi = edisi_aktif()
  and not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and boleh('pos')
  and (pos_saya() is null or p.nomor = pos_saya());
-- Bentuk 10 argumen dibuang supaya tidak ada dua hitungan yang berdampingan.
-- Dijalankan SESUDAH kedua view dibuat ulang: view yang masih menunjuk bentuk
-- lama akan menahan DROP-nya — dan itu memang yang terjadi waktu berkas ini
-- ditulis, v_lembar_pos yang menahannya.
drop function if exists hitung_poin(text, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, jsonb);

-- ---------------------------------------------------------------------------
-- 4. Konfigurasi Menaksir edisi ini.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_baris integer;
  v_edisi smallint := edisi_aktif();
begin
  update wahana set
    jawaban_benar = 8.55,
    tingkat = '[{"sampai": 1, "poin": 100},
                {"sampai": 2, "poin": 80},
                {"sampai": 3, "poin": 60},
                {"sampai": 4, "poin": 40},
                {"sampai": 5, "poin": 20}]'::jsonb,
    -- Kepala kolom di layar ikut berubah: yang diketik bukan selisih lagi.
    petunjuk = '(meter)',
    -- Rentangnya jadi rentang TAKSIRAN, bukan rentang selisih. 999.99 longgar
    -- untuk apa pun yang bisa ditaksir dengan mata di lapangan, dan cukup
    -- ketat untuk menolak 8550 yang lahir dari titik yang terlewat.
    rentang_mentah_maks = 999.99
  where edisi = v_edisi and kode = 'menaksir';

  get diagnostics v_baris = row_count;

  -- Dilaporkan, bukan diandaikan: di database yang konfigurasi XXXVII-nya
  -- belum terpasang, baris `menaksir` memang tidak ada dan UPDATE ini tidak
  -- mengenai apa pun. Itu keadaan yang sah (pelajaran 0035).
  if v_baris = 0 then
    raise notice '0085: baris menaksir tidak ada di edisi % — konfigurasinya '
                 'dilewati, fungsi dan kolomnya tetap terpasang.', v_edisi;
  else
    raise notice '0085: Menaksir dinilai dari taksiran; jawaban 8.55 m, '
                 'selisih sampai 1 m tetap 100 poin.';
  end if;
end;
$blok$;
