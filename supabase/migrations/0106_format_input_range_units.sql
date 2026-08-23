-- ============================================================================
-- hrcd-rekap : 0106_format_input_range_units.sql
-- Pesan rentang memakai satuan yang benar-benar diketik petugas.
--
-- Menaksir diketik dalam meter, tetapi disimpan dalam sentimeter agar angka
-- desimal tidak berubah oleh browser atau locale. Pesan lama mengambil batas
-- penyimpanan mentah dan karena itu menyuruh petugas memakai 0-10000, padahal
-- kepala kolom dan kotaknya sama-sama memakai meter.
--
-- `simpan_nilai_massal` disalin utuh dari definisi terakhir di 0082. Satu-
-- satunya perubahan perilakunya adalah pemformatan rentang nilai_1.
-- ============================================================================

create or replace function rentang_input_nilai(
  p_min numeric,
  p_maks numeric,
  p_satuan text
) returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_satuan = 'meter' then format(
      '%s - %s meter', trim_scale(p_min / 100), trim_scale(p_maks / 100))
    else format('%s - %s', trim_scale(p_min), trim_scale(p_maks))
  end
$$;

comment on function rentang_input_nilai(numeric, numeric, text) is
  'Rentang validasi dalam satuan yang diketik petugas; nilai meter tersimpan sebagai sentimeter.';

create or replace function simpan_nilai_massal(
  p_baris  jsonb,
  p_sumber text default 'upload',
  p_pos    smallint default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_r      jsonb;
  v_regu   regu%rowtype;
  v_wahana wahana%rowtype;
  v_hasil  jsonb := '[]'::jsonb;
  v_status text;
  v_alasan text;
  v_idx    int := 0;
  v_pos    smallint;
  v_kunci  text;
  v_sudah  text[] := '{}';
  v_n1     numeric;
  v_n2     numeric;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if pos_saya() is not null then
    v_pos := pos_saya();
  else
    v_pos := p_pos;
    if v_pos is null then
      raise exception 'wajib menyebut pos (p_pos)';
    end if;
  end if;
  if p_sumber not in ('manual', 'upload') then
    raise exception 'sumber tidak dikenal: %', p_sumber;
  end if;

  for v_r in select * from jsonb_array_elements(p_baris) loop
    v_idx := v_idx + 1;
    v_status := 'tersimpan'; v_alasan := null;

    begin
      v_n1 := (v_r ->> 'nilai_1')::numeric;
      v_n2 := nullif(v_r ->> 'nilai_2', '')::numeric;

      v_kunci := (v_r ->> 'nomor_dada') || '|' ||
                 regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g');
      if v_kunci = any (v_sudah) then
        raise exception 'baris ganda dalam paste (nomor dada + komponen sama)';
      end if;
      v_sudah := v_sudah || v_kunci;

      select * into v_regu from regu
      where nomor_dada = (v_r ->> 'nomor_dada')::integer and not is_cancelled;
      if not found then
        raise exception 'nomor dada tidak dikenal / regu batal';
      end if;

      select w.* into v_wahana from wahana w
      where w.edisi = edisi_aktif()
        and w.pos = v_pos
        and regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g')
            = regexp_replace(w.kode, '[^a-z0-9]', '', 'g');
      if not found then
        raise exception 'kode komponen tidak dikenal di pos % — mungkin ini lembar pos lain?', v_pos;
      end if;

      if nilai_tergembok(v_regu.id, v_pos) then
        raise exception 'Nilai regu ini sudah digembok. Buka gemboknya dulu.';
      end if;

      if not komponen_berlaku(v_wahana.golongan, v_regu.golongan) then
        raise exception 'Komponen ini untuk golongan lain.';
      end if;

      if v_n1 is null
         or v_n1 not between v_wahana.rentang_mentah_min and v_wahana.rentang_mentah_maks then
        raise exception 'Input % harus antara %.',
          v_wahana.name,
          rentang_input_nilai(v_wahana.rentang_mentah_min,
                              v_wahana.rentang_mentah_maks,
                              v_wahana.satuan);
      end if;
      if v_n2 is not null
         and v_n2 not between 0 and v_wahana.rentang_mentah_maks then
        raise exception 'Jumlah salah % harus antara 0 - %.',
          v_wahana.name,
          trim_scale(v_wahana.rentang_mentah_maks);
      end if;

      insert into nilai_mentah (regu_id, wahana_id, nilai_1, nilai_2, source, created_by)
      values (v_regu.id, v_wahana.id, v_n1, v_n2, p_sumber, auth.uid())
      on conflict (regu_id, wahana_id) do update set
        nilai_1 = excluded.nilai_1,
        nilai_2 = excluded.nilai_2,
        source  = excluded.source,
        created_by = excluded.created_by,
        created_at = now()
      where nilai_mentah.nilai_1 is distinct from excluded.nilai_1
         or nilai_mentah.nilai_2 is distinct from excluded.nilai_2;

    exception when others then
      v_status := 'ditolak';
      v_alasan := sqlerrm;
    end;

    v_hasil := v_hasil || jsonb_build_object(
      'baris', v_idx,
      'nomor_dada', v_r ->> 'nomor_dada',
      'kode', v_r ->> 'kode',
      'status', v_status,
      'alasan', v_alasan);
  end loop;

  return v_hasil;
end;
$$;

grant execute on function simpan_nilai_massal(jsonb, text, smallint) to authenticated;
