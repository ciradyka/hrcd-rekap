-- ============================================================================
-- hrcd-rekap : 0026_rekap_publik.sql
--
-- Bahan halaman rekap live untuk PESERTA (alur-lomba.md 1.5, rancangan-b.md
-- bagian 7). Halaman itu menjawab satu pertanyaan sepanjang lomba: "nilai
-- regu saya sudah masuk belum?" — centang per pos, TANPA angka.
--
-- YANG MENJAGA KEJUTAN BUKAN TAMPILANNYA, MELAINKAN VIEW INI.
--
-- Selama `status_acara.fase_live` masih 'progres', `v_progres_publik` hanya
-- mengembalikan centang dan `v_klasemen_publik` mengembalikan NOL BARIS. Jadi
-- angka nilai tidak pernah ikut tertulis ke berkas publik sama sekali — bukan
-- dikirim lalu disembunyikan CSS, yang bisa dibuka siapa pun lewat devtools.
-- Admin memindah fase ke 'penuh' saat hasilnya diumumkan, dan barulah
-- klasemennya ada untuk ditulis.
--
-- Yang ditambahkan di sini: fakta OPERASIONAL yang memang sudah diketahui
-- regunya sendiri — kloter, kontrak waktu, jam berangkat, jam datang.
-- Menerbitkannya bukan kebocoran, melainkan layanan: regu bisa memastikan
-- jam yang tercatat panitia sama dengan yang mereka catat sendiri, SEBELUM
-- hasilnya final. Itu persis kebiasaan pembina di alur-lomba.md 6.10, dan
-- sengketa yang ketahuan pagi hari jauh lebih murah daripada yang ketahuan
-- saat pengumuman.
--
-- Syarat "sudah tercatat berangkat" DIBUANG. Sebelumnya regu baru muncul di
-- halaman publik setelah diceklis berangkat; akibatnya regu yang sedang
-- menunggu di staging membuka halaman itu dan tidak menemukan dirinya sama
-- sekali — terbaca sebagai "saya tidak terdaftar", padahal justru kloter dan
-- kontraknya yang ingin ia periksa saat itu.
--
-- URUTAN TERHADAP 0025. Migrasi ini menambahkan kolom ke v_progres_publik,
-- dan 0025 membuat ulang view yang sama tanpa kolom-kolom itu. Menjalankan
-- 0025 SESUDAH berkas ini berarti meminta Postgres menghapus kolom dari view
-- — ditolak keras dengan "cannot drop columns from view", seluruh berkas
-- di-rollback, dan tidak ada yang rusak. Kalau 0025 memang perlu dijalankan
-- ulang, jalankan berkas ini lagi tepat sesudahnya.
-- ============================================================================

create or replace view v_progres_publik as
select
  r.nomor_dada,
  r.nama_regu,
  s.name as nama_sekolah,
  r.golongan,
  -- Hanya pos yang benar-benar dinilai (migrasi 0025): garis start dan garis
  -- finish tidak punya komponen, dan kolom yang selamanya kosong di halaman
  -- peserta terbaca sebagai pos yang panitianya lalai.
  (select jsonb_object_agg(p.nomor::text,
            exists (select 1 from nilai_mentah n
                    join wahana w on w.id = n.wahana_id
                    where n.regu_id = r.id and w.pos = p.nomor))
   from pos p
   where p.edisi = edisi_aktif()
     and exists (select 1 from wahana w
                 where w.edisi = p.edisi and w.pos = p.nomor)) as pos_terlewati,
  exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing,

  -- Kolom baru. Ditambahkan DI BELAKANG supaya create or replace diterima:
  -- PostgreSQL mengizinkan kolom baru di ujung, tapi menolak kalau urutan
  -- atau tipe kolom yang sudah ada ikut bergeser.
  r.kloter_nomor                              as kloter,
  r.kontrak_menit,
  k.jam_berangkat,
  case when k.jam_berangkat is not null and r.kontrak_menit is not null
    then k.jam_berangkat + make_interval(mins => r.kontrak_menit)
  end                                         as target_datang,
  c.jam_datang,
  exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
                                              as sudah_berangkat
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
left join kloter k        on k.nomor = r.kloter_nomor
left join closing_regu c  on c.regu_id = r.id
where not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and (select fase_live from status_acara) in ('progres', 'penuh');
