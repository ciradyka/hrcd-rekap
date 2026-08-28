-- ============================================================================
-- hrcd-rekap : 0133_kelas_organisasi_regu.sql
--
-- Regu menyimpan KELAS atau ORGANISASI asalnya, satu per regu.
--
-- ---------------------------------------------------------------------------
-- KENAPA, DAN KENAPA PER REGU
--
-- Regu Eksternal dibedakan oleh sekolahnya: "SMPN 3 Kawali" cukup untuk tahu
-- regu itu datang dari mana. Regu Intern semuanya dari SATU sekolah — tuan
-- rumah — jadi kolom sekolah mengatakan hal yang sama untuk keenam puluh
-- sekian regu, dan tidak membedakan apa pun.
--
-- Yang membedakan mereka kelas atau organisasinya: XI-1, XII-4, OSIS,
-- Paskibra. Sampai sekarang itu tidak dicatat di mana pun, jadi panitia yang
-- memanggil regu Intern di lapangan tidak punya cara menyebut asalnya selain
-- nama regunya sendiri.
--
-- Per REGU, bukan per pendaftaran: satu kiriman Intern memuat regu dari
-- beberapa kelas sekaligus — itulah bentuk pendaftaran tuan rumah, satu
-- pembina mendaftarkan seluruh angkatan. Satu kotak untuk seluruh kiriman
-- memaksa mereka memilih satu kelas untuk mewakili semuanya, dan yang
-- tersimpan jadi keterangan yang salah untuk sebagian besar barisnya.
--
-- ---------------------------------------------------------------------------
-- BOLEH KOSONG, DAN TIDAK DIPAGARI KE INTERN SAJA
--
-- Kolomnya NULL untuk seluruh regu yang sudah ada, dan tetap boleh NULL
-- sesudahnya. Form hanya menawarkan kotaknya pada jalur Intern; yang menjaga
-- itu form, bukan constraint.
--
-- Sengaja: `check (golongan like 'intern%' or kelas_organisasi is null)`
-- terdengar rapi sampai satu regu Eksternal ternyata memang punya organisasi
-- yang perlu dicatat — dan saat itu yang menolaknya bukan keputusan panitia
-- melainkan satu baris yang ditulis hari ini tanpa alasan yang kuat. Yang
-- dijaga di sini cuma panjangnya.
--
-- ---------------------------------------------------------------------------
-- KOMPATIBEL DENGAN FORM YANG SEDANG BERJALAN
--
-- Tanda tangan `submit_pendaftaran` TIDAK berubah. Kelas/organisasi dibaca
-- dari kunci baru DI DALAM tiap elemen `p_regu`, jadi:
--
--   form lama (yang tersaji sekarang)  -> kuncinya tidak ada -> NULL
--   form baru                          -> kuncinya terbaca dan tersimpan
--
-- Itu yang membuat migrasi ini aman diterapkan LEBIH DULU, di tengah acara,
-- tanpa menunggu form-nya ikut terbit. Urutannya memang harus begitu:
-- kalau form-nya terbit duluan, kotak yang diisi pembina dibuang diam-diam
-- oleh RPC yang belum mengenal kuncinya.
--
-- Gateway Worker tidak perlu ikut di-deploy — ia meneruskan `b.regu` apa
-- adanya (`p_regu: b.regu`), tanpa menyaring kuncinya satu per satu.
-- ============================================================================

alter table regu add column if not exists kelas_organisasi text;

alter table regu drop constraint if exists regu_kelas_organisasi_panjang;
alter table regu add constraint regu_kelas_organisasi_panjang
  check (kelas_organisasi is null or length(kelas_organisasi) <= 80);

comment on column regu.kelas_organisasi is
  'Kelas atau organisasi asal regu — XI-1, OSIS, Paskibra. Diisi jalur Intern, '
  'tempat kolom sekolah tidak membedakan apa pun karena semuanya tuan rumah. '
  'NULL untuk regu yang mendaftar sebelum 0133 dan untuk yang tidak mengisinya.';

