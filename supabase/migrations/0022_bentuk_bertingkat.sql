-- ============================================================================
-- hrcd-rekap : 0022_bentuk_bertingkat.sql
--
-- Bentuk konversi keenam: `bertingkat` — tangga poin, bukan garis lurus.
--
-- Kenapa perlu. Pos 4 menilai KECEPATAN praktik kesehatan, dan lembar yang
-- dipakai panitia memberi poin seperti ini:
--
--   sampai 1 menit  -> 50      1 menit 1 detik - 1 menit 30  -> 30
--   1:31 - 2:00     -> 15      lebih dari 2 menit            -> 0
--
-- Itu bukan interpolasi. `kecil_baik` dengan terbaik 60 detik dan terburuk
-- 180 detik memberi 37,5 poin untuk 90 detik, bukan 30 — jadi seluruh Pos 4
-- meleset kalau dipaksa masuk ke bentuk yang sudah ada. Panitia memang
-- menilai bertingkat: yang dihargai adalah masuk ke pita waktu berikutnya,
-- bukan tiap detik.
--
-- Bentuknya sengaja "kecil lebih baik": tiap tingkat menyebut batas ATASNYA,
-- dan yang berlaku adalah tingkat pertama yang masih memuat nilai mentahnya.
-- Di luar semua tingkat = 0 poin.
--
--   [{"sampai": 60, "poin": 50}, {"sampai": 90, "poin": 30},
--    {"sampai": 120, "poin": 15}]
--
-- Ditambah juga `wahana.satuan`, supaya layar tahu satu angka mentah itu
-- DETIK dan boleh menampilkannya sebagai dua kotak (Menit | Detik) seperti di
-- lembar kertas. Yang tersimpan tetap satu angka — satuan hanya mengatur cara
-- mengetiknya, bukan cara menghitungnya.
-- ============================================================================

-- 1. Kolom konfigurasi -----------------------------------------------------
alter table wahana add column tingkat jsonb;
alter table wahana add column satuan  text;

comment on column wahana.tingkat is
  'Tangga poin untuk form=bertingkat: [{"sampai": <nilai mentah maksimum>, '
  '"poin": <poin>}, ...]. Tingkat pertama yang masih memuat nilai mentahnya '
  'yang berlaku; di luar semuanya = 0.';
comment on column wahana.satuan is
  'Satuan nilai mentah, untuk tampilan saja: detik, kali, poin, ... '
  'satuan=detik membuat layar menampilkan dua kotak Menit + Detik.';

-- 2. Daftar bentuk yang sah ------------------------------------------------
-- Constraint ini lahir di 0001 sebagai check kolom `bentuk`; 0014 mengganti
-- nama kolomnya jadi `form` tapi TIDAK mengganti nama constraint-nya —
-- karena itu yang di-drop bernama `wahana_bentuk_check`, bukan
-- `wahana_form_check`. Yang dipasang di sini memakai nama yang benar.
alter table wahana drop constraint if exists wahana_bentuk_check;
alter table wahana add constraint wahana_form_check check (form in
  ('kecil_baik', 'besar_baik', 'biner',
   'benar_per_total', 'benar_kurang_salah', 'bertingkat'));

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'wahana'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%benar_kurang_salah%'
      and pg_get_constraintdef(oid) not like '%bertingkat%'
      and pg_get_constraintdef(oid) not like '%<>%') then
    raise exception 'daftar bentuk lama masih terpasang dengan nama constraint yang berbeda — cari namanya lewat \d wahana lalu drop manual';
  end if;
end;
$$;

-- Parameter wajib sesuai bentuk, sama seperti empat check sebelumnya di 0001:
-- konfigurasi setengah jadi tertolak sejak insert, bukan menghasilkan poin
-- null diam-diam saat lomba berjalan.
alter table wahana add constraint wahana_tingkat_check check (
  form <> 'bertingkat'
  or (tingkat is not null
      and jsonb_typeof(tingkat) = 'array'
      and jsonb_array_length(tingkat) > 0));

-- 3. Mesin konversi --------------------------------------------------------
-- hitung_poin bertambah satu argumen, jadi ini FUNGSI BARU, bukan pengganti.
-- Urutannya: buat yang baru -> arahkan view ke sana -> baru buang yang lama.
-- Dibalik, DROP-nya akan ditolak karena view masih memakainya; dan kalau yang
-- lama dibiarkan hidup berdampingan, panggilan 9 argumen tetap sah dan
-- diam-diam melewatkan seluruh tangga poin.
create or replace function hitung_poin(
  p_bentuk       text,
  p_nilai_1      numeric,
  p_nilai_2      numeric,
  p_poin_maks    numeric,
  p_raw_terbaik  numeric,
  p_raw_terburuk numeric,
  p_poin_benar   numeric,
  p_poin_salah   numeric,
  p_total_soal   numeric,
  p_tingkat      jsonb
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
    when 'bertingkat' then
      coalesce((
        select (t ->> 'poin')::numeric
        from jsonb_array_elements(p_tingkat) t
        where p_nilai_1 <= (t ->> 'sampai')::numeric
        order by (t ->> 'sampai')::numeric
        limit 1), 0)
  end, 2)
$$;

-- View memakai bentuk 10 argumen. Daftar kolom keluarannya TIDAK berubah,
-- jadi v_poin_pos yang bertumpu padanya tidak perlu ikut dibuat ulang.
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
              w.poin_benar, w.poin_salah, w.total_soal, w.tingkat) as poin
from nilai_mentah n
join wahana w on w.id = n.wahana_id
where w.edisi = edisi_aktif();

drop function hitung_poin(text, numeric, numeric, numeric,
                          numeric, numeric, numeric, numeric, numeric);

grant execute on function hitung_poin(text, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, jsonb) to authenticated, service_role;
