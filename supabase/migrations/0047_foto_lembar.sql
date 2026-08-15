-- ============================================================================
-- hrcd-rekap : 0047_foto_lembar.sql
--
-- FOTO LEMBAR: setiap slip penilaian punya salinan di server, satu foto per
-- lomba per regu, difoto petugas IT dengan HP sambil mengetik nilainya.
--
-- ---------------------------------------------------------------------------
-- KENAPA ADA
--
-- Nilai satu acara ada di ~5.500 lembar kertas A5 yang berpindah tangan dari
-- pos ke kotak ke meja IT. Kertas hilang, basah, tertukar, atau tertinggal —
-- dan begitu hilang, tidak ada apa pun yang bisa memulihkan angkanya. Yang
-- tersimpan di database cuma hasil ketikan; kalau ketikan itu dipertanyakan,
-- tidak ada yang bisa diadu dengannya.
--
-- Foto adalah catatannya. Ia tidak perlu dibaca mesin, tidak perlu akurat,
-- tidak perlu rapi. Ia cuma perlu ADA.
--
-- ---------------------------------------------------------------------------
-- KENAPA DIFOTO DI MEJA IT, BUKAN DI POS
--
-- Karena di meja IT fotonya tertaut sendiri ke nomor dada dan lomba yang
-- tepat — petugas baru saja mengetiknya. Foto borongan di pos harus dicari
-- satu per satu nanti di antara ribuan gambar, dan backup yang tidak bisa
-- ditemukan kembali bukan backup.
--
-- Harganya disebut supaya tidak jadi kejutan: slip yang HILANG DI JALAN antara
-- pos dan meja IT tidak pernah difoto sama sekali. Jendela itu memang tidak
-- terlindungi oleh migrasi ini.
--
-- ---------------------------------------------------------------------------
-- KENAPA BOLEH LEBIH DARI SATU FOTO
--
-- Foto pertama buram, tangan bergoyang, kertasnya terlipat. Memaksa satu foto
-- per lomba berarti petugas harus MENGHAPUS yang buram sebelum memotret ulang,
-- dan tombol hapus pada backup adalah cara backup itu hilang. Jadi: banyak
-- foto boleh, tidak ada yang pernah dihapus, yang terbaru yang ditampilkan.
--
-- ---------------------------------------------------------------------------
-- KENAPA KODE LOMBA, BUKAN wahana_id
--
-- Satu slip = satu LOMBA, dan satu lomba bisa berisi beberapa baris wahana:
-- Bidai punya lima kriteria di satu kertas, Tebak Simpul punya satu baris per
-- golongan. Menaut foto ke wahana_id akan memaksa lima baris untuk satu
-- selembar kertas, dan kelimanya menunjuk gambar yang sama.
--
-- Jadi tautannya ke nama lomba yang sudah dipakai layar untuk mengelompokkan
-- kolom, disimpan sebagai slug supaya aman jadi bagian nama berkas.
--
-- ---------------------------------------------------------------------------
-- ANGGARAN PENYIMPANAN — DIHITUNG, BUKAN DIHARAP
--
-- 500 regu x 11 lomba = ~5.500 foto. Kuota Supabase tier gratis 1 GB, jadi
-- angka yang boleh dipakai per foto adalah 1 GB / 5.500 = ~190 KB, dan itu
-- SEBELUM ruang untuk foto ulang yang buram.
--
-- Karena itu klien tidak pernah mengunggah foto apa adanya. Slip adalah
-- dokumen hitam-putih berisi tulisan tangan besar: warna tidak membawa
-- informasi apa pun, dan resolusi kamera 12 MP membawa 40x lebih banyak piksel
-- daripada yang dibutuhkan untuk membaca angka setinggi satu sentimeter.
-- Setiap gambar diubah jadi abu-abu, dikecilkan ke sisi terpanjang 1400 px,
-- dan dikodekan JPEG mutu 0,6 -> biasanya 50-90 KB. Seluruh acara ~350 MB.
--
-- `file_size_limit` bucket di bawah adalah pagar KEDUA, bukan yang pertama.
-- Ia sengaja dipasang 1 MB: sepuluh kali lipat ukuran wajar, jadi ia tidak
-- pernah menolak foto yang benar — tapi ia menolak foto mentah 4 MB dari
-- kamera kalau pengecilan di klien suatu hari gagal diam-diam. Tanpa pagar
-- kedua, kegagalan itu baru ketahuan saat kuota habis di tengah acara.
-- ============================================================================