-- ---------------------------------------------------------------------------
-- Salinan terakhir submit_pendaftaran (0124). Yang berubah HANYA daftar kolom
-- pada INSERT regu di bawah, beserta satu ekspresi yang membacanya. Selebihnya
-- disalin utuh — termasuk seluruh validasi dan komentarnya — karena badan
-- fungsi plpgsql disimpan sebagai TEKS: yang tidak ikut disalin, hilang.
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
  if coalesce(p_metode_bayar, '') not in ('transfer', 'tunai') then
    raise exception 'cara pembayaran wajib dipilih';
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

    -- Kelas/organisasi OPSIONAL, dan yang ditolak cuma yang terlalu panjang.
    -- Batasnya sama dengan `maxlength` kotaknya di form, jadi yang lolos di
    -- layar juga lolos di sini — pembina tidak pernah menemui penolakan yang
    -- tidak bisa ia lihat sebabnya.
    if length(coalesce(trim(v_r ->> 'kelas_organisasi'), '')) > 80 then
      raise exception 'kelas/organisasi maksimal 80 karakter';
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
                           jumlah_menginap, jumlah_regu, kontak_wa, kunci_kirim,
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
  --
  -- `kelas_organisasi` mengikuti aturan yang sama: kotak kosong disimpan NULL,
  -- bukan string kosong. Dua bentuk untuk satu keadaan berarti setiap
  -- pembacanya harus memeriksa keduanya, dan yang lupa memeriksa salah satunya
  -- menggambar baris kosong yang terlihat seperti data.
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, anggota,
                    kelas_organisasi)
  select v_batch, trim(r ->> 'nama_regu'), trim(r ->> 'nama_ketua'), r ->> 'golongan',
         (select array_agg(trim(a) order by urut)
          from jsonb_array_elements_text(coalesce(r -> 'anggota', '[]'::jsonb))
               with ordinality as t(a, urut)
          where trim(a) <> ''),
         nullif(trim(coalesce(r ->> 'kelas_organisasi', '')), '')
  from jsonb_array_elements(p_regu) r;

  return jsonb_build_object(
    'kode_pembayaran', v_kode,
    'jumlah_regu', v_n,
    'total_tagihan', tagihan_pendaftaran(v_batch),
    'terkirim_ulang', false);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Pagar: kunci baru benar-benar tersimpan, dan kiriman TANPA kunci itu tetap
-- diterima. Yang kedua yang penting hari ini — form yang sedang tersaji belum
-- mengirimnya, dan pembina sedang mendaftar saat migrasi ini berjalan.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_kunci uuid := gen_random_uuid();
  v_kunci2 uuid := gen_random_uuid();
  v_kode  text;
  v_isi   text;
begin
  select (submit_pendaftaran(
    'SMA Negeri 1 Ciamis', '', false, '081200000133',
    jsonb_build_array(jsonb_build_object(
      'nama_regu', 'UJI KELAS 0133', 'nama_ketua', 'Uji Ketua',
      'golongan', 'intern_pa', 'kelas_organisasi', '  XI-1  ')),
    0::smallint, v_kunci, null, 'tunai', null) ->> 'kode_pembayaran')
  into v_kode;

  select r.kelas_organisasi into v_isi
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v_kode;

  if v_isi is distinct from 'XI-1' then
    raise exception '0133: kelas/organisasi tersimpan sebagai % — seharusnya XI-1 (dan spasinya dibuang)', coalesce(v_isi, '<NULL>');
  end if;

  -- Kiriman tanpa kuncinya sama sekali: bentuk yang dipakai form yang sedang
  -- tersaji. Ia harus tetap diterima, dan kolomnya NULL.
  select (submit_pendaftaran(
    'SMA Negeri 1 Ciamis', '', false, '081200000133',
    jsonb_build_array(jsonb_build_object(
      'nama_regu', 'UJI TANPA KELAS 0133', 'nama_ketua', 'Uji Ketua',
      'golongan', 'intern_pi')),
    0::smallint, v_kunci2, null, 'tunai', null) ->> 'kode_pembayaran')
  into v_kode;

  select coalesce(r.kelas_organisasi, '<NULL>') into v_isi
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v_kode;

  if v_isi <> '<NULL>' then
    raise exception '0133: kiriman tanpa kelas/organisasi menyimpan %', v_isi;
  end if;

  -- Bersihkan kedua pendaftaran uji. Migrasi ini berjalan di produksi saat
  -- acara berlangsung; meninggalkan dua regu karangan di sana berarti dua
  -- baris palsu di Meja Pembayaran dan dua nama yang menyandera indeks
  -- `regu_nama_unik` selamanya.
  delete from regu where pendaftaran_id in (
    select id from pendaftaran where kunci_kirim in (v_kunci, v_kunci2));
  delete from pendaftaran where kunci_kirim in (v_kunci, v_kunci2);

  raise notice '0133: kelas/organisasi tersimpan per regu; kiriman tanpa kuncinya tetap diterima.';
end;
$blok$;
