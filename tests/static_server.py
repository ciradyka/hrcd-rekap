# ============================================================================
# hrcd-rekap : tests/static_server.py — server statis untuk web/ saat mengembang.
#
# Bukan sekadar `python -m http.server`: server itu mengizinkan browser
# menyimpan cache, dan selama pengujian kami sempat melihat style.css serta
# app.js versi LAMA disajikan sehingga perbaikan tidak terlihat sama sekali.
# Di sini semua respons dikirim dengan no-store, jadi apa yang tampil di layar
# selalu isi file yang barusan disimpan.
#
# (Untuk produksi, aturan setaranya ada di web/_headers — Cloudflare Pages.)
#
# Jalankan:
#   python tests/static_server.py          # http://127.0.0.1:8788
# ============================================================================

import functools
import http.server
import os

PORT = 8788
AKAR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web")


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass   # senyap: log yang berguna datang dari dev_server.py


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=os.path.normpath(AKAR))
    print(f"layar hrcd-rekap -> http://127.0.0.1:{PORT}  (tanpa cache)")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