create table if not exists foto_lembar (
  id             uuid primary key default gen_random_uuid(),
  regu_id        uuid     not null references regu (id) on delete cascade,
  pos            smallint not null,
  kode_lomba     text     not null,
  nama_lomba     text     not null,
  -- Nama objek di bucket `lembar`. Unik: dua baris yang menunjuk satu gambar
  -- berarti satu di antaranya berbohong tentang siapa yang mengunggahnya.
  path           text     not null unique,
  ukuran_bytes   integer,
  diunggah_oleh  uuid     not null references auth.users (id),
  diunggah_pada  timestamptz not null default now(),

  constraint foto_lembar_kode_slug check (kode_lomba ~ '^[a-z0-9-]+$')
);

create index if not exists foto_lembar_regu_pos_idx
  on foto_lembar (regu_id, pos, kode_lomba);

alter table foto_lembar enable row level security;

-- Pagarnya menyalin sel_nilai (0003) dan v_riwayat_nilai (0042): admin dan meja
-- seluruh pos, operator pos hanya posnya sendiri. Kalau berbeda, akan ada
-- petugas yang bisa MENGUNGGAH foto tapi tidak bisa melihat bahwa ia sudah
-- mengunggahnya — lalu ia mengunggahnya lagi, dan lagi.
create policy sel_foto on foto_lembar for select using (
  peran() in ('admin', 'meja')
  or (peran() = 'operator_pos' and pos = pos_saya())
);

-- Menulis HANYA lewat catat_foto_lembar di bawah. Tidak ada policy delete
-- untuk siapa pun kecuali admin: backup yang bisa dihapus dari layar bukan
-- backup.
create policy adm_foto on foto_lembar for all using (peran() = 'admin');

grant select on foto_lembar to authenticated;

comment on table foto_lembar is
  'Foto slip penilaian, satu baris per foto. Ditulis lewat catat_foto_lembar, '
  'tidak pernah dihapus dari layar. Gambarnya sendiri di bucket privat `lembar`.';

-- ---------------------------------------------------------------------------
-- Bucket privat.
--
-- Dibungkus exception handler karena hak atas skema `storage` berbeda antar
-- proyek Supabase: di sebagian proyek peran migrasi boleh menulis
-- storage.buckets, di sebagian lain hanya supabase_storage_admin. Gagal di
-- sini TIDAK BOLEH menggagalkan seluruh migrasi — tabel dan RPC di atas sudah
-- benar, dan buckets bisa dibuat dari dashboard dalam sepuluh detik.
-- ---------------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('lembar', 'lembar', false, 1048576, array['image/jpeg'])
  on conflict (id) do update
    set public = false,
        file_size_limit = 1048576,
        allowed_mime_types = array['image/jpeg'];
  raise notice '0047: bucket `lembar` siap (privat, maks 1 MB, hanya JPEG).';
exception
  when insufficient_privilege or undefined_table or invalid_schema_name then
    raise warning '0047: TIDAK BISA membuat bucket dari SQL. Buat manual di '
      'Dashboard > Storage: nama `lembar`, PRIVAT, batas 1 MB (1048576), '
      'allowed MIME image/jpeg.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Pagar bucket. Prefiks pertama nama objek adalah posnya: `pos1/...`.
--
-- Dipagari sendiri, tidak mengandalkan tabel foto_lembar: gambar diunggah
-- LEBIH DULU, barisnya ditulis sesudahnya. Kalau pagarnya bergantung pada
-- baris yang belum ada, tidak ada unggahan yang pernah berhasil.
-- ---------------------------------------------------------------------------
do $$
begin
  execute $p$
    create policy foto_lembar_baca on storage.objects for select
    using (
      bucket_id = 'lembar' and (
        peran() in ('admin', 'meja')
        or (peran() = 'operator_pos'
            and split_part(name, '/', 1) = 'pos' || pos_saya()::text)
      )
    )
  $p$;
  execute $p$
    create policy foto_lembar_tulis on storage.objects for insert
    with check (
      bucket_id = 'lembar' and (
        peran() in ('admin', 'meja')
        or (peran() = 'operator_pos'
            and split_part(name, '/', 1) = 'pos' || pos_saya()::text)
      )
    )
  $p$;
  raise notice '0047: policy storage.objects untuk bucket `lembar` terpasang.';
