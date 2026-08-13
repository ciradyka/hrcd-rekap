-- ============================================================================
-- hrcd-rekap : 0023_lembar_pos.sql
--
-- Bahan layar Input Pos: satu baris per regu, persis sebentuk lembar kertas
-- yang dipegang petugas lapangan — identitas regu di kiri, kotak nilai di
-- tengah, Nilai Pos di kanan.
--
-- KENAPA VIEW INI BUKAN `security_invoker`
--
-- Semua view lain di sistem ini tunduk pada RLS pemanggilnya. Yang ini tidak
-- bisa, dan alasannya ada di 0003: `sel_pendaftaran` hanya mengizinkan admin
-- dan meja, karena `pendaftaran.kontak_wa` adalah nomor WhatsApp — PII yang
-- tidak ada urusannya dengan operator pos. Padahal jalan menuju NAMA SEKOLAH
-- melewati tabel itu (regu -> pendaftaran -> sekolah), dan nama sekolah harus
-- tampil: itu kolom "Organisasi" di lembar, dan itu yang dipakai petugas
-- memastikan sedang menilai regu yang benar.
--
-- Kalau view ini invoker, operator pos membacanya dan mendapat NOL BARIS —
-- bukan galat, sekadar lembar kosong yang terlihat seperti "belum ada regu
-- yang daftar ulang". Kegagalan paling buruk bentuknya: tenang dan salah.
--
-- Jadi view ini definer (seperti v_progres_publik), dan pagarnya dipasang
-- sendiri di dalam WHERE:
--   - `peran() is not null`         -> hanya panitia berakun aktif
--   - operator pos hanya pos-nya    -> sama ketatnya dengan RLS nilai_mentah
-- Yang ditembus hanyalah jalur ke nama sekolah. `kontak_wa` tidak pernah
-- muncul di daftar kolom, jadi tidak ada yang bisa dimintanya.
--
-- Nilai Pos DIHITUNG DI SINI, bukan disimpan, dan rumusnya sama persis dengan
-- v_poin_pos — jumlah poin komponen dikali bobot pos. Layar tidak menghitung
-- sendiri: angka yang ditampilkan selalu datang dari database, supaya tidak
-- pernah ada dua mesin skor yang bisa berbeda pendapat.
-- ============================================================================

create view v_lembar_pos as
select
  p.nomor       as pos,
  p.name        as nama_pos,
  p.bayangan,
  r.id          as regu_id,
  r.nomor_dada,
  r.nama_regu,
  s.name        as nama_sekolah,
  r.golongan,

  -- Nilai mentah yang sudah tersimpan, dikunci nama komponen:
  --   {"semaphore": {"nilai_1": 5, "nilai_2": null}, ...}
  -- Bentuk objek, bukan larik, supaya layar bisa langsung mencari kolomnya
  -- tanpa memindai apa pun.
  coalesce((
    select jsonb_object_agg(w.kode, jsonb_build_object(
             'nilai_1', n.nilai_1, 'nilai_2', n.nilai_2))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), '{}'::jsonb) as nilai,

  (select count(*) from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor)::int
                as jumlah_terisi,
  (select count(*) from wahana w
   where w.edisi = p.edisi and w.pos = p.nomor)::int
                as jumlah_komponen,

  -- Sama dengan v_poin_pos. Komponen yang belum diisi tidak menyumbang apa
  -- pun (bukan nol yang menghukum) — lembar setengah terisi adalah keadaan
  -- normal sepanjang lomba, bukan kesalahan.
  round(coalesce((
    select sum(hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
                           w.raw_terbaik, w.raw_terburuk,
                           w.poin_benar, w.poin_salah, w.total_soal, w.tingkat))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), 0) * p.bobot, 2) as nilai_pos

from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
cross join pos p
where p.edisi = edisi_aktif()
  and not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  -- Pagar pengganti RLS — lihat catatan panjang di kepala berkas.
  and peran() is not null
  and (peran() <> 'operator_pos' or p.nomor = pos_saya());

grant select on v_lembar_pos to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- hapus_nilai_pos — mengosongkan satu sel yang sudah terlanjur tersimpan.
--
-- simpan_nilai_massal tidak bisa dipakai untuk ini: ia menolak nilai kosong
-- (itu memang benar untuk paste dari Excel — sel kosong berarti "belum
-- dinilai", bukan "hapus"). Tapi di layar tabel, mengosongkan kotak adalah
-- gerakan yang wajar dan artinya jelas: angka tadi salah orang.
--
-- Pagarnya sama dengan simpan_nilai_massal: operator hanya pos sendiri, admin
-- wajib menyebut pos, dan penghapusannya terekam trigger audit seperti
-- perubahan nilai lainnya.
-- ---------------------------------------------------------------------------

create or replace function hapus_nilai_pos(
  p_nomor_dada integer,
  p_kode       text,
  p_pos        smallint default null   -- wajib untuk admin
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pos    smallint;
  v_regu   uuid;
  v_wahana uuid;
begin
  if peran() = 'operator_pos' then
    v_pos := pos_saya();
  elsif peran() = 'admin' then
    v_pos := p_pos;
    if v_pos is null then
      raise exception 'admin wajib menyebut pos (p_pos)';
    end if;
  else
    raise exception 'hanya operator pos / admin';
  end if;

  select id into v_regu from regu
  where nomor_dada = p_nomor_dada and not is_cancelled;
  if not found then
    -- Tiga digit seperti di kain nomor dadanya (migrasi 0020). Nomor di luar
    -- 0-999 dicetak apa adanya: lpad MEMOTONG string yang lebih panjang dari
    -- targetnya, jadi salah ketik "9999" akan dilaporkan sebagai "999" —
    -- petugas lalu mencari nomor yang tidak pernah diketiknya.
    raise exception 'nomor dada % tidak dikenal / regu batal',
      case when p_nomor_dada between 0 and 999
        then lpad(p_nomor_dada::text, 3, '0')
        else p_nomor_dada::text end;
  end if;

  -- Normalisasi kode disamakan dengan simpan_nilai_massal, supaya kolom yang
  -- bisa DIISI lewat satu pintu selalu bisa DIKOSONGKAN lewat pintu ini.
  select w.id into v_wahana from wahana w
  where w.edisi = edisi_aktif()
    and w.pos = v_pos
    and regexp_replace(lower(coalesce(p_kode, '')), '[^a-z0-9]', '', 'g')
        = regexp_replace(w.kode, '[^a-z0-9]', '', 'g');
  if not found then
    raise exception 'kode komponen tidak dikenal di pos %', v_pos;
  end if;

  delete from nilai_mentah where regu_id = v_regu and wahana_id = v_wahana;
end;
$$;

grant execute on function hapus_nilai_pos(integer, text, smallint) to authenticated;
