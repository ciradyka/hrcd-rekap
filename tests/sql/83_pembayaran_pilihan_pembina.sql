-- ============================================================================
-- hrcd-rekap : tests/sql/83_pembayaran_pilihan_pembina.sql — migrasi 0121.
--
-- Pembina memilih cara membayar saat mendaftar, dan yang transfer wajib
-- mengunggah buktinya. Yang diuji di sini tiga hal yang gampang bocor:
--
--   1. cara bayar wajib disebut — tidak ada bentuk "tidak menyebutkan"
--   2. transfer TANPA bukti ditolak, dan ditolak di RPC maupun di constraint
--   3. bukti milik kiriman LAIN ditolak
--
-- Nomor 3 yang paling mudah terlewat. Nama objek di Storage bisa ditebak
-- siapa pun yang pernah melihat satu contohnya, dan tanpa pagar itu satu
-- pendaftaran bisa menunjuk bukti transfer milik sekolah lain — lalu terbaca
-- "sudah ada buktinya" di Meja Pembayaran.
--
-- Seluruhnya di-rollback.
-- ============================================================================

\echo '--- 83. cara bayar pilihan pembina + bukti transfer'
\set ON_ERROR_STOP on

do $blok$
declare
  v_kunci  uuid := gen_random_uuid();
  v_lain   uuid := gen_random_uuid();
  v_regu   jsonb := '[{"nama_regu":"Cakrawala","nama_ketua":"Ketua Uji",
                       "golongan":"penegak_pa"}]'::jsonb;
  v_hasil  jsonb;
  v_pesan  text;
  v_id     uuid;
  v_lolos  boolean;
