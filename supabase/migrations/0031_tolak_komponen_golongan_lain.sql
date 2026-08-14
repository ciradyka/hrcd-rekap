-- ============================================================================
-- hrcd-rekap : 0031_tolak_komponen_golongan_lain.sql
--
-- Satu pagar baru di `simpan_nilai_massal`: nilai untuk komponen yang bukan
-- milik golongan regu itu DITOLAK.
--
-- Migrasi 0030 membuat satu lomba boleh punya dua baris `wahana`, satu per
-- golongan — Tebak Simpul dinilai dari 5 objek untuk penggalang dan 10 untuk
-- penegak. Keduanya tampil sebagai kolom di lembar pos yang sama, karena
-- lembar itu satu untuk semua regu di pos tersebut.
--
-- Tanpa pagar ini, satu regu bisa terisi DUA-DUANYA. Tidak ada yang gagal:
-- kedua nilai sah menurut rentangnya masing-masing, keduanya tersimpan,
-- keduanya dihitung — dan Nilai Pos regu itu jadi 200 dari maksimum 100.
-- Kesalahan yang tidak menimbulkan galat adalah kesalahan yang baru ketahuan
-- saat juara diumumkan.
--
-- Pagarnya dipasang DI SERVER, bukan di layar: layar boleh saja mengaburkan
-- kolom yang tidak berlaku, tapi jalur upload massal tidak lewat layar.
--
-- ---------------------------------------------------------------------------
-- SELURUH BADAN FUNGSI DISALIN dari 0029, karena `create or replace
-- function` menuntut definisi utuh. Yang berbeda hanya satu blok `if` di
-- atas. Kalau fungsi ini diubah lagi nanti, yang disalin harus versi
-- TERBARU — bukan berkas ini.
-- ============================================================================

create or replace function simpan_nilai_massal(
  p_baris  jsonb,  -- [{"nomor_dada":1,"kode":"lari_zigzag","nilai_1":40,"nilai_2":null}, ...]
  p_sumber text default 'upload',
  p_pos    smallint default null  -- wajib untuk admin; operator memakai pos-nya sendiri
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
  if peran() = 'operator_pos' then
    v_pos := pos_saya();
  elsif peran() = 'admin' then
    v_pos := p_pos;
    if v_pos is null then
      raise exception 'admin wajib menyebut pos (p_pos)';
    end if;
  else
    raise exception 'hanya operator pos / admin';
  end if;
  if p_sumber not in ('manual', 'upload') then
    raise exception 'sumber tidak dikenal: %', p_sumber;
  end if;

  for v_r in select * from jsonb_array_elements(p_baris) loop
    v_idx := v_idx + 1;
    v_status := 'tersimpan'; v_alasan := null;

    -- Seluruh pemrosesan baris terlindungi: format angka rusak di baris 7
    -- tidak boleh menggagalkan 26 baris lain (temuan review).
    begin
      v_n1 := (v_r ->> 'nilai_1')::numeric;
      v_n2 := nullif(v_r ->> 'nilai_2', '')::numeric;

      -- Baris ganda dalam SATU paste = merah (bagian 6.3) — juga di server.
      v_kunci := (v_r ->> 'nomor_dada') || '|' ||
                 regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g');
      if v_kunci = any (v_sudah) then
        raise exception 'baris ganda dalam paste (nomor dada + komponen sama)';
      end if;
      v_sudah := v_sudah || v_kunci;

      -- Regu: harus dikenal, bernomor, tidak batal.
      select * into v_regu from regu
      where nomor_dada = (v_r ->> 'nomor_dada')::integer and not is_cancelled;
      if not found then
        raise exception 'nomor dada tidak dikenal / regu batal';
      end if;

      -- Komponen: HANYA pos ini (kode boleh kembar antar pos — temuan
      -- review); normalisasi dua arah supaya "Lari Zigzag" dari header foto
      -- cocok dengan kode lari_zigzag.
      select w.* into v_wahana from wahana w
      where w.edisi = edisi_aktif()
        and w.pos = v_pos
        and regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g')
            = regexp_replace(w.kode, '[^a-z0-9]', '', 'g');
      if not found then
        raise exception 'kode komponen tidak dikenal di pos % — mungkin ini lembar pos lain?', v_pos;
      end if;

      -- Komponen milik golongan lain: TOLAK.
      --
      -- Sejak 0030 satu lomba boleh punya dua baris `wahana`, satu per
      -- golongan (Tebak Simpul: 5 objek untuk penggalang, 10 untuk penegak).
      -- Keduanya muncul sebagai kolom di lembar yang sama, jadi tanpa pagar
      -- ini satu regu bisa terisi DUA-DUANYA — dan totalnya 200 dari
      -- maksimum 100, tanpa satu pun galat yang memberi tahu siapa pun.
      if not komponen_berlaku(v_wahana.golongan, v_regu.golongan) then
        raise exception 'Komponen ini untuk golongan lain.';
      end if;

      -- Rentang wajar dari konfigurasi (merah di preview = tolak di server).
      if v_n1 is null
         or v_n1 not between v_wahana.rentang_mentah_min and v_wahana.rentang_mentah_maks then
        -- trim_scale membuang nol di belakang koma: rentang_mentah_min
        -- bertipe numeric(10,2), jadi tanpa ini pesannya berbunyi
        -- "antara 0.00 - 20.00" — angka yang tidak pernah ditulis siapa pun
        -- di kertas, dan yang membacanya jadi ragu apakah pecahan diterima.
        raise exception 'Input harus antara % - %.',
          trim_scale(v_wahana.rentang_mentah_min),
          trim_scale(v_wahana.rentang_mentah_maks);
      end if;
      -- nilai_2 (jumlah salah) ikut divalidasi (temuan review).
      if v_n2 is not null
         and v_n2 not between 0 and v_wahana.rentang_mentah_maks then
        raise exception 'Jumlah salah harus antara 0 - %.',
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
      -- Simpan ulang tanpa perubahan = tidak menulis apa pun: kepengarangan
      -- tidak tergeser, riwayat tidak dibanjiri (temuan review).
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
