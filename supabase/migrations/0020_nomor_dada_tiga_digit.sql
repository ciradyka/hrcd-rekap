-- ============================================================================
-- hrcd-rekap : 0020_nomor_dada_tiga_digit.sql
--
-- Nomor dada di pesan galat dicetak TIGA DIGIT, sama seperti di seluruh layar.
--
-- Kain nomor dada yang dipegang regu tertulis "076", dan setiap layar yang
-- menampilkannya memakai bentuk itu (padStart(3, "0") di web/js/app.js —
-- daftar kloter, lembar barak, kwitansi, semuanya). Hanya pesan galat dari
-- database yang mencetak angka mentahnya: "regu nomor dada 76 belum
-- konfirmasi kontrak waktu".
--
-- Kelihatannya sepele, tapi bedanya nyata di lapangan. Petugas keberangkatan
-- membaca pesan itu lalu MENCARI kain fisiknya di antara puluhan regu, dan
-- yang tertulis di kain adalah 076. Dua bentuk untuk benda yang sama membuat
-- ia ragu sejenak setiap kali — persis di saat kloter sudah menunggu di garis
-- start.
--
-- Sekalian daftarnya diurutkan. string_agg tanpa ORDER BY mengikuti urutan
-- baris yang kebetulan dikembalikan Postgres, jadi pesan yang sama bisa
-- menyebut "076, 012" sekali dan "012, 076" di lain waktu. Petugas menyapu
-- daftar itu dengan mata; urutan yang berubah-ubah membuatnya menghitung
-- ulang dari awal.
--
-- Fungsi lain masih mencetak nomor dada mentah di pesannya (mis.
-- 'nomor dada % tidak dikenal' di catat_closing dan pindah_kloter). Itu
-- masalah yang sama dan layak dibereskan, tapi sengaja TIDAK diborong ke
-- migrasi ini: tiap perbaikan menuntut seluruh badan fungsinya disalin ulang,
-- dan menyalin lima fungsi sekaligus menukar satu cacat tampilan dengan
-- risiko salah ketik yang jauh lebih mahal.
-- ============================================================================

-- terbaru dari 0014_rename_common_columns.sql
create or replace function berangkatkan_kloter(
  p_kloter smallint,
  p_jam    timestamptz
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tanpa_kontrak text;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if p_jam is null then
    raise exception 'jam berangkat wajib diketik';
  end if;
  if exists (select 1 from kloter where nomor = p_kloter and jam_berangkat is not null) then
    raise exception 'kloter % sudah berangkat', p_kloter;
  end if;
  -- Papan pipeline diturunkan dari max(nomor berangkat) — satu ketukan salah
  -- (memberangkatkan kloter kosong / melompati) merusak seluruh papan.
  -- Guard: kloter harus berisi regu, dan tidak boleh melompati kloter berisi
  -- regu yang belum berangkat (temuan review).
  if not exists (select 1 from regu r where r.kloter_nomor = p_kloter and not r.is_cancelled) then
    raise exception 'kloter % tidak berisi regu', p_kloter;
  end if;
  if exists (
       select 1 from kloter k
       where k.nomor < p_kloter and k.jam_berangkat is null
         and exists (select 1 from regu r
                     where r.kloter_nomor = k.nomor and not r.is_cancelled)) then
    raise exception 'masih ada kloter sebelum % yang belum berangkat — urutan keberangkatan wajib berurut', p_kloter;
  end if;

  -- Regu yang diceklis berangkat wajib sudah berkontrak — mencegah penalti
  -- waktu yang tak terhitung (NULL) di kemudian hari.
  -- lpad(...) = bentuk yang tertulis di kain nomor dadanya; lihat kepala
  -- berkas ini. ORDER BY supaya daftarnya tidak berubah urutan tiap kali.
  select string_agg(lpad(r.nomor_dada::text, 3, '0'), ', ' order by r.nomor_dada)
    into v_tanpa_kontrak
  from regu r
  join keberangkatan_regu k on k.regu_id = r.id
  where r.kloter_nomor = p_kloter and r.kontrak_menit is null;
  if v_tanpa_kontrak is not null then
    raise exception 'regu nomor dada % belum konfirmasi kontrak waktu', v_tanpa_kontrak;
  end if;

  update kloter set jam_berangkat = p_jam where nomor = p_kloter;
end;
$$;
