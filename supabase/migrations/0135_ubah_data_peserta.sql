-- ============================================================================
-- hrcd-rekap : 0135_ubah_data_peserta.sql
--
-- Dua RPC yang membuat data pendaftaran BISA DIBETULKAN dari layar panitia:
-- kontak pembina, dan identitas tiap regu.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Sampai sekarang segala yang diketik pembina di form pendaftaran adalah
-- keadaan akhir. Nomor WA salah satu digit, nama anggota tertukar, nama ketua
-- salah eja — tidak ada satu layar pun yang bisa membetulkannya, dan satu-
-- satunya jalan membatalkan pendaftaran lalu meminta mereka mengisi ulang.
--
-- Itu bukan jalan yang dipakai orang: yang benar-benar terjadi, panitia
-- mencatat betulannya di kertas lain, dan sejak saat itu database berbeda dari
-- kenyataan tanpa ada yang tahu bagian mana.
--
-- ---------------------------------------------------------------------------
-- HAKNYA `pendaftaran`, BUKAN FITUR BARU
--
-- `boleh('pendaftaran')` — hak yang sudah ada, dipegang admin dan registrasi
-- (paket_peran, 0075). Membetulkan data pendaftaran adalah pekerjaan yang
-- sama dengan menerima pendaftaran; memberinya kunci sendiri berarti satu
-- centang lagi yang harus diingat panitia, untuk pemisahan yang tidak pernah
-- diminta siapa pun.
--
-- ---------------------------------------------------------------------------
-- YANG TIDAK BISA DIUBAH DARI SINI, DAN KENAPA
--
--   golongan      — menentukan harga (0110) dan blangko mana yang dicetak.
--                   Salah golongan berarti pendaftaran yang salah, bukan salah
--                   ketik; batalkan dan daftar ulang.
--   sekolah       — sama, dan ia dipakai kunci pencarian di banyak layar.
--   nomor dada    — punya jalurnya sendiri (tukar_nomor, 0041) yang menjaga
--                   stok dan pensiunnya.
--   status bayar  — punya Meja Pembayaran.
--
-- Yang tersisa memang cuma tulisan: nama dan nomor telepon.
--
-- ---------------------------------------------------------------------------
-- RIWAYATNYA TERCATAT SENDIRI
--
-- `regu` dan `pendaftaran` dua-duanya punya trigger `record_history` (0042),
-- jadi tiap perubahan di sini masuk riwayat tanpa satu baris tambahan. Itu
-- yang membuat layar ini aman diberikan: yang mengubah, kapan, dan dari apa
-- ke apa semuanya tersimpan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kontak pembina.
--
-- Nomor WA dan nama contact person adalah SATU pasang — keduanya diubah
-- bersama, karena yang mengganti nomor hampir selalu mengganti orangnya juga.
-- Dua RPC terpisah berarti satu di antaranya bisa gagal dan meninggalkan nama
-- lama di sebelah nomor baru.
-- ---------------------------------------------------------------------------
create or replace function ubah_kontak_pendaftaran(
  p_kode        text,
  p_nama_kontak text,
  p_kontak_wa   text
) returns void
language plpgsql security definer
set search_path = public
as $fn$
declare v_wa text;
begin
  if not boleh('pendaftaran') then
    raise exception 'tidak berhak: pendaftaran';
  end if;

  -- Satu bentuk saja yang disimpan: 08xxxxxxxxxx. Yang diketik orang ada
  -- empat — "+62 812-...", "62812...", "0812..." dan kadang "812..." — dan
  -- keempatnya nomor yang SAMA. Disimpan apa adanya, pencarian nomor tidak
  -- pernah menemukan yang ditulis dengan gaya lain, dan tautan WhatsApp
  -- panitia mendarat di nomor yang tidak ada.
  v_wa := regexp_replace(coalesce(p_kontak_wa, ''), '[^0-9]', '', 'g');
  if v_wa like '62%'     then v_wa := '0' || substr(v_wa, 3); end if;
  if v_wa like '8%'      then v_wa := '0' || v_wa;            end if;
  if length(v_wa) < 8 then
    raise exception 'nomor WA belum lengkap';
  end if;

  -- Nama boleh dikosongkan — sebagian pendaftaran lama memang tidak punya
  -- (kolomnya baru ada sejak 0013). Yang tidak boleh: angka di dalamnya,
  -- aturan yang sama dengan nama orang mana pun (0052).
  if coalesce(p_nama_kontak, '') ~ '[0-9]' then
    raise exception 'nama contact person tidak boleh memakai angka';
  end if;

  update pendaftaran
     set kontak_wa   = v_wa,
         nama_kontak = nullif(trim(coalesce(p_nama_kontak, '')), '')
   where kode_pembayaran = p_kode;

  if not found then
    raise exception 'kode pembayaran tidak dikenal: %', p_kode;
  end if;
end;
$fn$;

grant execute on function ubah_kontak_pendaftaran(text, text, text) to authenticated;

