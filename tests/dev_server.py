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
# Siapkan db-nya sekali dengan: bash tests/dev_db.sh
# ============================================================================

import json
import http.server
import urllib.parse

import psycopg2
import psycopg2.extras

DSN = "host=127.0.0.1 port=55432 dbname=hrcd_dev user=postgres password=hrcd"
PORT = 8787

# RPC yang boleh dipanggil layar, beserta urutan argumennya.
RPC = {
    "verifikasi_pembayaran": ["p_kode", "p_nominal", "p_metode"],
    "batalkan_verifikasi":   ["p_kode", "p_alasan"],
    "daftar_ulang_batch":    ["p_kode"],
    "tukar_nomor_dada":      ["p_regu", "p_nomor_baru", "p_alasan"],
    "ubah_pendamping":       ["p_kode", "p_jumlah"],
    "konfirmasi_kontrak":    ["p_regu", "p_menit"],
    "berangkatkan_kloter":   ["p_kloter", "p_jam"],
    "ceklis_berangkat":      ["p_nomor_dada"],
    "batal_ceklis_berangkat":["p_nomor_dada"],
    "simpan_nilai_massal":   ["p_baris", "p_sumber", "p_pos"],
    "catat_closing":         ["p_nomor_dada", "p_jam_datang", "p_anggota_hadir", "p_catatan"],
    "susun_barak":           [],
    "tandai_kloter_dicetak": ["p_kloter"],
    "pindah_kloter":         ["p_nomor_dada", "p_alasan", "p_kloter"],
    "batalkan_tanda_cetak":  ["p_kloter", "p_alasan"],
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
                    "select id, nama, alamat from sekolah order by nama",
                    role="anon"))
            elif u.path == "/edisi":
                self._kirim(200, q(
                    "select * from v_edisi_publik", role="anon", fetch="one"))
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
                         and not r.batal)::int as lunas_belum_nomor
                    """, uid=p.get("uid"), fetch="one"))
            elif u.path == "/batch":
                b = q("""
                    select d.id, d.kode_pembayaran, d.status, d.jumlah_regu,
                           d.jumlah_pendamping, d.butuh_barak, d.kontak_wa,
                           jsonb_build_object('nama', s.nama, 'alamat', s.alamat) as sekolah,
                           (select jsonb_agg(jsonb_build_object(
                              'id', r.id, 'nama_regu', r.nama_regu,
                              'nama_ketua', r.nama_ketua, 'golongan', r.golongan,
                              'nomor_dada', r.nomor_dada, 'kloter_nomor', r.kloter_nomor,
                              'batal', r.batal)
                              order by r.nama_regu)
                            from regu r where r.pendaftaran_id = d.id) as regu,
                           (select jsonb_build_object(
                              'nominal', b.nominal, 'metode', b.metode,
                              'nomor_kwitansi', b.nomor_kwitansi,
                              'diverifikasi_pada', b.diverifikasi_pada)
                            from pembayaran b where b.pendaftaran_id = d.id) as pembayaran
                    from pendaftaran d join sekolah s on s.id = d.sekolah_id
                    where d.kode_pembayaran = %s
                    """, (p.get("kode", ""),), uid=p.get("uid"), fetch="one")
                if b is None:
                    self._kirim(404, {"message":
                        f"Kode {p.get('kode')} tidak ditemukan. Periksa lagi hurufnya."})
                else:
                    self._kirim(200, b)
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
                akun = q(
                    "select user_id::text as uid, username, peran, pos "
                    "from akun_panitia where username = %s and aktif",
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
                    "%s::smallint, %s::uuid) as h",
                    (b.get("nama_sekolah"), b.get("alamat_sekolah"),
                     bool(b.get("butuh_barak")), b.get("kontak_wa"),
                     json.dumps(b.get("regu") or []),
                     int(b.get("jumlah_pendamping") or 0),
                     b.get("kunci_kirim")),
                    role="service_role", fetch="one")
                self._kirim(200, hasil["h"])

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
                CAST = {"p_baris": "::jsonb", "p_pos": "::smallint",
                        "p_menit": "::smallint", "p_kloter": "::smallint",
                        "p_anggota_hadir": "::smallint", "p_jumlah": "::smallint",
                        "p_regu": "::uuid", "p_jam": "::timestamptz",
                        "p_jam_datang": "::timestamptz"}
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
