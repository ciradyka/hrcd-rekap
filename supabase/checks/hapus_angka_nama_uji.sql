-- ============================================================================
-- hrcd-rekap : hapus_angka_nama_uji.sql
--
-- Sekali pakai. Mengubah angka di nama DATA UJI jadi angka Romawi, supaya
-- migrasi 0052 bisa diterapkan. Dijalankan lewat workflow "Apply migration to
-- Supabase" TEPAT SEBELUM 0052.
--
-- ---------------------------------------------------------------------------
-- KENAPA ROMAWI, BUKAN DIBUANG
--
-- Yang berangka ada delapan, dan sebagian saling membedakan diri HANYA lewat
-- angkanya: "Bali 2", "Bali 3", "bali 1". Membuang angkanya menabrakkan
-- ketiganya jadi satu nama, dan 0051 menolak nama kembar — perbaikan yang
-- melanggar aturan sebelahnya.
--
-- Romawi menyelesaikan keduanya sekaligus: huruf, jadi lolos 0052; tetap
-- berbeda, jadi lolos 0051. Panjangnya juga aman — "CITRALOKA SUKAPURA I"
-- tepat 20 karakter.
--
-- ---------------------------------------------------------------------------
-- CATATAN UNTUK YANG MEMBACA INI TAHUN DEPAN
--
-- Dua dari delapan nama itu ASLI dari HRCD XXXVI: "CITRALOKA SUKAPURA 1" dan
-- "LASKAR CONDONG 2" — sekolah yang mengirim beberapa regu menomori regunya
-- sendiri. Larangan angka menutup kebiasaan itu, dan itu memang disengaja:
-- nomor regu sudah ada, namanya nomor dada.
--
-- Akibatnya nyata di meja pendaftaran: sekolah yang mengirim tiga regu harus
-- memberi tiga nama yang benar-benar berbeda. 0051 sudah menuntut itu; 0052
-- cuma menutup jalan pintasnya.
-- ============================================================================

update regu set
  nama_regu  = regexp_replace(nama_regu,  '\s*\m10\M\s*$', ' X'),
  nama_ketua = regexp_replace(nama_ketua, '\s*\m10\M\s*$', ' X')
where nama_regu ~ '\m10\M$' or nama_ketua ~ '\m10\M$';

do $$
declare
  romawi text[] := array['I','II','III','IV','V','VI','VII','VIII','IX'];
  n int;
begin
  for n in 1..9 loop
    update regu
    set nama_regu = regexp_replace(nama_regu, n::text, romawi[n], 'g')
    where nama_regu ~ n::text;

    update regu
    set nama_ketua = regexp_replace(nama_ketua, n::text, romawi[n], 'g')
    where nama_ketua ~ n::text;

    update pendaftaran
    set nama_kontak = regexp_replace(nama_kontak, n::text, romawi[n], 'g')
    where nama_kontak ~ n::text;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Laporkan keadaan sesudahnya: angka, panjang, DAN kembar sekaligus. Ketiganya
-- bisa saling merusak — memanjangkan nama demi Romawi bisa melewati 20, dan
-- menyamakan dua nama bisa melanggar 0051.
-- ---------------------------------------------------------------------------
do $$
declare v_angka text; v_panjang text; v_kembar text;
begin
  select string_agg(x, ', ') into v_angka from (
    select nama_regu as x from regu where not is_cancelled and nama_regu ~ '[0-9]'
    union all
    select nama_ketua from regu where not is_cancelled and nama_ketua ~ '[0-9]'
    union all
    select nama_kontak from pendaftaran where nama_kontak ~ '[0-9]') d;

  select string_agg(format('%s (%s)', nama_regu, length(trim(nama_regu))), ', ')
  into v_panjang from regu
  where not is_cancelled and length(trim(nama_regu)) > 20;

  select string_agg(n, ', ') into v_kembar from (
    select lower(regexp_replace(trim(nama_regu), '\s+', ' ', 'g')) as n
    from regu where not is_cancelled group by 1 having count(*) > 1) d;

  if coalesce(v_angka, v_panjang, v_kembar) is null then
    raise notice 'BERSIH — tanpa angka, tanpa nama > 20 huruf, tanpa kembar. 0052 siap.';
  else
    raise warning 'MASIH ADA MASALAH. angka: % | panjang: % | kembar: %',
      coalesce(v_angka, '-'), coalesce(v_panjang, '-'), coalesce(v_kembar, '-');
  end if;
end;
$$;
