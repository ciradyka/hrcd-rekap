-- ============================================================================
-- hrcd-rekap : supabase/checks/perbaiki_jadwal_uji.sql
--
-- Menata ulang jam berangkat dan jam datang pada DATA UJI supaya seluruhnya
-- mungkin terjadi di hari yang sebenarnya.
--
-- ---------------------------------------------------------------------------
-- APA YANG DITEMUKAN
--
--   kloter 1  berangkat 2026-08-15 16:00 WIB   — enam bulan sebelum acara
--   kloter 2  berangkat 2026-08-15 18:15 WIB   — enam bulan sebelum acara
--   5 baris   datang    2026-08-15 / 08-16     — salah satunya pukul 20:30
--   dada 003  datang 311 menit SEBELUM berangkat
--   19 regu   selisih berangkat-datang 273.000-an menit (190 hari)
--
-- Itu yang membuat Live Score menampilkan total -272355: penalti dihitung
-- dari selisih waktu yang nyata angkanya tapi mustahil kejadiannya.
--
-- Dua lagi yang tidak terlihat di layar tapi sama mustahilnya:
--
--   * `keberangkatan_regu` hanya berisi 10 baris, semuanya kloter 1, padahal
--     44 regu sudah tercatat DATANG. Regu tidak bisa pulang tanpa berangkat,
--     jadi lencana Home membaca 44/10 — pembilang melebihi penyebutnya.
--   * kloter 8, 10, 12-16 memegang regu dan tidak pernah berangkat, padahal
--     44 regu lain sudah kembali. Kalau sudah lewat tengah hari, seluruh
--     kloter mestinya sudah lepas — batasnya pukul sepuluh (CLAUDE.md 10.1).
--
-- ---------------------------------------------------------------------------
-- BENTUK YANG DITUJU
--
-- Satu pagi yang utuh, difoto sekitar pukul setengah satu siang:
--
--   * setiap kloter yang berisi regu sudah berangkat, urut nomor, di dalam
--     jendela 07:00-10:00;
--   * setiap regu di kloter itu tercentang berangkat;
--   * regu yang sudah punya catatan datang, datang sesudah kloternya
--     berangkat, kira-kira selama kontrak waktunya;
--   * sisanya masih di jalur.
--
-- ---------------------------------------------------------------------------
-- KENAPA JAM DATANGNYA BUKAN 11:00-15:00
--
-- Karena aritmetikanya tidak mengizinkan. Kloter berangkat 07:00-08:06 dan
-- kontrak waktunya 210-270 menit, jadi yang paling cepat pun tiba 10:30.
-- Tiba pukul tiga sore berarti setiap regu tiga jam lebih lambat daripada
-- kontraknya — bukan data yang wajar, melainkan data yang seluruhnya kena
-- penalti. Hasilnya di sini 10:20-12:35, dan itu memang yang keluar dari
-- jendela berangkat dan kontrak yang ada sekarang. Kalau band 11:00-15:00
-- yang diinginkan, yang digeser `kontrak_menit`, bukan jam datangnya.
--
-- ---------------------------------------------------------------------------
-- HANYUTANNYA TETAP, BUKAN ACAK
--
-- `hashtext(id)` memberi tiap regu pergeseran yang sama setiap kali skrip ini
-- dijalankan. Dijalankan dua kali hasilnya identik — kalau memakai random(),
-- angka yang sudah dibaca panitia di layar berubah diam-diam setiap kali.
--
-- Rentangnya -16..+24 menit: sebagian tiba lebih cepat dari kontrak, sebagian
-- lebih lambat. Data yang seluruhnya tepat waktu tidak pernah menguji kolom
-- penalti.
--
-- ---------------------------------------------------------------------------
-- INI DATA UJI
--
-- Skrip ini MENIMPA jam yang sudah tercatat. Jangan jalankan sesudah hari-H
-- dimulai: yang ditimpanya adalah jam yang diketik petugas dari jam dinding
-- nyata, dan itulah satu-satunya sumber penalti (CLAUDE.md 10.6).
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- 0. Pagar. Kalau edisi aktifnya sudah lewat, berhenti.
-- ---------------------------------------------------------------------------
do $$
declare v_tanggal date;
begin
  select tanggal_lomba into v_tanggal from edisi where is_active;
  if v_tanggal is null then
    raise exception 'tidak ada edisi aktif';
  end if;
  if v_tanggal < current_date then
    raise exception 'edisi aktif (%) sudah lewat — skrip ini menimpa jam '
      'yang diketik petugas dan tidak boleh dijalankan sesudah hari-H',
      v_tanggal;
  end if;
  raise notice 'edisi aktif: %', v_tanggal;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Kontrak waktu untuk regu yang belum punya. Kloter tidak diberangkatkan
--    sebelum kontraknya dikonfirmasi, jadi kloter yang berangkat tanpa
--    kontrak adalah keadaan yang tidak bisa dicapai lewat layar mana pun.
-- ---------------------------------------------------------------------------
update regu r
set kontrak_menit = 210 + (abs(hashtext(r.id::text)) % 3) * 30
where r.kloter_nomor is not null
  and not r.is_cancelled
  and r.kontrak_menit is null;

