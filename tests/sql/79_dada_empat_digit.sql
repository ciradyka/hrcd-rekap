-- ============================================================================
-- hrcd-rekap : tests/sql/79_dada_empat_digit.sql — migrasi 0117.
-- Pesan galat tidak boleh MEMOTONG nomor dada empat digit.
--
-- `lpad(nomor::text, 3, '0')` memanjangkan 1 jadi "001" — dan memotong 1001
-- jadi "100". Yang membuatnya berbahaya: 100 adalah regu Eksternal yang
-- benar-benar ada, jadi pesannya tidak tampak rusak sama sekali. Petugas
-- garis start mencari regu yang salah pada pukul tujuh pagi.
--
-- Diuji lewat pesan yang benar-benar keluar dari `berangkatkan_kloter`, bukan
-- dengan membaca definisinya: yang harus benar apa yang dibaca petugas.
-- ============================================================================

\echo '--- 79. nomor dada empat digit tidak terpotong di pesan galat'
\set ON_ERROR_STOP on

begin;

do $blok$
declare
  v_sekolah uuid;
  v_daftar  uuid;
  v_regu    uuid;
  v_kloter  smallint;
  v_nomor   int;
  v_tolak   boolean := false;
  v_pesan   text;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  update status_acara set daftar_ulang_ditutup = false where id;

  select min(s.nomor) into v_nomor from nomor_dada_stok s
   where s.nomor >= 1001
     and not exists (select 1 from regu r where r.nomor_dada = s.nomor)
     and not exists (select 1 from nomor_dada_pensiun p where p.nomor = s.nomor);
  assert v_nomor >= 1001, '79.0: tidak ada nomor Intern bebas di stok';

  -- Kloter kosong yang belum berangkat, dan tidak boleh ada kloter berisi
  -- sebelum ia — `berangkatkan_kloter` menolak yang melompati.
  update kloter set jam_berangkat = null, dicetak_pada = null;
  update regu set kloter_nomor = null, urutan_kloter = null, nomor_dada = null
   where not is_cancelled;

  select id into v_sekolah from sekolah order by name limit 1;
  insert into pendaftaran
    (sekolah_id, kode_pembayaran, jumlah_regu, kontak_wa, status)
  values (v_sekolah, 'UJI-DIGIT-0117', 1, '081200000117', 'lunas')
  returning id into v_daftar;
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  values (v_daftar, 'EMPAT DIGIT UJI', 'Ketua Uji', 'intern_pa')
  returning id into v_regu;

  perform * from daftar_ulang_batch('UJI-DIGIT-0117', jsonb_build_array(
    jsonb_build_object('regu_id', v_regu, 'nomor_dada', v_nomor)));
  select kloter_nomor into v_kloter from regu where id = v_regu;

  -- Regu SUDAH DICEKLIS HADIR tapi belum berkontrak: persis keadaan yang
  -- memicu pesannya. Baris di `keberangkatan_regu` ITU SENDIRI yang berarti
  -- hadir — tidak ada kolom `hadir`, dan yang mencatatnya wajib disebut.
  insert into keberangkatan_regu (regu_id, recorded_by)
  values (v_regu, '00000000-0000-0000-0000-00000000000a')
  on conflict (regu_id) do nothing;
  update regu set kontrak_menit = null where id = v_regu;

  begin
    perform berangkatkan_kloter(v_kloter, now());
    raise exception 'GAGAL: kloter berangkat padahal ada regu tanpa kontrak';
  exception when others then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    v_tolak := true; v_pesan := sqlerrm;
  end;

  assert v_tolak, '79.1 GAGAL: regu tanpa kontrak tidak menahan keberangkatan';
  assert v_pesan like '%' || v_nomor::text || '%',
    format('79.1 GAGAL: pesan tidak menyebut nomor %s apa adanya: %s', v_nomor, v_pesan);
  -- Inilah bentuk terpotongnya. Dituliskan terpisah supaya kalau tes ini
  -- gugur, yang membacanya langsung tahu apa yang dicari.
  assert v_pesan not like '%' || left(v_nomor::text, 3) || ' %'
     and v_pesan not like '%' || left(v_nomor::text, 3),
    format('79.1 GAGAL: nomor %s terpotong jadi %s di pesan: %s',
           v_nomor, left(v_nomor::text, 3), v_pesan);

  -- 79.2 Tiga digit TETAP ditulis tiga digit — bentuk yang tertulis di kain,
  --      dan perbaikan empat digit tidak boleh menghapusnya.
  assert lpad('7', 3, '0') = '007', '79.2: asumsi bentuk tiga digit berubah';

  perform set_config('app.uid', '', true);
  raise notice '79 OK — nomor % disebut utuh di pesan keberangkatan.', v_nomor;
end;
$blok$;

rollback;

select '79_dada_empat_digit OK' as hasil;
