-- ============================================================================
-- hrcd-rekap : 0084_biaya_175_ribu.sql
--
-- BIAYA PENDAFTARAN JADI Rp 175.000 PER REGU (sebelumnya Rp 250.000).
--
-- ---------------------------------------------------------------------------
-- SATU ANGKA, DAN ITU MEMANG CUKUP
--
-- Tagihan TIDAK PERNAH DISIMPAN di baris pendaftaran. Ia dihitung ulang tiap
-- kali dibaca — `jumlah_regu * biaya_per_regu` — di form pendaftaran publik
-- (`v_edisi_publik`), di Meja Pembayaran, dan di dalam
-- `verifikasi_pembayaran` yang menolak nominal yang tidak pas. Jadi mengganti
-- satu angka di sini mengganti seluruhnya sekaligus, dan tidak ada tempat
-- kedua yang bisa tertinggal menyebut harga lama.
--
-- ---------------------------------------------------------------------------
-- YANG PERLU DIKETAHUI KALAU SUDAH ADA YANG BAYAR
--
-- `pembayaran.amount` menyimpan yang BENAR-BENAR dibayar, jadi kwitansi lama
-- tidak berubah dan riwayatnya utuh. Tapi layar menghitung tagihan dengan
-- harga yang berlaku SEKARANG — sekolah yang sudah melunasi 250.000 akan
-- terlihat membayar lebih dari tagihannya, dan yang belum bayar otomatis
-- beralih ke harga baru.
--
-- Migrasi ini melaporkan berapa batch yang sudah lunas supaya yang
-- menjalankannya tahu persis apakah keadaan itu benar-benar terjadi. Kalau
-- angkanya nol — dan pada saat berkas ini ditulis memang nol, seluruh isinya
-- masih data uji — tidak ada yang perlu ditindaklanjuti.
--
-- ---------------------------------------------------------------------------
-- KENAPA TIDAK ADA BERKAS TES SENDIRI
--
-- Berbeda dengan tanggal lomba (0083), harga yang salah TIDAK DIAM. Ia
-- tercetak di form pendaftaran yang dibaca pembina, dan
-- `verifikasi_pembayaran` menolak nominal yang tidak sama dengan tagihan
-- dengan galat yang menyebut kedua angkanya. Kesalahannya berteriak pada
-- transaksi pertama.
--
-- Harganya juga berganti tiap edisi, jadi tes yang memaku 175000 adalah
-- pekerjaan tahunan untuk menjaga sesuatu yang sudah dijaga layar. Yang
-- dipasang di sini cukup pemeriksaan bahwa UPDATE-nya benar-benar kena.
-- ============================================================================

update edisi
set biaya_per_regu = 175000
where nomor = 37;

do $blok$
declare
  v_biaya integer;
  v_lunas integer;
begin
  select biaya_per_regu into v_biaya from edisi where nomor = 37;

  if not found then
    raise notice '0084: edisi 37 tidak ada di database ini — dilewati.';
    return;
  end if;

  assert v_biaya = 175000, format('0084: biaya masih %s', v_biaya);

  select count(*) into v_lunas from pendaftaran where status = 'lunas';
  -- Angkanya polos, tanpa pemisah ribuan: `to_char` memakai pemisah bawaan
  -- server, dan di Supabase itu koma — "Rp 175,000" di catatan berbahasa
  -- Indonesia terbaca seperti seratus tujuh puluh lima koma nol.
  raise notice '0084: biaya per regu Rp %. Batch berstatus lunas: % '
               '(kwitansinya tetap menyebut nominal yang dibayar).',
               v_biaya, v_lunas;
end;
$blok$;
