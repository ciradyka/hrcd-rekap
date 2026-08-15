-- ============================================================================
-- hrcd-rekap : 0049_pratinjau_live_admin.sql
--
-- Klasemen live untuk ADMIN SAJA — persis yang akan dilihat peserta, tapi
-- sebelum peserta melihatnya.
--
-- ---------------------------------------------------------------------------
-- KENAPA VIEW KEDUA, BUKAN MELONGGARKAN v_klasemen_publik
--
-- `v_klasemen_publik` dipagari `fase_live = 'penuh'`, dan pagar itu bukan
-- kenyamanan — ia yang menahan hasil lomba supaya tidak bocor sebelum
-- diumumkan (0005, 0026). Melonggarkannya "sedikit saja untuk admin" berarti
-- syaratnya jadi `fase = 'penuh' or peran() = 'admin'`, dan sejak saat itu
-- satu view mengerjakan dua tugas yang berlawanan: menyembunyikan dari publik
-- dan menampilkan ke admin.
--
-- Yang lebih buruk: view itu dibaca `publish-live.yml` dengan service role
-- untuk menulis berkas STATIS yang disajikan ke ribuan HP. Kalau suatu hari
-- peran service role terbaca sebagai admin oleh `peran()`, seluruh klasemen
-- tertulis ke berkas publik tanpa satu pun galat muncul.
--
-- Jadi dua view, dua tugas, dan yang publik tidak pernah disentuh:
--
--   v_klasemen_publik     fase_live = 'penuh'   -> berkas statis peserta
--   v_klasemen_pratinjau  peran() = 'admin'     -> layar panitia, login
--
-- ---------------------------------------------------------------------------
-- KENAPA ADMIN SAJA, BUKAN ADMIN DAN MEJA
--
-- Meja boleh melihat seluruh nilai lewat layar Rekapitulasi — itu pekerjaan
-- mereka. Yang dibatasi di sini bukan angkanya, melainkan PERINGKATNYA:
-- klasemen yang sudah terurut adalah hasil lomba, dan hasil lomba yang
-- beredar di grup panitia sebelum pengumuman sudah pernah merusak acara
-- di mana pun hal itu terjadi. Satu orang yang memutuskan kapan angka itu
-- keluar, dan orang itu admin.
--
-- ---------------------------------------------------------------------------
-- KEMAJUAN INPUT TIDAK PERLU VIEW BARU
--
-- `v_kelengkapan_pos` (0028) sudah memberi lengkap / sebagian / regu_total per
-- pos kepada panitia, dan persennya satu pembagian di layar. Menambah view
-- ketiga yang menghitung hal yang sama adalah tempat kedua yang harus ikut
-- benar setiap kali definisi "lengkap" berubah.
-- ============================================================================

create or replace view v_klasemen_pratinjau with (security_invoker = on) as
select
  k.peringkat, k.nomor_dada, k.nama_regu, k.nama_sekolah, k.golongan,
  k.total_pos, k.penalti_waktu, k.penalti_checkout, k.penalti_anggota, k.total,
  (select jsonb_object_agg(pp.pos::text, pp.poin_pos)
   from v_poin_pos pp where pp.regu_id = k.regu_id)          as poin_per_pos,
  k.selisih_menit
from v_klasemen k
where peran() = 'admin';

comment on view v_klasemen_pratinjau is
  'Klasemen yang akan dilihat peserta, dibuka lebih awal untuk ADMIN SAJA. '
  'Bentuk kolomnya sengaja sama persis dengan v_klasemen_publik supaya layar '
  'pratinjau dan halaman peserta tidak pernah berbeda diam-diam.';

grant select on v_klasemen_pratinjau to authenticated;
