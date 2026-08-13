-- ============================================================================
-- hrcd-rekap : 0018_pindah_setelah_berangkat.sql
--
-- Melonggarkan pindah_kloter supaya regu yang KETINGGALAN kloternya bisa
-- dipindah ke kloter lain.
--
-- MASALAHNYA. Versi lama menolak dua hal:
--   1. regu yang kloternya sudah berangkat  ('sudah diberangkatkan ... tidak
--      bisa dipindah')
--   2. kloter tujuan yang sudah berangkat   ('kloter % sudah berangkat')
--
-- Aturan (1) menyamakan "kloternya berangkat" dengan "regunya ikut berangkat".
-- Itu tidak sama. Regu yang telat berdiri di staging saat kloternya jalan —
-- ia tidak ke mana-mana, dan justru dialah yang paling butuh dipindah. Dengan
-- aturan lama, regu itu terkunci di kloter yang sudah pergi tanpa dia, dan
-- penaltinya dihitung dari jam keberangkatan yang tidak pernah ia jalani.
--
-- YANG MEMBEDAKAN keduanya sudah ada di database: keberangkatan_regu. Baris
-- di situ berarti petugas MENCENTANG regu ini berangkat; tidak ada baris
-- berarti ia tidak ikut. Jadi syaratnya bukan "kloternya belum berangkat"
-- melainkan "regu ini belum tercatat berangkat" — tepat sasaran, dan tetap
-- menolak kasus yang benar-benar berbahaya.
--
-- Regu yang MEMANG sudah tercatat berangkat tetap ditolak. Memindahnya berarti
-- mengubah dasar penaltinya padahal ia sudah di lintasan; kalau keberangkatan
-- kloternya sendiri yang salah klik, jalan keluarnya batalkan_keberangkatan
-- (admin), dan pesan galatnya menyebut itu.
--
-- Aturan (2) dicabut. Regu telat yang berlari menyusul kloter berikutnya
-- memang berangkat bersama kloter itu, pada jam kloter itu — dan sejak
-- keberangkatan_regu ber-PK regu_id (bukan per kloter), memindahkannya tidak
-- meninggalkan baris yatim di mana pun. Penaltinya ikut sendiri, karena
-- v_penalti_waktu membaca kloter.jam_berangkat lewat kloter regu itu, tidak
-- menyimpan salinannya.
--
-- Kapasitas, status batal, dan kunci kertas (sisipan) tidak disentuh.
-- ============================================================================

-- Satu-satunya definisi "regu ini sudah berangkat", dipakai pindah_kloter dan
-- konfirmasi_kontrak supaya keduanya tidak bisa berbeda pendapat.
--
-- DUA syarat, dan keduanya wajib:
--   - regu ini DICENTANG hadir (ada baris keberangkatan_regu), DAN
--   - kloternya memang sudah jalan (jam_berangkat terisi).
--
-- Centang saja tidak cukup. Petugas mencentang regu saat ia tiba di staging,
-- jauh sebelum kloternya berangkat — memakai centang sendirian akan mengunci
-- kontrak waktu pada alur meja yang paling biasa: centang dulu, pilih kontrak
-- sesudahnya. Keberangkatan kloter saja juga tidak cukup: itu justru cerita
-- regu yang ketinggalan, yang tidak ke mana-mana.
create or replace function regu_sudah_berangkat(p_regu uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from keberangkatan_regu kb
    join regu r  on r.id = kb.regu_id
    join kloter k on k.nomor = r.kloter_nomor
    where kb.regu_id = p_regu and k.jam_berangkat is not null)
$$;

create or replace function pindah_kloter(
  p_nomor_dada integer,
  p_alasan     text,
  p_kloter     smallint default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu    regu%rowtype;
  v_cfg     edisi%rowtype;
  v_tujuan  smallint;
  v_isi     int;
  v_perlu_diumumkan boolean;
  v_lama    smallint;
  v_tujuan_berangkat boolean;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan pemindahan wajib diisi — tercatat di riwayat';
  end if;

  select * into v_cfg from edisi where is_active;

  -- Serialisasi bersama daftar ulang: keduanya menyentuh isi kloter.
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  select * into v_regu from regu where nomor_dada = p_nomor_dada for update;
  if not found then
    raise exception 'nomor dada % tidak dikenal', p_nomor_dada;
  end if;
  if v_regu.is_cancelled then
    raise exception 'regu % berstatus batal', p_nomor_dada;
  end if;
  v_lama := v_regu.kloter_nomor;

  -- Yang menghalangi BUKAN keberangkatan kloternya, melainkan keberangkatan
  -- REGU ini. Lihat catatan panjang di kepala berkas.
  if regu_sudah_berangkat(v_regu.id) then
    raise exception 'regu % ikut berangkat bersama kloter % — kalau itu keliru, batalkan dulu keberangkatan kloter itu lewat admin',
      p_nomor_dada, v_lama;
  end if;

  if p_kloter is null then
    -- TELAT BIASA: kloter terakhir yang belum berangkat dan masih muat.
    select k.nomor into v_tujuan
    from kloter k
    where k.jam_berangkat is null
      and k.nomor <= v_cfg.kloter_maks
      and (select count(*) from regu r where r.kloter_nomor = k.nomor)
          < v_cfg.maks_regu_per_kloter
    order by k.nomor desc
    limit 1;
    if v_tujuan is null then
      raise exception 'tidak ada kloter tersisa yang belum berangkat dan masih muat';
    end if;
  else
    -- URGENT: kloter yang disebut panitia, apa pun keadaannya — termasuk yang
    -- sudah berangkat, karena regu telat yang berlari menyusul memang
    -- berangkat bersama kloter itu.
    v_tujuan := p_kloter;
    if not exists (select 1 from kloter where nomor = v_tujuan) then
      raise exception 'kloter % tidak ada', v_tujuan;
    end if;
  end if;

  if v_tujuan = v_lama then
    raise exception 'regu % sudah ada di kloter %', p_nomor_dada, v_tujuan;
  end if;

  -- Kapasitas tetap dijaga: kertas boleh dilanggar, kapasitas fisik tidak.
  select count(*) into v_isi from regu
   where kloter_nomor = v_tujuan and not is_cancelled;
  if v_isi >= v_cfg.maks_regu_per_kloter then
    raise exception 'kloter % sudah penuh (% regu)', v_tujuan, v_isi;
  end if;

  -- Perlu diumumkan bukan hanya bila kertasnya sudah dicetak, tapi juga bila
  -- kloternya sudah berangkat: keduanya berarti petugas staging memegang
  -- daftar yang tidak memuat nomor ini. Keduanya berdiri sendiri —
  -- batalkan_tanda_cetak tidak memeriksa keberangkatan sama sekali.
  select dicetak_pada is not null or jam_berangkat is not null,
         jam_berangkat is not null
    into v_perlu_diumumkan, v_tujuan_berangkat
  from kloter where nomor = v_tujuan;

  -- Buka pintu untuk trigger 0008, hanya di dalam transaksi ini.
  perform set_config('hrcd.izin_pindah', '1', true);

  update regu set
    kloter_nomor  = v_tujuan,
    urutan_kloter = (select min(s) from generate_series(1, v_cfg.maks_regu_per_kloter) s
                     where not exists (select 1 from regu x
                                       where x.kloter_nomor = v_tujuan
                                         and x.urutan_kloter = s)),
    -- Ditandai sisipan HANYA bila kertas tujuan sudah beredar.
    disisipkan_pada = case when v_perlu_diumumkan then now() else disisipkan_pada end,
    alasan_sisip    = case when v_perlu_diumumkan then p_alasan else alasan_sisip end
  where id = v_regu.id;

  perform set_config('hrcd.izin_pindah', '0', true);

  -- old_value diisi, seperti koreksi_jam_berangkat (0017): kedua fungsi ini
  -- mengubah dasar penalti yang sama, dan sengketa nilai diselesaikan dari
  -- baris inilah — tanpa kloter lamanya, tidak ada yang bisa ditelusuri.
  insert into history (table_name, row_id, regu_id, action, old_value, new_value, changed_by)
  values ('regu', v_regu.id::text, v_regu.id, 'UPDATE',
          jsonb_build_object('kloter_nomor', v_lama,
                             'urutan_kloter', v_regu.urutan_kloter),
          jsonb_build_object('pindah_kloter', jsonb_build_object(
            'nomor_dada', p_nomor_dada, 'dari', v_lama, 'ke', v_tujuan,
            'alasan', p_alasan, 'kloter_tujuan_perlu_diumumkan', v_perlu_diumumkan,
            'kloter_tujuan_sudah_berangkat', v_tujuan_berangkat)),
          auth.uid());

  return jsonb_build_object(
    'nomor_dada', p_nomor_dada,
    'kloter_lama', v_lama,
    'kloter_baru', v_tujuan,
    'sisipan', v_perlu_diumumkan,
    'tujuan_sudah_berangkat', v_tujuan_berangkat,
    -- Satu peringatan, digabung: dua kotak merah beruntun tidak terbaca.
    'peringatan', nullif(concat_ws(' ',
      case when v_perlu_diumumkan then
        format('Nomor %s TIDAK ADA di kertas kloter %s. Beri tahu petugas staging.',
               p_nomor_dada, v_tujuan) end,
      case when v_tujuan_berangkat then
        format('Kloter %s sudah berangkat, jadi nomor %s dinilai dari jam berangkat kloter itu.',
               v_tujuan, p_nomor_dada) end), ''));
end;
$$;

-- ============================================================================
-- konfirmasi_kontrak ikut disetel ulang — kalau tidak, fiturnya buntu.
--
-- Aturannya memakai patokan yang sama kelirunya dengan pindah_kloter: ia
-- menolak meja begitu KLOTER regu itu berangkat. Akibatnya regu yang telat
-- dan belum punya kontrak tidak bisa ditolong siapa pun di meja:
--
--   sebelum dipindah : kloter asalnya sudah berangkat  -> ditolak
--   sesudah dipindah : kloter tujuannya sudah berangkat -> ditolak
--   tanpa kontrak    : ceklis_berangkat menolak juga
--
-- Meja terjebak mencari admin di tengah lomba, tepat pada satu keadaan yang
-- membuat fitur ini dibuat. Patokannya digeser ke subjek yang benar: kontrak
-- baru "sudah berjalan" setelah REGU ITU tercatat berangkat, bukan setelah
-- kloternya pergi tanpa dia.
-- ============================================================================

create or replace function konfirmasi_kontrak(
  p_regu  uuid,
  p_menit smallint
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_kloter smallint;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if not exists (select 1 from kontrak_opsi
                 where edisi = edisi_aktif() and menit = p_menit) then
    raise exception 'kontrak % menit bukan pilihan edisi ini', p_menit;
  end if;

  select kloter_nomor into v_kloter from regu where id = p_regu;
  if not found then
    raise exception 'regu tidak ditemukan';
  end if;
  if v_kloter is null then
    raise exception 'regu belum daftar ulang (belum punya kloter)';
  end if;
  -- Setelah REGU INI tercatat berangkat, kontraknya menentukan penalti yang
  -- sudah berjalan — perbaikan susulan hanya lewat admin. Kloter yang pergi
  -- tanpa dia tidak menghalangi apa pun.
  if peran() <> 'admin' and regu_sudah_berangkat(p_regu) then
    raise exception 'regu ini sudah berangkat — koreksi kontrak hanya lewat admin';
  end if;

  update regu set kontrak_menit = p_menit where id = p_regu;
end;
$$;
