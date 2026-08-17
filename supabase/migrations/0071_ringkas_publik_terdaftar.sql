-- ============================================================================
-- hrcd-rekap : 0071_ringkas_publik_terdaftar.sql
-- Angka di halaman peserta menghitung yang MENDAFTAR, bukan yang membayar.
--
-- KENAPA
--
-- Sebelum lomba, halaman peserta dibuka orang yang belum ikut — dan angka yang
-- menarik mereka adalah "sudah berapa yang mendaftar", bukan "sudah berapa
-- yang lunas". `v_publik_ringkas` sejak 0005 menghitung `status = 'lunas'`,
-- jadi regu yang sudah mengisi formulir tapi belum transfer tidak terhitung —
-- padahal merekalah bukti acaranya ramai.
--
-- Selisihnya nol di data contoh (semuanya lunas), jadi ini tidak akan pernah
-- terlihat sampai ada pendaftar sungguhan yang belum bayar. Diminta pemilik
-- acara, dua kali, dan disebutkan untuk KEDUA angka: totalnya dan pecahan per
-- golongan.
--
-- NAMANYA IKUT BERGANTI
--
-- `jumlah_regu_lunas` -> `jumlah_regu_daftar`. Membiarkan nama lama sambil
-- mengganti artinya adalah cara paling rapi untuk membuat orang berikutnya
-- salah membacanya — dan angka yang salah dibaca di halaman publik tidak
-- pernah mengeluh.
--
-- `live.js` membaca nama baru dengan mundur ke nama lama, jadi `live.json`
-- yang sudah terbit tetap tergambar sampai penerbitan berikutnya.
-- ============================================================================

-- `create or replace` TIDAK bisa mengganti nama kolom view — ia menolak
-- dengan "cannot change name of view column". Jadi view-nya dibuang dulu.
-- TANPA cascade, sengaja: kalau ternyata ada yang bergantung padanya,
-- perintah ini gagal keras alih-alih ikut menghapusnya diam-diam.
drop view if exists v_publik_ringkas;
create view v_publik_ringkas as
select
  (select fase_live from status_acara) as fase_live,
  -- Yang dihitung: regu yang ADA dan tidak batal. Status pembayarannya tidak
  -- ikut menyaring.
  (select count(*) from regu r where not r.is_cancelled) as jumlah_regu_daftar,
  (select jsonb_object_agg(golongan, jumlah) from (
     select golongan, count(*) as jumlah
     from regu r where not r.is_cancelled
     group by golongan) g) as per_golongan;

grant select on v_publik_ringkas to anon, authenticated, service_role;

comment on view v_publik_ringkas is
  'Ringkasan untuk halaman peserta. Menghitung yang MENDAFTAR, bukan yang lunas: sebelum lomba, halaman ini dibaca calon peserta, dan angka yang menarik mereka jumlah pendaftar.';

do $blok$
declare v_daftar int; v_lunas int;
begin
  select jumlah_regu_daftar into v_daftar from v_publik_ringkas;
  select count(*) into v_lunas from regu r
    join pendaftaran d on d.id = r.pendaftaran_id
   where d.status = 'lunas' and not r.is_cancelled;
  raise notice '0071: % regu mendaftar, % di antaranya lunas.', v_daftar, v_lunas;
end $blok$;
