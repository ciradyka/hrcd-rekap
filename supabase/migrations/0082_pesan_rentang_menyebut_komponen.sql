-- ============================================================================
-- hrcd-rekap : 0082_pesan_rentang_menyebut_komponen.sql
--
-- PESAN GALAT MENYEBUT KOMPONEN MANA YANG SALAH.
--
-- ---------------------------------------------------------------------------
-- APA YANG KURANG
--
-- Sampai sekarang kalimatnya berbunyi "Input harus antara 0 - 5." — benar,
-- singkat, dan TIDAK MENYEBUT KOLOM YANG MANA. Di lembar pos satu baris punya
-- tiga sampai lima kotak berdampingan, masing-masing dengan rentangnya
-- sendiri: Semaphore 0-5, Tebak Simpul 0-10, Menaksir tanpa batas atas. Satu
-- baris yang ditolak karena Semaphore terisi 6 memunculkan kalimat yang sama
-- persis dengan baris yang ditolak karena Tebak Simpul terisi 11.
--
-- Yang terjadi di lapangan: petugas membaca "harus antara 0 - 5", melihat
-- tiga kotaknya, dan MENEBAK. Tebakan yang salah mengganti angka yang
-- sebenarnya sudah benar — dan angka pengganti itu tersimpan, karena baris
-- yang sah tetap dikirim (lihat komentar "yang sah tetap dikirim" di app.js).
-- Kalimat yang kurang satu kata karena itu tidak berhenti pada kebingungan;
-- ia berakhir pada nilai yang salah di database, tanpa satu pun galat.
--
-- ---------------------------------------------------------------------------
-- YANG BERUBAH
--
--   sebelum   Input harus antara 0 - 5.
--   sesudah   Input Semaphore harus antara 0 - 5.
--
--   sebelum   Jumlah salah harus antara 0 - 20.
--   sesudah   Jumlah salah Sandi Morse harus antara 0 - 20.
--
-- Namanya diambil dari `wahana.name` — yang sama persis dengan yang tercetak
-- di kepala kolom lembar pos dan di blangko kertasnya, jadi yang membaca
-- pesan ini mencari satu kata yang sudah ada di depan matanya.
--
-- Nomor dadanya TIDAK ikut di sini. Ia ditempelkan layar (`Nomor Dada 007.`),
-- karena RPC ini juga dipakai jalur paste dan upload yang menampilkan
-- nomornya di kolom tabel pratinjau — menyebutnya dua kali di sana justru
-- memanjangkan kalimat tanpa menambah apa pun.
--
-- ---------------------------------------------------------------------------
-- DISALIN UTUH DARI 0064
--
-- `create or replace` mengganti SELURUH badan fungsi, jadi cabang yang lupa
-- disalin hilang tanpa satu galat pun. Yang berubah dari 0064 cuma DUA baris
-- `raise exception` di bawah; sisanya sama karakter demi karakter.
--
-- KENAPA TES 12 TIDAK IKUT DIUBAH. tests/run.sh MEMUTAR ULANG sejarahnya:
-- tes 12 berjalan jauh di atas berkas ini, jadi yang ia uji adalah fungsi
-- versi 0031 — dan di sana kalimatnya memang belum menyebut komponen.
-- Mengubah tes 12 justru membuatnya gagal. Hal yang sama berlaku untuk
-- "Jumlah salah" di tes 03. Kalimat baru ini dijaga TES 45, yang berjalan
-- tepat sesudah berkas ini.
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
        -- NAMA KOMPONENNYA IKUT DISEBUT. Lihat kepala berkas ini.
        raise exception 'Input % harus antara % - %.',
          v_wahana.name,
          trim_scale(v_wahana.rentang_mentah_min),
          trim_scale(v_wahana.rentang_mentah_maks);
      end if;
      -- nilai_2 (jumlah salah) ikut divalidasi (temuan review).
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

-- `create or replace` mempertahankan hak yang sudah ada, jadi baris ini
-- sebenarnya tidak mengubah apa pun. Ditulis supaya berkas ini tetap benar
-- kalau suatu hari dijalankan di database yang fungsinya belum pernah ada.
grant execute on function simpan_nilai_massal(jsonb, text, smallint) to authenticated;
