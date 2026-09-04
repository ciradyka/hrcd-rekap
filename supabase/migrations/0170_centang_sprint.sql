-- ============================================================================
-- hrcd-rekap : 0170_centang_sprint.sql
-- Papan sprint Buku Sakti bisa dicentang, dan centangnya dilihat semua panitia.
--
-- KENAPA DI DATABASE, BUKAN DI HP MASING-MASING
--
-- Timeline persiapan adalah alat KOORDINASI. Pertanyaannya selalu berbunyi
-- "surat ke desa sudah dikirim belum?", dan jawabannya harus sama untuk
-- Ketua, Sekretaris, dan orang yang baru masuk rapat. Centang yang tinggal di
-- localStorage HP masing-masing menjawab pertanyaan itu berbeda-beda per
-- peranti: Sekretaris melihat papan penuh, Ketua melihat papan kosong, dan
-- keduanya yakin papannya yang benar.
--
-- Daftar tugas yang berbohong lebih buruk daripada tidak ada daftar tugas.
--
-- BARIS ADA = SELESAI. Tidak ada kolom `selesai boolean`.
--
-- Alasannya sama dengan `akun_hak` di 0057: baris yang ada tapi bernilai
-- false adalah dua cara menuliskan hal yang sama, dan dua cara berarti suatu
-- hari keduanya tidak sepakat. Membatalkan centang = menghapus barisnya.
--
-- KUNCINYA (edisi, kode), DAN `kode` ITU MILIK BERKAS, BUKAN MILIK DATABASE
--
-- `kode` adalah kode tugas di `web/js/buku-sakti.mjs` — "s6-desa",
-- "s9-tutup-sponsor". Database tidak menyimpan daftar tugasnya dan tidak bisa
-- memvalidasinya: yang menulis timeline panitia lewat berkas, bukan lewat
-- layar. Konsekuensinya satu, dan ia ditulis besar-besar di berkas itu juga:
-- SEKALI SEBUAH KODE DIPAKAI, JANGAN PERNAH DIUBAH. Mengubahnya membuat
-- centangnya menggantung — tugasnya kembali kosong dan tidak ada yang tahu
-- kenapa.
--
-- Kode yang menggantung sengaja TIDAK dihapus otomatis. Timeline yang
-- disunting lalu dikembalikan lagi akan menemukan centangnya masih ada, dan
-- itu jauh lebih sering terjadi daripada kode yang benar-benar pensiun.
--
-- SIAPA BOLEH MENCENTANG: SETIAP PANITIA, DAN ITU DISENGAJA
--
-- Tidak ada fitur baru di layar Akun untuk ini. Papan sprint dipakai di
-- rapat, dan yang memegang spidol bukan selalu yang memegang centang
-- `pengaturan` — Sekretaris yang mencatat, koordinator seksi yang melapor.
-- Mengikatnya ke satu centang berarti seluruh rapat menunggu satu orang.
--
-- Yang menggantikan pagar itu JEJAK: tiap baris menyimpan siapa dan kapan,
-- dan layar menuliskannya di sebelah tugasnya. Salah centang bisa dilihat
-- siapa yang melakukannya dan dibatalkan dalam satu ketukan. Untuk papan
-- rencana — bukan nilai, bukan uang, bukan nomor dada — jejak yang terbuka
-- lebih berguna daripada pintu yang terkunci.
--
-- Membacanya ikut aturan yang sama dengan `regu` dan `kloter` (CLAUDE.md
-- 13.5): membaca data operasional = jadi panitia.
-- ============================================================================

create table if not exists centang_sprint (
  edisi          int  not null references edisi(nomor) on delete cascade,
  kode           text not null,
  dicentang_pada timestamptz not null default now(),
  dicentang_oleh uuid references akun_panitia(user_id) on delete set null,
  primary key (edisi, kode)
);

-- Kode tugas dipakai jadi id elemen di layar dan jadi kunci di sini. Pagarnya
-- dipasang di database juga, bukan cuma di tes berkasnya: yang menulis lewat
-- RPC boleh saja suatu hari bukan layar ini.
alter table centang_sprint drop constraint if exists centang_sprint_kode_check;
alter table centang_sprint add constraint centang_sprint_kode_check
  check (kode ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(kode) between 2 and 60);

