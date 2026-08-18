-- ============================================================================
-- hrcd-rekap : 0077_peran_mengisi_ulang_centang.sql
--
-- MENGGANTI PERAN BENAR-BENAR MENGISI ULANG CENTANGNYA.
--
-- ---------------------------------------------------------------------------
-- APA YANG RUSAK
--
-- Layar Akun berbunyi "Mengganti peran mengisi ulang centangnya." Tidak ada
-- satu baris pun di sistem ini yang melakukannya. `ubahPeranAkun()` mengubah
-- kolom `peran` di `akun_panitia` dan berhenti di situ; `akun_hak` — yang
-- SEBENARNYA menjadi pagar sejak 0064 — tidak tersentuh.
--
-- Akibatnya persis kebalikan dari yang diharapkan admin: menurunkan seseorang
-- dari admin jadi juri pos meninggalkan sebelas centang admin utuh di
-- tangannya. Ia tetap bisa membuka pembayaran, keberangkatan, akun, dan
-- pengaturan. Perannya di layar berbunyi "Juri Pos", dan itulah yang dibaca
-- orang saat memeriksa siapa boleh apa.
--
-- Yang membuatnya sulit dilihat: layarnya BENAR. Peran berubah, notifikasi
-- muncul, tabelnya menampilkan peran baru. Yang tidak berubah cuma sebelas
-- kotak yang letaknya jauh di kanan, di luar layar HP.
--
-- ---------------------------------------------------------------------------
-- KENAPA TRIGGER, BUKAN DUA PERMINTAAN DARI LAYAR
--
-- Peran bisa berubah dari EMPAT pintu: layar Akun, gateway saat provisioning,
-- SQL langsung di dashboard, dan skrip pemeliharaan. Memperbaiki layarnya saja
-- meninggalkan tiga pintu yang tetap menghasilkan centang basi — dan bentuk
-- kegagalan itu persis yang bagian 13.3 gambarkan: pemeriksaan yang cakupannya
-- lebih sempit daripada masalahnya.
--
-- Di database ia juga ATOMIK. Dua permintaan dari klien punya jeda di
-- antaranya, dan jeda itu adalah akun tanpa satu centang pun — atau, kalau
-- yang kedua gagal, akun dengan centang lama selamanya.
--
-- ---------------------------------------------------------------------------
-- YANG SENGAJA TIDAK DILAKUKAN
--
-- Trigger ini TIDAK menyentuh INSERT. Akun baru sudah diisi centangnya oleh
-- pembuatnya (gateway `buatAkun` dan `daftarPanitia`), dan menambah satu
-- pengisi lagi berarti dua tempat menulis hal yang sama dengan urutan yang
-- tidak dijamin.
--
-- Ia juga tidak mencoba MEMPERTAHANKAN centang yang disetel tangan. Kalau
-- admin menambahkan `rekap` ke seorang juri pos lalu mengganti perannya,
-- centang itu hilang. Itu memang arti kalimat di layar, dan menebak-nebak mana
-- yang "sengaja ditambahkan" akan membuat perilakunya tidak bisa diterangkan
-- dalam satu kalimat.
-- ============================================================================

create or replace function isi_ulang_hak_peran()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  -- Hanya kalau perannya benar-benar berganti. Tanpa penjaga ini, setiap
  -- perubahan lain di baris yang sama — mengaktifkan akun, mengganti pos,
  -- mengganti nama — ikut menghapus centang yang mungkin baru saja disetel
  -- admin dengan tangan.
  if new.peran is not distinct from old.peran then
    return new;
  end if;

  delete from akun_hak where user_id = new.user_id;

  insert into akun_hak (user_id, fitur)
  select new.user_id, f
  from unnest(paket_peran(new.peran)) as f
  -- Peran yang paket_peran() tidak kenali menghasilkan array kosong, dan
  -- akun itu berakhir tanpa centang sama sekali. Itu keadaan yang benar:
  -- tidak bisa apa-apa lebih aman daripada memegang centang peran lamanya.
  on conflict do nothing;

  return new;
end;
$$;

comment on function isi_ulang_hak_peran() is
  'Mengganti peran mengisi ulang akun_hak dari paket_peran(). Dipasang sebagai '
  'trigger supaya berlaku dari SEMUA pintu, bukan hanya dari layar Akun.';

drop trigger if exists hak_ikut_peran on akun_panitia;
create trigger hak_ikut_peran
  after update of peran on akun_panitia
  for each row execute function isi_ulang_hak_peran();

-- ---------------------------------------------------------------------------
-- Membetulkan yang sudah terlanjur: akun yang centangnya tidak cocok dengan
-- perannya HARI INI. Ini bukan pembersihan kosmetik — tiap satu di antaranya
-- adalah orang yang memegang hak yang tidak seharusnya ia pegang.
-- ---------------------------------------------------------------------------
do $blok$
declare
  r       record;
  v_ubah  integer := 0;
begin
  for r in
    select a.user_id, a.username, a.peran,
           array(select h.fitur from akun_hak h where h.user_id = a.user_id
                 order by h.fitur) as punya,
           array(select f from unnest(paket_peran(a.peran)) f order by 1) as harus
    from akun_panitia a
  loop
    if r.punya is distinct from r.harus then
      raise notice '0077: % (%) — % centang -> %',
        r.username, r.peran, array_length(r.punya, 1), array_length(r.harus, 1);
      delete from akun_hak where user_id = r.user_id;
      insert into akun_hak (user_id, fitur)
      select r.user_id, f from unnest(paket_peran(r.peran)) f
      on conflict do nothing;
      v_ubah := v_ubah + 1;
    end if;
  end loop;

  raise notice '0077: % akun diselaraskan centangnya dengan perannya.', v_ubah;
end;
$blok$;
