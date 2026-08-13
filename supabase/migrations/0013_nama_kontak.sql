-- ============================================================================
-- hrcd-rekap : 0013_nama_kontak.sql
--
-- Contact person sekarang punya NAMA, bukan cuma nomor WA. Panitia menelepon
-- balik saat pembayaran tidak jelas, dan "menghubungi 08123..." tanpa tahu
-- siapa yang akan mengangkat membuat percakapan canggung tiap kali.
--
-- Kolom sengaja NULLABLE: sembilan pendaftaran yang sudah masuk tidak punya
-- nilai ini, dan memaksanya NOT NULL berarti mengarang nama orang.
--
-- DISALIN DARI 0006, BUKAN 0004: 0006 sudah mendefinisikan ulang fungsi ini
-- dengan p_kunci_kirim (idempotensi — mencegah sinyal putus melahirkan dua
-- pendaftaran). Menyalin dari 0004 akan diam-diam MENGHAPUS fitur itu.
--
-- Parameter baru ditaruh DI URUTAN TERAKHIR dan ber-default null, jadi
-- gateway Worker versi lama yang belum mengirimkannya tetap jalan — tidak
-- ada jendela rusak saat deploy.
-- ============================================================================

alter table pendaftaran add column nama_kontak text;

create or replace function submit_pendaftaran(
  p_nama_sekolah   text,
  p_alamat_sekolah text,
  p_butuh_barak    boolean,
  p_kontak_wa      text,
  p_regu           jsonb,
  p_jumlah_pendamping smallint default 0,
  p_kunci_kirim    uuid default null,
  p_nama_kontak    text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_sekolah  uuid;
  v_batch    uuid;
  v_kode     text;
  v_n        int;
  v_r        jsonb;
  v_ada      pendaftaran%rowtype;
begin
  -- Kiriman ulang dengan kunci yang sama: kembalikan hasil yang dulu.
  if p_kunci_kirim is not null then
    select * into v_ada from pendaftaran where kunci_kirim = p_kunci_kirim;
    if found then
      return jsonb_build_object(
        'kode_pembayaran', v_ada.kode_pembayaran,
        'jumlah_regu', v_ada.jumlah_regu,
        'total_tagihan', v_ada.jumlah_regu * (select biaya_per_regu from edisi where aktif),
        'terkirim_ulang', true);
    end if;
  end if;

  v_n := jsonb_array_length(p_regu);
  if v_n is null or v_n < 1 then
    raise exception 'minimal satu regu';
  end if;
  if v_n > 30 then
    raise exception 'maksimal 30 regu per pendaftaran';
  end if;
  if p_kontak_wa is null or length(trim(p_kontak_wa)) < 8 then
    raise exception 'kontak WA wajib diisi';
  end if;

  for v_r in select * from jsonb_array_elements(p_regu) loop
    if coalesce(trim(v_r ->> 'nama_regu'), '') = '' then
      raise exception 'nama regu wajib diisi';
    end if;
    if coalesce(trim(v_r ->> 'nama_ketua'), '') = '' then
      raise exception 'nama ketua wajib diisi';
    end if;
    if coalesce(v_r ->> 'golongan', '') not in
       ('penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi') then
      raise exception 'golongan tidak dikenal: %', coalesce(v_r ->> 'golongan', '(kosong)');
    end if;
  end loop;

  insert into sekolah (nama, alamat)
  values (trim(p_nama_sekolah), trim(p_alamat_sekolah))
  on conflict (nama, alamat) do nothing;
  select id into v_sekolah from sekolah
  where nama = trim(p_nama_sekolah) and alamat = trim(p_alamat_sekolah);

  loop
    v_kode := 'HRCD' || edisi_aktif() || '-' ||
              upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from pendaftaran where kode_pembayaran = v_kode);
  end loop;

  insert into pendaftaran (sekolah_id, kode_pembayaran, butuh_barak,
                           jumlah_pendamping, jumlah_regu, kontak_wa, kunci_kirim, nama_kontak)
  values (v_sekolah, v_kode, coalesce(p_butuh_barak, false),
          greatest(coalesce(p_jumlah_pendamping, 0), 0), v_n, trim(p_kontak_wa),
          p_kunci_kirim, nullif(trim(coalesce(p_nama_kontak, '')), ''))
  returning id into v_batch;

  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  select v_batch, trim(r ->> 'nama_regu'), trim(r ->> 'nama_ketua'), r ->> 'golongan'
  from jsonb_array_elements(p_regu) r;

  return jsonb_build_object(
    'kode_pembayaran', v_kode,
    'jumlah_regu', v_n,
    'total_tagihan', v_n * (select biaya_per_regu from edisi where aktif));
end;
$$;

grant execute on function
  submit_pendaftaran(text, text, boolean, text, jsonb, smallint, uuid, text)
  to service_role;
