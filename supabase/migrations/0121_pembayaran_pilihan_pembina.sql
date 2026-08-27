-- ============================================================================
-- hrcd-rekap : 0121_pembayaran_pilihan_pembina.sql
--
-- Pembina memilih cara membayar saat mendaftar, dan yang transfer mengunggah
-- buktinya di form itu juga.
--
-- ---------------------------------------------------------------------------
-- DUA "METODE" YANG BERBEDA, DAN JANGAN SAMPAI TERTUKAR
--
-- `pembayaran.method` sudah ada sejak 0001. Itu metode yang benar-benar
-- DITERIMA panitia, dicatat saat menekan Tandai Lunas, dan itulah yang dipakai
-- menyusun laporan keuangan.
--
-- Kolom `pendaftaran.metode_bayar` di sini bukan itu. Ia NIAT pembina, dicatat
-- sebelum uangnya ada di mana pun. Keduanya sengaja disimpan terpisah karena
-- keduanya memang bisa berbeda: sekolah memilih Transfer lalu batal dan
-- membayar tunai di meja, dan yang benar tetap yang di tangan bendahara.
--
-- Gunanya niat itu tetap nyata: Meja Pembayaran memakainya sebagai pilihan
-- awal dropdown metode, jadi jalur yang paling sering benar cukup satu ketukan.
--
-- ---------------------------------------------------------------------------
-- KENAPA BUKTI TRANSFER WAJIB
--
-- Keputusan pemilik acara. Tanpa bukti, transfer hanya bisa dicocokkan lewat
-- kode di berita transfer — dan kode yang salah ketik membuat uang masuk tanpa
-- nama, ketahuan berhari-hari kemudian saat rekening dicocokkan.
--
-- Harganya disebut supaya tidak jadi kejutan: sekolah yang MEMILIH transfer
-- tetapi belum sempat mentransfer tidak bisa mengirim pendaftarannya dulu.
-- Belum ada layar untuk menyusulkan bukti dengan modal kode pembayaran, jadi
-- ia harus mengisi form itu lagi nanti. Kalau itu terlalu mahal di lapangan,
-- yang diubah adalah `check` di bawah DAN validasi di form — bukan salah
-- satunya saja.
--
-- ---------------------------------------------------------------------------
-- BUCKET `bukti` DAN UNGGAHAN ANONIM
--
-- Ini satu-satunya tempat di seluruh sistem yang menerima unggahan dari orang
-- yang tidak login, jadi pagarnya ditulis sesempit mungkin:
--
--   * nama objek WAJIB `<kunci_kirim>/<sesuatu>.jpg` — satu UUID acak yang
--     lahir di HP pembina. Tidak ada yang bisa menebak folder orang lain.
--   * INSERT saja. Tidak ada policy update maupun delete untuk anon, jadi
--     bukti yang sudah masuk tidak bisa ditimpa atau dihapus dari luar.
--   * tidak ada policy SELECT untuk anon. Yang mengunggah pun tidak bisa
--     membacanya kembali — bukti pembayaran sekolah lain bukan urusannya.
--   * batas 1 MB dan hanya image/jpeg, sama dengan bucket `lembar`. Klien
--     sudah mengecilkan gambarnya lebih dulu lewat `kecilkanFoto()`; batas ini
--     pagar KEDUA, untuk saat pengecilan itu gagal diam-diam.
--
-- Yang TIDAK dijaga, dan disebut supaya tidak jadi kejutan: tidak ada rate
-- limit di jalur ini. Gateway membatasi 30 pengiriman per IP per menit, tetapi
-- gambarnya naik langsung ke Storage tanpa melewatinya. Yang menahan
-- penyalahgunaan cuma batas 1 MB dan tidak adanya hak baca — jadi bucket ini
-- bisa diisi sampah oleh siapa pun yang mau. Untuk satu acara berisi ratusan
-- pendaftaran itu risiko yang diterima; kalau suatu saat tidak, unggahannya
-- dipindahkan lewat Worker, bukan ditambal dengan policy yang lebih rumit.
--
-- `submit_pendaftaran` menambahkan pagar yang tidak bisa ditegakkan Storage:
-- path yang disebut harus berada di dalam folder `kunci_kirim` milik kiriman
-- itu sendiri. Tanpa itu, satu pendaftaran bisa mengaku memakai bukti milik
-- pendaftaran lain yang path-nya kebetulan diketahui.
-- ============================================================================

