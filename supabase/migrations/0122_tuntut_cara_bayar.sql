-- ============================================================================
-- hrcd-rekap : 0122_tuntut_cara_bayar.sql
--
-- Cara bayar tidak boleh NULL lagi.
--
-- 0121 sengaja menerimanya kosong. Alasannya ada di kepala migrasi itu:
-- migrasi, Worker gateway, dan form peserta tidak mendarat pada detik yang
-- sama, dan menolak kiriman tanpa cara bayar sebelum gateway barunya naik
-- berarti mematikan satu-satunya pintu pendaftaran selama beberapa menit yang
-- tidak bisa dijadwalkan.
--
-- JALANKAN SESUDAH `deploy-gateway.yml` selesai, bukan sebelumnya. Sesudah itu
-- tidak ada lagi klien yang mengirim tanpa cara bayar, dan menerimanya berarti
-- menyisakan pintu yang mencatat pembayaran sebagai "tidak tahu".
--
-- Baris yang terlanjur lahir tanpa cara bayar selama jeda itu DIBIARKAN, sama
-- seperti seluruh pendaftaran sebelum 0121. Yang berubah cuma yang baru.
--
-- Salinan fungsinya diambil utuh dari 0121; satu-satunya perubahan perilakunya
-- ada di blok validasi cara bayar.
-- ============================================================================

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

do $blok$
begin
  perform submit_pendaftaran('Uji 0122', 'Jl. Uji', false, '081200000122',
                             '[{"nama_regu":"Uji Nol","nama_ketua":"Uji",
                                "golongan":"penegak_pa"}]'::jsonb,
                             0::smallint, gen_random_uuid(), 'Uji', null, null);
  raise exception '0122: cara bayar NULL masih diterima — pengetatan gagal';
exception
  when others then
    if sqlerrm not like '%cara pembayaran wajib dipilih%' then raise; end if;
    raise notice '0122: cara bayar wajib disebut sejak sekarang.';
end;
$blok$;
