-- ============================================================================
-- hrcd-rekap : 0042_riwayat_nilai.sql
--
-- Riwayat perubahan NILAI, dan hanya nilai, terbuka bagi panitia yang berhak.
--
-- ---------------------------------------------------------------------------
-- YANG SUDAH ADA DAN TIDAK PERNAH TERPAKAI
--
-- Setiap perubahan `nilai_mentah` sudah tercatat sejak migrasi 0002: trigger
-- `audit_nilai_mentah` menyimpan baris lama, baris baru, siapa, dan kapan.
-- Datanya utuh, tapi tidak pernah bisa dilihat — RLS tabel `history` hanya
-- mengizinkan `peran() = 'admin'` (0003), dan tidak ada satu layar pun yang
-- membacanya.
--
-- Jadi kalau satu nilai berubah tanpa ada yang tahu, jawabannya SUDAH tersimpan
-- di database sejak awal. Yang tidak ada cuma jalan untuk bertanya.
--
-- ---------------------------------------------------------------------------
-- KENAPA VIEW SEMPIT, BUKAN MELEBARKAN RLS `history`
--
-- Melonggarkan tabelnya akan membuka jauh lebih banyak daripada yang diminta:
-- `history` mencatat SELURUH tabel, termasuk `pendaftaran` — dan baris
-- pendaftaran memuat nomor WhatsApp. Membuka audit nilai kepada operator pos
-- tidak boleh berarti membuka nomor telepon sekolah kepada mereka.
--
-- View ini karena itu menyaring `table_name = 'nilai_mentah'` lebih dulu, lalu
-- hanya mengeluarkan kolom yang memang perlu dibaca manusia: nomor dada, nama
-- lomba, angka lama, angka baru, siapa, kapan.
--
-- ---------------------------------------------------------------------------
-- SIAPA BOLEH MELIHAT APA
--
-- Pagarnya sama persis dengan pagar menulis nilai (policy sel_nilai, 0003):
-- admin dan meja melihat seluruh pos, operator pos hanya posnya sendiri. Kalau
-- keduanya berbeda, akan ada operator yang bisa MENGUBAH satu nilai tetapi
-- tidak bisa melihat bahwa ia mengubahnya — atau sebaliknya.
--
-- Dibuat `security_invoker = off` dengan pagar di dalam view, sebab `history`
-- sendiri tertutup untuk selain admin dan tidak bisa dilonggarkan tanpa ikut
-- membuka isi tabel lain. Pola yang sama dipakai `v_lembar_pos` (0023) dan
-- `v_rekap_penuh` (0027).
-- ============================================================================

create or replace view v_riwayat_nilai as
select
  h.id,
  r.nomor_dada,
  w.pos,
  w.name                        as nama_lomba,
  w.kode                        as kode_lomba,
  (h.old_value ->> 'nilai_1')::numeric as nilai_lama,
  (h.new_value ->> 'nilai_1')::numeric as nilai_baru,
  h.action,
  coalesce(a.username, '(tidak dikenal)') as oleh,
  h.changed_at
from history h
join regu r   on r.id = h.regu_id
-- Baris nilai_mentah menyimpan wahana_id di kedua sisi; DELETE hanya punya
-- yang lama, INSERT hanya yang baru.
join wahana w on w.id = coalesce((h.new_value ->> 'wahana_id')::uuid,
                                 (h.old_value ->> 'wahana_id')::uuid)
left join akun_panitia a on a.user_id = h.changed_by
where h.table_name = 'nilai_mentah'
  and w.edisi = edisi_aktif()
  and (
    peran() in ('admin', 'meja')
    or (peran() = 'operator_pos' and w.pos = pos_saya())
  );

comment on view v_riwayat_nilai is
  'Riwayat perubahan nilai per regu — hanya nilai_mentah, tidak menyentuh '
  'riwayat tabel lain. Pagarnya menyalin policy sel_nilai: admin/meja seluruh '
  'pos, operator pos hanya posnya sendiri.';

grant select on v_riwayat_nilai to authenticated;
