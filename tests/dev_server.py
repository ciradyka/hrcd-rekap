# ============================================================================
# hrcd-rekap : tests/dev_server.py — server pengembangan lokal.
# Meniru peran Supabase (PostgREST + GoTrue + gerbang Worker) di atas Postgres
# lokal, supaya seluruh alur layar bisa diuji TANPA akun cloud.
#
# Cara meniru RLS: setiap request dijalankan dalam transaksi dengan
#   SET LOCAL app.uid  (dibaca auth.uid() tiruan di tests/sql/00_harness.sql)
#   SET LOCAL ROLE     (authenticated / service_role / anon)
# sehingga policy yang sama dengan produksi ikut menggigit di sini.
#
# Jalankan:
#   python tests/dev_server.py            # port 8787, db hrcd_dev @ 55432
# Siapkan db-nya sekali dengan: bash tests/dev_database.sh
# ============================================================================

import hashlib
import json
import http.server
import os
import struct
import tempfile
import urllib.parse
import zlib

import psycopg2
import psycopg2.extras

# Sambungan database dibaca dari environment, dengan Postgres portable di
# port 55432 sebagai bawaannya. Angka-angka itu dulu ditulis mati di sini,
# dan siapa pun yang memakai PostgreSQL biasa — port 5432, password sendiri —
# harus menyunting berkas ini lebih dulu, lalu hati-hati tidak ikut
# meng-commit passwordnya. Nama variabelnya sama dengan yang sudah dipakai
# tests/run.sh dan tests/dev_database.sh, jadi satu set export cukup untuk
# ketiganya:
#
#   PGPORT=5432 PGUSER=postgres PGPASSWORD=... python tests/dev_server.py
DSN = " ".join([
    f"host={os.environ.get('PGHOST', '127.0.0.1')}",
    f"port={os.environ.get('PGPORT', '55432')}",
    f"dbname={os.environ.get('PGDATABASE', 'hrcd_dev')}",
    f"user={os.environ.get('PGUSER', 'postgres')}",
    f"password={os.environ.get('PGPASSWORD', 'hrcd')}",
])
PORT = 8787

# ============================================================================
# GUDANG BERKAS TIRUAN — supaya FOTO bisa dibuka di laptop.
#
# Sampai 1 September 2026 tidak bisa: tautanFotoBanyak() mengembalikan peta
# kosong begitu modenya "dev", jadi tidak satu pun foto pernah mendapat URL
# dan SELURUH jalur gambar — menggeser, memutar, mengurutkan, menghapus —
# tidak pernah berjalan sekali pun di luar produksi. Dua kali dalam satu hari
# itu menghalangi perbaikan yang terpaksa dikirim tanpa pernah dilihat
# layarnya (CLAUDE.md 17.2).
#
# Yang dibutuhkan sederhana: tempat menaruh byte dan cara mengambilnya lagi.
# BUKAN di dalam repo — berkas uji tidak boleh mengotori pohon kerja — jadi di
# direktori sementara milik sistem. Isinya boleh hilang kapan saja: barisnya
# ada di database, dan yang kehilangan bytenya digantikan gambar contoh.
# ============================================================================
GUDANG = os.path.join(tempfile.gettempdir(), "hrcd-dev-storage")


def _jalur_gudang(path):
    """Path objek -> berkas di disk, dengan nama yang tidak bisa keluar dari
    GUDANG. Memakai nama aslinya apa adanya akan mengizinkan '../..'."""
    kunci = hashlib.sha256(path.encode()).hexdigest()
    return os.path.join(GUDANG, kunci)


