-- ============================================================================
-- hrcd-rekap : 0034_nama_pos_final.sql
--
-- Nama pos HRCD XXXVII sebagaimana disebut panitia, kata demi kata:
--
--   Pos 1  Kepramukaan
--   Pos 2  Halang Rintang
--   Pos 3  P3K
--   Pos 4  PBB
--   Pos 5  Yel-Yel
--
-- Dua yang berubah dari 0033: Pos 3 yang tadinya 'P3K dan Kim' — nama itu
-- saya turunkan sendiri dari isinya karena panitia belum menyebutnya — dan
-- Pos 5 yang tadinya 'Yel-yel'.
--
-- ---------------------------------------------------------------------------
-- PENJAGANYA SAMA DENGAN 0033, DAN ITU PERLU
--
-- Berkas ini mengganti nama BERDASARKAN NOMOR POS. Itu hanya benar kalau tata
-- letak XXXVII memang sudah terpasang. Di database yang 0033-nya dilewati —
-- database uji, misalnya — Pos 5 masih GARIS FINISH, dan menamainya 'Yel-Yel'
-- membuat garis finish menyamar jadi pos penilaian. Tidak ada yang gagal; yang
-- rusak hanya arti kata di layar, dan itu jenis kerusakan yang paling lama
-- tidak ketahuan.
--
-- Jadi syaratnya disamakan: jalan hanya bila edisi belum memuat satu nilai
-- pun — persis keadaan yang membuat 0033 jadi memasang konfigurasinya.
--
-- Nama pos adalah UI text: ia dibaca panitia di layar dan di kertas, jadi
-- yang dipakai kata yang mereka ucapkan sendiri (CLAUDE.md aturan 5.1).
-- "P3K" bukan singkatan yang perlu dipanjangkan di sini — begitulah pos itu
-- dipanggil di lapangan.
-- ============================================================================

do $$
declare v_edisi smallint; v_nilai int;
begin
  select nomor into v_edisi from edisi where is_active;
  if v_edisi is null then
    raise notice '0034: belum ada edisi aktif — nama pos dilewati.';
    return;
  end if;

  select count(*) into v_nilai
  from nilai_mentah n join wahana w on w.id = n.wahana_id
  where w.edisi = v_edisi;

  if v_nilai > 0 then
    raise notice '0034: edisi % memuat % nilai — tata letak XXXVII tidak '
                 'terpasang, nama pos TIDAK diubah.', v_edisi, v_nilai;
    return;
  end if;

  update pos set name = 'Kepramukaan'    where edisi = v_edisi and nomor = 1;
  update pos set name = 'Halang Rintang' where edisi = v_edisi and nomor = 2;
  update pos set name = 'P3K'            where edisi = v_edisi and nomor = 3;
  update pos set name = 'PBB'            where edisi = v_edisi and nomor = 4;
  update pos set name = 'Yel-Yel'        where edisi = v_edisi and nomor = 5;

  raise notice '0034: nama pos edisi % disesuaikan.', v_edisi;
end;
$$;
