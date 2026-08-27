-- ============================================================================
-- hrcd-rekap : 0126_nama_regu_kapital.sql
--
-- Nama regu selalu KAPITAL, di mana pun ia muncul.
--
-- ---------------------------------------------------------------------------
-- KENAPA DI DATABASE, BUKAN DI LAYAR
--
-- Nama regu tampil di belasan tempat: form pendaftaran, konfirmasi, pesan
-- WhatsApp, Meja Pembayaran, Meja Daftar Ulang, papan Keberangkatan, lembar
-- input nilai per pos, blangko cetak, Live Score, dan rekap yang terbit ke
-- halaman peserta. Menyeragamkannya dengan `text-transform: uppercase` berarti
-- menambal belasan tempat, melewatkan sebagian, dan sama sekali tidak menyentuh
-- yang BUKAN layar — pesan WhatsApp dan berkas JSON yang terbit adalah teks
-- biasa, bukan HTML.
--
-- Kalau datanya sendiri kapital, ketiga belas tempat itu benar tanpa satu baris
-- pun ditambahkan, sekarang maupun tahun depan.
--
-- ---------------------------------------------------------------------------
-- APA YANG TIDAK BERUBAH
--
-- Indeks nama unik memakai bentuk yang sudah dinormalkan (huruf kecil, spasi
-- dirapatkan), jadi mengubah huruf besar-kecil TIDAK melahirkan tabrakan baru
-- dan tidak pula menghapus tabrakan lama.
--
-- `regu_nama_panjang` menghitung karakter dan `regu_nama_regu_tiga_huruf`
-- menghitung huruf; `upper()` tidak mengubah jumlah keduanya.
--
-- Nama KETUA dan nama ANGGOTA sengaja TIDAK ikut dikapitalkan. Yang dibacakan
-- di lapangan dan dicetak besar di blangko adalah nama regu; nama orang ditulis
-- sebagaimana orangnya menulisnya.
-- ============================================================================

update regu set nama_regu = upper(nama_regu) where nama_regu <> upper(nama_regu);

create or replace function regu_nama_kapital()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.nama_regu := upper(new.nama_regu);
  return new;
end;
$fn$;

comment on function regu_nama_kapital() is
  'Nama regu disimpan kapital supaya seluruh layar, cetakan, pesan WhatsApp, '
  'dan berkas terbit menampilkannya seragam tanpa menambal satu per satu.';

drop trigger if exists regu_kapital on regu;
create trigger regu_kapital
  before insert or update of nama_regu on regu
  for each row execute function regu_nama_kapital();

do $blok$
declare v_sisa int;
begin
  select count(*) into v_sisa from regu where nama_regu <> upper(nama_regu);
  if v_sisa > 0 then
    raise exception '0126: masih ada % nama regu yang belum kapital', v_sisa;
  end if;
  raise notice '0126: seluruh nama regu kapital, dan trigger menjaga yang baru.';
end;
$blok$;
