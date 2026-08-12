-- ============================================================================
-- hrcd-rekap : 0003_rls.sql
-- Row-Level Security + grants. Acuan: docs/rancangan-b.md bagian 3.
--
-- Tiga peran di balik satu link:
--   admin        — semua tabel, semua operasi
--   operator_pos — nilai_mentah hanya baris pos = pos_saya()
--   meja         — semua layar meja; ganti fungsi = pindah layar (R14)
-- Anon nyaris nol: hanya SELECT sekolah. Form publik menulis lewat gateway
-- Worker (service role); penonton membaca file statis — tidak ada jalur anon
-- lain ke database.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Aktifkan RLS di semua tabel
-- ---------------------------------------------------------------------------

alter table edisi              enable row level security;
alter table pos                enable row level security;
alter table wahana             enable row level security;
alter table kontrak_opsi       enable row level security;
alter table konfig_penalti     enable row level security;
alter table status_acara       enable row level security;
alter table sekolah            enable row level security;
alter table pendaftaran        enable row level security;
alter table nomor_dada_stok    enable row level security;
alter table kloter             enable row level security;
alter table regu               enable row level security;
alter table pembayaran         enable row level security;
alter table keberangkatan_regu enable row level security;
alter table nilai_mentah       enable row level security;
alter table closing_regu       enable row level security;
alter table ruangan            enable row level security;
alter table penempatan_barak   enable row level security;
alter table akun_panitia       enable row level security;
alter table riwayat            enable row level security;
alter table nomor_dada_pensiun enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Grants dasar. Policy yang membatasi baris; grant membuka pintu kelasnya.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- service_role (BYPASSRLS) dipakai gateway Worker & GitHub Actions; di
-- Supabase asli grant ini datang dari default privileges — dieksplisitkan
-- supaya lingkungan uji lokal berperilaku sama.
grant select, insert, update, delete on all tables in schema public to service_role;
-- Supabase asli MEMBERI grant ke anon lewat default privileges — cabut
-- eksplisit supaya anon benar-benar hanya memegang sekolah (temuan review).
revoke all on all tables in schema public from anon;
grant select on sekolah to anon;

-- ---------------------------------------------------------------------------
-- 3. Policy per tabel
-- ---------------------------------------------------------------------------

-- Konfigurasi: semua panitia membaca (layar input pos butuh wahana + rentang);
-- hanya admin menulis (dan trigger kunci hari-H tetap menghadang siapa pun).
create policy sel_edisi          on edisi          for select using (peran() is not null);
create policy adm_edisi          on edisi          for all    using (peran() = 'admin');
create policy sel_pos            on pos            for select using (peran() is not null);
create policy adm_pos            on pos            for all    using (peran() = 'admin');
create policy sel_wahana         on wahana         for select using (peran() is not null);
create policy adm_wahana         on wahana         for all    using (peran() = 'admin');
create policy sel_kontrak_opsi   on kontrak_opsi   for select using (peran() is not null);
create policy adm_kontrak_opsi   on kontrak_opsi   for all    using (peran() = 'admin');
create policy sel_konfig_penalti on konfig_penalti for select using (peran() is not null);
create policy adm_konfig_penalti on konfig_penalti for all    using (peran() = 'admin');

-- Saklar hari-H: semua panitia membaca; admin menulis.
create policy sel_status_acara on status_acara for select using (peran() is not null);
create policy adm_status_acara on status_acara for update using (peran() = 'admin');

-- Sekolah: anon + panitia membaca (autocomplete, tanpa PII); tulis via RPC
-- submit_pendaftaran (SECURITY DEFINER) atau admin.
create policy sel_sekolah_anon on sekolah for select using (true);
create policy adm_sekolah      on sekolah for all    using (peran() = 'admin');

