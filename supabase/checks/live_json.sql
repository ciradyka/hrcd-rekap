-- ============================================================================
-- hrcd-rekap : live_json.sql — seluruh isi halaman rekap peserta, satu query.
--
-- Dipakai .github/workflows/publish-live.yml, yang mengarahkan keluarannya
-- langsung ke live/live.json. Ditaruh di supabase/checks/ dan bukan di dalam
-- berkas workflow supaya bisa dijalankan tangan saat memeriksa apa yang
-- SEBENARNYA akan terbit:
--
--   psql "$SUPABASE_DB_URL" -A -t -f supabase/checks/live_json.sql | less
--
-- Tidak ada penyaring fase di sini. Itu disengaja: penggerbangnya ada di
-- dalam view (0026 dan 0005), jadi tidak ada cara menerbitkan klasemen lebih
-- awal dengan salah menyunting berkas ini. Selama fase masih 'progres',
-- v_klasemen_publik memang mengembalikan nol baris.
-- ============================================================================

select jsonb_pretty(jsonb_build_object(

  -- Cap sinkronisasi yang ditampilkan halaman rekap. Sengaja waktu SERVER
  -- saat berkas dibuat, bukan waktu halaman dimuat — kalau workflow tersendat,
  -- peserta harus bisa melihat bahwa datanya tua.
  'dibuat_pada', now(),
  'fase',        (select fase_live from status_acara),

  'edisi', (select jsonb_build_object(
              'nomor', nomor, 'name', name, 'tanggal_lomba', tanggal_lomba)
            from edisi where is_active),

  'ringkas', (select to_jsonb(r) from v_publik_ringkas r),

  -- Hanya pos yang benar-benar dinilai: garis start dan finish tidak punya
  -- kolom centang, dan kolom yang selamanya kosong di halaman peserta
  -- terbaca seperti pos yang panitianya lalai.
  'pos', (select coalesce(jsonb_agg(jsonb_build_object(
                   'nomor', nomor, 'name', name, 'bayangan', bayangan)
                 order by nomor), '[]'::jsonb)
          from v_pos where jumlah_komponen > 0),

  -- Kemajuan input per pos (0048). Ikut ke live.json — berkas kecil yang
  -- memang di-poll — bukan ke rekap.json, karena inilah angka yang berubah
  -- terus sepanjang hari dan justru itu yang datang dilihat peserta.
  'kelengkapan', (select coalesce(jsonb_agg(to_jsonb(kl) order by kl.pos),
                         '[]'::jsonb)
                  from v_kelengkapan_publik kl),

  'progres', (select coalesce(jsonb_agg(to_jsonb(p) order by p.nomor_dada),
                     '[]'::jsonb)
              from v_progres_publik p),

  'klasemen', (select coalesce(jsonb_agg(to_jsonb(k)
                        order by k.golongan, k.peringkat), '[]'::jsonb)
               from v_klasemen_publik k)
));