begin
  -- 83.1 Cara bayar NULL — bentuk yang benar-benar dikirim gateway saat
  -- pembina memakai form lama yang belum punya bagian Pembayaran. Ditolak,
  -- bukan diam-diam dianggap tunai.
  begin
    perform submit_pendaftaran('SMP Uji Bayar', 'Jl. Uji', false, '081200000083',
                              v_regu, 0::smallint, gen_random_uuid(), 'Uji',
                              null, null);
    v_lolos := true;
  exception when others then
    v_lolos := false;
    get stacked diagnostics v_pesan = message_text;
  end;
  assert not v_lolos, '83.1 GAGAL: pendaftaran tanpa cara bayar diterima';
  assert v_pesan like '%cara pembayaran wajib dipilih%',
    format('83.1 GAGAL: ditolak, tetapi pesannya "%s"', v_pesan);

  -- 83.2 Transfer tanpa bukti: ditolak.
  begin
    perform submit_pendaftaran('SMP Uji Bayar', 'Jl. Uji', false, '081200000083',
                              v_regu, 0::smallint, gen_random_uuid(), 'Uji',
                              'transfer', null);
    v_lolos := true;
  exception when others then
    v_lolos := false;
    get stacked diagnostics v_pesan = message_text;
  end;
  assert not v_lolos, '83.2 GAGAL: transfer tanpa bukti diterima';
  assert v_pesan like '%bukti transfer wajib diunggah%',
    format('83.2 GAGAL: ditolak, tetapi pesannya "%s"', v_pesan);

  -- 83.3 Bukti milik folder kiriman LAIN: ditolak. Inilah pagar yang tidak
  -- bisa ditegakkan Storage, karena di sana kedua path sama-sama sah.
  begin
    perform submit_pendaftaran('SMP Uji Bayar', 'Jl. Uji', false, '081200000083',
                              v_regu, 0::smallint, v_kunci, 'Uji',
                              'transfer', v_lain::text || '/bukti.jpg');
    v_lolos := true;
  exception when others then
    v_lolos := false;
    get stacked diagnostics v_pesan = message_text;
  end;
  assert not v_lolos, '83.3 GAGAL: bukti milik kiriman lain diterima';
  assert v_pesan like '%bukan milik kiriman ini%',
    format('83.3 GAGAL: ditolak, tetapi pesannya "%s"', v_pesan);

  -- 83.4 Transfer dengan bukti yang benar: diterima, dan tersimpan apa adanya.
  v_hasil := submit_pendaftaran('SMP Uji Bayar', 'Jl. Uji', false, '081200000083',
                                v_regu, 0::smallint, v_kunci, 'Uji',
                                'transfer', v_kunci::text || '/bukti.jpg');
  select id into v_id from pendaftaran
   where kode_pembayaran = v_hasil ->> 'kode_pembayaran';
  assert (select metode_bayar from pendaftaran where id = v_id) = 'transfer',
    '83.4 GAGAL: metode_bayar tidak tersimpan sebagai transfer';
  assert (select bukti_transfer from pendaftaran where id = v_id)
         = v_kunci::text || '/bukti.jpg',
    '83.4 GAGAL: path bukti transfer tidak tersimpan apa adanya';

  -- 83.5 Tunai: diterima tanpa bukti, dan bukti yang terlanjur ikut terkirim
  -- TIDAK disimpan. Menyimpannya akan membuat Meja Pembayaran menawarkan
  -- gambar untuk pembayaran yang tidak pernah ditransfer.
  v_hasil := submit_pendaftaran('SMP Uji Tunai', 'Jl. Uji', false, '081200000084',
                                '[{"nama_regu":"Bimasakti","nama_ketua":"Ketua Uji",
                                   "golongan":"penegak_pi"}]'::jsonb,
                                0::smallint, gen_random_uuid(), 'Uji',
                                'tunai', 'sisa/bukti.jpg');
  select id into v_id from pendaftaran
   where kode_pembayaran = v_hasil ->> 'kode_pembayaran';
  assert (select metode_bayar from pendaftaran where id = v_id) = 'tunai',
    '83.5 GAGAL: metode_bayar tidak tersimpan sebagai tunai';
  assert (select bukti_transfer from pendaftaran where id = v_id) is null,
    '83.5 GAGAL: bukti ikut tersimpan padahal pembayarannya tunai';

  -- 83.6 Bentuk fungsinya berubah, jadi yang lama ikut diperiksa sekali lagi:
  -- nama anggota (0114) harus tetap tersimpan lewat salinan yang ditulis 0121.
  -- Tes 77 memeriksa ini terhadap bentuk 0114 dan berhenti di sana; kalau
  -- salinan di 0121 menjatuhkan satu baris, di sinilah ketahuannya.
  v_hasil := submit_pendaftaran('SMP Uji Anggota', 'Jl. Uji', false, '081200000085',
                                '[{"nama_regu":"Nusantara","nama_ketua":"Ketua Uji",
                                   "golongan":"penegak_pa",
                                   "anggota":["Andi","","Budi"]}]'::jsonb,
                                0::smallint, gen_random_uuid(), 'Uji', 'tunai', null);
  assert (select anggota from regu r
           join pendaftaran d on d.id = r.pendaftaran_id
          where d.kode_pembayaran = v_hasil ->> 'kode_pembayaran')
         = array['Andi', 'Budi'],
    '83.6 GAGAL: nama anggota tidak tersimpan rapat lewat submit_pendaftaran 0121';

  -- 83.7 Pagar terakhir, di kolomnya sendiri: UPDATE yang membuat baris jadi
  -- "transfer tanpa bukti" ditolak database, bukan hanya oleh RPC di atas.
  begin
    update pendaftaran set metode_bayar = 'transfer', bukti_transfer = null
     where kode_pembayaran = v_hasil ->> 'kode_pembayaran';
    raise exception '83.7 GAGAL: transfer tanpa bukti lolos lewat UPDATE';
  exception when check_violation then
    null;
  end;

  raise exception 'ROLLBACK UJI 83';
exception when others then
  if sqlerrm <> 'ROLLBACK UJI 83' then raise; end if;
end;
$blok$;

\echo '    83 LULUS'