alter table pendaftaran add column if not exists metode_bayar text;
alter table pendaftaran add column if not exists bukti_transfer text;

alter table pendaftaran drop constraint if exists pendaftaran_metode_bayar_check;
alter table pendaftaran add constraint pendaftaran_metode_bayar_check
  check (metode_bayar is null or metode_bayar in ('transfer', 'tunai'));

-- Baris sebelum migrasi ini tidak punya metode sama sekali, dan
-- `null is distinct from 'transfer'` bernilai true — jadi mereka lolos tanpa
-- perlu NOT VALID.
alter table pendaftaran drop constraint if exists pendaftaran_transfer_berbukti;
alter table pendaftaran add constraint pendaftaran_transfer_berbukti
  check (metode_bayar is distinct from 'transfer' or bukti_transfer is not null);

comment on column pendaftaran.metode_bayar is
  'Cara bayar yang DIPILIH pembina saat mendaftar. Bukan pembayaran.method, '
  'yang mencatat cara uangnya benar-benar diterima panitia.';
comment on column pendaftaran.bukti_transfer is
  'Nama objek di bucket privat `bukti`, selalu berawalan folder kunci_kirim '
  'kiriman itu sendiri. Wajib ada bila metode_bayar = transfer.';

-- ---------------------------------------------------------------------------
-- Bucket privat. Pembungkus exception-nya menyalin 0047 dan alasannya sama:
-- hak atas skema `storage` berbeda antar proyek Supabase, dan gagal di sini
-- tidak boleh menggagalkan kolom serta RPC yang sudah benar di atas.
-- ---------------------------------------------------------------------------
do $blok$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('bukti', 'bukti', false, 1048576, array['image/jpeg'])
  on conflict (id) do update
    set public = false,
        file_size_limit = 1048576,
        allowed_mime_types = array['image/jpeg'];
  raise notice '0121: bucket `bukti` siap (privat, maks 1 MB, hanya JPEG).';
exception
  when insufficient_privilege or undefined_table or invalid_schema_name then
    raise warning '0121: TIDAK BISA membuat bucket lewat migrasi. Buat manual '
      'di Dashboard > Storage: nama `bukti`, PRIVAT, batas 1 MB (1048576), '
      'allowed MIME image/jpeg.';
end;
$blok$;

do $blok$
begin
  execute $pol$
    create policy bukti_transfer_tulis on storage.objects for insert
    with check (
      bucket_id = 'bukti'
      and name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[a-z0-9-]+[.]jpg$'
    )
  $pol$;
  execute $pol$
    create policy bukti_transfer_baca on storage.objects for select
    using (bucket_id = 'bukti' and boleh_apa_saja('pembayaran', 'pengaturan'))
  $pol$;
  raise notice '0121: policy storage.objects untuk bucket `bukti` terpasang.';
exception
  when duplicate_object then
    raise notice '0121: policy storage.objects sudah ada — dilewati.';
  when insufficient_privilege or undefined_table or invalid_schema_name then
    raise warning '0121: TIDAK BISA memasang policy storage.objects lewat '
      'migrasi. Pasang manual di Dashboard > Storage > bukti > Policies, '
      'salin syaratnya dari kepala migrasi ini.';
end;
$blok$;

