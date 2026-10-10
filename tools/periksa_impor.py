r"""Pastikan fungsi shared module yang DIPANGGIL benar-benar diimpor.

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


def periksa(app_path: Path, sumber_path: Path, modul: str) -> list[str]:
    app = app_path.read_text(encoding="utf-8")
    sumber = sumber_path.read_text(encoding="utf-8")

    ekspor = set(re.findall(
        r"export\s+(?:async\s+function|function|const)\s+(\w+)", sumber))
    m = re.search(
        r'import\s*\{([^}]*)\}\s*from\s*["\']' + re.escape(modul) + r'["\']',
        app, re.S)
    if not m:
        raise SystemExit(f"{app_path}: pernyataan import {modul} tidak ditemukan")
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


def periksa_web(akar_js: Path) -> list[tuple[str, str, str]]:
    """Setiap modul di web/js/ (termasuk common/ dan screens/) terhadap
    setiap modul lain di sana.

    Daftar pasangan tulisan tangan berhenti benar begitu app.js dipecah per
    layar: modul baru tidak diperiksa sampai seseorang ingat menambahkannya,
    dan yang lupa baru ketahuan saat tombolnya ditekan di lapangan. Jadi di
    sini pasangannya dicari sendiri.

    Yang dilaporkan: nama yang DIEKSPOR modul lain, DIPANGGIL di berkas ini,
    tetapi tidak diimpor dari mana pun dan tidak dideklarasikan di berkas ini
    sendiri."""
    berkas = sorted(x for x in akar_js.rglob("*") if x.suffix in (".js", ".mjs"))
    ekspor = {}
    for b in berkas:
        teks = b.read_text(encoding="utf-8")
        ekspor[b] = set(re.findall(
            r"export\s+(?:async\s+function|function|const|let)\s+(\w+)", teks))
    gagal = []
    for pemakai in berkas:
        teks = pemakai.read_text(encoding="utf-8")
        diimpor = set()
        for m in re.finditer(r"import\s*\{([^}]*)\}\s*from\s*[\"'][^\"']+[\"']", teks, re.S):
            for x in m.group(1).replace("\n", " ").split(","):
                x = x.strip()
                if x:
                    diimpor.add(x.split(" as ")[-1].strip())
        badan = tanpa_komentar(re.sub(
            r"import\s*\{[^}]*\}\s*from\s*[\"'][^\"']+[\"'];?", " ", teks, flags=re.S))
        for sumber in berkas:
            if sumber == pemakai:
                continue
            for n in sorted(ekspor[sumber]):
                if n in diimpor:
                    continue
                if not re.search(r"(?<![\w.])" + n + r"\s*\(", badan):
                    continue
                if re.search(r"(?:function\s+|(?:const|let|var)\s+)" + n + r"\b", badan):
                    continue
                gagal.append((str(pemakai.relative_to(AKAR)).replace("\\", "/"),
                              str(sumber.relative_to(AKAR)).replace("\\", "/"), n))
    return gagal


if __name__ == "__main__":
    # live/ masih didaftar per pasangan: berkasnya sedikit dan jarang berganti.
    pasangan = [
        ("live/js/daftar.js", "live/js/api.js", "./api.js"),
        ("live/js/daftar.js", "live/js/util.js", "./util.js"),
        ("live/js/daftar.js", "live/js/school-search.mjs", "./school-search.mjs"),
        ("live/live.js", "live/js/util.js", "./js/util.js"),
    ]
    gagal = []
    for pemakai, sumber, modul in pasangan:
        for nama in periksa(AKAR / pemakai, AKAR / sumber, modul):
            gagal.append((pemakai, modul, nama))
    gagal += periksa_web(AKAR / "web" / "js")
    if gagal:
        print("Dipanggil tetapi TIDAK diimpor dari shared module:")
        for pemakai, modul, nama in gagal:
            print(f"  {pemakai}: {nama} dari {modul}")
        sys.exit(1)
    print("Semua fungsi shared module yang dipanggil sudah diimpor.")