comment on function ubah_kontak_pendaftaran(text, text, text) is
  'Betulkan nama dan nomor WA pembina satu pendaftaran. Nomornya dinormalkan '
  'ke satu bentuk 08xxxxxxxxxx, jadi "+62 812-3456", "62812..." dan "812..." '
  'mendarat sama. Riwayatnya tercatat trigger record_history (0042).';

-- ---------------------------------------------------------------------------
-- 2. Identitas satu regu.
--
-- Seluruh validasinya SAMA PERSIS dengan submit_pendaftaran, dan itu
-- disengaja: dua pintu masuk untuk satu tabel yang aturannya berbeda berarti
-- data yang lolos lewat pintu kedua akan ditolak pintu pertama, dan yang
-- menemukannya pembina yang mendaftar tahun depan.
-- ---------------------------------------------------------------------------
create or replace function ubah_identitas_regu(
  p_regu_id          uuid,
  p_nama_regu        text,
  p_nama_ketua       text,
  p_anggota          text[],
  p_kelas_organisasi text default null
) returns void
language plpgsql security definer
set search_path = public
as $fn$
declare v_anggota text[];
begin
  if not boleh('pendaftaran') then
    raise exception 'tidak berhak: pendaftaran';
  end if;

  if coalesce(trim(p_nama_regu), '') = '' then
    raise exception 'nama regu wajib diisi';
  end if;
  if coalesce(trim(p_nama_ketua), '') = '' then
    raise exception 'nama ketua wajib diisi';
  end if;
  if p_nama_ketua ~ '[0-9]' then
    raise exception 'nama ketua tidak boleh memakai angka';
  end if;

  -- Kotak kosong DIBUANG, bukan disimpan sebagai string kosong — aturan yang
  -- sama dengan submit_pendaftaran. Urutannya dipertahankan.
  select array_agg(a order by urut) into v_anggota
  from unnest(coalesce(p_anggota, array[]::text[])) with ordinality as t(a, urut)
  where trim(coalesce(a, '')) <> '';

  if coalesce(array_length(v_anggota, 1), 0) > 4 then
    raise exception 'maksimal 4 anggota selain ketua';
  end if;
  if exists (select 1 from unnest(coalesce(v_anggota, array[]::text[])) a
             where a ~ '[0-9]') then
    raise exception 'nama anggota tidak boleh memakai angka';
  end if;

  update regu
     set nama_regu        = trim(p_nama_regu),
         nama_ketua       = trim(p_nama_ketua),
         anggota          = (select array_agg(trim(a) order by urut)
                             from unnest(coalesce(v_anggota, array[]::text[]))
                                  with ordinality as t(a, urut)),
         kelas_organisasi = nullif(trim(coalesce(p_kelas_organisasi, '')), '')
   where id = p_regu_id;

  if not found then
    raise exception 'regu tidak dikenal';
  end if;
end;
$fn$;

grant execute on function ubah_identitas_regu(uuid, text, text, text[], text)
  to authenticated;

comment on function ubah_identitas_regu(uuid, text, text, text[], text) is
  'Betulkan nama regu, ketua, anggota, dan kelas/organisasi satu regu. '
  'Golongan, sekolah, nomor dada, dan status bayar SENGAJA tidak di sini — '
  'masing-masing punya jalurnya sendiri, dan yang salah di antaranya bukan '
  'salah ketik melainkan pendaftaran yang salah. Constraint tabelnya yang '
  'menegakkan nama kapital (0126), tanpa angka di depan (0128), tidak kembar '
  '(0051), dan kelas tanpa simbol (0134).';

-- ---------------------------------------------------------------------------
-- Pagar di SINI cuma membuktikan pintunya terkunci: kedua fungsi ada, dan
-- keduanya menolak pemanggil tanpa hak. Migrasi berjalan tanpa kursi
-- pengguna — `boleh()` selalu false di sini — jadi jalur POSITIFnya tidak bisa
-- diuji dari dalam berkas ini.
--
-- Itu bukan kekurangan yang ditambal, melainkan pembagian yang benar: yang
-- menguji hak harus MENEMPATI KURSI (CLAUDE.md 13.8), dan yang bisa
-- menempati kursi cuma harness tes. Jalur positifnya di
-- tests/sql/88_ubah_data_peserta.sql, yang menjalankan keduanya sebagai akun
-- registrasi lalu memeriksa hasilnya baris demi baris.
-- ---------------------------------------------------------------------------
do $blok$
declare v_ditolak integer := 0;
begin
  begin
    perform ubah_kontak_pendaftaran('TIDAK-ADA', 'Bu Uji', '081200000000');
  exception when others then
    if sqlerrm like 'tidak berhak%' then v_ditolak := v_ditolak + 1; end if;
  end;

  begin
    perform ubah_identitas_regu(gen_random_uuid(), 'UJI', 'Uji', null, null);
  exception when others then
    if sqlerrm like 'tidak berhak%' then v_ditolak := v_ditolak + 1; end if;
  end;

  if v_ditolak <> 2 then
    raise exception '0135: baru % dari 2 RPC yang menolak pemanggil tanpa hak', v_ditolak;
  end if;
  raise notice '0135: kedua RPC ada dan menolak pemanggil tanpa hak pendaftaran.';
end;
$blok$;
