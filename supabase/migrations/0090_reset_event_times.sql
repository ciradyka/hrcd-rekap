-- ============================================================================
-- hrcd-rekap : 0090_reset_event_times.sql
-- Reset waktu operasional sebelum keberangkatan sebenarnya dimulai.
--
-- KEPUTUSAN PEMILIK, 21 AGUSTUS 2026
--
-- Seluruh jam berangkat dan jam datang di production harus dibersihkan agar
-- semua kloter kembali terlihat belum berangkat dan belum ada regu yang
-- closing. `closing_regu.jam_datang` wajib terisi, jadi "hapus jam datang"
-- berarti menghapus baris closing beserta anggota_hadir, note, dan jejak siapa
-- yang mencatatnya. History audit tetap dipertahankan.
--
-- Ceklis `keberangkatan_regu` ikut dihapus. Walaupun tabel itu tidak menyimpan
-- jam, v_kemajuan_hari membacanya sebagai peserta sudah berangkat; membiarkan
-- ceklis akan membuat layar tetap melaporkan keberangkatan setelah jam kloter
-- dikosongkan.
--
-- Yang sengaja TIDAK disentuh:
--   - kontrak_menit: pilihan kontrak waktu peserta tetap ada;
--   - nomor dada, penempatan kloter, nilai, dan tanda cetak kloter.
--
-- Kedua tulisan memakai WHERE eksplisit. Supabase production mengaktifkan
-- safeupdate dan akan menolak UPDATE/DELETE seluruh tabel tanpa WHERE, meski
-- perintah yang sama lolos di database tes lokal.
-- ============================================================================

do $blok$
declare
  v_kloter_sebelum  int;
  v_closing_sebelum int;
  v_ceklis_sebelum  int;
  v_kloter_sesudah  int;
  v_closing_sesudah int;
  v_ceklis_sesudah  int;
begin
  select count(*) into v_kloter_sebelum
  from kloter where jam_berangkat is not null;

  select count(*) into v_closing_sebelum
  from closing_regu where regu_id is not null;

  select count(*) into v_ceklis_sebelum
  from keberangkatan_regu where regu_id is not null;

  delete from closing_regu
  where regu_id is not null;

  delete from keberangkatan_regu
  where regu_id is not null;

  update kloter
  set jam_berangkat = null
  where jam_berangkat is not null;

  select count(*) into v_kloter_sesudah
  from kloter where jam_berangkat is not null;

  select count(*) into v_closing_sesudah
  from closing_regu where regu_id is not null;

  select count(*) into v_ceklis_sesudah
  from keberangkatan_regu where regu_id is not null;

  assert v_kloter_sesudah = 0,
         format('0090: masih ada %s kloter dengan jam berangkat', v_kloter_sesudah);
  assert v_closing_sesudah = 0,
         format('0090: masih ada %s regu dengan jam datang', v_closing_sesudah);
  assert v_ceklis_sesudah = 0,
         format('0090: masih ada %s peserta berstatus berangkat', v_ceklis_sesudah);

  raise notice '0090: % jam kloter, % ceklis berangkat, dan % baris closing dihapus; semuanya kembali belum berangkat/belum datang.',
               v_kloter_sebelum, v_ceklis_sebelum, v_closing_sebelum;
end;
$blok$;