-- ---------------------------------------------------------------------------
-- Salinan terakhir submit_pendaftaran (0114). Yang berubah: dua argumen baru,
-- satu blok validasi, dan dua kolom di INSERT.
-- ---------------------------------------------------------------------------
create or replace function submit_pendaftaran(
  p_nama_sekolah   text,
  p_alamat_sekolah text,
  p_butuh_barak    boolean,
  p_kontak_wa      text,
  p_regu           jsonb,
  p_jumlah_pendamping smallint default 0,
  p_kunci_kirim    uuid default null,
  p_nama_kontak    text default null,
  p_metode_bayar   text default null,
  p_bukti_transfer text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $fn$
declare
  v_sekolah  uuid;
  v_batch    uuid;
  v_kode     text;
  v_n        int;
  v_r        jsonb;
  v_ada      pendaftaran%rowtype;
  v_bukti    text;
begin
  if p_kunci_kirim is not null then
    select * into v_ada from pendaftaran where kunci_kirim = p_kunci_kirim;
    if found then
      return jsonb_build_object(
        'kode_pembayaran', v_ada.kode_pembayaran,
        'jumlah_regu', v_ada.jumlah_regu,
        'total_tagihan', tagihan_pendaftaran(v_ada.id),
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
  if coalesce(trim(p_nama_sekolah), '') = '' then
    raise exception 'nama sekolah wajib diisi';
  end if;

  -- Cara bayar dan buktinya. Path buktinya WAJIB berada di dalam folder
  -- kunci_kirim kiriman ini: nama objek Storage bisa ditebak siapa pun yang
  -- pernah melihat satu contohnya, dan tanpa pagar ini satu pendaftaran bisa
  -- menunjuk bukti milik pendaftaran lain.
  if p_metode_bayar is not null and p_metode_bayar not in ('transfer', 'tunai') then
    raise exception 'cara pembayaran tidak dikenal: %', p_metode_bayar;
  end if;
  v_bukti := nullif(trim(coalesce(p_bukti_transfer, '')), '');
  if p_metode_bayar = 'transfer' then
    if v_bukti is null then
      raise exception 'bukti transfer wajib diunggah';
    end if;
    if p_kunci_kirim is null
       or v_bukti not like p_kunci_kirim::text || '/%' then
      raise exception 'bukti transfer bukan milik kiriman ini';
    end if;
  else
    v_bukti := null;
  end if;

  for v_r in select * from jsonb_array_elements(p_regu) loop
    if coalesce(trim(v_r ->> 'nama_regu'), '') = '' then
      raise exception 'nama regu wajib diisi';
    end if;
    if coalesce(trim(v_r ->> 'nama_ketua'), '') = '' then
      raise exception 'nama ketua wajib diisi';
    end if;
    if coalesce(v_r ->> 'golongan', '') not in (
      'penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi',
      'intern_pa', 'intern_pi'
    ) then
      raise exception 'golongan tidak dikenal: %', coalesce(v_r ->> 'golongan', '(kosong)');
    end if;

    -- Anggota OPSIONAL: kunci `anggota` boleh tidak ada sama sekali, dan
    -- daftarnya boleh kosong. Yang ditolak cuma bentuk yang salah.
    if v_r ? 'anggota' and jsonb_typeof(v_r -> 'anggota') <> 'null' then
      if jsonb_typeof(v_r -> 'anggota') <> 'array' then
        raise exception 'anggota harus berupa daftar nama';
      end if;
      if (select count(*) from jsonb_array_elements_text(v_r -> 'anggota') a
          where trim(a) <> '') > 4 then
        raise exception 'maksimal 4 anggota selain ketua';
      end if;
      -- Aturan yang sama dengan nama ketua (0052): angka di nama orang hampir
      -- selalu nomor urut yang ikut terketik, dan ia terbawa ke daftar hadir.
      if exists (select 1 from jsonb_array_elements_text(v_r -> 'anggota') a
                 where a ~ '[0-9]') then
        raise exception 'nama anggota tidak boleh memakai angka';
      end if;
    end if;
  end loop;

  select id into v_sekolah from sekolah
   where kunci_sekolah(name) = kunci_sekolah(p_nama_sekolah);

  if v_sekolah is null then
    insert into sekolah (name, address)
    values (trim(p_nama_sekolah), trim(coalesce(p_alamat_sekolah, '')))
    on conflict (kunci_sekolah(name)) do nothing
    returning id into v_sekolah;

    if v_sekolah is null then
      select id into v_sekolah from sekolah
       where kunci_sekolah(name) = kunci_sekolah(p_nama_sekolah);
    end if;
  end if;

  loop
    v_kode := 'HRCD' || edisi_aktif() || '-' ||
              upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from pendaftaran where kode_pembayaran = v_kode);
  end loop;

  insert into pendaftaran (sekolah_id, kode_pembayaran, butuh_barak,
                           jumlah_pendamping, jumlah_regu, kontak_wa, kunci_kirim,
                           nama_kontak, metode_bayar, bukti_transfer)
  values (v_sekolah, v_kode, coalesce(p_butuh_barak, false),
          greatest(coalesce(p_jumlah_pendamping, 0), 0), v_n, trim(p_kontak_wa),
          p_kunci_kirim, nullif(trim(coalesce(p_nama_kontak, '')), ''),
          p_metode_bayar, v_bukti)
  returning id into v_batch;

  -- Kotak yang dibiarkan kosong TIDAK disimpan sebagai string kosong: yang
  -- tersimpan hanya nama yang benar-benar diketik, berurutan. `array_agg` atas
  -- nol baris mengembalikan NULL, dan NULL di sini berarti "tidak ada nama
  -- anggota yang dicatat" — bukan "regunya kosong".
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, anggota)
  select v_batch, trim(r ->> 'nama_regu'), trim(r ->> 'nama_ketua'), r ->> 'golongan',
         (select array_agg(trim(a) order by urut)
          from jsonb_array_elements_text(coalesce(r -> 'anggota', '[]'::jsonb))
               with ordinality as t(a, urut)
          where trim(a) <> '')
  from jsonb_array_elements(p_regu) r;

  return jsonb_build_object(
    'kode_pembayaran', v_kode,
    'jumlah_regu', v_n,
    'total_tagihan', tagihan_pendaftaran(v_batch),
    'terkirim_ulang', false);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- KENAPA VERSI INI BELUM MENUNTUT CARA BAYAR, DAN 0122 YANG MENUNTUTNYA