exception
  when duplicate_object then
    raise notice '0047: policy storage.objects sudah ada — dilewati.';
  when insufficient_privilege or undefined_table or invalid_schema_name then
    raise warning '0047: TIDAK BISA memasang policy storage.objects dari SQL. '
      'Pasang manual di Dashboard > Storage > lembar > Policies, '
      'salin syarat dari kepala migrasi ini.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Mencatat foto yang SUDAH terunggah.
--
-- Dipanggil sesudah gambarnya mendarat di bucket, bukan sebelumnya. Urutan itu
-- disengaja: baris tanpa gambar adalah kebohongan (layar bilang "sudah difoto"
-- padahal tidak ada apa-apa), sedangkan gambar tanpa baris cuma berkas yatim
-- yang tidak merugikan siapa pun dan masih bisa ditemukan lewat path-nya.
-- ---------------------------------------------------------------------------
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
  if peran() = 'operator_pos' then
    if p_pos is distinct from pos_saya() then
      raise exception 'operator pos % tidak boleh mengunggah foto pos %',
        pos_saya(), p_pos;
    end if;
  elsif peran() not in ('admin', 'meja') then
    raise exception 'hanya panitia yang boleh mengunggah foto lembar';
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

  insert into foto_lembar
    (regu_id, pos, kode_lomba, nama_lomba, path, ukuran_bytes, diunggah_oleh)
  values
    (v_regu, p_pos, p_kode_lomba, p_nama_lomba, p_path, p_ukuran, auth.uid())
  -- Mengirim ulang berkas yang sama bukan galat: jaringan lapangan memutus
  -- jawaban, bukan permintaan, dan petugas yang menekan "kirim ulang" tidak
  -- melakukan kesalahan apa pun.
  on conflict (path) do nothing;
end;
$$;

revoke all on function catat_foto_lembar(integer, smallint, text, text, text, integer) from public;
grant execute on function catat_foto_lembar(integer, smallint, text, text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Berapa foto sudah masuk, per regu per lomba. Dibaca layar untuk menampilkan
-- angka di samping tiap lomba tanpa menarik seluruh daftar.
-- ---------------------------------------------------------------------------
create or replace view v_foto_lembar as
select
  f.id, r.nomor_dada, f.pos, f.kode_lomba, f.nama_lomba, f.path,
  f.ukuran_bytes,
  coalesce(a.username, '(tidak dikenal)') as oleh,
  f.diunggah_pada
from foto_lembar f
join regu r on r.id = f.regu_id
left join akun_panitia a on a.user_id = f.diunggah_oleh
where peran() in ('admin', 'meja')
   or (peran() = 'operator_pos' and f.pos = pos_saya());

comment on view v_foto_lembar is
  'Foto lembar dengan nomor dada dan nama pengunggah. Pagarnya sama dengan '
  'tabelnya: admin/meja seluruh pos, operator pos hanya posnya sendiri.';

grant select on v_foto_lembar to authenticated;

-- ---------------------------------------------------------------------------
-- Kuota terpakai, dibaca langsung oleh layar.
--
-- Angka ini ada supaya kehabisan kuota tidak pernah jadi kejutan di tengah
-- acara. Kalau rata-rata per foto mulai menanjak jauh di atas ~90 KB, artinya
-- pengecilan di klien gagal pada sebagian HP — dan itu ketahuan dari satu
-- angka di layar, bukan dari unggahan yang tiba-tiba ditolak semua.
--
-- Agregat tanpa pagar peran: tidak ada data siapa pun di dalamnya, cuma
-- hitungan dan jumlah byte.
-- ---------------------------------------------------------------------------
create or replace view v_kuota_foto as
select
  count(*)                                        as jumlah_foto,
  coalesce(sum(ukuran_bytes), 0)                  as total_bytes,
  coalesce(round(avg(ukuran_bytes))::bigint, 0)   as rata_bytes,
  coalesce(max(ukuran_bytes), 0)                  as terbesar_bytes
from foto_lembar;

comment on view v_kuota_foto is
  'Ringkasan pemakaian bucket `lembar`. Rata-rata jauh di atas 90 KB berarti '
  'pengecilan gambar di klien tidak jalan pada sebagian HP.';

grant select on v_kuota_foto to authenticated;
