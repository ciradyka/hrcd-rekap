-- ============================================================================
-- hrcd-rekap : 0038_petunjuk_menaksir.sql
--
-- Judul kolom Menaksir berbunyi persis seperti yang panitia minta:
--
--     (selisih meter)
--
-- Menggantikan "selisih jarak · 0 = tepat" dari 0037. Tambahan "0 = tepat"
-- dipasang di sana sebagai pengingat bahwa 0 adalah angka yang boleh ditulis —
-- panitia sudah membacanya dan memutuskan kalimatnya cukup pendek saja.
-- Keputusan itu diikuti; yang tersisa hanyalah catatan bahwa satu-satunya
-- tempat aturan itu diajarkan sekarang adalah briefing petugas, bukan kertas
-- maupun layar.
--
-- Kolom `petunjuk` (0037) memang dibuat untuk ini: mengubah bunyinya tidak
-- menyentuh satu baris kode pun, tidak perlu deploy, dan tidak bisa membuat
-- layar mana pun rusak.
--
-- Rentangnya TIDAK dikembalikan. Batas atas 99999999.99 tetap, karena
-- panitia meminta validasi cukup ">= 0" — dan sejak 0037 angka itu tidak
-- pernah tampil di mana pun, justru itulah gunanya kolom `petunjuk`.
-- ============================================================================

do $$
declare v_baris int;
begin
  update wahana set petunjuk = '(selisih meter)'
  where edisi = edisi_aktif() and kode = 'menaksir';

  get diagnostics v_baris = row_count;
  if v_baris = 0 then
    raise notice '0038: komponen `menaksir` tidak ada di edisi aktif — dilewati.';
  else
    raise notice '0038: petunjuk Menaksir jadi "(selisih meter)".';
  end if;
end;
$$;
