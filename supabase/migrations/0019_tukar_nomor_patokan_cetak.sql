-- ============================================================================
-- hrcd-rekap : 0019_tukar_nomor_patokan_cetak.sql
--
-- Membetulkan patokan tukar_nomor_dada: "kertas sudah beredar" ditentukan oleh
-- dicetak_pada, bukan jam_berangkat.
--
-- MASALAHNYA ada di komentar fungsinya sendiri. Alasan yang ditulis adalah
-- "lembar kertas beredar memakai nomor lama", tapi syarat yang dipakai
-- jam_berangkat. Kertas mulai beredar saat DICETAK, dan mencetak selalu lebih
-- dulu daripada berangkat — layar Cetak Kloter bahkan menyatakannya: setelah
-- dicetak, isi kloter dibekukan.
--
-- Akibatnya ada satu jendela waktu — sudah dicetak, belum berangkat — di mana
-- penjaganya tidak menggigit dan meja boleh mengganti nomor tanpa admin. Itu
-- justru jendela ketika petugas staging sedang memegang kertas dan memanggil
-- nama satu per satu:
--
--   di kertas : 001 — Melati
--   kenyataan : Melati memakai 007; 001 pensiun, tidak dimiliki siapa pun
--
-- Petugas memanggil 001, tidak ada yang maju, dan regu yang memakai 007 tidak
-- tercantum di kertas sama sekali. Tidak ada peringatan apa pun, karena
-- mekanisme sisipan hanya dipasang di pindah_kloter.
--
-- Sekaligus menyeragamkan: pindah_kloter (0018) sudah memakai
-- "dicetak_pada is not null or jam_berangkat is not null". Dua fungsi yang
-- sama-sama mengubah isi kertas tidak boleh berbeda pendapat tentang kapan
-- kertas itu beredar.
--
-- Admin tetap boleh menembusnya, seperti sebelumnya. Yang berubah hanya KAPAN
-- pembatasan itu mulai berlaku — lebih awal, sesuai kenyataan di meja.
-- ============================================================================

create or replace function tukar_nomor_dada(
  p_regu       uuid,
  p_nomor_baru integer,
  p_alasan     text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu regu%rowtype;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan tukar wajib diisi';
  end if;

  select * into v_regu from regu where id = p_regu for update;
  if not found then
    raise exception 'regu tidak ditemukan';
  end if;
  if v_regu.is_cancelled then
    raise exception 'regu berstatus batal';
  end if;
  if v_regu.nomor_dada is null then
    raise exception 'regu belum punya nomor dada';
  end if;
  -- Begitu kertasnya DICETAK, lembar yang beredar memakai nomor lama —
  -- penukaran hanya boleh oleh admin yang paham konsekuensinya. Keberangkatan
  -- ikut dihitung karena kloter yang sudah jalan pasti kertasnya beredar,
  -- walau tanda cetaknya sempat dibatalkan (batalkan_tanda_cetak tidak
  -- memeriksa keberangkatan sama sekali).
  if peran() <> 'admin' and exists (
       select 1 from kloter where nomor = v_regu.kloter_nomor
         and (dicetak_pada is not null or jam_berangkat is not null)) then
    raise exception 'kertas kloter ini sudah beredar — tukar nomor hanya lewat admin';
  end if;
  if not exists (select 1 from nomor_dada_stok where nomor = p_nomor_baru) then
    raise exception 'nomor % tidak ada di stok', p_nomor_baru;
  end if;
  if exists (select 1 from regu where nomor_dada = p_nomor_baru)
     or exists (select 1 from nomor_dada_pensiun where nomor = p_nomor_baru) then
    raise exception 'nomor % sudah terpakai / pensiun', p_nomor_baru;
  end if;

  insert into history (table_name, row_id, regu_id, action, new_value, changed_by)
  values ('regu', p_regu::text, p_regu, 'UPDATE',
          jsonb_build_object('alasan_tukar_nomor', p_alasan,
                             'nomor_lama', v_regu.nomor_dada,
                             'nomor_baru', p_nomor_baru), auth.uid());

  -- Nomor lama PENSIUN — tidak pernah terbit ulang ke regu lain, supaya
  -- lembar/foto lama yang masih menuliskannya tidak menilai regu yang salah.
  insert into nomor_dada_pensiun (nomor, reason)
  values (v_regu.nomor_dada, p_alasan);

  update regu set nomor_dada = p_nomor_baru where id = p_regu;
end;
$$;