-- Pendaftaran: kontak_wa adalah PII — hanya meja + admin; operator_pos tidak.
-- Tulis hanya lewat RPC (DEFINER) atau admin langsung.
create policy sel_pendaftaran on pendaftaran for select using (peran() in ('admin', 'meja'));
create policy adm_pendaftaran on pendaftaran for all    using (peran() = 'admin');

-- Stok nomor dada: panitia membaca; admin yang seeding.
create policy sel_stok on nomor_dada_stok for select using (peran() is not null);
create policy adm_stok on nomor_dada_stok for all    using (peran() = 'admin');
create policy sel_pensiun on nomor_dada_pensiun for select using (peran() is not null);
create policy adm_pensiun on nomor_dada_pensiun for all    using (peran() = 'admin');

-- Kloter: panitia membaca (papan garis start); tulis via RPC atau admin.
create policy sel_kloter on kloter for select using (peran() is not null);
create policy adm_kloter on kloter for all    using (peran() = 'admin');

-- Regu: semua panitia membaca — operator pos butuh identitas regu untuk
-- kartu echo-confirm. Tulis via RPC atau admin.
create policy sel_regu on regu for select using (peran() is not null);
create policy adm_regu on regu for all    using (peran() = 'admin');

-- Pembayaran: meja + admin; tulis via RPC.
create policy sel_pembayaran on pembayaran for select using (peran() in ('admin', 'meja'));
create policy adm_pembayaran on pembayaran for all    using (peran() = 'admin');

-- Ceklis keberangkatan: panitia membaca. TULIS HANYA VIA RPC (temuan review:
-- tulisan langsung memalsukan dicatat_oleh dan melompati guard RPC) — policy
-- tulis langsung tersisa untuk admin.
create policy sel_keberangkatan on keberangkatan_regu for select using (peran() is not null);
create policy adm_keberangkatan on keberangkatan_regu for all using (peran() = 'admin');

-- Nilai mentah — kebijakan inti R6. TULIS HANYA VIA simpan_nilai_massal
-- (SECURITY DEFINER dengan cek pos eksplisit); tulisan langsung memalsukan
-- diinput_oleh dan melompati validasi rentang, jadi policy tulis langsung
-- hanya admin. Operator tetap MEMBACA baris pos-nya sendiri saja.
create policy sel_nilai on nilai_mentah for select using (
  peran() in ('admin', 'meja')
  or (peran() = 'operator_pos' and exists (
        select 1 from wahana w
        where w.id = wahana_id and w.pos = pos_saya()))
);
create policy adm_nilai on nilai_mentah for all using (peran() = 'admin');

-- Closing: panitia membaca. TULIS HANYA VIA catat_closing (alasan sama).
create policy sel_closing on closing_regu for select using (peran() is not null);
create policy adm_closing on closing_regu for all using (peran() = 'admin');

-- Barak: panitia membaca; penyusunan via RPC susun_barak; koreksi manual
-- langsung hanya admin.
create policy sel_ruangan on ruangan for select using (peran() is not null);
create policy adm_ruangan on ruangan for all    using (peran() = 'admin');
create policy sel_barak   on penempatan_barak for select using (peran() is not null);
create policy adm_barak   on penempatan_barak for all    using (peran() = 'admin');

-- Akun: tiap orang melihat barisnya sendiri; admin semuanya.
create policy sel_akun_sendiri on akun_panitia for select using (user_id = auth.uid());
create policy adm_akun         on akun_panitia for all    using (peran() = 'admin');

-- Riwayat: hanya admin membaca; INSERT hanya lewat trigger (DEFINER) —
-- tidak ada policy insert untuk klien.
create policy sel_riwayat on riwayat for select using (peran() = 'admin');

-- ---------------------------------------------------------------------------
-- 4. Realtime (layar pemantau & papan). Publication dibuat Supabase;
--    di lingkungan uji lokal dibuat bila belum ada.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table
  nilai_mentah, kloter, keberangkatan_regu, closing_regu, regu, pendaftaran;
