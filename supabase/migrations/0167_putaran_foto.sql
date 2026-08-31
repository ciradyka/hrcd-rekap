-- ============================================================================
-- hrcd-rekap : 0167_putaran_foto.sql
-- Foto slip yang masuk MIRING bisa diputar, dan putarannya tersimpan.
--
-- KENAPA FOTONYA MIRING SAMA SEKALI
--
-- Kamera HP hampir tidak pernah memutar pikselnya; ia menyimpan foto apa
-- adanya lalu menitipkan arah tegaknya di tag EXIF. `createImageBitmap()` di
-- web/js/util.js dipanggil TANPA `imageOrientation: "from-image"`, jadi tag
-- itu diabaikan, dan kanvas di bawahnya menulis ulang gambarnya jadi JPEG
-- baru tanpa EXIF sama sekali.
--
-- Artinya miringnya bukan sekadar salah tampil -- ia TERPANGGANG ke dalam
-- berkasnya. Tidak ada layar yang bisa membatalkannya dengan membaca ulang
-- berkasnya, karena tidak ada lagi yang memberi tahu arah tegaknya.
--
-- Panggilan itu sudah dibetulkan bersama migrasi ini, jadi foto BARU masuk
-- tegak. Yang ditangani di sini foto yang SUDAH TERLANJUR tersimpan.
--
-- KENAPA PUTARANNYA DISIMPAN, BUKAN DIPUTAR DI LAYAR SAJA
--
-- Keputusan pemilik acara: sekali diputar, foto itu tegak untuk siapa pun,
-- besok maupun di layar lain. Layar Cek Nilai dibuka ratusan kali, dan
-- putaran yang hilang tiap kali pindah regu berarti pekerjaan yang sama
-- diulang ratusan kali.
--
-- YANG DISIMPAN SUDUTNYA, BUKAN GAMBARNYA
--
-- Berkasnya TIDAK disentuh. Memutar piksel berarti membaca ulang, memutar,
-- dan menulis ulang JPEG-nya -- satu putaran mutu setiap kali, pada berkas
-- yang justru sudah dimampatkan habis-habisan demi kuota. Sudutnya cuma satu
-- angka, layar yang memutarnya saat menggambar, dan membatalkannya sama
-- murahnya dengan memasangnya.
-- ============================================================================

alter table foto_lembar
  add column if not exists putaran smallint not null default 0;

-- Empat sudut saja. Sudut bebas tidak menjawab pertanyaan apa pun di sini:
-- yang miring adalah foto yang kameranya dipegang menyamping, dan itu selalu
-- kelipatan 90.
alter table foto_lembar drop constraint if exists foto_lembar_putaran_check;
alter table foto_lembar add constraint foto_lembar_putaran_check
  check (putaran in (0, 90, 180, 270));

comment on column foto_lembar.putaran is
  'Sudut putar saat DIGAMBAR, derajat searah jarum jam (0/90/180/270). '
  'Berkasnya tidak disentuh.';

-- ---------------------------------------------------------------------------
-- View ikut membawanya, kalau tidak layar tidak pernah tahu harus memutar.
-- Salinan persis definisi yang berjalan, dengan satu kolom ditambahkan.
-- ---------------------------------------------------------------------------
create or replace view v_foto_lembar as
select f.id,
    r.nomor_dada,
    f.pos,
    f.kode_lomba,
    f.nama_lomba,
    f.path,
    f.ukuran_bytes,
    coalesce(a.username, '(tidak dikenal)'::text) as oleh,
    f.diunggah_pada,
    f.cara_taut,
    f.ditaut_pada,
    coalesce(t.username, '(tidak dikenal)'::text) as ditaut_oleh,
    -- DI UJUNG, bukan di tengah. `create or replace view` menuntut nama dan
    -- urutan kolom yang sudah ada tidak berubah; menyisipkan kolom baru di
    -- tengah menggeser nama kolom sesudahnya dan PostgreSQL menolaknya dengan
    -- "cannot change name of view column".
    f.putaran
   from foto_lembar f
     left join regu r on r.id = f.regu_id
     left join akun_panitia a on a.user_id = f.diunggah_oleh
     left join akun_panitia t on t.user_id = f.ditaut_oleh
  where boleh('rekap'::text) or boleh('pos'::text) and (pos_saya() is null or f.pos = pos_saya());

-- ---------------------------------------------------------------------------
-- Memutar.
--
-- Pagar haknya DISALIN dari hapus_foto_lembar: hak `pos`, lalu isolasi pos
-- untuk operator pos. Yang TIDAK disalin kewajiban alasan -- menghapus foto
-- membuang bukti dan memang harus dipertanggungjawabkan, memutar tidak
-- membuang apa pun dan bisa dibatalkan dengan mengetuk tiga kali lagi.
-- Memaksa alasan untuk itu cuma menambah kotak yang diisi asal-asalan.
-- ---------------------------------------------------------------------------
create or replace function putar_foto_lembar(p_id uuid, p_putaran smallint)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare v_pos smallint; v_baru smallint;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;

  -- Dinormalkan di sini, bukan dipercayakan ke layar: 360 dan -90 adalah cara
  -- yang wajar untuk mengatakan 0 dan 270, dan menolaknya cuma memindahkan
  -- perhitungan itu ke setiap pemanggil.
  v_baru := ((coalesce(p_putaran, 0)::int % 360) + 360) % 360;
  if v_baru not in (0, 90, 180, 270) then
    raise exception 'putaran harus kelipatan 90, bukan %', p_putaran;
  end if;

  select pos into v_pos from foto_lembar where id = p_id;
  if not found then
    raise exception 'foto tidak dikenal';
  end if;
  if pos_saya() is not null and v_pos is distinct from pos_saya() then
    raise exception 'operator pos % tidak boleh memutar foto pos %',
      pos_saya(), v_pos;
  end if;

  update foto_lembar set putaran = v_baru where id = p_id;
  return v_baru;
end;
$$;

revoke all on function putar_foto_lembar(uuid, smallint) from public, anon;
grant execute on function putar_foto_lembar(uuid, smallint) to authenticated, service_role;

comment on function putar_foto_lembar(uuid, smallint) is
  'Putar satu foto slip saat digambar. Berkasnya tidak disentuh.';

do $$
begin
  assert (select count(*) from foto_lembar where putaran not in (0, 90, 180, 270)) = 0,
    '0167 GAGAL: ada putaran di luar 0/90/180/270';
  raise notice '0167: kolom putaran terpasang, % foto (semuanya mulai dari 0)',
    (select count(*) from foto_lembar);
end;
$$;
