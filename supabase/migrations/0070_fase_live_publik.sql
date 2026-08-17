-- ============================================================================
-- hrcd-rekap : 0070_fase_live_publik.sql
-- Saklar fase terbaca halaman peserta seketika.
--
-- KENAPA
--
-- Diminta pemilik acara: "ada momen di mana peserta panas melihat live score,
-- kita bisa mematikannya untuk sementara." Sekarang tidak bisa — halaman
-- peserta membaca `live.json`, dan fase di berkas itu hanya berubah kalau
-- publish-live.yml dijalankan. Mematikan papan berarti membuka GitHub
-- Actions, dan itu bukan yang dilakukan orang saat kerumunan sedang panas.
--
-- View ini membuka SATU KOLOM ke anon: fase yang sedang berlaku. Bukan
-- `status_acara` seluruhnya — tabel itu memuat kunci konfigurasi dan penanda
-- hari-H yang tidak ada urusannya dengan penonton.
--
-- YANG TIDAK BERUBAH, DAN INI PAGARNYA
--
-- Fase dari sini hanya boleh MEMPERKETAT tampilan, tidak pernah membuka lebih
-- dari yang sudah diterbitkan. Berkas yang terbit saat fase `progres` memang
-- TIDAK MEMUAT satu angka pun — bukan memuat angka yang disembunyikan
-- tampilan (lihat kepala publish-live.yml). Kalau saklar ini bisa membuka
-- lebih dari isi berkasnya, jaminan itu berubah jadi "angkanya ada di CDN,
-- cuma tidak digambar" — dan siapa pun yang membuka rekap.json langsung akan
-- melihatnya.
--
-- Jadi: mematikan seketika, menyalakan tetap lewat penerbitan. Arah yang
-- mendesak justru arah yang aman.
-- ============================================================================

create or replace view v_fase_live as
select fase_live from status_acara;

comment on view v_fase_live is
  'Fase live yang sedang berlaku, satu kolom, untuk halaman peserta. Dipakai HANYA untuk memperketat tampilan — halaman tidak boleh menampilkan lebih dari isi rekap.json, karena berkas itulah yang menjamin angka belum terbit memang tidak ada di CDN.';

grant select on v_fase_live to anon, authenticated, service_role;

do $blok$
declare v_f text;
begin
  select fase_live into v_f from v_fase_live;
  raise notice '0070: fase_live yang terbaca peserta: %.', v_f;
end $blok$;
