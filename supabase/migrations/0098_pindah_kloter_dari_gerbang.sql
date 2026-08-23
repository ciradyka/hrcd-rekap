-- ============================================================================
-- hrcd-rekap : 0098_pindah_kloter_dari_gerbang.sql
-- Petugas gerbang boleh memindahkan regu dari layar Keberangkatan.
--
-- Layar Keberangkatan hanya dibuka oleh hak `keberangkatan`, tetapi definisi
-- termuda `pindah_kloter` masih menuntut `cetak_kloter`. Hak lama tetap
-- dipertahankan karena meja registrasi juga sudah memakai jalur manual ini.
-- ============================================================================

create or replace function pindah_kloter(
  p_nomor_dada integer, p_alasan text, p_kloter smallint default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu regu%rowtype;
  v_cfg edisi%rowtype;
  v_tujuan smallint;
  v_perlu_diumumkan boolean;
  v_tercetak boolean;
  v_lama smallint;
  v_tujuan_berangkat boolean;
begin
  if not boleh_apa_saja('keberangkatan', 'cetak_kloter') then
    raise exception 'tidak berhak: keberangkatan';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan pemindahan wajib diisi — tercatat di riwayat';
  end if;
  select * into v_cfg from edisi where is_active;
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));
  select * into v_regu from regu where nomor_dada = p_nomor_dada for update;
  if not found then raise exception 'nomor dada % tidak dikenal', p_nomor_dada; end if;
  if v_regu.is_cancelled then raise exception 'regu % berstatus batal', p_nomor_dada; end if;
  v_lama := v_regu.kloter_nomor;
  if regu_sudah_berangkat(v_regu.id) then
    raise exception 'regu % ikut berangkat bersama kloter % — kalau itu keliru, batalkan dulu keberangkatan kloter itu lewat admin', p_nomor_dada, v_lama;
  end if;

  if p_kloter is null then
    select k.nomor into v_tujuan from kloter k
    where k.jam_berangkat is null and k.nomor <= v_cfg.kloter_maks
    order by k.nomor desc limit 1;
  else
    v_tujuan := p_kloter;
    if not exists (select 1 from kloter where nomor = v_tujuan) then
      raise exception 'kloter % tidak ada', v_tujuan;
    end if;
  end if;
  if v_tujuan is null then raise exception 'tidak ada kloter tersisa yang belum berangkat'; end if;
  if v_tujuan = v_lama then raise exception 'regu % sudah ada di kloter %', p_nomor_dada, v_tujuan; end if;

  select dicetak_pada is not null or jam_berangkat is not null,
         dicetak_pada is not null, jam_berangkat is not null
    into v_perlu_diumumkan, v_tercetak, v_tujuan_berangkat
  from kloter where nomor = v_tujuan;
  perform set_config('hrcd.izin_pindah', '1', true);
  update regu set
    kloter_nomor = v_tujuan,
    urutan_kloter = slot_kloter_berikutnya(v_tujuan),
    disisipkan_pada = case when v_perlu_diumumkan then now() else disisipkan_pada end,
    alasan_sisip = case when v_perlu_diumumkan then p_alasan else alasan_sisip end
  where id = v_regu.id;
  perform set_config('hrcd.izin_pindah', '0', true);

  insert into history (table_name, row_id, regu_id, action, old_value, new_value, changed_by)
  values ('regu', v_regu.id::text, v_regu.id, 'UPDATE',
    jsonb_build_object('kloter_nomor', v_lama, 'urutan_kloter', v_regu.urutan_kloter),
    jsonb_build_object('pindah_kloter', jsonb_build_object(
      'nomor_dada', p_nomor_dada, 'dari', v_lama, 'ke', v_tujuan,
      'alasan', p_alasan, 'kloter_tujuan_sudah_dicetak', v_tercetak,
      'kloter_tujuan_sudah_berangkat', v_tujuan_berangkat)), auth.uid());

  return jsonb_build_object(
    'nomor_dada', p_nomor_dada, 'kloter_lama', v_lama, 'kloter_baru', v_tujuan,
    'sisipan', v_perlu_diumumkan, 'tujuan_sudah_berangkat', v_tujuan_berangkat,
    'peringatan', nullif(concat_ws(' ',
      case when v_perlu_diumumkan then format(
        'Nomor %s TIDAK ADA di kertas kloter %s. Beri tahu petugas staging.',
        p_nomor_dada, v_tujuan) end,
      case when v_tujuan_berangkat then format(
        'Kloter %s sudah berangkat, jadi nomor %s dinilai dari jam berangkat kloter itu.',
        v_tujuan, p_nomor_dada) end), ''));
end;
$$;

comment on function pindah_kloter(integer, text, smallint) is
  'Memindahkan regu secara manual dari meja registrasi atau garis start; hak cetak_kloter dan keberangkatan sama-sama membuka pintu.';
