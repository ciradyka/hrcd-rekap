-- ============================================================================
-- hrcd-rekap : tests/sql/34_atur_fase_live.sql
-- Tombol Publish Live Score (migrasi 0068).
--
-- Yang dijaga: pintunya, bukan tombolnya. Tombol di layar cuma menyembunyikan
-- dirinya dari yang tidak berhak — RPC-nya yang harus menolak, karena ia bisa
-- dipanggil langsung dari devtools oleh siapa pun yang punya sesi sah.
-- ============================================================================

do $blok$
declare
  v_admin uuid := '00000000-0000-0000-0000-00000000000a';
  v_juri  uuid := '00000000-0000-0000-0000-000000000001';
  v_awal  text;
  v_pesan text;
begin
  select fase_live into v_awal from status_acara;

  -- Juri pos tidak memegang `pengaturan`.
  perform set_config('app.uid', v_juri::text, true);
  begin
    perform atur_fase_live('penuh');
    v_pesan := '(diterima)';
  exception when others then v_pesan := sqlerrm;
  end;
  assert v_pesan like '%tidak berhak: pengaturan%',
         format('juri pos seharusnya ditolak, galatnya: %s', v_pesan);
  assert (select fase_live from status_acara) = v_awal,
         'fase berubah padahal panggilannya ditolak';

  perform set_config('app.uid', v_admin::text, true);

  -- Fase karangan ditolak, bukan disimpan diam-diam.
  begin
    perform atur_fase_live('setengah');
    v_pesan := '(diterima)';
  exception when others then v_pesan := sqlerrm;
  end;
  assert v_pesan like '%tidak dikenal%',
         format('fase karangan seharusnya ditolak, galatnya: %s', v_pesan);

  -- Admin membuka lalu menutup lagi.
  assert atur_fase_live('penuh') = 'penuh', 'admin gagal membuka klasemen';
  assert (select fase_live from status_acara) = 'penuh', 'fase tidak tersimpan';
  -- Dipanggil dua kali dengan nilai yang sama: tidak apa-apa.
  assert atur_fase_live('penuh') = 'penuh', 'panggilan ulang seharusnya aman';

  assert atur_fase_live('progres') = 'progres', 'admin gagal menutup klasemen';

  update status_acara set fase_live = v_awal;
end $blok$;

\echo '34 atur fase live: LULUS'
