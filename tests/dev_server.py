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

import json
import http.server
import os
import urllib.parse

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
    "simpan_nilai_massal":   ["p_baris", "p_sumber", "p_pos"],
    "hapus_nilai_pos":       ["p_nomor_dada", "p_kode", "p_pos"],
    "kunci_nilai_pos":       ["p_nomor_dada", "p_pos"],
    "buka_kunci_nilai_pos":  ["p_nomor_dada", "p_pos", "p_alasan"],
    "catat_closing":         ["p_nomor_dada", "p_jam_datang", "p_anggota_hadir", "p_catatan"],
    "atur_fase_live":        ["p_fase"],
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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self._kirim(204, {})

    def _badan(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    # ------------------------------------------------------------------ GET
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        p = dict(urllib.parse.parse_qsl(u.query))
        try:
            if u.path == "/sekolah":
                self._kirim(200, q(
                    "select id, name, address from sekolah order by name",
                    role="anon"))
            elif u.path == "/edisi":
                self._kirim(200, q(
                    "select * from v_edisi_publik", role="anon", fetch="one"))
            elif u.path == "/pengaturan-kloter":
                self._kirim(200, q(
                    "select e.jam_mulai_berangkat, e.jam_batas_berangkat, "
                    "e.maks_eksternal_per_kloter, e.maks_intern_per_kloter, "
                    "e.perkiraan_regu_eksternal, e.perkiraan_regu_intern, e.kloter_maks, "
                    # `%%`, bukan `%`: q() selalu memanggil cur.execute(sql, args),
                    # dan psycopg2 memperlakukan `%` sebagai penanda parameter apa pun
                    # isi args-nya. Ditulis `%` polos, rute ini melempar
                    # "IndexError: tuple index out of range" dan layar yang
                    # memanggilnya mati di dev — tanpa gejala di produksi, karena
                    # di sana PostgREST yang menjawab.
                    "(select count(*) from regu where not is_cancelled and golongan not like 'intern_%%') as jumlah_eksternal, "
                    "(select count(*) from regu where not is_cancelled and golongan like 'intern_%%') as jumlah_intern "
                    "from edisi e where e.is_active",
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
            elif u.path == "/batas-nomor-dada":
                self._kirim(200, q(
                    "select nomor from nomor_dada_stok order by nomor desc limit 1",
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
            elif u.path == "/daftar-pendaftaran":
                self._kirim(200, q("""
                    select d.id, d.kode_pembayaran, d.status, d.jumlah_regu,
                           d.jumlah_pendamping, d.butuh_barak, d.kontak_wa, d.nama_kontak,
                           d.created_at,
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
                    "%s::smallint, %s::uuid, %s) as h",
                    (b.get("nama_sekolah"), b.get("alamat_sekolah"),
                     bool(b.get("butuh_barak")), b.get("kontak_wa"),
                     json.dumps(b.get("regu") or []),
                     int(b.get("jumlah_pendamping") or 0),
                     b.get("kunci_kirim"), b.get("nama_kontak")),
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
                    if isinstance(v, (dict, list)):
                        v = json.dumps(v)
                    nilai.append(v)
                # Postgres tidak meng-coerce integer->smallint saat memilih
                # overload fungsi — cast eksplisit per jenis argumen.
                CAST = {"p_baris": "::jsonb", "p_nomor": "::jsonb", "p_pos": "::smallint",
                        "p_menit": "::smallint", "p_kloter": "::smallint",
                        "p_anggota_hadir": "::smallint", "p_jumlah": "::smallint",
                        "p_regu": "::uuid", "p_jam": "::timestamptz",
                        "p_jam_datang": "::timestamptz", "p_id": "::uuid"}
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


if __name__ == "__main__":
    print(f"dev server hrcd-rekap -> http://127.0.0.1:{PORT}  (db hrcd_dev @ 55432)")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
