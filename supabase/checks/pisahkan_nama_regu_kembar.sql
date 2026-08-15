-- ============================================================================
-- hrcd-rekap : pisahkan_nama_regu_kembar.sql
--
-- Sekali pakai. Memisahkan nama regu yang kembar supaya migrasi 0051 bisa
-- diterapkan. Dijalankan lewat workflow "Apply migration to Supabase" dengan
-- path berkas ini, TEPAT SEBELUM 0051.
--
-- ---------------------------------------------------------------------------
-- KENAPA MENGGANTI NAMA, BUKAN MENGHAPUS
--
-- Menghapus baris regu ikut membuang kaitannya ke pendaftaran, dan pendaftaran
-- itu bisa saja dipakai menguji pembayaran atau kwitansi. Mengganti nama
-- membuka jalan untuk indeks unik tanpa satu baris pun hilang — dan kalau
-- ternyata keliru, ia bisa dibalik dengan mengetik nama lamanya.
--
-- Pemilik repo menyatakan seluruh data sekarang masih dummy, jadi mengubah
-- nama di sini tidak menyentuh milik sekolah mana pun.
--
-- ---------------------------------------------------------------------------
-- YANG MANA YANG DIGANTI
--
-- Yang PERTAMA (id terkecil) mempertahankan namanya; sisanya diberi akhiran
-- " 2", " 3", dan seterusnya. Urutan by id, bukan acak, supaya menjalankan
-- skrip ini dua kali menghasilkan hal yang sama.
--
-- Nama dasarnya dipotong lebih dulu bila perlu: batas 20 karakter di 0051
-- berlaku pada hasil akhirnya, jadi "NAMA YANG SUDAH PAS 20" + " 2" akan
-- melanggar aturan yang justru sedang kita siapkan.
-- ============================================================================

with kembar as (
  select
    id,
    nama_regu,
    row_number() over (
      partition by lower(regexp_replace(trim(nama_regu), '\s+', ' ', 'g'))
      order by id) as urutan
  from regu
  where not is_cancelled
)
update regu r
set nama_regu = left(k.nama_regu, 20 - length(' ' || k.urutan::text))
                || ' ' || k.urutan::text
from kembar k
where r.id = k.id and k.urutan > 1;

-- ---------------------------------------------------------------------------
-- Laporkan keadaan sesudahnya, supaya yang menjalankan tidak perlu menebak
-- apakah 0051 akan lolos.
-- ---------------------------------------------------------------------------
do $$
declare v_panjang text; v_kembar text;
begin
  select string_agg(format('%s (%s)', nama_regu, length(trim(nama_regu))), ', ')
  into v_panjang from regu
  where not is_cancelled and length(trim(nama_regu)) > 20;

  select string_agg(n, ', ') into v_kembar from (
    select lower(regexp_replace(trim(nama_regu), '\s+', ' ', 'g')) as n
    from regu where not is_cancelled group by 1 having count(*) > 1) d;

  if v_panjang is null and v_kembar is null then
    raise notice 'BERSIH — tidak ada nama > 20 huruf, tidak ada kembar. 0051 siap.';
  else
    raise warning 'MASIH ADA MASALAH. panjang: % | kembar: %',
      coalesce(v_panjang, '-'), coalesce(v_kembar, '-');
  end if;
end;
$$;
