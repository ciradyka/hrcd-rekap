-- ============================================================================
-- hrcd-rekap : 0044_gembok_di_jalur_tulis.sql
--
-- Memasang gembok (0043) di KEDUA jalur tulis nilai, dan memberitahukan
-- keadaannya ke layar lewat v_lembar_pos.
--
-- ---------------------------------------------------------------------------
-- KENAPA DI SERVER, PADAHAL LAYAR SUDAH MENGABUKAN KOTAKNYA
--
-- Lembar pos dibuka di beberapa HP sekaligus — itu memang bentuk kerjanya,
-- dan sejak lembar ini menyegarkan diri tiap 20 detik, HP kedua akan tahu
-- soal gemboknya dalam waktu paling lama 20 detik.
--
-- Paling lama 20 detik masih berarti ada 20 detik. HP yang layarnya dimuat
-- sebelum gemboknya dipasang akan mengirim angka dengan penuh keyakinan, dan
-- satu-satunya yang bisa menolaknya adalah database.
--
-- ---------------------------------------------------------------------------
-- SATU PEMERIKSA, DIPAKAI DUA JALUR
--
-- `simpan_nilai_massal` dan `hapus_nilai_pos` sama-sama memanggil
-- `nilai_tergembok()`, bukan menyalin syaratnya masing-masing. Dua salinan
-- syarat yang sama adalah cara mereka mulai berbeda pendapat — dan itu persis
-- cacat yang membuat 0040 harus ditulis: 0011 menyalin algoritma dari 0004
-- lalu kehilangan satu syarat yang ditambahkan 0008 di antaranya.
--
-- Badan kedua fungsi disalin dari 0031 dan 0023 oleh skrip, dengan satu
-- sisipan masing-masing yang diperiksa jumlahnya.
--
-- ---------------------------------------------------------------------------
-- LAYAR PERLU TAHU, TAPI TIDAK MENENTUKAN
--
-- v_lembar_pos mendapat kolom `terkunci` supaya lembar bisa menggambar gembok
-- tertutup dan mematikan kotaknya. Itu untuk KENYAMANAN — supaya petugas tahu
-- sebelum mengetik, bukan sesudah ditolak. Yang menegakkan aturannya tetap
-- kedua fungsi di atas.
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

      -- Baris yang sudah DIGEMBOK: tolak, apa pun isinya.
      --
      -- Diperiksa di server, bukan cukup di layar. Lembar pos dibuka di
      -- beberapa HP sekaligus, dan HP yang layarnya dimuat SEBELUM gemboknya
      -- dipasang tidak tahu apa-apa tentang gembok itu — ia akan mengirim
      -- angka dengan penuh keyakinan.
      if nilai_tergembok(v_regu.id, v_pos) then
        raise exception 'Nilai regu ini sudah digembok. Buka gemboknya dulu.';
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

create or replace function hapus_nilai_pos(
  p_nomor_dada integer,
  p_kode       text,
  p_pos        smallint default null   -- wajib untuk admin
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pos    smallint;
  v_regu   uuid;
  v_wahana uuid;
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

  select id into v_regu from regu
  where nomor_dada = p_nomor_dada and not is_cancelled;
  if not found then
    -- Tiga digit seperti di kain nomor dadanya (migrasi 0020). Nomor di luar
    -- 0-999 dicetak apa adanya: lpad MEMOTONG string yang lebih panjang dari
    -- targetnya, jadi salah ketik "9999" akan dilaporkan sebagai "999" —
    -- petugas lalu mencari nomor yang tidak pernah diketiknya.
    raise exception 'nomor dada % tidak dikenal / regu batal',
      case when p_nomor_dada between 0 and 999
        then lpad(p_nomor_dada::text, 3, '0')
        else p_nomor_dada::text end;
  end if;

  if nilai_tergembok(v_regu, v_pos) then
    raise exception 'Nilai regu ini sudah digembok. Buka gemboknya dulu.';
  end if;

  -- Normalisasi kode disamakan dengan simpan_nilai_massal, supaya kolom yang
  -- bisa DIISI lewat satu pintu selalu bisa DIKOSONGKAN lewat pintu ini.
  select w.id into v_wahana from wahana w
  where w.edisi = edisi_aktif()
    and w.pos = v_pos
    and regexp_replace(lower(coalesce(p_kode, '')), '[^a-z0-9]', '', 'g')
        = regexp_replace(w.kode, '[^a-z0-9]', '', 'g');
  if not found then
    raise exception 'kode komponen tidak dikenal di pos %', v_pos;
  end if;

  delete from nilai_mentah where regu_id = v_regu and wahana_id = v_wahana;
end;
$$;

create or replace view v_lembar_pos as
select
  p.nomor       as pos,
  p.name        as nama_pos,
  p.bayangan,
  r.id          as regu_id,
  r.nomor_dada,
  r.nama_regu,
  s.name        as nama_sekolah,
  r.golongan,

  coalesce((
    select jsonb_object_agg(w.kode, jsonb_build_object(
             'nilai_1', n.nilai_1, 'nilai_2', n.nilai_2))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), '{}'::jsonb) as nilai,

  (select count(*) from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor)::int
                as jumlah_terisi,

  -- INI yang berubah: hanya komponen yang berlaku untuk golongan regu ini.
  (select count(*) from wahana w
   where w.edisi = p.edisi and w.pos = p.nomor
     and komponen_berlaku(w.golongan, r.golongan))::int
                as jumlah_komponen,

  round(coalesce((
    select sum(hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
                           w.raw_terbaik, w.raw_terburuk,
                           w.poin_benar, w.poin_salah, w.total_soal, w.tingkat))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), 0) * p.bobot, 2) as nilai_pos,

  -- Gembok (0043). Kolom BARU ditaruh paling belakang: `create or replace
  -- view` menolak daftar kolom yang berubah urutan atau tipenya, dan hanya
  -- mengizinkan penambahan di ujung.
  nilai_tergembok(r.id, p.nomor) as terkunci

from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
cross join pos p
where p.edisi = edisi_aktif()
  and not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and peran() is not null
  and (peran() <> 'operator_pos' or p.nomor = pos_saya());