--
-- Tiga hal berubah bersama untuk fitur ini — migrasi, Worker gateway, dan form
-- peserta — dan ketiganya TIDAK mendarat pada detik yang sama. Kalau fungsi ini
-- langsung menolak kiriman tanpa cara bayar, gateway yang masih berjalan
-- ditolak setiap kali, dan pendaftaran mati sampai deploy berikutnya selesai.
-- Bukan jeda yang bisa dijadwalkan: form ini dibuka pembina kapan saja.
--
-- Membiarkan bentuk delapan-argumen dari 0114 hidup berdampingan BUKAN
-- jalannya. Dua fungsi bernama sama membuat PostgREST harus menebak yang mana,
-- dan tebakan itu bukan sesuatu yang boleh dipertaruhkan pada satu-satunya
-- pintu pendaftaran. Jadi bentuk lama dibuang di sini, dan penggantinya
-- menerima kiriman delapan kunci lewat DEFAULT — cara bayarnya tercatat NULL,
-- persis seperti seluruh pendaftaran sebelum hari ini.
--
-- Yang tetap ditegakkan sejak sekarang: transfer WAJIB berbukti, dan buktinya
-- wajib milik kiriman itu sendiri. Keduanya tidak punya masa peralihan karena
-- tidak ada klien lama yang pernah mengirimkannya.
--
-- `0122` yang menutupnya: sesudah gateway terdeploy, cara bayar yang NULL
-- ditolak. Jalankan migrasi itu SESUDAH deploy-gateway.yml selesai.
-- ---------------------------------------------------------------------------

drop function if exists submit_pendaftaran(
  text, text, boolean, text, jsonb, smallint, uuid, text);

grant execute on function submit_pendaftaran(
  text, text, boolean, text, jsonb, smallint, uuid, text, text, text)
  to anon, authenticated;
