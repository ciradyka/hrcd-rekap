-- ============================================================================
-- hrcd-rekap : 0068_atur_fase_live.sql
-- Satu tombol untuk membuka klasemen ke peserta.
--
-- KENAPA RPC, BUKAN UPDATE LANGSUNG
--
-- `status_acara` sudah bisa di-UPDATE lewat policy `adm_status_acara`
-- (boleh('pengaturan') sejak 0064), jadi layar bisa saja menulisnya langsung.
-- Tidak dilakukan, karena yang berpindah di sini bukan satu kolom melainkan
-- SATU KEPUTUSAN: sejak baris ini berubah, nilai yang belum diumumkan boleh
-- dilihat siapa saja yang membuka halaman peserta. Keputusan seperti itu
-- pantas punya nama, pantas tercatat siapa yang menekannya, dan pantas
-- menolak nilai yang tidak dikenal alih-alih menyimpannya diam-diam.
--
-- FASENYA TIGA, DAN TOMBOLNYA CUMA MENGURUS DUA
--
--   pra      peserta tidak melihat apa pun
--   progres  peserta melihat KEMAJUAN input, belum nilainya
--   penuh    peserta melihat klasemen
--
-- Tombol "Publish Live Score" berpindah antara `progres` dan `penuh`. `pra`
-- tidak disentuh tombol — ia keadaan sebelum lomba dimulai, dan kembali ke
-- sana di tengah acara bukan hal yang pantas terjadi karena satu ketukan
-- tidak sengaja.
--
-- YANG TOMBOL INI TIDAK KERJAKAN, DAN HARUS DIKETAHUI
--
-- Halaman peserta membaca BERKAS STATIS `live.json` dan `rekap.json`, bukan
-- database. Mengubah fase di sini tidak menerbitkan apa pun sampai
-- `publish-live.yml` berjalan dan menulis ulang kedua berkas itu. Layarnya
-- mengatakan begitu apa adanya — tombol yang mengaku sudah menerbitkan
-- padahal belum adalah cara tercepat membuat panitia mengumumkan juara yang
-- tidak ada di layar peserta.
-- ============================================================================

create or replace function atur_fase_live(p_fase text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare v_lama text;
begin
  if not boleh('pengaturan') then
    raise exception 'tidak berhak: pengaturan';
  end if;
  if p_fase not in ('pra', 'progres', 'penuh') then
    raise exception 'fase tidak dikenal: % (pra / progres / penuh)', p_fase;
  end if;

  select fase_live into v_lama from status_acara;
  if v_lama = p_fase then
    return v_lama;
  end if;

  update status_acara set fase_live = p_fase;
  raise notice 'fase_live: % -> %', v_lama, p_fase;
  return p_fase;
end;
$$;

comment on function atur_fase_live(text) is
  'Buka/tutup klasemen untuk peserta. TIDAK menerbitkan apa pun sendiri: halaman peserta membaca live.json dan rekap.json, yang ditulis ulang oleh publish-live.yml.';

revoke all on function atur_fase_live(text) from public;
grant execute on function atur_fase_live(text) to authenticated;

do $blok$
declare v_f text;
begin
  select fase_live into v_f from status_acara;
  raise notice '0068: fase_live sekarang %.', v_f;
end $blok$;