def _png_contoh(path):
    """Gambar pengganti untuk objek yang barisnya ada tapi bytenya tidak —
    baris lama, atau database yang dibangun ulang sesudah gudangnya terhapus.

    Bukan kotak kosong: warnanya diturunkan dari path, jadi dua foto berbeda
    TERLIHAT berbeda dan urutannya bisa diperiksa dengan mata. Ada pita gelap
    di seperempat atas supaya PUTARAN 90/180/270 ikut terlihat — gambar
    simetris tidak bisa membuktikan apa pun soal putaran.

    Tegak 3:4, sama seperti slip yang difoto panitia.

    Byte-nya ditulis sebagai ANGKA, bukan escape: berkas ini pernah rusak
    karena satu "backslash-x-nol-nol" berubah jadi byte nol sungguhan saat
    disunting lewat perkakas, dan Python menolak berkas yang memuatnya dengan
    galat yang tidak menyebut barisnya."""
    w, h = 240, 320
    n = int(hashlib.sha256(path.encode()).hexdigest()[:6], 16)
    warna = bytes((120 + n % 100, 120 + (n >> 8) % 100, 120 + (n >> 16) % 100))
    gelap = bytes((40, 40, 40))
    saring = bytes((0,))          # filter "None" di awal tiap baris PNG
    baris = [saring + (gelap if y < h // 4 else warna) * w for y in range(h)]
    mentah = b"".join(baris)

    def bagian(tipe, data):
        c = tipe + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    tanda = bytes((137, 80, 78, 71, 13, 10, 26, 10))
    return (tanda
            + bagian(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + bagian(b"IDAT", zlib.compress(mentah))
            + bagian(b"IEND", b""))


# Argumen yang bertipe text[] di Postgres, bukan jsonb. Dipisah karena
# keduanya sampai ke sini sebagai list JSON yang sama persis.
# Argumen yang tujuannya ARRAY Postgres — apa pun jenis elemennya. Namanya
# dulu ARRAY_TEKS dan isinya hanya "p_anggota", jadi `p_kloter` (smallint[])
# ikut di-json.dumps dan Postgres menolaknya dengan "malformed array literal"
# — persis kerusakan yang komentar di bawah sudah menjelaskan, cuma daftarnya
# yang kurang satu. Akibatnya "Simpan waktu cetak" di layar Daftar Kloter
# TIDAK PERNAH berhasil di laptop, dan tidak ada yang tahu karena jawabannya
# cuma muncul sebagai notifikasi merah yang lewat.
ARRAY_PG = {"p_anggota", "p_kloter"}

# Cast eksplisit per nama argumen. Postgres TIDAK meng-coerce literal
# bertipe bebas menjadi smallint/uuid/timestamptz saat memilih overload
# fungsi, jadi tanpa cast panggilannya gagal dengan "function ... does not
# exist" — kalimat yang terbaca seperti migrasi yang belum jalan, padahal
# fungsinya ada.
#
# Daftar ini pernah tertinggal DUA KALI dalam satu hari: `p_kloter` membuat
# "Simpan waktu cetak" tidak pernah berhasil di laptop, dan `p_putaran`
# membuat tombol putar foto diam-diam mengembalikan sudutnya. Karena itu
# sekarang ada _periksa_cast() di bawah, yang membandingkan daftar ini dengan
# tanda tangan fungsi yang SUNGGUHAN ada di database setiap kali server
# dinyalakan.
CAST_ARG = {
    "p_baris": "::jsonb", "p_nomor": "::jsonb", "p_pos": "::smallint",
    "p_menit": "::smallint", "p_kloter": "::smallint",
    "p_anggota_hadir": "::smallint", "p_jumlah": "::smallint",
    "p_regu": "::uuid", "p_jam": "::timestamptz",
    "p_jam_datang": "::timestamptz", "p_id": "::uuid",
    "p_putaran": "::smallint", "p_sekolah": "::uuid", "p_foto_id": "::uuid",
    "p_regu_id": "::uuid", "p_anggota": "::text[]",
}

# RPC yang boleh dipanggil layar, beserta urutan argumennya.
RPC = {
    "verifikasi_pembayaran": ["p_kode", "p_nominal", "p_metode"],
    "batalkan_verifikasi":   ["p_kode", "p_alasan"],
    "daftar_ulang_batch":    ["p_kode", "p_nomor"],
    "tukar_nomor_dada":      ["p_regu", "p_nomor_baru", "p_alasan"],
    "ubah_pendamping":       ["p_kode", "p_jumlah"],
    "konfirmasi_kontrak":    ["p_regu", "p_menit"],
    "berangkatkan_kloter":   ["p_kloter", "p_jam"],
    "ceklis_berangkat":      ["p_nomor_dada"],
    "batal_ceklis_berangkat":["p_nomor_dada"],
    "koreksi_jam_berangkat": ["p_kloter", "p_jam", "p_alasan"],
    "minta_segarkan_live_score": [],
    "set_centang_sprint":    ["p_kode", "p_selesai"],
    "putar_foto_lembar":     ["p_id", "p_putaran"],
    "simpan_nilai_massal":   ["p_baris", "p_sumber", "p_pos"],
    "hapus_nilai_pos":       ["p_nomor_dada", "p_kode", "p_pos"],
    "kunci_nilai_pos":       ["p_nomor_dada", "p_pos", "p_lomba"],
    "buka_kunci_nilai_pos":  ["p_nomor_dada", "p_pos", "p_lomba", "p_alasan"],
    "catat_closing":         ["p_nomor_dada", "p_jam_datang", "p_anggota_hadir", "p_catatan"],
    "ubah_kontak_pendaftaran": ["p_kode", "p_nama_kontak", "p_kontak_wa"],
    "ubah_identitas_regu":   ["p_regu_id", "p_nama_regu", "p_nama_ketua",
                              "p_anggota", "p_kelas_organisasi"],
    "atur_fase_live":        ["p_fase"],
    "atur_planning_berangkat": ["p_pertama", "p_terakhir"],
    "susun_barak":           [],
    "tandai_kloter_dicetak": ["p_kloter"],
    "pindah_kloter":         ["p_nomor_dada", "p_alasan", "p_kloter"],
    "batalkan_tanda_cetak":  ["p_kloter", "p_alasan"],
    # Foto jawaban (0074). Gambarnya sendiri TIDAK lewat sini — dev server
    # tidak punya Storage — tapi barisnya tetap dicatat supaya alur layarnya
    # bisa dicoba tanpa Supabase.
    "catat_foto_lembar":     ["p_nomor_dada", "p_pos", "p_kode_lomba", "p_nama_lomba", "p_path", "p_ukuran"],
    "hapus_foto_lembar":     ["p_id", "p_alasan"],
    "catat_foto_masuk":      ["p_pos", "p_kode_lomba", "p_nama_lomba", "p_path", "p_ukuran"],
    "tautkan_foto":          ["p_foto_id", "p_nomor_dada", "p_cara"],
    "simpan_kejuaraan_manual": ["p_kode", "p_regu"],
    "simpan_kejuaraan_terjauh": ["p_sekolah"],
}
# RPC yang hasilnya tabel (bukan skalar/jsonb).
RPC_TABEL = {"daftar_ulang_batch"}


def q(sql, args=(), uid=None, role="authenticated", fetch="all"):
    with psycopg2.connect(DSN) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("set local app.uid = %s", (uid or "",))
            cur.execute(f"set local role {role}")
            cur.execute(sql, args)
            if fetch == "all":
                return cur.fetchall()
            if fetch == "one":
                return cur.fetchone()
            return None


class Handler(http.server.BaseHTTPRequestHandler):
    def _kirim(self, status, isi):
        raw = json.dumps(isi, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self._kirim(204, {})

    def do_DELETE(self):
        """Hapus objek gudang. Berkas yang memang tidak ada bukan kegagalan —
        yang diminta pemanggil adalah keadaan 'tidak ada lagi', dan itu sudah
        tercapai."""
        u = urllib.parse.urlparse(self.path)
        if not u.path.startswith("/storage/"):
            return self._kirim(404, {"message": "tidak ada"})
        path = urllib.parse.unquote(u.path[len("/storage/"):])
        try:
            os.remove(_jalur_gudang(path))
        except FileNotFoundError:
            pass
        return self._kirim(200, {"path": path})

    def _badan(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def _kirim_gambar(self, isi, tipe="image/png"):
        self.send_response(200)
        self.send_header("Content-Type", tipe)
        self.send_header("Content-Length", str(len(isi)))
        self.send_header("Access-Control-Allow-Origin", "*")
        # Tanpa ini browser memakai salinan lamanya sesudah foto diputar atau
        # diganti, dan yang tergambar bukan yang baru saja disimpan.
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(isi)

    # ------------------------------------------------------------------ GET
    def do_GET(self):
        # Berkas gudang dilayani SEBELUM rute JSON: ia bukan API, dan
        # jawabannya bukan JSON.
        if self.path.startswith("/storage/"):
            path = urllib.parse.unquote(self.path[len("/storage/"):].split("?")[0])
            berkas = _jalur_gudang(path)
            if os.path.exists(berkas):
                with open(berkas, "rb") as f:
                    return self._kirim_gambar(f.read(), "image/jpeg")
            # Barisnya ada tapi bytenya tidak. Gambar contoh, bukan 404: yang
            # sedang diuji tata letak dan alurnya, dan kotak rusak menghentikan
            # keduanya lebih awal daripada yang perlu.
            return self._kirim_gambar(_png_contoh(path))
        u = urllib.parse.urlparse(self.path)
        p = dict(urllib.parse.parse_qsl(u.query))
        try:
            if u.path == "/sekolah":
                self._kirim(200, q(
                    "select id, name, address from sekolah order by name",
                    role="anon"))
            elif u.path == "/centang-sprint":
                # Papan sprint Buku Sakti (migrasi 0170). Layarnya sengaja
                # tetap terbuka walau ini gagal, jadi yang penting di sini
                # cuma bentuk jawabannya sama dengan v_centang_sprint di
                # produksi: kode, dicentang_pada, dicentang_oleh.
                # uid WAJIB diteruskan: v_centang_sprint security_invoker, dan
                # RLS-nya menuntut peran() — tanpa uid yang kembali daftar
                # KOSONG, bukan galat, dan papan sprint tergambar seolah belum
                # ada satu tugas pun yang selesai.
                self._kirim(200, q(
                    "select kode, dicentang_pada, dicentang_oleh "
                    "from v_centang_sprint order by kode", uid=p.get("uid")))
            elif u.path == "/edisi":
                self._kirim(200, q(
                    "select * from v_edisi_publik", role="anon", fetch="one"))
            elif u.path == "/pengaturan-kloter":
                self._kirim(200, q(
                    "select e.jam_mulai_berangkat, e.jam_batas_berangkat, "
                    "e.maks_eksternal_per_kloter, e.maks_intern_per_kloter, "
                    "e.perkiraan_regu_eksternal, e.perkiraan_regu_intern, e.kloter_maks, "
                    "s.planning_berangkat_pertama, s.planning_berangkat_terakhir, "
                    # `%%`, bukan `%`: q() selalu memanggil cur.execute(sql, args),
                    # dan psycopg2 memperlakukan `%` sebagai penanda parameter apa pun
                    # isi args-nya. Ditulis `%` polos, rute ini melempar
                    # "IndexError: tuple index out of range" dan layar yang
                    # memanggilnya mati di dev — tanpa gejala di produksi, karena
                    # di sana PostgREST yang menjawab.
                    "(select count(*) from regu where not is_cancelled and golongan not like 'intern_%%') as jumlah_eksternal, "
                    "(select count(*) from regu where not is_cancelled and golongan like 'intern_%%') as jumlah_intern "
                    "from edisi e, status_acara s where e.is_active and s.id",
                    uid=p.get("uid"), fetch="one"))
            elif u.path == "/penalti":
                self._kirim(200, q(
                    "select * from konfig_penalti where edisi = edisi_aktif()",
                    uid=p.get("uid"), fetch="one"))
            elif u.path == "/regu":
                self._kirim(200, q(
                    "select * from v_regu_ringkas where nomor_dada = %s",
                    (p.get("dada") or 0,), uid=p.get("uid")))
            elif u.path == "/sisipan":
                self._kirim(200, q(
                    "select * from v_sisipan_kloter", uid=p.get("uid")))
            elif u.path == "/keberangkatan":
                self._kirim(200, q(
                    "select * from v_keberangkatan order by nomor",
                    uid=p.get("uid")))
            elif u.path == "/regu-kloter":
                self._kirim(200, q(
                    "select * from v_regu_ringkas where kloter = %s order by nomor_dada",
                    (p.get("kloter") or 0,), uid=p.get("uid")))
            elif u.path == "/kontrak":
                # sort_order, bukan urutan — kolomnya berganti nama di 0014.
                self._kirim(200, q(
                    "select label, menit from kontrak_opsi "
                    "where edisi = edisi_aktif() order by sort_order",
                    uid=p.get("uid")))
            elif u.path == "/status":
                self._kirim(200, q(
                    "select * from status_acara", uid=p.get("uid"), fetch="one"))
            elif u.path == "/foto-lembar-pos":
                self._kirim(200, q(
                    "select nomor_dada, kode_lomba from v_foto_lembar "
                    "where pos = %s",
                    (p.get("pos") or 0,), uid=p.get("uid")))
            elif u.path == "/foto-lembar":
                # Foto satu regu di satu pos, yang pertama diunggah lebih
                # dulu (halaman 1 sebelum halaman 2) — dipakai dialog
                # Foto Jawaban di lembar pos dan layar Cek Nilai. Rute ini
                # sempat TIDAK ADA di sini sementara web/js/api.js sudah
                # memanggilnya, jadi kedua layar itu tidak bisa dibuka di
                # laptop sama sekali (CLAUDE.md 17.6).
                self._kirim(200, q(
                    "select * from v_foto_lembar "
                    "where pos = %s and nomor_dada = %s "
                    "order by diunggah_pada asc",
                    (p.get("pos") or 0, p.get("dada") or 0), uid=p.get("uid")))
            elif u.path == "/foto-belum-taut":
                # nomor_dada NULL = foto borongan yang belum ditautkan (0074).
                self._kirim(200, q(
                    "select * from v_foto_lembar "
                    "where pos = %s and kode_lomba = %s and nomor_dada is null "
                    "order by diunggah_pada",
                    (p.get("pos") or 0, p.get("lomba") or ""), uid=p.get("uid")))
            elif u.path == "/kuota-foto":
                self._kirim(200, q(
                    "select * from v_kuota_foto", uid=p.get("uid"), fetch="one"))
            elif u.path == "/pos":
                self._kirim(200, q(
                    "select * from v_pos order by nomor", uid=p.get("uid")))
            elif u.path == "/komponen-pos":
                self._kirim(200, q(
                    "select kode, name, type, form, poin_maks, raw_terbaik, "
                    "       raw_terburuk, poin_benar, poin_salah, total_soal, "
                    "       tingkat, satuan, golongan, petunjuk, judul_isian, "
                    # `lomba` (0054) sempat TIDAK ada di sini padahal
                    # web/js/api.js memilihnya. Akibatnya di mode dev
                    # kelompokLomba() menerima undefined di tiap baris: Pos 3
                    # tampil tujuh lomba bukan tiga, dan blangko mencetak tujuh
                    # lembar bukan tiga — persis yang dilarang CLAUDE.md 11.6.
                    # Setiap uji lokal atas pengelompokan lomba menguji dunia
                    # yang salah, dan hasilnya terlihat masuk akal.
                    "       lomba, kode_lomba, "
                    "       rentang_mentah_min, "
                    "       rentang_mentah_maks, sort_order "
                    "from wahana where edisi = edisi_aktif() and pos = %s "
                    "order by sort_order",
                    (p.get("pos") or 0,), uid=p.get("uid")))
            elif u.path == "/komponen-semua":
                # Seluruh kolom penilaian semua pos — pembangun tabel
                # Rekapitulasi (#/rekap).
                self._kirim(200, q(
                    "select pos, kode, name, type, form, poin_maks, satuan, "
                    "       golongan, petunjuk, judul_isian, lomba, kode_lomba, "
                    "       total_soal, rentang_mentah_min, "
                    "       rentang_mentah_maks, sort_order "
                    "from wahana where edisi = edisi_aktif() "
                    "order by pos, sort_order", uid=p.get("uid")))
            elif u.path == "/riwayat-nilai":
                self._kirim(200, q(
                    "select * from v_riwayat_nilai where pos = %s "
                    "and nomor_dada = %s order by changed_at desc",
                    (p.get("pos") or 0, p.get("dada") or 0), uid=p.get("uid")))
            elif u.path == "/riwayat-pendaftaran":
                self._kirim(200, q(
                    "select * from v_riwayat_pendaftaran "
                    "where kode_pembayaran = %s order by changed_at desc, id desc",
                    (p.get("kode") or "",), uid=p.get("uid")))
            elif u.path == "/rentang-nomor-dada":
                self._kirim(200, q(
                    "select * from v_rentang_nomor_dada",
                    uid=p.get("uid")))
            elif u.path == "/kelengkapan-pos":
                self._kirim(200, q(
                    "select * from v_kelengkapan_pos order by pos",
                    uid=p.get("uid")))
            elif u.path == "/akun":
                self._kirim(200, q(
                    "select user_id::text, username, peran, pos, is_active "
                    "from akun_panitia order by username",
                    uid=p.get("uid")))
            elif u.path == "/fitur":
                self._kirim(200, q(
                    "select kode, nama, urutan from fitur order by urutan",
                    uid=p.get("uid")))
            elif u.path == "/hak-saya":
                self._kirim(200, q(
                    "select fitur from akun_hak where user_id = %s::uuid",
                    (p.get("uid"),), role="service_role"))
            elif u.path == "/akun-saya":
                self._kirim(200, q(
                    "select username, peran, pos, is_active from akun_panitia "
                    "where user_id = %s::uuid",
                    (p.get("uid"),), role="service_role", fetch="one"))
            elif u.path == "/hak":
                self._kirim(200, q(
                    "select user_id::text, fitur from akun_hak", uid=p.get("uid")))
            elif u.path == "/klasemen-live-score":
                # Layar Live Score tidak pernah bisa dicoba di dev sebelum
                # ini — rutenya memang tidak ada, dan layarnya menjawab
                # "akun tidak berhak" yang terbaca seperti masalah izin.
                self._kirim(200, q(
                    "select * from v_klasemen_live_score"
                    " order by golongan, peringkat",
                    uid=p.get("uid")))
            elif u.path == "/kejuaraan":
                self._kirim(200, q(
                    "select * from v_kejuaraan order by urutan",
                    uid=p.get("uid")))
            elif u.path == "/rekap-penuh":
                self._kirim(200, q(
                    "select * from v_rekap_penuh order by nomor_dada",
                    uid=p.get("uid")))
            elif u.path == "/lembar-pos":
                # dada opsional: kosong = seluruh lembar, isi = satu baris
                # yang dibaca ulang sesudah menyimpan.
                self._kirim(200, q(
                    "select * from v_lembar_pos where pos = %s "
                    "  and (%s::text = '' "
                    "       or nomor_dada = nullif(%s::text, '')::integer) "
                    "order by nomor_dada",
                    (p.get("pos") or 0, p.get("dada") or "", p.get("dada") or ""),
                    uid=p.get("uid")))
            elif u.path == "/data-peserta":
                # Bahan layar Data Peserta. Kolomnya BEDA dari
                # /daftar-pendaftaran: yang di sini nama anggota dan
                # kelas/organisasi, bukan tagihan dan kwitansi.
                self._kirim(200, q("""
                    select d.id, d.kode_pembayaran, d.status, d.jumlah_regu,
                           d.kontak_wa, d.nama_kontak, d.created_at,
                           jsonb_build_object('name', s.name) as sekolah,
                           coalesce((select jsonb_agg(jsonb_build_object(
                                       'id', r.id, 'nama_regu', r.nama_regu,
                                       'nama_ketua', r.nama_ketua,
                                       'golongan', r.golongan,
                                       'anggota', r.anggota,
                                       'kelas_organisasi', r.kelas_organisasi,
                                       'nomor_dada', r.nomor_dada,
                                       'is_cancelled', r.is_cancelled)
                                     order by r.nama_regu)
                             from regu r where r.pendaftaran_id = d.id),
                            '[]'::jsonb) as regu
                    from pendaftaran d join sekolah s on s.id = d.sekolah_id
                    order by d.created_at
                """, uid=p.get("uid")))

            elif u.path == "/daftar-pendaftaran":
                self._kirim(200, q("""
                    select d.id, d.kode_pembayaran, d.status, d.jumlah_regu,
                           d.jumlah_menginap, d.butuh_barak, d.kontak_wa, d.nama_kontak,
                           d.created_at, d.metode_bayar, d.bukti_transfer,
                           jsonb_build_object('name', s.name, 'address', s.address) as sekolah,
                           (select jsonb_agg(jsonb_build_object(
                              'id', r.id, 'nama_regu', r.nama_regu,
                              'nama_ketua', r.nama_ketua, 'golongan', r.golongan,
                              'nomor_dada', r.nomor_dada, 'kloter_nomor', r.kloter_nomor,
                              'is_cancelled', r.is_cancelled)
                              order by r.nama_regu)
                            from regu r where r.pendaftaran_id = d.id) as regu,
                           (select jsonb_build_object(
                              'amount', b.amount, 'method', b.method,
                              'nomor_kwitansi', b.nomor_kwitansi,
                              'verified_at', b.verified_at)
                            from pembayaran b where b.pendaftaran_id = d.id) as pembayaran
                    from pendaftaran d join sekolah s on s.id = d.sekolah_id
                    order by d.created_at
                    """, uid=p.get("uid")))
            elif u.path == "/kloter":
                self._kirim(200, q(
                    "select * from v_daftar_kloter", uid=p.get("uid")))
            elif u.path == "/ringkasan":
                self._kirim(200, q("""
                    select
                      (select count(*) from pendaftaran
                       where status = 'menunggu_pembayaran')::int as menunggu_pembayaran,
                      (select count(distinct d.id) from pendaftaran d
                       join regu r on r.pendaftaran_id = d.id
                       where d.status = 'lunas' and r.nomor_dada is null
                         and not r.is_cancelled)::int as lunas_belum_nomor,
                      (select count(*) from regu
                       where nomor_dada is not null and not is_cancelled)::int
                        as regu_siap,
                      (select count(*) from keberangkatan_regu)::int
                        as regu_berangkat,
                      (select count(*) from closing_regu)::int as regu_datang
                    """, uid=p.get("uid"), fetch="one"))
            else:
                self._kirim(404, {"message": "tidak ada"})
        except psycopg2.Error as e:
            self._kirim(400, {"message": (e.diag.message_primary or str(e)).strip()})

    # ----------------------------------------------------------------- POST
    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        # Unggahan gudang: bytenya mentah, bukan JSON, jadi ia ditangani
        # sebelum _badan() dipanggil.
        if u.path.startswith("/storage/"):
            path = urllib.parse.unquote(u.path[len("/storage/"):])
            n = int(self.headers.get("Content-Length") or 0)
            os.makedirs(GUDANG, exist_ok=True)
            with open(_jalur_gudang(path), "wb") as f:
                f.write(self.rfile.read(n))
            return self._kirim(200, {"path": path, "ukuran": n})
        try:
            if u.path == "/login":
                b = self._badan()
                # Hak ikut dibawa, sama seperti jalur Supabase — kalau tidak,
                # papan Home di dev memilih ubin dengan daftar kosong dan
                # tampak seolah semua peran kehilangan aksesnya.
                akun = q(
                    "select a.user_id::text as uid, a.username, a.peran, a.pos,"
                    "       coalesce(array_agg(h.fitur) filter (where h.fitur is not null),"
                    "                '{}') as hak "
                    "from akun_panitia a left join akun_hak h on h.user_id = a.user_id "
                    "where kunci_akun(a.username) = kunci_akun(%s) and a.is_active "
                    "group by a.user_id, a.username, a.peran, a.pos",
                    (b.get("username", ""),), role="service_role", fetch="one")
                # Dev server: password apa pun diterima — auth sungguhan milik
                # Supabase; yang diuji di sini adalah alur & RLS.
                if akun is None or not b.get("password"):
                    self._kirim(400, {"message": "Nama akun atau password salah."})
                else:
                    self._kirim(200, akun)

            elif u.path == "/daftar":
                # Tiruan gerbang Worker: jalan sebagai service_role.
                b = self._badan()
                hasil = q(
                    "select submit_pendaftaran(%s, %s, %s, %s, %s::jsonb, "
                    "%s::smallint, %s::uuid, %s, %s, %s) as h",
                    (b.get("nama_sekolah"), b.get("alamat_sekolah"),
                     bool(b.get("butuh_barak")), b.get("kontak_wa"),
                     json.dumps(b.get("regu") or []),
                     int(b.get("jumlah_pendamping") or 0),
                     b.get("kunci_kirim"), b.get("nama_kontak"),
                     b.get("metode_bayar"), b.get("bukti_transfer")),
                    role="service_role", fetch="one")
                self._kirim(200, hasil["h"])

            elif u.path == "/akun/ubah":
                b = self._badan()
                sets, args = [], []
                for k in ("peran", "pos", "is_active"):
                    if k in b:
                        sets.append(f"{k} = %s")
                        args.append(b[k])
                if not sets:
                    self._kirim(400, {"message": "tidak ada yang diubah"})
                    return
                args.append(b.get("user_id"))
                q(f"update akun_panitia set {', '.join(sets)} where user_id = %s::uuid",
                  tuple(args), uid=b.get("uid"), fetch=None)
                self._kirim(200, {"ok": True})

            elif u.path == "/akun/buat":
                # Dev tidak punya auth sungguhan: user_id digenerate di sini,
                # dan passwordnya palsu — yang diuji alur layarnya, bukan
                # GoTrue. Di produksi ini pekerjaan Worker gateway.
                b = self._badan()
                hasil = []
                for a in b.get("akun") or []:
                    nama = (a.get("username") or "").strip().lower()
                    peran = (a.get("peran") or "").strip()
                    pos = a.get("pos") or None
                    try:
                        baris = q(
                            "with u as ("
                            "  insert into auth.users (id, email)"
                            "  values (gen_random_uuid(), %s || '@uji.local') returning id)"
                            " insert into akun_panitia (user_id, username, peran, pos)"
                            " select id, %s, %s, %s from u returning user_id::text",
                            (nama, nama, peran, pos),
                            role="service_role", fetch="one")
                        q("insert into akun_hak (user_id, fitur)"
                          " select %s::uuid, f from unnest(paket_peran(%s)) f"
                          " on conflict do nothing",
                          (baris["user_id"], peran), role="service_role", fetch=None)
                        hasil.append({"username": nama, "ok": True, "peran": peran,
                                      "pos": pos, "password": "dev-tanpa-password"})
                    except Exception as e:  # noqa: BLE001 — pesannya untuk layar
                        hasil.append({"username": nama, "ok": False,
                                      "pesan": str(e).strip().splitlines()[0]})
                self._kirim(200, {"hasil": hasil})

            elif u.path == "/akun/password":
                self._kirim(200, {"password": "dev-tanpa-password"})

            elif u.path == "/akun/username":
                b = self._badan()
                q("update akun_panitia set username = %s where user_id = %s::uuid",
                  (b.get("username"), b.get("user_id")), role="service_role", fetch=None)
                self._kirim(200, {"username": b.get("username")})

            elif u.path == "/hak/set":
                b = self._badan()
                if b.get("boleh"):
                    q("insert into akun_hak (user_id, fitur) values (%s::uuid, %s)"
                      " on conflict do nothing",
                      (b.get("user_id"), b.get("fitur")), uid=b.get("uid"), fetch=None)
                else:
                    q("delete from akun_hak where user_id = %s::uuid and fitur = %s",
                      (b.get("user_id"), b.get("fitur")), uid=b.get("uid"), fetch=None)
                self._kirim(200, {"ok": True})

            elif u.path.startswith("/rpc/"):
                nama = u.path.split("/rpc/", 1)[1]
                if nama not in RPC:
                    self._kirim(404, {"message": f"rpc {nama} tidak dikenal"})
                    return
                b = self._badan()
                args = b.get("args") or {}
                urutan = RPC[nama]
                nilai = []
                for k in urutan:
                    v = args.get(k)
                    # Daftar yang tujuannya array Postgres diteruskan sebagai
                    # LIST Python — psycopg2 mengubahnya jadi array Postgres.
                    # Kalau ikut di-json.dumps seperti jsonb, yang sampai ke
                    # fungsi teks '["a","b"]' dan Postgres menolaknya dengan
                    # "malformed array literal". PostgREST di produksi memang
                    # sudah memetakannya sendiri; yang perlu diajari cuma
                    # tiruan ini.
                    if isinstance(v, list) and k in ARRAY_PG:
                        pass
                    elif isinstance(v, (dict, list)):
                        v = json.dumps(v)
                    nilai.append(v)
                # Postgres tidak meng-coerce integer->smallint saat memilih
                # overload fungsi — cast eksplisit per jenis argumen.
                CAST = dict(CAST_ARG)
                if nama == "tandai_kloter_dicetak":
                    CAST = {**CAST, "p_kloter": "::smallint[]"}
                tanda = ", ".join("%s" + CAST.get(k, "") for k in urutan)
                if nama in RPC_TABEL:
                    sql = f"select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as h from {nama}({tanda}) t"
                else:
                    sql = f"select to_jsonb({nama}({tanda})) as h"
                hasil = q(sql, tuple(nilai), uid=b.get("uid"), fetch="one")
                self._kirim(200, hasil["h"])
            else:
                self._kirim(404, {"message": "tidak ada"})
        except psycopg2.Error as e:
            self._kirim(400, {"message": (e.diag.message_primary or str(e)).strip()})
        except Exception as e:  # jangan pernah mati diam-diam
            self._kirim(500, {"message": str(e)})

    def log_message(self, fmt, *args):
        print(f"[dev] {self.address_string()} {fmt % args}")


def _periksa_cast():
    """Bandingkan CAST_ARG dengan tanda tangan fungsi yang SUNGGUHAN ada di
    database, lalu berteriak kalau ada yang tertinggal.

    Ini ada karena dua kerusakan yang bentuknya sama persis dan dua-duanya
    diam: satu argumen smallint atau uuid tanpa cast membuat Postgres tidak
    menemukan overload-nya, dan pesannya berbunyi "function ... does not
    exist" — kalimat yang mengarahkan pembacanya ke migrasi, bukan ke berkas
    ini. Yang satu membuat "Simpan waktu cetak" tidak pernah berhasil, yang
    satu lagi membuat tombol putar foto mengembalikan sudutnya sendiri.

    TIDAK mematikan server. Yang dicetak peringatan, karena database yang
    belum lengkap migrasinya juga akan memicunya, dan menolak menyala di situ
    menghalangi satu-satunya alat untuk membetulkannya."""
    perlu = ("smallint", "uuid", "timestamp", "date", "interval", "jsonb", "[]")
    try:
        with psycopg2.connect(DSN) as conn, conn.cursor() as cur:
            cur.execute(r"""
                select p.proname, an.nama, at.tipe
                from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public',
                     lateral unnest(p.proargnames) with ordinality as an(nama, i),
                     lateral unnest(string_to_array(
                         pg_get_function_identity_arguments(p.oid), ', ')
                     ) with ordinality as at(tipe, j)
                where an.i = at.j and an.nama like 'p\_%'
            """)
            tipe = {}
            for fungsi, nama, tanda in cur.fetchall():
                tipe.setdefault(fungsi, {})[nama] = tanda
    except Exception as e:                       # noqa: BLE001
        print(f"  (cast tidak diperiksa: {e})", flush=True)
        return

    kurang = []
    for fungsi, args in RPC.items():
        for a in args:
            t = tipe.get(fungsi, {}).get(a)
            if t and any(k in t for k in perlu) and a not in CAST_ARG:
                kurang.append(f"{fungsi}({a} {t.split(' ', 1)[-1]})")
    if kurang:
        print("  PERINGATAN: argumen RPC tanpa cast di CAST_ARG:", flush=True)
        for k in sorted(kurang):
            print(f"    {k}", flush=True)
        print("  Panggilannya akan gagal dengan 'function ... does not exist'.",
              flush=True)
    else:
        print(f"  cast RPC lengkap ({len(RPC)} fungsi diperiksa)", flush=True)


if __name__ == "__main__":
    print(f"dev server hrcd-rekap -> http://127.0.0.1:{PORT}  (db hrcd_dev @ 55432)")
    print(f"  gudang berkas: {GUDANG}")
    _periksa_cast()
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