comment on table centang_sprint is
  'Centang tugas papan sprint Buku Sakti. Baris ada = selesai. '
  'kode = kode tugas di web/js/buku-sakti.mjs, dan tidak pernah diubah.';
comment on column centang_sprint.dicentang_oleh is
  'Yang mencentang. NULL kalau akunnya dihapus — centangnya tetap berlaku, '
  'yang hilang cuma namanya.';

alter table centang_sprint enable row level security;

-- Membaca: setiap panitia. Papan yang cuma terlihat sebagian orang bukan
-- papan koordinasi.
drop policy if exists sel_centang_sprint on centang_sprint;
create policy sel_centang_sprint on centang_sprint
  for select using (peran() is not null);

-- Menulis lewat RPC saja. Tidak ada policy insert/delete langsung: RPC-nya
-- yang mengunci edisinya ke edisi aktif dan mengisi kolom jejaknya, dan
-- policy terbuka akan membuat keduanya bisa dilewati dari luar layar.
drop policy if exists adm_centang_sprint on centang_sprint;

-- ---------------------------------------------------------------------------
-- RPC: satu fungsi untuk dua arah.
--
-- Dua fungsi terpisah (centang / batal) berarti dua tempat yang harus
-- sepakat soal edisi aktif, jejak, dan pagar peran. Satu fungsi dengan satu
-- boolean tidak punya masalah itu, dan layar memang selalu tahu ia sedang
-- mau ke arah mana — kotak centang membawa keadaan barunya.
-- ---------------------------------------------------------------------------
create or replace function set_centang_sprint(p_kode text, p_selesai boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_edisi int;
begin
  if peran() is null then
    raise exception 'Hanya panitia yang bisa mencentang papan sprint.'
      using errcode = '42501';
  end if;

  v_edisi := edisi_aktif();
  if v_edisi is null then
    raise exception 'Belum ada edisi aktif.' using errcode = '22023';
  end if;

  if p_selesai then
    -- ON CONFLICT DO NOTHING, bukan DO UPDATE: centang yang diketuk dua kali
    -- oleh dua orang harus tetap menyimpan yang PERTAMA. Yang menarik dari
    -- kolom jejak bukan siapa yang terakhir menyentuhnya melainkan siapa
    -- yang menyelesaikannya.
    insert into centang_sprint (edisi, kode, dicentang_oleh)
    values (v_edisi, p_kode, auth.uid())
    on conflict (edisi, kode) do nothing;
  else
    -- WHERE yang memang berarti. `delete` tanpa WHERE ditolak ekstensi
    -- safeupdate di produksi, dan ekstensi itu TIDAK ada di database uji
    -- (CLAUDE.md 14.6) — jadi yang menahannya di sini cuma penulisnya.
    delete from centang_sprint
     where edisi = v_edisi and kode = p_kode;
  end if;
end;
$$;

revoke all on function set_centang_sprint(text, boolean) from public, anon;
grant execute on function set_centang_sprint(text, boolean)
  to authenticated, service_role;

grant select on centang_sprint to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- View: centang edisi aktif beserta nama pencentangnya.
--
-- Layar butuh NAMA, bukan uuid, dan menggabungkannya di browser berarti
-- menarik seluruh daftar akun ke setiap peranti yang membuka Buku Sakti —
-- termasuk juri pos yang tidak berhak membaca daftar akun sama sekali.
-- ---------------------------------------------------------------------------
create or replace view v_centang_sprint
with (security_invoker = true) as
select c.kode,
       c.dicentang_pada,
       a.username as dicentang_oleh
  from centang_sprint c
  left join akun_panitia a on a.user_id = c.dicentang_oleh
 where c.edisi = edisi_aktif();

grant select on v_centang_sprint to authenticated, service_role;

comment on view v_centang_sprint is
  'Centang papan sprint edisi aktif, uuid sudah ditukar jadi username.';

do $$
begin
  raise notice '0170: papan sprint bisa dicentang, % baris centang tersimpan',
    (select count(*) from centang_sprint);
end $$;
