-- ============================================================================
-- hrcd-rekap : 0080_catat_foto_lembar_taut.sql
--
-- UNGGAH FOTO PER REGU BERHENTI TOTAL SEJAK 0074.
--
-- ---------------------------------------------------------------------------
-- APA YANG RUSAK
--
-- 0074 menambahkan tiga kolom jejak penautan ke `foto_lembar` — `cara_taut`,
-- `ditaut_oleh`, `ditaut_pada` — lalu menguncinya dengan
--
--     constraint foto_lembar_taut_utuh
--     check ((regu_id is null) = (cara_taut is null))
--
-- Aturannya benar dan tidak diubah di sini: baris yang punya regu tapi tidak
-- punya jejak siapa yang menautkannya adalah baris yang tidak bisa
-- dipertanggungjawabkan, dan foto ini gunanya justru untuk dipertanggung-
-- jawabkan.
--
-- Yang tidak dilakukan 0074 adalah memberi tahu SATU-SATUNYA penulis lama
-- tentang aturan barunya. `catat_foto_lembar` — dialog "Foto Jawaban" per
-- regu, dipakai sejak 0047 dan terakhir disentuh 0064 — menyisipkan
--
--     (regu_id, pos, kode_lomba, nama_lomba, path, ukuran_bytes, diunggah_oleh)
--
-- dengan `regu_id` SELALU terisi (fungsinya menolak nomor dada yang tidak
-- dikenal) dan `cara_taut` tidak pernah disebut, jadi NULL. Sisi kiri
-- constraint `false`, sisi kanan `true`. Setiap panggilan ditolak.
--
-- Dua fungsi yang 0074 buat sendiri lolos, dan itulah yang menyembunyikannya:
-- `catat_foto_masuk` menulis `regu_id = null` tanpa `cara_taut` (kedua sisi
-- `true`), `tautkan_foto` menulis keempat kolom sekaligus. Jalur borongan
-- bekerja, jalur per regu mati — dan keduanya ada di layar yang sama.
--
-- Akibatnya di lapangan: gambarnya SUDAH naik ke bucket `lembar` (unggahan
-- storage terjadi lebih dulu, barisnya sesudahnya), lalu pencatatannya gagal.
-- Kuota terpakai, berkasnya ada, dan tidak ada satu pun baris yang menunjuk
-- ke sana — foto yatim yang tidak akan ditemukan layar mana pun. Petugas
-- melihat "gagal terkirim" dan menekan kirim ulang, yang menambah satu
-- gambar yatim lagi setiap kali.
--
-- Kenapa lolos sampai produksi: tes 37 menguji `catat_foto_masuk` dan
-- `tautkan_foto` — dua fungsi yang 0074 tulis — dan tidak pernah memanggil
-- `catat_foto_lembar` sama sekali. Menambahkan constraint tanpa memanggil
-- setiap penulis yang sudah ada adalah lubang yang sama bentuknya dengan
-- 0074 bagian 3 (mencari nama fungsi yang sudah di-rename); tes 43 menutupnya
-- dengan memanggil penulis lama itu.
--
-- ---------------------------------------------------------------------------
-- YANG DIUBAH
--
-- Hanya `insert`-nya. Seluruh pagar 0064 disalin apa adanya — hak `pos`,
-- kunci pos operator, wajib isi, folder path, nomor dada dikenal, dan
-- `on conflict (path) do nothing` untuk kirim ulang.
--
-- `cara_taut` diisi 'unggah', persis nilai yang dipakai 0074 saat menambal
-- baris lama: foto yang sudah tertaut sejak lahir karena nomor dadanya
-- diketik SEBELUM gambarnya diambil. Baris baru dari dialog ini lahir dengan
-- cara yang sama, jadi ia harus menyandang nama yang sama — kalau tidak,
-- `v_foto_lembar` akan memisahkan dua kelompok baris yang identik asal-usulnya.
--
-- `ditaut_oleh`/`ditaut_pada` sama dengan `diunggah_oleh`/`diunggah_pada`:
-- di jalur ini keduanya memang satu peristiwa, satu orang, satu detik.
-- ============================================================================

create or replace function catat_foto_lembar(
  p_nomor_dada integer,
  p_pos        smallint,
  p_kode_lomba text,
  p_nama_lomba text,
  p_path       text,
  p_ukuran     integer default null
) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_regu uuid;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if pos_saya() is not null then
    if p_pos is distinct from pos_saya() then
      raise exception 'operator pos % tidak boleh mengunggah foto pos %',
        pos_saya(), p_pos;
    end if;
  end if;

  if coalesce(trim(p_kode_lomba), '') = '' or coalesce(trim(p_path), '') = '' then
    raise exception 'kode lomba dan path wajib diisi';
  end if;

  -- Path harus berada di dalam folder posnya. Tanpa ini seorang operator bisa
  -- mencatat baris pos-nya sendiri yang menunjuk gambar milik pos lain.
  if split_part(p_path, '/', 1) <> 'pos' || p_pos::text then
    raise exception 'path % tidak berada di folder pos %', p_path, p_pos;
  end if;

  select id into v_regu from regu
  where nomor_dada = p_nomor_dada and not is_cancelled;
  if not found then
    raise exception 'nomor dada % tidak dikenal / regu batal',
      case when p_nomor_dada between 0 and 999
        then lpad(p_nomor_dada::text, 3, '0') else p_nomor_dada::text end;
  end if;

  -- Tertaut sejak lahir, jadi jejak tautnya ditulis BERSAMA barisnya. Kolom
  -- taut tidak boleh menyusul lewat update terpisah: foto_lembar_taut_utuh
  -- memeriksa per baris, jadi baris tanpa jejak tidak akan pernah sempat ada.
  insert into foto_lembar
    (regu_id, pos, kode_lomba, nama_lomba, path, ukuran_bytes, diunggah_oleh,
     cara_taut, ditaut_oleh, ditaut_pada)
  values
    (v_regu, p_pos, p_kode_lomba, p_nama_lomba, p_path, p_ukuran, auth.uid(),
     'unggah', auth.uid(), now())
  -- Mengirim ulang berkas yang sama bukan galat: jaringan lapangan memutus
  -- jawaban, bukan permintaan, dan petugas yang menekan "kirim ulang" tidak
  -- melakukan kesalahan apa pun.
  on conflict (path) do nothing;
end;
$$;

revoke all on function catat_foto_lembar(integer, smallint, text, text, text, integer) from public;
grant execute on function catat_foto_lembar(integer, smallint, text, text, text, integer) to authenticated;

comment on function catat_foto_lembar(integer, smallint, text, text, text, integer) is
  'Foto per regu: nomor dadanya sudah diketik sebelum gambarnya diambil, jadi '
  'barisnya lahir sudah tertaut dengan cara_taut = ''unggah''.';