-- ---------------------------------------------------------------------------
-- 2. Jam berangkat tiap kloter yang berisi regu.
--
--    07:00 + interval x (nomor-1), ditambah hanyutan 0-6 menit. Hanyutannya
--    ada supaya catatan tidak jadi salinan persis perkiraannya — perkiraan
--    dan catatan adalah dua hal berbeda, dan data uji yang menyamakan
--    keduanya menyembunyikan bug di layar yang membedakannya.
--
--    `at time zone 'Asia/Jakarta'`, bukan `::timestamptz`: sesi database
--    berjalan di UTC, dan menstempelnya di sana menggeser seluruh pagi tujuh
--    jam. Itu cacat yang sama yang diperbaiki migrasi 0056.
-- ---------------------------------------------------------------------------
update kloter k
set jam_berangkat =
      ((e.tanggal_lomba + e.jam_mulai_berangkat) at time zone 'Asia/Jakarta')
      + make_interval(mins => e.interval_berangkat_menit * (k.nomor - 1)
                              + (k.nomor * 3) % 7)
from edisi e
where e.is_active
  and exists (select 1 from regu r
              where r.kloter_nomor = k.nomor and not r.is_cancelled);

-- ---------------------------------------------------------------------------
-- 3. Centang berangkat per regu, untuk setiap regu di kloter yang sudah
--    lepas. Tanpa ini `v_kemajuan_hari` membaca datang > berangkat.
--
--    `recorded_by` diambil dari baris yang sudah ada supaya tetap menunjuk
--    akun panitia yang sah; kolomnya wajib isi.
-- ---------------------------------------------------------------------------
insert into keberangkatan_regu (regu_id, recorded_by)
select r.id, coalesce(
         (select kb.recorded_by from keberangkatan_regu kb limit 1),
         (select c.recorded_by from closing_regu c limit 1))
from regu r
join kloter k on k.nomor = r.kloter_nomor
where k.jam_berangkat is not null
  and not r.is_cancelled
  and not exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. Jam datang: berangkat + kontrak + hanyutan -16..+24 menit.
--
--    Hanya baris yang SUDAH ada yang diperbarui. Regu yang belum tercatat
--    datang tetap belum datang — merekalah yang masih di jalur, dan angka
--    itu yang dibaca panitia sepanjang sore.
-- ---------------------------------------------------------------------------
update closing_regu c
set jam_datang = k.jam_berangkat
      + make_interval(mins => r.kontrak_menit
                              + (abs(hashtext(r.id::text)) % 41) - 16)
from regu r
join kloter k on k.nomor = r.kloter_nomor
where r.id = c.regu_id
  and k.jam_berangkat is not null
  and r.kontrak_menit is not null;

-- ---------------------------------------------------------------------------
-- 5. Laporan. Dibaca dari log workflow — kalau ada satu saja yang tersisa,
--    angkanya muncul di sini dan bukan di layar panitia.
-- ---------------------------------------------------------------------------
do $$
declare
  v_tanggal date; v_mulai time; v_batas time;
  v_luar int; v_urut int; v_mundur int; v_lama int;
  v_berangkat int; v_datang int; v_jalur int;
  v_awal text; v_akhir text;
begin
  select tanggal_lomba, jam_mulai_berangkat, jam_batas_berangkat
    into v_tanggal, v_mulai, v_batas from edisi where is_active;

  select count(*) into v_luar from kloter
  where jam_berangkat is not null
    and ((jam_berangkat at time zone 'Asia/Jakarta')::date <> v_tanggal
      or (jam_berangkat at time zone 'Asia/Jakarta')::time < v_mulai
      or (jam_berangkat at time zone 'Asia/Jakarta')::time > v_batas);

  select count(*) into v_urut from kloter a join kloter b on b.nomor > a.nomor
  where a.jam_berangkat is not null and b.jam_berangkat is not null
    and b.jam_berangkat < a.jam_berangkat;

  select count(*) into v_mundur from closing_regu c
  join regu r on r.id = c.regu_id join kloter k on k.nomor = r.kloter_nomor
  where c.jam_datang < k.jam_berangkat;

  select count(*) into v_lama from closing_regu c
  join regu r on r.id = c.regu_id join kloter k on k.nomor = r.kloter_nomor
  where c.jam_datang > k.jam_berangkat + interval '10 hours';

  select regu_berangkat, regu_datang into v_berangkat, v_datang
  from v_kemajuan_hari;

  select to_char(min(jam_datang) at time zone 'Asia/Jakarta', 'HH24:MI'),
         to_char(max(jam_datang) at time zone 'Asia/Jakarta', 'HH24:MI')
    into v_awal, v_akhir from closing_regu;

  v_jalur := v_berangkat - v_datang;

  raise notice '--------------------------------------------------------';
  raise notice 'berangkat di luar jendela %-% : %', v_mulai, v_batas, v_luar;
  raise notice 'kloter berangkat tidak urut      : %', v_urut;
  raise notice 'datang sebelum berangkat         : %', v_mundur;
  raise notice 'di jalur lebih dari 10 jam       : %', v_lama;
  raise notice 'jam datang                       : % - %', v_awal, v_akhir;
  raise notice 'berangkat / datang / masih jalur : % / % / %',
    v_berangkat, v_datang, v_jalur;
  raise notice '--------------------------------------------------------';

  if v_luar + v_urut + v_mundur + v_lama > 0 then
    raise exception 'masih ada % baris yang mustahil — dibatalkan',
      v_luar + v_urut + v_mundur + v_lama;
  end if;
  if v_jalur < 0 then
    raise exception 'datang (%) melebihi berangkat (%) — dibatalkan',
      v_datang, v_berangkat;
  end if;
end;
$$;

commit;
