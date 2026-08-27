-- ============================================================================
-- hrcd-rekap : tests/sql/85_nama_regu_kapital.sql — migrasi 0126.
--
-- Nama regu disimpan kapital supaya seluruh layar, cetakan, pesan WhatsApp,
-- dan berkas terbit seragam tanpa menambal satu per satu. Yang diuji: jalur
-- pendaftaran DAN penulisan langsung, karena panitia juga mengetik nama dari
-- layar meja — dan trigger inilah satu-satunya yang menjaga jalur itu.
-- ============================================================================

\echo '--- 85. nama regu selalu kapital'
\set ON_ERROR_STOP on

do $blok$
declare
  v_hasil jsonb;
  v_id    uuid;
  v_nama  text;
begin
  v_hasil := submit_pendaftaran('SMP Uji Kapital', 'Jl. Uji', false, '081200000085',
               '[{"nama_regu":"Rajawali Muda","nama_ketua":"Andi Saputra",
                  "golongan":"penegak_pa"}]'::jsonb,
               0::smallint, gen_random_uuid(), 'Uji', 'tunai', null);
  select r.id, r.nama_regu into v_id, v_nama
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v_hasil ->> 'kode_pembayaran';
  assert v_nama = 'RAJAWALI MUDA',
    format('85.1 GAGAL: tersimpan "%s", seharusnya RAJAWALI MUDA', v_nama);

  -- Nama orang TIDAK ikut dikapitalkan.
  assert (select nama_ketua from regu where id = v_id) = 'Andi Saputra',
    '85.1 GAGAL: nama ketua ikut dikapitalkan';

  -- 85.2 Jalur meja: UPDATE langsung juga dijaga trigger.
  update regu set nama_regu = 'elang senja' where id = v_id;
  assert (select nama_regu from regu where id = v_id) = 'ELANG SENJA',
    '85.2 GAGAL: UPDATE dari layar meja lolos tanpa dikapitalkan';

  raise exception 'ROLLBACK UJI 85';
exception when others then
  if sqlerrm <> 'ROLLBACK UJI 85' then raise; end if;
end;
$blok$;

\echo '    85 LULUS'
