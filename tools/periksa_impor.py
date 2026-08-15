r"""Pastikan setiap fungsi api.js yang DIPANGGIL app.js benar-benar diimpor.

KENAPA BERKAS INI ADA

Sebuah nama yang dipakai tanpa diimpor tidak menggagalkan apa pun sampai baris
itu benar-benar dijalankan. `node --check` lulus, CI hijau, halaman terbuka
normal — dan galatnya baru muncul saat petugas menekan tombolnya di lapangan.

Itu bukan kemungkinan teoretis: `kunciNilaiPos` dan `bukaKunciNilaiPos` pernah
lolos sampai produksi persis begitu. Suntingan yang menambahkan importnya ada
di skrip yang gagal di tengah jalan, jadi berkasnya tidak pernah ditulis,
sementara suntingan berikutnya menambahkan pemanggilnya dari arah lain. Yang
menemukannya akhirnya adalah mengetuk tombolnya di browser sungguhan.

Pemeriksa ini menutup celah itu di CI, di tempat yang tidak menuntut siapa pun
membuka layar.
"""
import re
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent


def periksa(app_path: Path, api_path: Path) -> list[str]:
    app = app_path.read_text(encoding="utf-8")
    api = api_path.read_text(encoding="utf-8")

    ekspor = set(re.findall(
        r"export\s+(?:async\s+function|function|const)\s+(\w+)", api))
    m = re.search(r'import\s*\{([^}]*)\}\s*from\s*"\./api\.js"', app, re.S)
    if not m:
        raise SystemExit(f"{app_path}: pernyataan import api.js tidak ditemukan")
    diimpor = {x.strip() for x in m.group(1).replace("\n", " ").split(",") if x.strip()}

    # Hanya badan SESUDAH importnya — kalau tidak, daftar impor itu sendiri
    # terbaca sebagai pemakaian.
    badan = tanpa_komentar(app[m.end():])
    return sorted(
        n for n in ekspor
        # (?<![\w.]) supaya `obj.namaSama(...)` tidak terhitung.
        if re.search(r"(?<![\w.])" + n + r"\s*\(", badan) and n not in diimpor)


def tanpa_komentar(kode: str) -> str:
    """Buang komentar supaya nama yang cuma DISEBUT tidak terhitung dipanggil.

    Versi pertama pemeriksa ini melaporkan `pesanRamah` hilang, padahal ia
    hanya disebut di dalam satu komentar yang menjelaskan bahwa api.js sudah
    memanggilnya. Lapor palsu adalah cara tercepat membuat orang berhenti
    mempercayai pemeriksa, dan pemeriksa yang tidak dipercaya sama saja
    dengan tidak ada.

    Batasnya diakui: baris berisi "https://" di dalam string akan dianggap
    berkomentar mulai dari situ. Yang hilang karenanya paling jauh satu
    pemeriksaan — lapor KURANG, bukan lapor PALSU — dan itu arah kesalahan
    yang benar untuk alat seperti ini.
    """
    kode = re.sub(r"/\*.*?\*/", " ", kode, flags=re.S)
    baris = [b.split("//")[0] for b in kode.split(chr(10))]
    return chr(10).join(baris)


if __name__ == "__main__":
    kurang = periksa(AKAR / "web" / "js" / "app.js", AKAR / "web" / "js" / "api.js")
    if kurang:
        print("Dipanggil app.js tapi TIDAK diimpor dari api.js:")
        for n in kurang:
            print(f"  {n}")
        sys.exit(1)
    print("Semua fungsi api.js yang dipanggil app.js sudah diimpor.")
